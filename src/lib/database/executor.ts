'use server';

import type { DatabaseConnection, DbFilterCondition } from '@/lib/types';

export interface DbExecuteParams {
    connection: DatabaseConnection;
    operation: 'select' | 'insert' | 'update' | 'delete';
    table: string;
    columns?: string;
    data?: Record<string, any>;
    filters?: DbFilterCondition[];
}

export interface DbExecuteResult {
    success: boolean;
    data?: any[];
    rowCount?: number;
    error?: string;
}

export interface DbSchemaResult {
    tables?: { name: string }[];
    columns?: { name: string; type: string; nullable: boolean }[];
    error?: string;
}

export async function executeDatabaseOperation(params: DbExecuteParams): Promise<DbExecuteResult> {
    const { connection } = params;

    try {
        if (connection.type === 'postgres') {
            const { executePostgres } = await import('./postgres-adapter');
            return await executePostgres(params);
        }

        if (connection.type === 'supabase') {
            const { executeSupabase } = await import('./supabase-adapter');
            return await executeSupabase(params);
        }

        return { success: false, error: `Unsupported database type: ${connection.type}` };
    } catch (error: any) {
        console.error('[DB Executor] Unexpected error:', error);
        return { success: false, error: error.message || 'Unknown database error' };
    }
}

export async function fetchDatabaseSchema(
    connection: DatabaseConnection,
    table?: string
): Promise<DbSchemaResult> {
    try {
        if (connection.type === 'postgres') {
            const { fetchPostgresSchema } = await import('./postgres-adapter');
            return await fetchPostgresSchema(connection, table);
        }

        if (connection.type === 'supabase') {
            const { fetchSupabaseSchema } = await import('./supabase-adapter');
            return await fetchSupabaseSchema(connection, table);
        }

        return { error: `Unsupported database type: ${connection.type}` };
    } catch (error: any) {
        console.error('[DB Schema] Unexpected error:', error);
        return { error: error.message || 'Unknown schema error' };
    }
}

export async function testDatabaseConnection(connection: DatabaseConnection): Promise<{ success: boolean; error?: string }> {
    try {
        if (connection.type === 'postgres') {
            const { testPostgresConnection } = await import('./postgres-adapter');
            return await testPostgresConnection(connection);
        }

        if (connection.type === 'supabase') {
            const { testSupabaseConnection } = await import('./supabase-adapter');
            return await testSupabaseConnection(connection);
        }

        return { success: false, error: `Unsupported database type: ${connection.type}` };
    } catch (error: any) {
        return { success: false, error: error.message || 'Connection test failed' };
    }
}
