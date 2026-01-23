import { MemoryStore, MemoryProvider, MemoryWrite, MemoryQuery, MemoryItem, MemoryScope } from '../types';
import { createClient, RedisClientType } from 'redis';

export class RedisMemoryStore implements MemoryStore {
    provider: MemoryProvider = 'redis';
    private clientPromise: Promise<RedisClientType>;

    constructor(connectionString?: string) {
        if (!connectionString) {
            throw new Error('Redis connection string is missing.');
        }
        const client = createClient({ url: connectionString });
        client.on('error', (err: any) => console.error('Redis Client Error', err));
        this.clientPromise = client.connect().then(() => client as RedisClientType);
    }

    private buildKey(payload: { workspaceId: string; agentId: string; scope: MemoryScope; scopeKey: string }) {
        return `nexus:mem:${payload.workspaceId}:${payload.agentId}:${payload.scope}:${payload.scopeKey}`;
    }

    // Helper to serialize item properly
    private serialize(item: MemoryItem): string {
        return JSON.stringify(item);
    }

    // Helper to deserialize item properly
    private deserialize(str: string): MemoryItem | null {
        try {
            return JSON.parse(str);
        } catch {
            return null;
        }
    }

    async put(items: MemoryWrite[]): Promise<void> {
        if (!items.length) return;
        const client = await this.clientPromise;

        // Group by key to batch operations
        const grouped = new Map<string, MemoryWrite[]>();

        items.forEach(item => {
            const key = this.buildKey(item);
            const list = grouped.get(key) || [];
            list.push(item);
            grouped.set(key, list);
        });

        for (const [key, list] of grouped.entries()) {
            // We push to the head of the list (LPUSH) so newest are first
            // We do this to simulate "ORDER BY created_at DESC"
            for (const item of list) {
                const memoryItem: MemoryItem = {
                    id: crypto.randomUUID(), // In Redis standalone this ID might clash but for cache it's fine
                    ...item,
                    createdAt: new Date().toISOString(),
                    importance: item.importance ?? 0.5,
                };
                await client.lPush(key, this.serialize(memoryItem));
            }
            // Cap list size to preventing infinite growth in cache
            await client.lTrim(key, 0, 499);

            // If items have expiry, we generally set TTL on the whole list key?
            // Redis lists don't support per-item TTL well. 
            // We largely rely on the Hybrid store to manage logical expiration or Key eviction.
            // For simple caching, we can set a long expiry on the key if not accessed.
            await client.expire(key, 60 * 60 * 24 * 7); // 1 week default safety
        }
    }

    async query(query: MemoryQuery): Promise<MemoryItem[]> {
        const client = await this.clientPromise;
        const key = this.buildKey(query);
        const limit = query.limit ?? 200;

        // Get range. 0 is first element, limit-1 is the last requested
        const raw = await client.lRange(key, 0, limit - 1);
        const now = Date.now();

        return (raw || [])
            .map(this.deserialize)
            .filter((item: MemoryItem | null): item is MemoryItem => {
                if (!item) return false;
                if (query.types && query.types.length > 0 && !query.types.includes(item.type)) return false;
                if (typeof query.minImportance === 'number' && item.importance < query.minImportance) return false;
                if (item.expiresAt && new Date(item.expiresAt).getTime() <= now) return false;
                return true;
            })
            .slice(0, limit);
    }

    async touch(ids: string[]): Promise<void> {
        // Redis doesn't easily support touching individual list items by ID without rescanning.
        // We could implement it but for cache it's often overkill.
        // For now, no-op or just refresh key expiry if we had the key context.
        return;
    }

    async deleteExpired(): Promise<void> {
        // Redis handles expiration via key TTL (expire).
        // No explicit cleanup needed for list items in this implementation.
        return;
    }
}
