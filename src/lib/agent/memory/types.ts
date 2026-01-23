export type MemoryProvider = 'postgres' | 'redis' | 'mariadb' | 'in-memory' | 'hybrid';
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
    // New fields for advanced capabilities
    embedding?: number[];
    isCompressed?: boolean;
    summaryOfIds?: string[];
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
    embedding?: number[];
}

export interface MemoryQuery {
    workspaceId: string;
    agentId: string;
    scope: MemoryScope;
    scopeKey: string;
    types?: MemoryType[];
    limit?: number;
    minImportance?: number;
    // New fields for vector search
    embedding?: number[];
    similarityThreshold?: number;
}

export interface MemoryStore {
    provider: MemoryProvider;
    put(items: MemoryWrite[]): Promise<void>;
    query(query: MemoryQuery): Promise<MemoryItem[]>;
    touch(ids: string[]): Promise<void>;
    deleteExpired?(): Promise<void>;
}
