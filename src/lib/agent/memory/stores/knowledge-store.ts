import { Pool } from 'pg';
import { getPostgresPool } from '../db-pools';
import { generateEmbedding } from '../embedding';

export interface KnowledgeEntry {
    id: string;
    workspaceId: string;
    category: string;
    key: string;
    title: string;
    content: string;
    metadata?: Record<string, any> | null;
    createdAt: string;
    updatedAt: string;
}

export interface KnowledgeWrite {
    workspaceId: string;
    category: string;
    key: string;
    title: string;
    content: string;
    metadata?: Record<string, any> | null;
}

export interface KnowledgeSearchParams {
    workspaceId: string;
    query: string;
    category?: string;
    limit?: number;
    embeddingsModel?: string;
}

export interface KnowledgeListParams {
    workspaceId: string;
    category?: string;
    limit?: number;
    offset?: number;
}

const KNOWLEDGE_KEYWORDS = new Set([
    'plano', 'planos', 'preco', 'precos', 'valor', 'valores', 'empresa',
    'servico', 'servicos', 'cobertura', 'internet', 'fibra', 'wifi',
    'instalacao', 'velocidade', 'mega', 'beneficio', 'beneficios',
    'contrato', 'pacote', 'mensalidade'
]);

const stripDiacritics = (text: string): string =>
    text.normalize('NFD').replace(/\p{M}/gu, '');

const buildKeywordSearchTerms = (query: string): string[] => {
    const cleaned = query
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .split(/\s+/)
        .filter(token => token.length > 2);

    if (cleaned.length === 0) return query.trim() ? [query.trim()] : [];

    const normalized = cleaned.map(token => stripDiacritics(token));
    const keywordHits = cleaned.filter((token, idx) => KNOWLEDGE_KEYWORDS.has(normalized[idx]));
    const selected = keywordHits.length ? keywordHits : cleaned;

    const unique = Array.from(new Set([...selected, ...selected.map(stripDiacritics)]));
    return unique.slice(0, 6);
};

export class KnowledgeStore {
    private hasCheckedSchema = false;
    private supportsVector = false;
    private pool: Pool;

    constructor(connectionString: string) {
        if (!connectionString) {
            throw new Error('KnowledgeStore requires a PostgreSQL connection string. Configure it in the Memory Node or Knowledge Node.');
        }
        this.pool = getPostgresPool(connectionString);
    }

    private async execute(text: string, params?: any[]): Promise<any> {
        return this.pool.query(text, params);
    }

    private async ensureSchema(): Promise<void> {
        if (this.hasCheckedSchema) return;

        // 1. Check for PGVector extension
        try {
            await this.execute(`CREATE EXTENSION IF NOT EXISTS vector`);
            this.supportsVector = true;
        } catch (e) {
            console.warn('[KnowledgeStore] PGVector not available. Semantic search will be disabled.');
            this.supportsVector = false;
        }

        // 2. Create table
        await this.execute(`
            CREATE TABLE IF NOT EXISTS agent_knowledge (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                workspace_id UUID NOT NULL,
                category TEXT NOT NULL,
                key TEXT NOT NULL,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                metadata JSONB,
                ${this.supportsVector ? 'embedding vector(1536),' : ''}
                ${this.supportsVector ? 'embedding_384 vector(384),' : ''}
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW(),
                UNIQUE (workspace_id, category, key)
            );
        `);

        // 3. Add embedding columns if they don't exist (migration)
        if (this.supportsVector) {
            try {
                await this.execute(`ALTER TABLE agent_knowledge ADD COLUMN IF NOT EXISTS embedding vector(1536)`);
            } catch (e) { /* ignore */ }
            try {
                await this.execute(`ALTER TABLE agent_knowledge ADD COLUMN IF NOT EXISTS embedding_384 vector(384)`);
            } catch (e) { /* ignore */ }
        }

        // 4. Create indexes
        await this.execute(`
            CREATE INDEX IF NOT EXISTS idx_agent_knowledge_workspace ON agent_knowledge (workspace_id);
            CREATE INDEX IF NOT EXISTS idx_agent_knowledge_category ON agent_knowledge (workspace_id, category);
            CREATE INDEX IF NOT EXISTS idx_agent_knowledge_key ON agent_knowledge (workspace_id, category, key);
            ${this.supportsVector ? `
                CREATE INDEX IF NOT EXISTS idx_agent_knowledge_embedding ON agent_knowledge USING ivfflat (embedding vector_cosine_ops);
                CREATE INDEX IF NOT EXISTS idx_agent_knowledge_embedding_384 ON agent_knowledge USING ivfflat (embedding_384 vector_cosine_ops);
            ` : ''}
        `);

        this.hasCheckedSchema = true;
    }

    /**
     * Create or update a knowledge entry
     */
    async put(entry: KnowledgeWrite, embeddingsModel?: string): Promise<KnowledgeEntry> {
        await this.ensureSchema();

        // Generate embedding if model is specified and content exists
        let embedding1536: string | null = null;
        let embedding384: string | null = null;

        if (this.supportsVector && embeddingsModel && entry.content) {
            try {
                const result = await generateEmbedding(entry.content, embeddingsModel);
                if (result) {
                    if (result.embedding.length === 1536) {
                        embedding1536 = JSON.stringify(result.embedding);
                    } else if (result.embedding.length === 384) {
                        embedding384 = JSON.stringify(result.embedding);
                    }
                }
            } catch (e) {
                console.warn('[KnowledgeStore] Failed to generate embedding:', e);
            }
        }

        const columns = [
            'workspace_id', 'category', 'key', 'title', 'content', 'metadata', 'updated_at'
        ];
        const values: any[] = [
            entry.workspaceId,
            entry.category,
            entry.key,
            entry.title,
            entry.content,
            entry.metadata ? JSON.stringify(entry.metadata) : null,
            new Date().toISOString()
        ];

        if (this.supportsVector) {
            columns.push('embedding', 'embedding_384');
            values.push(embedding1536, embedding384);
        }

        const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
        const updateSet = columns
            .filter(c => c !== 'workspace_id' && c !== 'category' && c !== 'key')
            .map(c => `${c} = EXCLUDED.${c}`)
            .join(', ');

        const query = `
            INSERT INTO agent_knowledge (${columns.join(', ')})
            VALUES (${placeholders})
            ON CONFLICT (workspace_id, category, key)
            DO UPDATE SET ${updateSet}
            RETURNING id, workspace_id, category, key, title, content, metadata, created_at, updated_at
        `;

        const result = await this.execute(query, values);
        const row = result.rows[0];

        return {
            id: row.id,
            workspaceId: row.workspace_id,
            category: row.category,
            key: row.key,
            title: row.title,
            content: row.content,
            metadata: row.metadata,
            createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
            updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
        };
    }

    /**
     * Get a specific knowledge entry by key
     */
    async get(workspaceId: string, category: string, key: string): Promise<KnowledgeEntry | null> {
        await this.ensureSchema();

        const result = await this.execute(`
            SELECT id, workspace_id, category, key, title, content, metadata, created_at, updated_at
            FROM agent_knowledge
            WHERE workspace_id = $1 AND category = $2 AND key = $3
        `, [workspaceId, category, key]);

        if (!result.rows.length) return null;
        const row = result.rows[0];

        return {
            id: row.id,
            workspaceId: row.workspace_id,
            category: row.category,
            key: row.key,
            title: row.title,
            content: row.content,
            metadata: row.metadata,
            createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
            updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
        };
    }

    /**
     * List knowledge entries
     */
    async list(params: KnowledgeListParams): Promise<KnowledgeEntry[]> {
        await this.ensureSchema();

        let query = `
            SELECT id, workspace_id, category, key, title, content, metadata, created_at, updated_at
            FROM agent_knowledge
            WHERE workspace_id = $1
        `;
        const values: any[] = [params.workspaceId];
        let idx = 1;

        if (params.category) {
            idx++;
            values.push(params.category);
            query += ` AND category = $${idx}`;
        }

        query += ` ORDER BY category, key`;

        idx++;
        values.push(params.limit ?? 100);
        query += ` LIMIT $${idx}`;

        if (params.offset) {
            idx++;
            values.push(params.offset);
            query += ` OFFSET $${idx}`;
        }

        const result = await this.execute(query, values);

        return result.rows.map((row: any) => ({
            id: row.id,
            workspaceId: row.workspace_id,
            category: row.category,
            key: row.key,
            title: row.title,
            content: row.content,
            metadata: row.metadata,
            createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
            updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
        }));
    }

    /**
     * Search knowledge base using keyword or semantic search
     */
    async search(params: KnowledgeSearchParams): Promise<Array<KnowledgeEntry & { similarity?: number }>> {
        await this.ensureSchema();

        const limit = params.limit ?? 5;
        const values: any[] = [params.workspaceId];
        let idx = 1;

        // Try semantic search first if embeddings are available
        if (this.supportsVector && params.embeddingsModel && params.query) {
            try {
                const result = await generateEmbedding(params.query, params.embeddingsModel);
                if (result) {
                    const vectorCol = result.embedding.length === 384 ? 'embedding_384' : 'embedding';
                    idx++;
                    values.push(JSON.stringify(result.embedding));

                    let query = `
                        SELECT 
                            id, workspace_id, category, key, title, content, metadata, 
                            created_at, updated_at,
                            1 - (${vectorCol} <=> $${idx}) as similarity
                        FROM agent_knowledge
                        WHERE workspace_id = $1
                          AND ${vectorCol} IS NOT NULL
                    `;

                    if (params.category) {
                        idx++;
                        values.push(params.category);
                        query += ` AND category = $${idx}`;
                    }

                    query += ` ORDER BY similarity DESC`;
                    idx++;
                    values.push(limit);
                    query += ` LIMIT $${idx}`;

                    const dbResult = await this.execute(query, values);

                    if (dbResult.rows.length > 0) {
                        return dbResult.rows.map((row: any) => ({
                            id: row.id,
                            workspaceId: row.workspace_id,
                            category: row.category,
                            key: row.key,
                            title: row.title,
                            content: row.content,
                            metadata: row.metadata,
                            createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
                            updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
                            similarity: Number(row.similarity),
                        }));
                    }
                }
            } catch (e) {
                console.warn('[KnowledgeStore] Semantic search failed, falling back to keyword search:', e);
            }
        }

        // Fallback to keyword search
        const searchTerms = buildKeywordSearchTerms(params.query);
        if (searchTerms.length === 0) return [];

        let keywordQuery = `
            SELECT id, workspace_id, category, key, title, content, metadata, created_at, updated_at
            FROM agent_knowledge
            WHERE workspace_id = $1
              AND (
                  ${searchTerms.map((_, i) =>
        `(title ILIKE $${i + 2} OR content ILIKE $${i + 2} OR key ILIKE $${i + 2} OR category ILIKE $${i + 2})`
    ).join(' OR ')}
              )
        `;
        idx = 1 + searchTerms.length;
        values.length = 1; // Reset values
        values.push(...searchTerms.map(term => `%${term}%`));

        if (params.category) {
            idx++;
            values.push(params.category);
            keywordQuery += ` AND category = $${idx}`;
        }

        keywordQuery += ` ORDER BY 
            CASE WHEN title ILIKE $2 THEN 0 ELSE 1 END,
            CASE WHEN key ILIKE $2 THEN 0 ELSE 1 END,
            updated_at DESC`;

        idx++;
        values.push(limit);
        keywordQuery += ` LIMIT $${idx}`;

        const result = await this.execute(keywordQuery, values);

        return result.rows.map((row: any) => ({
            id: row.id,
            workspaceId: row.workspace_id,
            category: row.category,
            key: row.key,
            title: row.title,
            content: row.content,
            metadata: row.metadata,
            createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
            updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
        }));
    }

    /**
     * Delete a knowledge entry
     */
    async delete(id: string): Promise<boolean> {
        await this.ensureSchema();
        const result = await this.execute(`DELETE FROM agent_knowledge WHERE id = $1`, [id]);
        return result.rowCount > 0;
    }

    /**
     * Delete by key
     */
    async deleteByKey(workspaceId: string, category: string, key: string): Promise<boolean> {
        await this.ensureSchema();
        const result = await this.execute(
            `DELETE FROM agent_knowledge WHERE workspace_id = $1 AND category = $2 AND key = $3`,
            [workspaceId, category, key]
        );
        return result.rowCount > 0;
    }

    /**
     * Get all categories for a workspace
     */
    async getCategories(workspaceId: string): Promise<string[]> {
        await this.ensureSchema();
        const result = await this.execute(`
            SELECT DISTINCT category FROM agent_knowledge WHERE workspace_id = $1 ORDER BY category
        `, [workspaceId]);
        return result.rows.map((r: any) => r.category);
    }
}
