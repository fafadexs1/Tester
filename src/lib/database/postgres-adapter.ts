import type { DatabaseConnection, DbFilterCondition } from '@/lib/types';
import type { DbExecuteParams, DbExecuteResult, DbSchemaResult } from './executor';
import pg from 'pg';

const { Pool } = pg;

function buildConnectionConfig(conn: DatabaseConnection): pg.PoolConfig {
    return {
        host: conn.host || 'localhost',
        port: conn.port || 5432,
        database: conn.database || 'postgres',
        user: conn.username,
        password: conn.password,
        ssl: conn.ssl ? { rejectUnauthorized: false } : false,
        max: 2,
        idleTimeoutMillis: 10000,
        connectionTimeoutMillis: 5000,
    };
}

function buildWhereClause(filters: DbFilterCondition[] | undefined): { clause: string; values: any[] } {
    if (!filters || filters.length === 0) return { clause: '', values: [] };

    const conditions: string[] = [];
    const values: any[] = [];

    for (const filter of filters) {
        if (!filter.column) continue;

        const col = quoteIdentifier(filter.column);

        if (filter.operator === 'IS NULL') {
            conditions.push(`${col} IS NULL`);
        } else if (filter.operator === 'IS NOT NULL') {
            conditions.push(`${col} IS NOT NULL`);
        } else if (filter.operator === 'IN') {
            const inValues = filter.value.split(',').map(v => v.trim());
            const placeholders = inValues.map((_, i) => `$${values.length + i + 1}`).join(', ');
            values.push(...inValues);
            conditions.push(`${col} IN (${placeholders})`);
        } else {
            values.push(filter.value);
            conditions.push(`${col} ${filter.operator} $${values.length}`);
        }
    }

    return {
        clause: conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '',
        values,
    };
}

function quoteIdentifier(name: string): string {
    return `"${name.replace(/"/g, '""')}"`;
}

export async function executePostgres(params: DbExecuteParams): Promise<DbExecuteResult> {
    const pool = new Pool(buildConnectionConfig(params.connection));

    try {
        const table = quoteIdentifier(params.table);

        switch (params.operation) {
            case 'select': {
                const columns = params.columns?.trim() || '*';
                const { clause, values } = buildWhereClause(params.filters);
                const query = `SELECT ${columns} FROM ${table}${clause} LIMIT 1000`;
                const result = await pool.query(query, values);
                return { success: true, data: result.rows, rowCount: result.rowCount ?? 0 };
            }

            case 'insert': {
                if (!params.data || Object.keys(params.data).length === 0) {
                    return { success: false, error: 'No data provided for INSERT' };
                }
                const keys = Object.keys(params.data);
                const cols = keys.map(quoteIdentifier).join(', ');
                const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
                const values = Object.values(params.data);
                const query = `INSERT INTO ${table} (${cols}) VALUES (${placeholders}) RETURNING *`;
                const result = await pool.query(query, values);
                return { success: true, data: result.rows, rowCount: result.rowCount ?? 0 };
            }

            case 'update': {
                if (!params.data || Object.keys(params.data).length === 0) {
                    return { success: false, error: 'No data provided for UPDATE' };
                }
                const keys = Object.keys(params.data);
                const setClause = keys.map((k, i) => `${quoteIdentifier(k)} = $${i + 1}`).join(', ');
                const dataValues = Object.values(params.data);

                const { clause: whereClause, values: whereValues } = buildWhereClause(params.filters);
                const reIndexedWhere = whereClause.replace(/\$(\d+)/g, (_, n) => `$${parseInt(n) + dataValues.length}`);

                const query = `UPDATE ${table} SET ${setClause}${reIndexedWhere} RETURNING *`;
                const result = await pool.query(query, [...dataValues, ...whereValues]);
                return { success: true, data: result.rows, rowCount: result.rowCount ?? 0 };
            }

            case 'delete': {
                const { clause, values } = buildWhereClause(params.filters);
                if (!clause) {
                    return { success: false, error: 'DELETE without filters is not allowed for safety' };
                }
                const query = `DELETE FROM ${table}${clause} RETURNING *`;
                const result = await pool.query(query, values);
                return { success: true, data: result.rows, rowCount: result.rowCount ?? 0 };
            }

            default:
                return { success: false, error: `Unknown operation: ${params.operation}` };
        }
    } catch (error: any) {
        console.error('[Postgres Adapter] Query error:', error.message);
        return { success: false, error: error.message };
    } finally {
        await pool.end();
    }
}

export async function fetchPostgresSchema(
    connection: DatabaseConnection,
    table?: string
): Promise<DbSchemaResult> {
    const pool = new Pool(buildConnectionConfig(connection));

    try {
        if (!table) {
            const result = await pool.query(
                `SELECT table_name as name FROM information_schema.tables
         WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
         ORDER BY table_name`
            );
            return { tables: result.rows };
        }

        const result = await pool.query(
            `SELECT column_name as name, data_type as type, is_nullable = 'YES' as nullable
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = $1
       ORDER BY ordinal_position`,
            [table]
        );
        return { columns: result.rows };
    } catch (error: any) {
        return { error: error.message };
    } finally {
        await pool.end();
    }
}

export async function testPostgresConnection(
    connection: DatabaseConnection
): Promise<{ success: boolean; error?: string }> {
    const pool = new Pool(buildConnectionConfig(connection));

    try {
        await pool.query('SELECT 1');
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    } finally {
        await pool.end();
    }
}
