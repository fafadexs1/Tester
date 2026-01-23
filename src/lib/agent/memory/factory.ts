import { MemoryStore, MemoryProvider } from './types';
import { PostgresMemoryStore } from './stores/postgres-store';
import { RedisMemoryStore } from './stores/redis-store';
import { MariaDbMemoryStore } from './stores/mariadb-store';
import { InMemoryMemoryStore } from './stores/in-memory-store';
import { HybridMemoryStore } from './stores/hybrid-store';

export const createMemoryStore = (
    provider: MemoryProvider,
    connectionString?: string,
    options?: {
        hybridCacheTTL?: number;
        hybridWriteThrough?: boolean;
        redisConnectionString?: string; // Explicit separate Redis URL for Hybrid mode
    }
): MemoryStore => {
    if (provider === 'postgres') return new PostgresMemoryStore(connectionString);

    if (provider === 'redis') return new RedisMemoryStore(connectionString);

    if (provider === 'mariadb') return new MariaDbMemoryStore(connectionString);

    if (provider === 'in-memory') return new InMemoryMemoryStore();

    if (provider === 'hybrid') {
        // For hybrid, we need a Redis connection string.
        // Use the explicit one if provided.
        const redisUrl = options?.redisConnectionString;

        if (!redisUrl) {
            console.warn('[MemoryFactory] Hybrid provider selected but no Redis URL found in options. Falling back to Postgres.');
            return new PostgresMemoryStore(connectionString);
        }

        return new HybridMemoryStore(redisUrl, {
            cacheTTL: options?.hybridCacheTTL,
            writeThrough: options?.hybridWriteThrough,
            postgresConnectionString: connectionString
        });
    }

    // Fallback
    console.warn(`[MemoryFactory] Unknown provider "${provider}", falling back to in-memory.`);
    return new InMemoryMemoryStore();
};
