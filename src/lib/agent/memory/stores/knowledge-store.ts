import { Pool } from 'pg';
import { getPostgresPool } from '../db-pools';
import { generateEmbedding } from '../embedding';
import {
    createVectorColumnPayload,
    getVectorColumnDefinitions,
    getVectorColumnForEmbedding,
    getVectorIndexDefinitions,
    VECTOR_COLUMN_SPECS,
} from '../vector-columns';

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
        const vectorDefinitions = this.supportsVector
            ? `${getVectorColumnDefinitions().map(definition => `                ${definition}`).join(',\n')},\n`
            : '';
        await this.execute(`
            CREATE TABLE IF NOT EXISTS agent_knowledge (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                workspace_id UUID NOT NULL,
                category TEXT NOT NULL,
                key TEXT NOT NULL,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                metadata JSONB,
${vectorDefinitions}
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW(),
                UNIQUE (workspace_id, category, key)
            );
        `);

        // 3. Add embedding columns if they don't exist (migration)
        if (this.supportsVector) {
            for (const spec of VECTOR_COLUMN_SPECS) {
                try {
                    await this.execute(
                        `ALTER TABLE agent_knowledge ADD COLUMN IF NOT EXISTS ${spec.column} vector(${spec.dimension})`
                    );
                } catch (e) {
                    console.warn(`[KnowledgeStore] Could not add ${spec.column} column:`, e);
                }
            }
        }

        // 4. Create indexes
        const vectorIndexes = this.supportsVector
            ? `\n                ${getVectorIndexDefinitions('agent_knowledge').join('\n                ')}`
            : '';
        await this.execute(`
            CREATE INDEX IF NOT EXISTS idx_agent_knowledge_workspace ON agent_knowledge (workspace_id);
            CREATE INDEX IF NOT EXISTS idx_agent_knowledge_category ON agent_knowledge (workspace_id, category);
            CREATE INDEX IF NOT EXISTS idx_agent_knowledge_key ON agent_knowledge (workspace_id, category, key);
            ${vectorIndexes}
        `);

        this.hasCheckedSchema = true;
    }

    /**
     * Create or update a knowledge entry
     */
    async put(entry: KnowledgeWrite, embeddingsModel?: string): Promise<KnowledgeEntry> {
        await this.ensureSchema();

        // Generate embedding if model is specified and content exists
        let vectorPayload = createVectorColumnPayload();

        if (this.supportsVector && embeddingsModel && entry.content) {
            try {
                const result = await generateEmbedding(entry.content, embeddingsModel, { role: 'document' });
                if (result) {
                    vectorPayload = createVectorColumnPayload(result.embedding);
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
            columns.push(...VECTOR_COLUMN_SPECS.map(spec => spec.column));
            VECTOR_COLUMN_SPECS.forEach(spec => values.push(vectorPayload[spec.column]));
        }

        const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
        const updateSet = columns
            .filter(c => c !== 'workspace_id' && c !== 'category' && c !== 'key')
            .map(c => {
                const isVectorColumn = VECTOR_COLUMN_SPECS.some(spec => spec.column === c);
                return isVectorColumn
                    ? `${c} = COALESCE(EXCLUDED.${c}, agent_knowledge.${c})`
                    : `${c} = EXCLUDED.${c}`;
            })
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
                const result = await generateEmbedding(params.query, params.embeddingsModel, { role: 'query' });
                if (result) {
                    const vectorCol = getVectorColumnForEmbedding(result.embedding);
                    if (!vectorCol) {
                        throw new Error(`Unsupported embedding dimension: ${result.embedding.length}`);
                    }
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
