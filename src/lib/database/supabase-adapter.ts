import type { DatabaseConnection, DbFilterCondition } from '@/lib/types';
import type { DbExecuteParams, DbExecuteResult, DbSchemaResult } from './executor';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

function getClient(connection: DatabaseConnection): SupabaseClient {
    if (!connection.supabaseUrl || !connection.supabaseKey) {
        throw new Error('Supabase URL and Key are required');
    }
    return createClient(connection.supabaseUrl, connection.supabaseKey);
}

function applyFilters(query: any, filters: DbFilterCondition[] | undefined): any {
    if (!filters || filters.length === 0) return query;

    for (const filter of filters) {
        if (!filter.column) continue;

        switch (filter.operator) {
            case '=': query = query.eq(filter.column, filter.value); break;
            case '!=': query = query.neq(filter.column, filter.value); break;
            case '>': query = query.gt(filter.column, filter.value); break;
            case '<': query = query.lt(filter.column, filter.value); break;
            case '>=': query = query.gte(filter.column, filter.value); break;
            case '<=': query = query.lte(filter.column, filter.value); break;
            case 'LIKE': query = query.like(filter.column, filter.value); break;
            case 'ILIKE': query = query.ilike(filter.column, filter.value); break;
            case 'IN': {
                const values = filter.value.split(',').map(v => v.trim());
                query = query.in(filter.column, values);
                break;
            }
            case 'IS NULL': query = query.is(filter.column, null); break;
            case 'IS NOT NULL': query = query.not(filter.column, 'is', null); break;
        }
    }

    return query;
}

export async function executeSupabase(params: DbExecuteParams): Promise<DbExecuteResult> {
    try {
        const client = getClient(params.connection);

        switch (params.operation) {
            case 'select': {
                const columns = params.columns?.trim() || '*';
                let query = client.from(params.table).select(columns);
                query = applyFilters(query, params.filters);
                query = query.limit(1000);
                const { data, error, count } = await query;
                if (error) return { success: false, error: error.message };
                return { success: true, data: data ?? [], rowCount: data?.length ?? 0 };
            }

            case 'insert': {
                if (!params.data || Object.keys(params.data).length === 0) {
                    return { success: false, error: 'No data provided for INSERT' };
                }
                const { data, error } = await client.from(params.table).insert(params.data).select();
                if (error) return { success: false, error: error.message };
                return { success: true, data: data ?? [], rowCount: data?.length ?? 0 };
            }

            case 'update': {
                if (!params.data || Object.keys(params.data).length === 0) {
                    return { success: false, error: 'No data provided for UPDATE' };
                }
                let query = client.from(params.table).update(params.data);
                query = applyFilters(query, params.filters);
                const { data, error } = await query.select();
                if (error) return { success: false, error: error.message };
                return { success: true, data: data ?? [], rowCount: data?.length ?? 0 };
            }

            case 'delete': {
                if (!params.filters || params.filters.length === 0) {
                    return { success: false, error: 'DELETE without filters is not allowed for safety' };
                }
                let query = client.from(params.table).delete();
                query = applyFilters(query, params.filters);
                const { data, error } = await query.select();
                if (error) return { success: false, error: error.message };
                return { success: true, data: data ?? [], rowCount: data?.length ?? 0 };
            }

            default:
                return { success: false, error: `Unknown operation: ${params.operation}` };
        }
    } catch (error: any) {
        console.error('[Supabase Adapter] Error:', error.message);
        return { success: false, error: error.message };
    }
}

export async function fetchSupabaseSchema(
    connection: DatabaseConnection,
    table?: string
): Promise<DbSchemaResult> {
    try {
        if (!connection.supabaseUrl || !connection.supabaseKey) {
            return { error: 'Supabase URL and Key are required' };
        }

        const restUrl = connection.supabaseUrl.replace(/\/$/, '');

        if (!table) {
            const res = await fetch(`${restUrl}/rest/v1/`, {
                headers: {
                    'apikey': connection.supabaseKey,
                    'Authorization': `Bearer ${connection.supabaseKey}`,
                },
            });

            if (!res.ok) {
                const openApiRes = await fetch(`${restUrl}/rest/v1/?apikey=${connection.supabaseKey}`);
                if (!openApiRes.ok) return { error: `Failed to fetch schema: ${res.status}` };
                const openApi = await openApiRes.json();
                const paths = Object.keys(openApi.paths || {});
                const tables = paths
                    .filter(p => p.startsWith('/') && !p.includes('{'))
                    .map(p => ({ name: p.replace(/^\//, '') }));
                return { tables };
            }

            const openApi = await res.json();
            if (openApi.definitions) {
                const tables = Object.keys(openApi.definitions).map(name => ({ name }));
                return { tables };
            }
            if (openApi.paths) {
                const tables = Object.keys(openApi.paths)
                    .filter(p => p.startsWith('/') && !p.includes('{'))
                    .map(p => ({ name: p.replace(/^\//, '') }));
                return { tables };
            }

            return { tables: [] };
        }

        // Fetch columns by querying a single row
        const client = getClient(connection);
        const { data, error } = await client.from(table).select('*').limit(0);

        if (error) {
            // Fallback: try PostgreSQL information_schema via RPC if accessible
            return { error: error.message };
        }

        // Supabase doesn't easily expose column types via REST, use the OpenAPI spec
        const openApiRes = await fetch(`${restUrl}/rest/v1/?apikey=${connection.supabaseKey}`);
        if (openApiRes.ok) {
            const openApi = await openApiRes.json();
            const def = openApi.definitions?.[table];
            if (def?.properties) {
                const columns = Object.entries(def.properties).map(([name, prop]: [string, any]) => ({
                    name,
                    type: prop.format || prop.type || 'unknown',
                    nullable: !(def.required || []).includes(name),
                }));
                return { columns };
            }
        }

        return { columns: [] };
    } catch (error: any) {
        return { error: error.message };
    }
}

export async function testSupabaseConnection(
    connection: DatabaseConnection
): Promise<{ success: boolean; error?: string }> {
    try {
        const client = getClient(connection);
        // A simple health check — try to query a non-existent table placeholder
        const { error } = await client.from('_health_check_nonexistent_').select('*').limit(0);
        // 42P01 = relation does not exist — that's fine, means we connected
        if (error && !error.message.includes('does not exist') && !error.code?.includes('42P01') && error.code !== 'PGRST116') {
            return { success: false, error: error.message };
        }
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}
