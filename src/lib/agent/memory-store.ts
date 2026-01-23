'use server';

import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { runQuery } from '@/app/actions/databaseActions';

export type MemoryProvider = 'postgres' | 'redis' | 'mariadb' | 'in-memory';
export type MemoryScope = 'session' | 'user' | 'workspace';
export type MemoryType = 'semantic' | 'episodic' | 'procedural';

export interface MemoryItem {
  id: string;
  workspaceId: string;
  agentId: string;
  scope: MemoryScope;
  scopeKey: string;
  type: MemoryType;
  content: string;
  importance: number;
  tags?: string[];
  metadata?: Record<string, any> | null;
  source?: 'compiler' | 'manual' | 'tool' | 'system';
  createdAt: string;
  lastAccessedAt?: string | null;
  expiresAt?: string | null;
}

export interface MemoryWrite {
  workspaceId: string;
  agentId: string;
  scope: MemoryScope;
  scopeKey: string;
  type: MemoryType;
  content: string;
  importance?: number;
  tags?: string[];
  metadata?: Record<string, any> | null;
  source?: 'compiler' | 'manual' | 'tool' | 'system';
  expiresAt?: string | null;
}

export interface MemoryQuery {
  workspaceId: string;
  agentId: string;
  scope: MemoryScope;
  scopeKey: string;
  types?: MemoryType[];
  limit?: number;
  minImportance?: number;
}

export interface MemoryStore {
  provider: MemoryProvider;
  put(items: MemoryWrite[]): Promise<void>;
  query(query: MemoryQuery): Promise<MemoryItem[]>;
  touch(ids: string[]): Promise<void>;
  deleteExpired?(): Promise<void>;
}

const require = createRequire(import.meta.url);
const optionalRequire = (moduleName: string): any | null => {
  try {
    return require(moduleName);
  } catch {
    return null;
  }
};

const hashMemoryContent = (type: MemoryType, content: string): string =>
  crypto.createHash('sha256').update(`${type}|${content}`).digest('hex');

const normalizeImportance = (value: number | undefined): number => {
  if (typeof value !== 'number' || Number.isNaN(value)) return 0.5;
  return Math.max(0, Math.min(1, value));
};

class PostgresMemoryStore implements MemoryStore {
  provider: MemoryProvider = 'postgres';

  async put(items: MemoryWrite[]): Promise<void> {
    if (!items.length) return;

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
      'source',
    ];

    const values: any[] = [];
    const rows = items.map((item, index) => {
      const hash = hashMemoryContent(item.type, item.content);
      const base = index * columns.length;
      values.push(
        item.workspaceId,
        item.agentId,
        item.scope,
        item.scopeKey,
        item.type,
        item.content,
        normalizeImportance(item.importance),
        item.tags ?? null,
        item.metadata ?? null,
        hash,
        item.expiresAt ?? null,
        item.source ?? null
      );
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
        last_accessed_at = NOW();
    `;

    await runQuery(query, values);
  }

  async query(query: MemoryQuery): Promise<MemoryItem[]> {
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
      FROM agent_memories
      WHERE workspace_id = $1
        AND agent_id = $2
        AND scope = $3
        AND scope_key = $4
        AND (expires_at IS NULL OR expires_at > NOW())
    `;

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

    idx += 1;
    params.push(query.limit ?? 200);
    sql += ` ORDER BY created_at DESC LIMIT $${idx}`;

    const result = await runQuery<any>(sql, params);
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
    await runQuery(`UPDATE agent_memories SET last_accessed_at = NOW() WHERE id = ANY($1)`, [ids]);
  }

  async deleteExpired(): Promise<void> {
    await runQuery(`DELETE FROM agent_memories WHERE expires_at IS NOT NULL AND expires_at <= NOW()`);
  }
}

class InMemoryMemoryStore implements MemoryStore {
  provider: MemoryProvider = 'in-memory';
  private records: MemoryItem[] = [];

  async put(items: MemoryWrite[]): Promise<void> {
    const now = new Date().toISOString();
    items.forEach(item => {
      const entry: MemoryItem = {
        id: crypto.randomUUID(),
        workspaceId: item.workspaceId,
        agentId: item.agentId,
        scope: item.scope,
        scopeKey: item.scopeKey,
        type: item.type,
        content: item.content,
        importance: normalizeImportance(item.importance),
        tags: item.tags,
        metadata: item.metadata ?? null,
        source: item.source,
        createdAt: now,
        lastAccessedAt: null,
        expiresAt: item.expiresAt ?? null,
      };
      this.records.unshift(entry);
    });
  }

  async query(query: MemoryQuery): Promise<MemoryItem[]> {
    const now = Date.now();
    const filtered = this.records.filter(item => {
      if (item.workspaceId !== query.workspaceId) return false;
      if (item.agentId !== query.agentId) return false;
      if (item.scope !== query.scope) return false;
      if (item.scopeKey !== query.scopeKey) return false;
      if (query.types && query.types.length > 0 && !query.types.includes(item.type)) return false;
      if (typeof query.minImportance === 'number' && item.importance < query.minImportance) return false;
      if (item.expiresAt && new Date(item.expiresAt).getTime() <= now) return false;
      return true;
    });
    return filtered.slice(0, query.limit ?? 200);
  }

  async touch(ids: string[]): Promise<void> {
    if (!ids.length) return;
    const now = new Date().toISOString();
    this.records = this.records.map(item =>
      ids.includes(item.id) ? { ...item, lastAccessedAt: now } : item
    );
  }

  async deleteExpired(): Promise<void> {
    const now = Date.now();
    this.records = this.records.filter(item => {
      if (!item.expiresAt) return true;
      return new Date(item.expiresAt).getTime() > now;
    });
  }
}

const buildMemoryItem = (item: MemoryWrite): MemoryItem => {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    workspaceId: item.workspaceId,
    agentId: item.agentId,
    scope: item.scope,
    scopeKey: item.scopeKey,
    type: item.type,
    content: item.content,
    importance: normalizeImportance(item.importance),
    tags: item.tags,
    metadata: item.metadata ?? null,
    source: item.source,
    createdAt: now,
    lastAccessedAt: null,
    expiresAt: item.expiresAt ?? null,
  };
};

class RedisMemoryStore implements MemoryStore {
  provider: MemoryProvider = 'redis';
  private clientPromise: Promise<any>;

  constructor(connectionString?: string) {
    const redis = optionalRequire('redis');
    if (!redis?.createClient) {
      throw new Error('Redis provider requires the "redis" package.');
    }
    const url = connectionString || process.env.REDIS_URL;
    if (!url) {
      throw new Error('Redis connection string is missing.');
    }
    const client = redis.createClient({ url });
    this.clientPromise = client.connect().then(() => client);
  }

  private buildKey(payload: { workspaceId: string; agentId: string; scope: MemoryScope; scopeKey: string }) {
    return `nexus:mem:${payload.workspaceId}:${payload.agentId}:${payload.scope}:${payload.scopeKey}`;
  }

  async put(items: MemoryWrite[]): Promise<void> {
    if (!items.length) return;
    const client = await this.clientPromise;
    const grouped = new Map<string, MemoryItem[]>();

    items.forEach(item => {
      const key = this.buildKey(item);
      const list = grouped.get(key) || [];
      list.push(buildMemoryItem(item));
      grouped.set(key, list);
    });

    for (const [key, list] of grouped.entries()) {
      const serialized = list.map(entry => JSON.stringify(entry));
      await client.lPush(key, serialized);
      await client.lTrim(key, 0, 500);
    }
  }

  async query(query: MemoryQuery): Promise<MemoryItem[]> {
    const client = await this.clientPromise;
    const key = this.buildKey(query);
    const limit = query.limit ?? 200;
    const raw = await client.lRange(key, 0, limit - 1);
    const now = Date.now();

    return (raw || [])
      .map((entry: string) => {
        try {
          return JSON.parse(entry) as MemoryItem;
        } catch {
          return null;
        }
      })
      .filter((item: MemoryItem | null): item is MemoryItem => {
        if (!item) return false;
        if (query.types && query.types.length > 0 && !query.types.includes(item.type)) return false;
        if (typeof query.minImportance === 'number' && item.importance < query.minImportance) return false;
        if (item.expiresAt && new Date(item.expiresAt).getTime() <= now) return false;
        return true;
      })
      .slice(0, limit);
  }

  async touch(): Promise<void> {
    return;
  }
}

class MariaDbMemoryStore implements MemoryStore {
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

class UnsupportedMemoryStore implements MemoryStore {
  provider: MemoryProvider;

  constructor(provider: MemoryProvider) {
    this.provider = provider;
  }

  async put(): Promise<void> {
    throw new Error(`Memory provider "${this.provider}" is not configured in this build.`);
  }

  async query(): Promise<MemoryItem[]> {
    throw new Error(`Memory provider "${this.provider}" is not configured in this build.`);
  }

  async touch(): Promise<void> {
    return;
  }
}

const inMemoryStore = new InMemoryMemoryStore();

export const createMemoryStore = (
  provider: MemoryProvider,
  connectionString?: string
): MemoryStore => {
  if (provider === 'postgres') return new PostgresMemoryStore();
  if (provider === 'redis') return new RedisMemoryStore(connectionString);
  if (provider === 'mariadb') return new MariaDbMemoryStore(connectionString);
  if (provider === 'in-memory') return inMemoryStore;
  return new UnsupportedMemoryStore(provider);
};
