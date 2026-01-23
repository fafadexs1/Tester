'use server';

import { createRequire } from 'node:module';
import { Client } from 'pg';

const require = createRequire(import.meta.url);

export async function testPostgresConnection(connectionString: string): Promise<{ success: boolean; message: string }> {
    if (!connectionString) {
        return { success: false, message: 'Connection string is empty.' };
    }

    const client = new Client({
        connectionString,
        connectionTimeoutMillis: 5000, // 5s timeout
    });

    try {
        await client.connect();
        await client.query('SELECT 1');
        await client.end();
        return { success: true, message: 'Connection successful!' };
    } catch (error: any) {
        return { success: false, message: `Connection failed: ${error.message}` };
    }
}

export async function testRedisConnection(connectionString: string): Promise<{ success: boolean; message: string }> {
    if (!connectionString) {
        return { success: false, message: 'Connection string is empty.' };
    }

    try {
        // Dynamic import to handle optional dependency
        let redis;
        try {
            redis = require('redis');
        } catch (e) {
            return { success: false, message: 'Redis package is not installed. Please install "redis" to use this provider.' };
        }

        if (!redis?.createClient) {
            return { success: false, message: 'Redis package found but createClient is missing.' };
        }

        const client = redis.createClient({
            url: connectionString,
            socket: {
                connectTimeout: 5000
            }
        });

        await client.connect();
        await client.ping();
        await client.disconnect();

        return { success: true, message: 'Redis Connection successful!' };

    } catch (error: any) {
        return { success: false, message: `Redis Connection failed: ${error.message}` };
    }
}
