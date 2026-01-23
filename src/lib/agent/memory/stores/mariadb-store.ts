import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { MemoryStore, MemoryProvider, MemoryWrite, MemoryQuery, MemoryItem } from '../types';
import { hashMemoryContent, normalizeImportance } from '../utils';

const require = createRequire(import.meta.url);
const optionalRequire = (moduleName: string): any | null => {
    try {
        return require(moduleName);
    } catch {
        return null;
    }
};

export class MariaDbMemoryStore implements MemoryStore {
    provider: MemoryProvider = 'mariadb';
    private poolPromise: Promise<any>;

    constructor(connectionString?: string) {
        const mysql = optionalRequire('mysql2/promise');
        if (!mysql?.createPool) {
            throw new Error('MariaDB provider requires the "mysql2" package.');
        }
        const url = connectionString || process.env.MARIADB_URL;
        if (!url) {
            throw new Error('MariaDB connection string is missing.');
        }
        const parsed = new URL(url);
        const pool = mysql.createPool({
            host: parsed.hostname,
            port: parsed.port ? Number(parsed.port) : 3306,
            user: decodeURIComponent(parsed.username || ''),
            password: decodeURIComponent(parsed.password || ''),
            database: parsed.pathname.replace(/^\//, ''),
            connectionLimit: 5,
        });

        this.poolPromise = (async () => {
            await pool.query(`
        CREATE TABLE IF NOT EXISTS agent_memories (
          id CHAR(36) PRIMARY KEY,
          workspace_id CHAR(36) NOT NULL,
          agent_id VARCHAR(191) NOT NULL,
          scope VARCHAR(32) NOT NULL,
          scope_key VARCHAR(191) NOT NULL,
          type VARCHAR(32) NOT NULL,
          content TEXT NOT NULL,
          importance FLOAT NOT NULL DEFAULT 0.5,
          tags JSON NULL,
          metadata JSON NULL,
          content_hash VARCHAR(64) NOT NULL,
          source VARCHAR(32) NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          last_accessed_at DATETIME NULL,
          expires_at DATETIME NULL,
          UNIQUE KEY uniq_memory (workspace_id, agent_id, scope, scope_key, type, content_hash),
          INDEX idx_lookup (workspace_id, agent_id, scope, scope_key),
          INDEX idx_expires (expires_at)
        );
      `);
            return pool;
        })();
    }

    private async getPool() {
        return this.poolPromise;
    }

    async put(items: MemoryWrite[]): Promise<void> {
        if (!items.length) return;
        const pool = await this.getPool();
        const columns = [
            'id',
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
            'source',
        ];

        const values: any[] = [];
        const rows = items.map((item, index) => {
            const hash = hashMemoryContent(item.type, item.content);
            const base = index * columns.length;
            values.push(
                crypto.randomUUID(),
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
                item.expiresAt ? new Date(item.expiresAt) : null,
                item.source ?? null
            );
            const placeholders = columns.map((_, colIndex) => `?`);
            return `(${placeholders.join(', ')})`;
        });

        const sql = `
      INSERT INTO agent_memories (${columns.join(', ')})
      VALUES ${rows.join(', ')}
      ON DUPLICATE KEY UPDATE
        importance = GREATEST(importance, VALUES(importance)),
        tags = COALESCE(VALUES(tags), tags),
        metadata = COALESCE(VALUES(metadata), metadata),
        expires_at = COALESCE(VALUES(expires_at), expires_at),
        source = COALESCE(VALUES(source), source),
        last_accessed_at = NOW();
    `;

        await pool.query(sql, values);
    }

    async query(query: MemoryQuery): Promise<MemoryItem[]> {
        const pool = await this.getPool();
        const params: any[] = [
            query.workspaceId,
            query.agentId,
            query.scope,
            query.scopeKey,
        ];
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
        source,
        created_at,
        last_accessed_at,
        expires_at
      FROM agent_memories
      WHERE workspace_id = ?
        AND agent_id = ?
        AND scope = ?
        AND scope_key = ?
        AND (expires_at IS NULL OR expires_at > NOW())
    `;

        if (query.types && query.types.length > 0) {
            sql += ` AND type IN (${query.types.map(() => '?').join(', ')})`;
            params.push(...query.types);
        }

        if (typeof query.minImportance === 'number') {
            sql += ` AND importance >= ?`;
            params.push(query.minImportance);
        }

        sql += ` ORDER BY created_at DESC LIMIT ?`;
        params.push(query.limit ?? 200);

        const [rows] = await pool.query(sql, params);
        const list = Array.isArray(rows) ? rows : [];

        return list.map((row: any) => ({
            id: row.id,
            workspaceId: row.workspace_id,
            agentId: row.agent_id,
            scope: row.scope,
            scopeKey: row.scope_key,
            type: row.type,
            content: row.content,
            importance: Number(row.importance ?? 0.5),
            tags: row.tags ? JSON.parse(row.tags) : undefined,
            metadata: row.metadata ? JSON.parse(row.metadata) : null,
            source: row.source ?? undefined,
            createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
            lastAccessedAt: row.last_accessed_at instanceof Date ? row.last_accessed_at.toISOString() : row.last_accessed_at,
            expiresAt: row.expires_at instanceof Date ? row.expires_at.toISOString() : row.expires_at,
        }));
    }

    async touch(ids: string[]): Promise<void> {
        if (!ids.length) return;
        const pool = await this.getPool();
        await pool.query(`UPDATE agent_memories SET last_accessed_at = NOW() WHERE id IN (${ids.map(() => '?').join(', ')})`, ids);
    }

    async deleteExpired(): Promise<void> {
        const pool = await this.getPool();
        await pool.query(`DELETE FROM agent_memories WHERE expires_at IS NOT NULL AND expires_at <= NOW()`);
    }
}
