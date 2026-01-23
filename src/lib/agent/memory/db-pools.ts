import { Pool } from 'pg';

// Global cache for connection pools to avoid exhausting database connections
// Key: connection string, Value: pg.Pool instance
const poolCache = new Map<string, Pool>();

export const getPostgresPool = (connectionString: string): Pool => {
    if (!poolCache.has(connectionString)) {
        const newPool = new Pool({
            connectionString,
            max: 5, // Limit max connections per pool to be safe
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 5000,
        });

        // Handle pool errors to prevent process crash
        newPool.on('error', (err) => {
            console.error('[PostgresPool] Unexpected error on idle client', err);
        });

        poolCache.set(connectionString, newPool);
    }

    return poolCache.get(connectionString)!;
};

// Optional: capability to close pools if needed (e.g. on shutdown)
export const closeAllPools = async () => {
    for (const pool of poolCache.values()) {
        await pool.end();
    }
    poolCache.clear();
};
