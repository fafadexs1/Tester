
'use server';

import { Pool, type QueryResult } from 'pg';
import dotenv from 'dotenv';
import type { WorkspaceData, FlowSession, NodeData, Connection } from '@/lib/types';

dotenv.config();

let pool: Pool | null = null;

function getDbPool(): Pool {
    if (pool) {
        return pool;
    }
    
    console.log('[DB Actions] Creating new PostgreSQL connection pool...');
    const useSSL = process.env.POSTGRES_SSL === 'true';
    pool = new Pool({
        host: process.env.POSTGRES_HOST,
        port: process.env.POSTGRES_PORT ? parseInt(process.env.POSTGRES_PORT, 10) : 5432,
        user: process.env.POSTGRES_USER,
        password: process.env.POSTGRES_PASSWORD,
        database: process.env.POSTGRES_DATABASE,
        ssl: useSSL ? { rejectUnauthorized: false } : false,
        idleTimeoutMillis: 60000,
        connectionTimeoutMillis: 10000,
    });

    pool.on('error', (err, client) => {
        console.error('[DB Actions] PostgreSQL Pool Error:', err);
        pool = null;
    });

    return pool;
}

async function initializeDatabaseSchema(): Promise<void> {
  const poolInstance = getDbPool();
  const client = await poolInstance.connect();
  try {
    console.log('[DB Actions] Initializing database schema if needed...');
    await client.query('BEGIN');

    await client.query(`
      CREATE TABLE IF NOT EXISTS workspaces (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        nodes JSONB,
        connections JSONB,
        owner TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS flow_sessions (
        session_id TEXT PRIMARY KEY,
        workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
        current_node_id TEXT,
        flow_variables JSONB,
        awaiting_input_type TEXT,
        awaiting_input_details JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        last_interaction_at TIMESTAMPTZ DEFAULT NOW(),
        session_timeout_seconds INTEGER DEFAULT 0
      );
    `);
    
    // --- Schema Migration Section ---
    // This section handles adding new columns to existing tables without dropping them.
    console.log('[DB Actions] Checking for necessary schema migrations...');
    
    // Add 'session_timeout_seconds' to 'flow_sessions' if it doesn't exist
    const checkColumnQuery = await client.query(`
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='flow_sessions' AND column_name='session_timeout_seconds'
    `);
    if (checkColumnQuery.rowCount === 0) {
        console.log("[DB Actions] Migration needed: 'session_timeout_seconds' column is missing from 'flow_sessions'. Adding it now...");
        await client.query(`
            ALTER TABLE flow_sessions
            ADD COLUMN session_timeout_seconds INTEGER NOT NULL DEFAULT 0;
        `);
        console.log("[DB Actions] Migration complete: Successfully added 'session_timeout_seconds' column.");
    } else {
        console.log("[DB Actions] Migration check: 'session_timeout_seconds' column already exists. No action needed.");
    }
    // --- End of Schema Migration Section ---


    await client.query('COMMIT');
    console.log('[DB Actions] Schema initialization check complete.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[DB Actions] Error initializing database schema, transaction rolled back.', error);
    throw error;
  } finally {
    client.release();
  }
}

async function runQuery<T>(query: string, params: any[] = []): Promise<QueryResult<T>> {
    const poolInstance = getDbPool();
    try {
        const client = await poolInstance.connect();
        try {
            return await client.query<T>(query, params);
        } finally {
            client.release();
        }
    } catch (error: any) {
        console.error(`[DB Actions] Query failed: ${query.substring(0, 100)}...`, { error: error.message, code: error.code });
        if (['ECONNRESET', 'ECONNREFUSED'].includes(error.code) || error.message.includes('timeout')) {
            if (pool) await pool.end();
            pool = null;
        }
        if (error.code === '42P01' || (error.code === '42703' && error.message.includes('session_timeout_seconds'))) { // 42P01: undefined_table, 42703: undefined_column
            const logMessage = error.code === '42P01' 
                ? '[DB Actions] Table not found. Attempting to initialize schema and retry...'
                : `[DB Actions] Column 'session_timeout_seconds' not found. Attempting to initialize schema and retry...`;
            
            console.warn(logMessage);

            try {
                await initializeDatabaseSchema();
                console.log('[DB Actions] Schema initialized. Retrying query...');
                const client = await poolInstance.connect();
                 try {
                    return await client.query<T>(query, params);
                } finally {
                    client.release();
                }
            } catch (initError) {
                 console.error('[DB Actions] Fatal: Failed to initialize schema after table/column not found.', initError);
                 throw initError;
            }
        }
        throw error;
    }
}


// --- Workspace Actions ---
export async function saveWorkspaceToDB(workspaceData: WorkspaceData): Promise<{ success: boolean; error?: string }> {
  try {
    const query = `
      INSERT INTO workspaces (id, name, nodes, connections, owner, updated_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
      ON CONFLICT (id) DO UPDATE
      SET name = EXCLUDED.name,
          nodes = EXCLUDED.nodes,
          connections = EXCLUDED.connections,
          owner = EXCLUDED.owner,
          updated_at = NOW();
    `;
    await runQuery(query, [
      workspaceData.id,
      workspaceData.name,
      JSON.stringify(workspaceData.nodes || []), 
      JSON.stringify(workspaceData.connections || []),
      workspaceData.owner,
    ]);
    return { success: true };
  } catch (error: any) {
    console.error(`[DB Actions] saveWorkspaceToDB Error:`, error);
     let errorMessage = `PG Error: ${error.message || 'Unknown DB error'} (Code: ${error.code || 'N/A'})`;
     if (error.constraint === 'workspaces_name_key') {
        errorMessage = `Error: Workspace name '${workspaceData.name}' already exists. Please use a unique name.`;
    }
    return { success: false, error: errorMessage };
  }
}

export async function loadWorkspaceFromDB(workspaceId: string): Promise<WorkspaceData | null> {
  try {
    const result = await runQuery<WorkspaceData>('SELECT id, name, nodes, connections, owner, created_at, updated_at FROM workspaces WHERE id = $1', [workspaceId]);
    if (result.rows.length > 0) {
      const row = result.rows[0];
      return { 
        ...row, 
        nodes: row.nodes || [], 
        connections: row.connections || []
      };
    }
    return null;
  } catch (error: any) {
    console.error(`[DB Actions] loadWorkspaceFromDB Error for ID ${workspaceId}:`, error);
    return null;
  }
}

export async function loadWorkspaceByNameFromDB(name: string): Promise<WorkspaceData | null> {
    try {
        const result = await runQuery<WorkspaceData>('SELECT id, name, nodes, connections, owner, created_at, updated_at FROM workspaces WHERE name = $1', [name]);
        if (result.rows.length > 0) {
            const row = result.rows[0];
            return {
                ...row,
                nodes: row.nodes || [],
                connections: row.connections || [],
            };
        }
        return null;
    } catch (error: any) {
        console.error(`[DB Actions] loadWorkspaceByNameFromDB Error for name "${name}":`, error);
        return null;
    }
}


export async function loadAllWorkspacesFromDB(): Promise<WorkspaceData[]> {
  try {
    const result = await runQuery<WorkspaceData>(
      'SELECT id, name, nodes, connections, owner, created_at, updated_at FROM workspaces ORDER BY updated_at DESC'
    );
     return result.rows.map(row => ({
        ...row,
        nodes: row.nodes || [],
        connections: row.connections || [],
      }));
  } catch (error: any) {
    console.error('[DB Actions] loadAllWorkspacesFromDB Error:', error);
    return [];
  }
}

export async function deleteWorkspaceFromDB(workspaceId: string): Promise<{ success: boolean; error?: string }> {
  try {
    await runQuery('DELETE FROM workspaces WHERE id = $1', [workspaceId]);
    return { success: true };
  } catch (error: any) {
    console.error(`[DB Actions] deleteWorkspaceFromDB Error for ID ${workspaceId}:`, error);
    return { success: false, error: error.message };
  }
}

export async function deleteWorkspaceAction(workspaceId: string): Promise<{ success: boolean, error?: string }> {
  console.log(`[DB Actions Client] Attempting to delete workspace ${workspaceId}`);
  return deleteWorkspaceFromDB(workspaceId);
}


// --- Flow Session Actions ---
export async function saveSessionToDB(sessionData: FlowSession): Promise<{ success: boolean; error?: string }> {
  try {
    const query = `
      INSERT INTO flow_sessions (session_id, workspace_id, current_node_id, flow_variables, awaiting_input_type, awaiting_input_details, session_timeout_seconds, last_interaction_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      ON CONFLICT (session_id) DO UPDATE
      SET workspace_id = EXCLUDED.workspace_id,
          current_node_id = EXCLUDED.current_node_id,
          flow_variables = EXCLUDED.flow_variables,
          awaiting_input_type = EXCLUDED.awaiting_input_type,
          awaiting_input_details = EXCLUDED.awaiting_input_details,
          session_timeout_seconds = EXCLUDED.session_timeout_seconds,
          last_interaction_at = NOW();
    `;
    await runQuery(query, [
      sessionData.session_id,
      sessionData.workspace_id,
      sessionData.current_node_id,
      JSON.stringify(sessionData.flow_variables || {}),
      sessionData.awaiting_input_type,
      sessionData.awaiting_input_details ? JSON.stringify(sessionData.awaiting_input_details) : null,
      sessionData.session_timeout_seconds || 0,
    ]);
    return { success: true };
  } catch (error: any) {
    console.error(`[DB Actions] saveSessionToDB Error for ID ${sessionData.session_id}:`, error);
    return { success: false, error: `PG Error saving session: ${error.message}` };
  }
}

export async function loadSessionFromDB(sessionId: string): Promise<FlowSession | null> {
  try {
    const result = await runQuery<FlowSession>(
      'SELECT session_id, workspace_id, current_node_id, flow_variables, awaiting_input_type, awaiting_input_details, session_timeout_seconds, created_at, last_interaction_at FROM flow_sessions WHERE session_id = $1',
      [sessionId]
    );
    if (result.rows.length > 0) {
      const row = result.rows[0];
      return { 
        ...row, 
        flow_variables: row.flow_variables || {},
        awaiting_input_details: row.awaiting_input_details || null
      };
    }
    return null;
  } catch (error: any) {
    console.error(`[DB Actions] loadSessionFromDB Error for ID ${sessionId}:`, error);
    return null;
  }
}

export async function deleteSessionFromDB(sessionId: string): Promise<{ success: boolean; error?: string }> {
  try {
    await runQuery('DELETE FROM flow_sessions WHERE session_id = $1', [sessionId]);
    return { success: true };
  } catch (error: any) {
    console.error(`[DB Actions] deleteSessionFromDB Error for ID ${sessionId}:`, error);
    return { success: false, error: error.message };
  }
}

export async function loadAllActiveSessionsFromDB(): Promise<FlowSession[]> {
  try {
    const result = await runQuery<FlowSession>(
      'SELECT session_id, workspace_id, current_node_id, flow_variables, awaiting_input_type, awaiting_input_details, session_timeout_seconds, created_at, last_interaction_at FROM flow_sessions ORDER BY last_interaction_at DESC'
    );
    return result.rows.map(row => ({
      ...row,
      flow_variables: row.flow_variables || {},
      awaiting_input_details: row.awaiting_input_details || null,
    }));
  } catch (error: any) {
    console.error('[DB Actions] loadAllActiveSessionsFromDB Error:', error);
    return [];
  }
}

(async () => {
    try {
        console.log('[DB Actions] Performing initial connection check and schema initialization...');
        await initializeDatabaseSchema();
        console.log('[DB Actions] Database connection and schema are ready.');
    } catch (error: any) {
        console.error('[DB Actions] FATAL: Initial database setup failed.', {
            message: error.message,
            code: error.code,
            hint: "Please check your .env file and ensure the PostgreSQL server is running and accessible."
        });
    }
})();
    

    