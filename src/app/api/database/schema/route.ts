import { NextRequest, NextResponse } from 'next/server';
import { fetchDatabaseSchema, testDatabaseConnection } from '@/lib/database/executor';
import type { DatabaseConnection } from '@/lib/types';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { action, connection, table } = body as {
            action: 'schema' | 'test';
            connection: DatabaseConnection;
            table?: string;
        };

        if (!connection || !connection.type) {
            return NextResponse.json({ error: 'Invalid connection data' }, { status: 400 });
        }

        if (action === 'test') {
            const result = await testDatabaseConnection(connection);
            return NextResponse.json(result);
        }

        const result = await fetchDatabaseSchema(connection, table);
        return NextResponse.json(result);
    } catch (error: any) {
        console.error('[API /database/schema] Error:', error);
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
    }
}
