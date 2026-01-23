
import { NextResponse } from 'next/server';
import { PostgresMemoryStore } from '@/lib/agent/memory/stores/postgres-store';

export async function POST(req: Request) {
    try {
        const store = new PostgresMemoryStore();
        // Use a method to force schema check/creation
        // Since ensureSchema is private, we can trigger it by calling touch with empty list or a specific public method if we expose one.
        // However, touch returns early if list is empty.
        // Query also calls ensureSchema.

        // We'll create a dummy query that does nothing but triggers schema check
        await store.query({
            workspaceId: 'setup',
            agentId: 'setup',
            scope: 'session',
            scopeKey: 'setup',
            limit: 1
        });

        return NextResponse.json({ success: true, message: 'Memory schema initialized successfully.' });
    } catch (error: any) {
        console.error('[MemorySetup] Failed:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
