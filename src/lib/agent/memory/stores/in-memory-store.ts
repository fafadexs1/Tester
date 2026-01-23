import crypto from 'node:crypto';
import { MemoryStore, MemoryProvider, MemoryWrite, MemoryQuery, MemoryItem } from '../types';
import { normalizeImportance } from '../utils';

export class InMemoryMemoryStore implements MemoryStore {
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
                embedding: item.embedding,
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

        // Simple cosine similarity sort if embedding provided (mock implementation)
        if (query.embedding) {
            // In a real in-memory vector store we'd do dot product here
            // For now just returning defaults or implementing a basic dist check if critical
        }

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
