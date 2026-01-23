import { MemoryStore, MemoryProvider, MemoryWrite, MemoryQuery, MemoryItem } from '../types';
import { PostgresMemoryStore } from './postgres-store';
import { RedisMemoryStore } from './redis-store';

export class HybridMemoryStore implements MemoryStore {
    provider: MemoryProvider = 'hybrid';
    private postgres: PostgresMemoryStore;
    private redis: RedisMemoryStore;
    private cacheTTL: number;
    private writeThrough: boolean;

    constructor(redisConnectionString: string, options?: {
        cacheTTL?: number;
        writeThrough?: boolean;
        postgresConnectionString?: string;
    }) {
        this.postgres = new PostgresMemoryStore(options?.postgresConnectionString);
        this.redis = new RedisMemoryStore(redisConnectionString);
        this.cacheTTL = options?.cacheTTL ?? 3600;
        this.writeThrough = options?.writeThrough ?? true;
    }

    async put(items: MemoryWrite[]): Promise<void> {
        const redisItems = items.map(item => ({
            ...item,
            // If the item doesn't have an expiry, we might technically set one for the cache layer
            // but RedisStore handles key expiry. 
            // We can override expiresAt if we want strict cache TTLs on items, but better to let RedisStore handle logic.
        }));

        if (this.writeThrough) {
            // Write to both simultaneously
            await Promise.all([
                this.postgres.put(items),
                this.redis.put(redisItems)
            ]);
        } else {
            // Write-behind: write to persistence, then async update cache
            await this.postgres.put(items);
            this.redis.put(redisItems).catch(err => console.error('[HybridStore] Async cache update failed', err));
        }
    }

    async query(query: MemoryQuery): Promise<MemoryItem[]> {
        try {
            // 1. Try Redis cache first (fastest)
            // Note: Redis store query might simpler than Postgres (no vector search support usually)
            // If query has vector embedding, we SKIP Redis unless we implement vector search in Redis (RediSearch)
            // For now, assuming Redis is for basic retrieval by scope/type/recency.

            const shouldSkipCache = !!query.embedding;

            if (!shouldSkipCache) {
                const cached = await this.redis.query(query);
                if (cached.length > 0) {
                    return cached;
                }
            }
        } catch (err) {
            console.warn('[HybridStore] Cache query failed, falling back to DB', err);
        }

        // 2. Cache miss or vector search - query Postgres
        const fromDb = await this.postgres.query(query);

        // 3. Populate Redis cache for next time (Write-Around / Read-Through)
        // Only populate if we got results and it wasn't a vector search (or maybe we do want to cache vector results? usually yes)
        if (fromDb.length > 0) {
            const cacheItems: MemoryWrite[] = fromDb.map(item => ({
                workspaceId: item.workspaceId,
                agentId: item.agentId,
                scope: item.scope,
                scopeKey: item.scopeKey,
                type: item.type,
                content: item.content,
                importance: item.importance,
                tags: item.tags,
                metadata: item.metadata,
                source: item.source,
                // Set distinct expiry for cache layer if desired, roughly matching TTL
                expiresAt: item.expiresAt || new Date(Date.now() + this.cacheTTL * 1000).toISOString()
            }));

            this.redis.put(cacheItems).catch(err => console.warn('[HybridStore] Cache population failed', err));
        }

        return fromDb;
    }

    async touch(ids: string[]): Promise<void> {
        // Touch persistence
        await this.postgres.touch(ids);
        // Touch cache?? Redis store implementation of touch is no-op currently.
    }

    async deleteExpired(): Promise<void> {
        await Promise.all([
            this.postgres.deleteExpired(),
            this.redis.deleteExpired ? this.redis.deleteExpired() : Promise.resolve()
        ]);
    }
}
