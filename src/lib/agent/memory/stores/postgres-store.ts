import { runQuery } from '@/app/actions/databaseActions';
import { MemoryStore, MemoryProvider, MemoryWrite, MemoryQuery, MemoryItem } from '../types';
import { hashMemoryContent, normalizeImportance } from '../utils';
import { Pool } from 'pg';
import { getPostgresPool } from '../db-pools';

export class PostgresMemoryStore implements MemoryStore {
    provider: MemoryProvider = 'postgres';
    private hasCheckedSchema = false;
    private supportsVector = false;
    private pool: Pool | undefined;

    constructor(connectionString?: string) {
        if (connectionString) {
            this.pool = getPostgresPool(connectionString);
        }
    }

    private async execute(text: string, params?: any[]): Promise<any> {
        if (this.pool) {
            return this.pool.query(text, params);
        }
        // Fallback to system DB only if no custom pool is configured (Default Session Memory)
        return runQuery(text, params);
    }

    private async ensureSchema() {
        if (this.hasCheckedSchema) return;

        // 1. Ensure PGVector extension exists
        try {
            await this.execute(`CREATE EXTENSION IF NOT EXISTS vector`);
            this.supportsVector = true;
        } catch (e: any) {
            // Silently fail if extension is not available (common in managed/shared DBs)
            // Code '0A000' or similar indicates feature not supported
            if (e.code === '0A000' || e.message?.includes('not available')) {
                this.supportsVector = false;
                // Debug log only, don't spam console
                // console.debug('[PostgresMemoryStore] PGVector extension not available in this database.');
            } else {
                console.warn('[PostgresMemoryStore] Failed to install "vector" extension:', e.message);
                this.supportsVector = false;
            }
        }

        // 2. Ensure table exists with new columns
        await this.execute(`
      CREATE TABLE IF NOT EXISTS agent_memories (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID NOT NULL,
        agent_id TEXT NOT NULL,
        scope TEXT NOT NULL,
        scope_key TEXT NOT NULL,
        type TEXT NOT NULL,
        content TEXT NOT NULL,
        importance FLOAT NOT NULL DEFAULT 0.5,
        tags JSONB,
        metadata JSONB,
        content_hash TEXT NOT NULL,
        source TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        last_accessed_at TIMESTAMPTZ,
        expires_at TIMESTAMPTZ,
        ${this.supportsVector ? 'embedding vector(1536),' : ''}
        is_compressed BOOLEAN DEFAULT FALSE,
        summary_of_ids UUID[] DEFAULT NULL,
        UNIQUE (workspace_id, agent_id, scope, scope_key, type, content_hash)
      );
    `);

        // 2.5 Ensure embedding columns exist (manual migration for existing tables)
        if (this.supportsVector) {
            try {
                // OpenAI standard
                await this.execute(`ALTER TABLE agent_memories ADD COLUMN IF NOT EXISTS embedding vector(1536)`);
            } catch (e) { /* ignore */ }
            try {
                // Local models (MiniLM, E5)
                await this.execute(`ALTER TABLE agent_memories ADD COLUMN IF NOT EXISTS embedding_384 vector(384)`);
            } catch (e) {
                console.warn('[PostgresMemoryStore] Could not add embedding_384 column:', e);
            }
        }

        // 3. Ensure indexes exist
        await this.execute(`
      CREATE INDEX IF NOT EXISTS idx_agent_memories_lookup ON agent_memories (workspace_id, agent_id, scope, scope_key);
      CREATE INDEX IF NOT EXISTS idx_agent_memories_type ON agent_memories (type);
      CREATE INDEX IF NOT EXISTS idx_agent_memories_expires ON agent_memories (expires_at);
      ${this.supportsVector ? `
          CREATE INDEX IF NOT EXISTS idx_agent_memories_embedding ON agent_memories USING ivfflat (embedding vector_cosine_ops);
          CREATE INDEX IF NOT EXISTS idx_agent_memories_embedding_384 ON agent_memories USING ivfflat (embedding_384 vector_cosine_ops);
      ` : ''}
    `);

        this.hasCheckedSchema = true;
    }

    async put(items: MemoryWrite[]): Promise<void> {
        if (!items.length) return;
        await this.ensureSchema();

        const columns = [
            'workspace_id', 'agent_id', 'scope', 'scope_key', 'type', 'content',
            'importance', 'tags', 'metadata', 'content_hash', 'expires_at', 'source'
        ];

        if (this.supportsVector) {
            columns.push('embedding');
            columns.push('embedding_384');
        }

        const values: any[] = [];
        const rows = items.map((item, index) => {
            const hash = hashMemoryContent(item.type, item.content);
            const base = index * columns.length;

            // Handle embedding columns based on dimension
            let embed1536 = null;
            let embed384 = null;

            if (item.embedding) {
                if (item.embedding.length === 1536) embed1536 = JSON.stringify(item.embedding);
                else if (item.embedding.length === 384) embed384 = JSON.stringify(item.embedding);
            }

            // Normalize tags to ensure it's always a string array
            let normalizedTags: string[] | null = null;
            if (item.tags) {
                if (Array.isArray(item.tags)) {
                    // Already an array, ensure all elements are strings
                    normalizedTags = item.tags.map((t: any) => String(t)).filter((t: string) => t.length > 0);
                } else if (typeof item.tags === 'object') {
                    // Object was passed, extract keys or values as tags
                    normalizedTags = Object.keys(item.tags).filter((k: string) => k.length > 0);
                } else if (typeof item.tags === 'string') {
                    // Single string, wrap in array
                    normalizedTags = [item.tags];
                }
                if (normalizedTags && normalizedTags.length === 0) normalizedTags = null;
            }

            values.push(
                item.workspaceId, item.agentId, item.scope, item.scopeKey, item.type, item.content,
                normalizeImportance(item.importance),
                normalizedTags ? JSON.stringify(normalizedTags) : null,
                item.metadata ? JSON.stringify(item.metadata) : null,
                hash,
                item.expiresAt || null,
                item.source || null,
            );

            if (this.supportsVector) {
                values.push(embed1536);
                values.push(embed384);
            }

            const placeholders = columns.map((_, colIndex) => `$${base + colIndex + 1}`);
            return `(${placeholders.join(', ')})`;
        });

        const query = `
      INSERT INTO agent_memories (${columns.join(', ')})
      VALUES ${rows.join(', ')}
      ON CONFLICT (workspace_id, agent_id, scope, scope_key, type, content_hash)
      DO UPDATE SET
        importance = GREATEST(agent_memories.importance, EXCLUDED.importance),
        tags = COALESCE(EXCLUDED.tags, agent_memories.tags),
        metadata = COALESCE(EXCLUDED.metadata, agent_memories.metadata),
        expires_at = COALESCE(EXCLUDED.expires_at, agent_memories.expires_at),
        source = COALESCE(EXCLUDED.source, agent_memories.source),
        ${this.supportsVector ? `
            embedding = COALESCE(EXCLUDED.embedding, agent_memories.embedding),
            embedding_384 = COALESCE(EXCLUDED.embedding_384, agent_memories.embedding_384),
        ` : ''}
        last_accessed_at = NOW();
    `;

        await this.execute(query, values);
    }

    async query(query: MemoryQuery): Promise<MemoryItem[]> {
        await this.ensureSchema();

        const params: any[] = [
            query.workspaceId,
            query.agentId,
            query.scope,
            query.scopeKey,
        ];
        let idx = params.length;

        // Determine which embedding column to use based on query vector length
        let vectorCol = 'embedding'; // default
        if (query.embedding && query.embedding.length === 384) {
            vectorCol = 'embedding_384';
        }

        let sql = `
      SELECT
        id, workspace_id, agent_id, scope, scope_key, type, content,
        importance, tags, metadata, created_at, last_accessed_at, expires_at, source
        ${query.embedding && this.supportsVector ? `, 1 - (${vectorCol} <=> $${idx + 1}) as similarity` : ''}
      FROM agent_memories
      WHERE workspace_id = $1
        AND agent_id = $2
        AND scope = $3
        AND scope_key = $4
        AND (expires_at IS NULL OR expires_at > NOW())
    `;

        if (query.embedding && this.supportsVector) {
            idx += 1;
            params.push(JSON.stringify(query.embedding));
        }

        if (query.types && query.types.length > 0) {
            idx += 1;
            params.push(query.types);
            sql += ` AND type = ANY($${idx})`;
        }

        if (typeof query.minImportance === 'number') {
            idx += 1;
            params.push(query.minImportance);
            sql += ` AND importance >= $${idx}`;
        }

        if (query.embedding && query.similarityThreshold && this.supportsVector) {
            // Re-use current param index for embedding if possible, but here we just added threshold
            // Actually, we need to refer to embedding param index again or structure differently.
            // Simplified: WHERE 1 - (col <=> $embedding) > $threshold
            // We already pushed embedding at idx (which was params.length before push, so it is at params[idx-1] now?)
            // Let's use the explicit indices.

            // Embedding param is at $5 (initial params=4 + 1)
            const embeddingParamIdx = 5;
            idx += 1;
            params.push(query.similarityThreshold);
            sql += ` AND 1 - (${vectorCol} <=> $${embeddingParamIdx}) >= $${idx}`;
        }

        // Order
        if (query.embedding && this.supportsVector) {
            sql += ` ORDER BY similarity DESC`;
        } else {
            sql += ` ORDER BY created_at DESC`;
        }

        idx += 1;
        params.push(query.limit ?? 200);
        sql += ` LIMIT $${idx}`;

        const result = await this.execute(sql, params);
        return result.rows.map((row: any) => ({
            id: row.id,
            workspaceId: row.workspace_id,
            agentId: row.agent_id,
            scope: row.scope,
            scopeKey: row.scope_key,
            type: row.type,
            content: row.content,
            importance: Number(row.importance ?? 0.5),
            tags: row.tags ?? undefined,
            metadata: row.metadata ?? null,
            source: row.source ?? undefined,
            createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
            lastAccessedAt: row.last_accessed_at instanceof Date ? row.last_accessed_at.toISOString() : row.last_accessed_at,
            expiresAt: row.expires_at instanceof Date ? row.expires_at.toISOString() : row.expires_at,
        }));
    }

    async touch(ids: string[]): Promise<void> {
        if (!ids.length) return;
        await this.ensureSchema();
        await this.execute(`UPDATE agent_memories SET last_accessed_at = NOW() WHERE id = ANY($1)`, [ids]);
    }

    async deleteExpired(): Promise<void> {
        await this.ensureSchema();
        await this.execute(`DELETE FROM agent_memories WHERE expires_at IS NOT NULL AND expires_at <= NOW()`);
    }
}

