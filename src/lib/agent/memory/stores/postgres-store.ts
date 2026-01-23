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
        } catch (e) {
            console.warn('[PostgresMemoryStore] Failed to install "vector" extension. Embeddings will be disabled.');
            this.supportsVector = false;
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

        // 3. Ensure indexes exist
        await this.execute(`
      CREATE INDEX IF NOT EXISTS idx_agent_memories_lookup ON agent_memories (workspace_id, agent_id, scope, scope_key);
      CREATE INDEX IF NOT EXISTS idx_agent_memories_type ON agent_memories (type);
      CREATE INDEX IF NOT EXISTS idx_agent_memories_expires ON agent_memories (expires_at);
      ${this.supportsVector ? 'CREATE INDEX IF NOT EXISTS idx_agent_memories_embedding ON agent_memories USING ivfflat (embedding vector_cosine_ops);' : ''}
    `);

        this.hasCheckedSchema = true;
    }

    async put(items: MemoryWrite[]): Promise<void> {
        if (!items.length) return;
        await this.ensureSchema();

        const columns = [
            'workspace_id',
            'agent_id',
            'scope',
            'scope_key',
            'type',
            'content',
            'importance',
            'tags',
            'metadata',
            'content_hash',
            'expires_at',
            'source'
        ];

        if (this.supportsVector) {
            columns.push('embedding');
        }

        const values: any[] = [];
        const rows = items.map((item, index) => {
            const hash = hashMemoryContent(item.type, item.content);
            const base = index * columns.length;

            // Handle embedding formatting for pgvector if present
            const embeddingVal = item.embedding ? JSON.stringify(item.embedding) : null;

            values.push(
                item.workspaceId,
                item.agentId,
                item.scope,
                item.scopeKey,
                item.type,
                item.content,
                normalizeImportance(item.importance),
                item.tags ? JSON.stringify(item.tags) : null,
                item.metadata ? JSON.stringify(item.metadata) : null,
                hash,
                item.expiresAt || null,
                item.source || null,
            );

            if (this.supportsVector) {
                values.push(embeddingVal);
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
        ${this.supportsVector ? 'embedding = COALESCE(EXCLUDED.embedding, agent_memories.embedding),' : ''}
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

        let sql = `
      SELECT
        id,
        workspace_id,
        agent_id,
        scope,
        scope_key,
        type,
        content,
        importance,
        tags,
        metadata,
        created_at,
        last_accessed_at,
        expires_at,
        source
        ${query.embedding && this.supportsVector ? `, 1 - (embedding <=> $${idx + 1}) as similarity` : ''}
      FROM agent_memories
      WHERE workspace_id = $1
        AND agent_id = $2
        AND scope = $3
        AND scope_key = $4
        AND (expires_at IS NULL OR expires_at > NOW())
    `;

        if (query.embedding && this.supportsVector) {
            idx += 1;
            params.push(JSON.stringify(query.embedding)); // Vector needs to be stringified for parameterized query in some drivers, checking this
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
            // already added embedding to params
            idx += 1;
            params.push(query.similarityThreshold);
            sql += ` AND 1 - (embedding <=> $${idx - 1}) >= $${idx}`;
        }

        // Order by similarity if embedding is present, otherwise time
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
