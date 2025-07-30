
'use server';

import { Pool, type QueryResult } from 'pg';
import dotenv from 'dotenv';
import type { WorkspaceData, FlowSession, NodeData, Connection } from '@/lib/types';

dotenv.config();

let pool: Pool | null = null;
let dbInitializationPromise: Promise<void> | null = null;

console.log('[DB Actions] databaseActions.ts loaded. POSTGRES_HOST:', process.env.POSTGRES_HOST ? 'Set' : 'Not Set');

async function initializeDatabaseSchema(existingPool: Pool): Promise<void> {
  console.log('[DB Actions] initializeDatabaseSchema: Starting schema initialization...');
  const client = await existingPool.connect();
  try {
    console.log('[DB Actions] initializeDatabaseSchema: Connected to DB for schema setup.');

    await client.query('BEGIN');

    await client.query(`
      CREATE OR REPLACE FUNCTION trigger_set_timestamp()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

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
    
    // Trigger para workspaces.updated_at
    await client.query(`
      DO $$
      BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_workspaces_timestamp') THEN
              CREATE TRIGGER set_workspaces_timestamp
              BEFORE UPDATE ON workspaces
              FOR EACH ROW
              EXECUTE FUNCTION trigger_set_timestamp();
          END IF;
      END;
      $$;
    `);

    await client.query(`
      CREATE OR REPLACE FUNCTION trigger_set_session_interaction_timestamp()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.last_interaction_at = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS flow_sessions (
        session_id TEXT PRIMARY KEY,
        workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
        current_node_id TEXT,
        flow_variables JSONB,
        awaiting_input_type TEXT,
        awaiting_input_details JSONB,
        session_timeout_seconds INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        last_interaction_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    
    // Trigger para flow_sessions.last_interaction_at
    await client.query(`
      DO $$
      BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_flow_sessions_interaction_timestamp') THEN
              CREATE TRIGGER set_flow_sessions_interaction_timestamp
              BEFORE UPDATE ON flow_sessions
              FOR EACH ROW
              EXECUTE FUNCTION trigger_set_session_interaction_timestamp();
          END IF;
      END;
      $$;
    `);

    await client.query('COMMIT');
    console.log('[DB Actions] initializeDatabaseSchema: Database schema initialized successfully.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[DB Actions] initializeDatabaseSchema: Error initializing database schema, transaction rolled back.', error);
    throw error;
  } finally {
    client.release();
  }
}

function getDbPool(): Pool {
    if (pool) {
        return pool;
    }
    
    console.log('[DB Actions] getDbPool: Creating new PostgreSQL connection pool...');
    const useSSL = process.env.POSTGRES_SSL === 'true';
    const poolConfig = {
        host: process.env.POSTGRES_HOST,
        port: process.env.POSTGRES_PORT ? parseInt(process.env.POSTGRES_PORT, 10) : 5432,
        user: process.env.POSTGRES_USER,
        password: process.env.POSTGRES_PASSWORD,
        database: process.env.POSTGRES_DATABASE,
        ssl: useSSL ? { rejectUnauthorized: false } : false,
        idleTimeoutMillis: 60000,
        connectionTimeoutMillis: 30000,
    };
    
    pool = new Pool(poolConfig);

    pool.on('error', (err, client) => {
        console.error('[DB Actions] getDbPool: PostgreSQL Pool Error - Idle client error', err.message, err.stack);
    });

    console.log('[DB Actions] getDbPool: PostgreSQL connection pool configured.');
    return pool;
}

async function ensureDbInitialized(): Promise<void> {
    if (!dbInitializationPromise) {
        console.log('[DB Actions] ensureDbInitialized: First call. Starting DB initialization...');
        dbInitializationPromise = (async () => {
            try {
                const poolInstance = getDbPool();
                await poolInstance.query('SELECT 1'); // Test connection
                console.log('[DB Actions] ensureDbInitialized: Database connection successful.');
                await initializeDatabaseSchema(poolInstance);
            } catch (error) {
                console.error('[DB Actions] ensureDbInitialized: Database initialization FAILED.', error);
                pool = null; // Reset pool on failure
                dbInitializationPromise = null; // Allow retrying
                throw new Error(`Database initialization failed: ${error}`);
            }
        })();
    }
    await dbInitializationPromise;
}

// Eagerly initialize on module load
ensureDbInitialized().catch(() => {
  // Catch error here to prevent unhandled promise rejection at module level
});


// --- Workspace Actions ---
export async function saveWorkspaceToDB(workspaceData: WorkspaceData): Promise<{ success: boolean; error?: string }> {
  try {
    await ensureDbInitialized();
    const poolInstance = getDbPool();
    console.log(`[DB Actions] saveWorkspaceToDB: Saving workspace to DB: ${workspaceData.id} (${workspaceData.name})`);
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
    await poolInstance.query(query, [
      workspaceData.id,
      workspaceData.name,
      JSON.stringify(workspaceData.nodes || []), 
      JSON.stringify(workspaceData.connections || []),
      workspaceData.owner,
    ]);
    return { success: true };
  } catch (error: any) {
    console.error(`[DB Actions] saveWorkspaceToDB: Error saving workspace ${workspaceData.id}:`, error.message);
    const pgError = error as { code?: string; detail?: string; hint?: string; message?: string, constraint?: string };
    let errorMessage = `PG Error: ${pgError.message || 'Unknown DB error'} (Code: ${pgError.code || 'N/A'})`;
     if (pgError.constraint === 'workspaces_name_key') {
        errorMessage = `Error: Workspace name '${workspaceData.name}' already exists. Please use a unique name.`;
    }
    return { success: false, error: errorMessage };
  }
}

export async function loadWorkspaceFromDB(workspaceId: string): Promise<WorkspaceData | null> {
  try {
    await ensureDbInitialized();
    const poolInstance = getDbPool();
    const result: QueryResult<WorkspaceData> = await poolInstance.query('SELECT id, name, nodes, connections, owner, created_at, updated_at FROM workspaces WHERE id = $1', [workspaceId]);
    if (result.rows.length > 0) {
      const row = result.rows[0];
      return { 
        ...row, 
        nodes: typeof row.nodes === 'string' ? JSON.parse(row.nodes) : (row.nodes || []), 
        connections: typeof row.connections === 'string' ? JSON.parse(row.connections) : (row.connections || [])
      };
    }
    return null;
  } catch (error: any) {
    console.error(`[DB Actions] loadWorkspaceFromDB: Error loading workspace ${workspaceId}:`, error);
    return null;
  }
}

export async function loadWorkspaceByNameFromDB(name: string): Promise<WorkspaceData | null> {
    try {
        await ensureDbInitialized();
        const poolInstance = getDbPool();
        const result: QueryResult<WorkspaceData> = await poolInstance.query('SELECT id, name, nodes, connections, owner, created_at, updated_at FROM workspaces WHERE name = $1', [name]);
        if (result.rows.length > 0) {
            const row = result.rows[0];
            return {
                ...row,
                nodes: typeof row.nodes === 'string' ? JSON.parse(row.nodes) : (row.nodes || []),
                connections: typeof row.connections === 'string' ? JSON.parse(row.connections) : (row.connections || []),
            };
        }
        return null;
    } catch (error: any) {
        console.error(`[DB Actions] loadWorkspaceByNameFromDB: Error loading workspace by name "${name}":`, error);
        return null;
    }
}


export async function loadAllWorkspacesFromDB(): Promise<WorkspaceData[]> {
  try {
    await ensureDbInitialized();
    const poolInstance = getDbPool();
    const result: QueryResult<WorkspaceData> = await poolInstance.query(
      'SELECT id, name, nodes, connections, owner, created_at, updated_at FROM workspaces ORDER BY updated_at DESC'
    );
     return result.rows.map(row => ({
        ...row,
        nodes: typeof row.nodes === 'string' ? JSON.parse(row.nodes) : (row.nodes || []),
        connections: typeof row.connections === 'string' ? JSON.parse(row.connections) : (row.connections || []),
      }));
  } catch (error: any) {
    console.error('[DB Actions] loadAllWorkspacesFromDB: Error loading all workspaces:', error);
    return [];
  }
}

export async function loadActiveWorkspaceFromDB(): Promise<WorkspaceData | null> {
  try {
    await ensureDbInitialized();
    const poolInstance = getDbPool();
    const result: QueryResult<WorkspaceData> = await poolInstance.query(
      'SELECT id, name, nodes, connections, owner, created_at, updated_at FROM workspaces ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST LIMIT 1'
    );
    if (result.rows.length > 0) {
      const row = result.rows[0];
      return { 
        ...row, 
        nodes: typeof row.nodes === 'string' ? JSON.parse(row.nodes) : (row.nodes || []),
        connections: typeof row.connections === 'string' ? JSON.parse(row.connections) : (row.connections || [])
      };
    }
    return null;
  } catch (error: any) {
    console.error('[DB Actions] loadActiveWorkspaceFromDB: Error loading active workspace:', error);
    return null;
  }
}

export async function deleteWorkspaceFromDB(workspaceId: string): Promise<{ success: boolean; error?: string }> {
  try {
    await ensureDbInitialized();
    const poolInstance = getDbPool();
    await poolInstance.query('DELETE FROM workspaces WHERE id = $1', [workspaceId]);
    return { success: true };
  } catch (error: any) {
    console.error(`[DB Actions] deleteWorkspaceFromDB: Error deleting workspace ${workspaceId}:`, error.message);
    return { success: false, error: error.message };
  }
}

// --- Flow Session Actions ---
export async function saveSessionToDB(sessionData: FlowSession): Promise<{ success: boolean; error?: string }> {
  try {
    await ensureDbInitialized();
    const poolInstance = getDbPool();
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
    await poolInstance.query(query, [
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
    console.error(`[DB Actions] saveSessionToDB: Error saving session ${sessionData.session_id}:`, error.message);
    return { success: false, error: `PG Error saving session: ${error.message}` };
  }
}

export async function loadSessionFromDB(sessionId: string): Promise<FlowSession | null> {
  try {
    await ensureDbInitialized();
    const poolInstance = getDbPool();
    const result: QueryResult<FlowSession> = await poolInstance.query(
      'SELECT session_id, workspace_id, current_node_id, flow_variables, awaiting_input_type, awaiting_input_details, session_timeout_seconds, created_at, last_interaction_at FROM flow_sessions WHERE session_id = $1',
      [sessionId]
    );
    if (result.rows.length > 0) {
      const row = result.rows[0];
      return { 
        ...row, 
        flow_variables: typeof row.flow_variables === 'string' ? JSON.parse(row.flow_variables) : (row.flow_variables || {}),
        awaiting_input_details: typeof row.awaiting_input_details === 'string' ? JSON.parse(row.awaiting_input_details) : (row.awaiting_input_details || null)
      };
    }
    return null;
  } catch (error: any) {
    console.error(`[DB Actions] loadSessionFromDB: Error loading session ${sessionId}:`, error);
    return null;
  }
}

export async function deleteSessionFromDB(sessionId: string): Promise<{ success: boolean; error?: string }> {
  try {
    await ensureDbInitialized();
    const poolInstance = getDbPool();
    await poolInstance.query('DELETE FROM flow_sessions WHERE session_id = $1', [sessionId]);
    return { success: true };
  } catch (error: any) {
    console.error(`[DB Actions] deleteSessionFromDB: Error deleting session ${sessionId}:`, error.message);
    return { success: false, error: error.message };
  }
}

export async function loadAllActiveSessionsFromDB(): Promise<FlowSession[]> {
  try {
    await ensureDbInitialized();
    const poolInstance = getDbPool();
    const result = await poolInstance.query<FlowSession>(
      'SELECT session_id, workspace_id, current_node_id, flow_variables, awaiting_input_type, awaiting_input_details, session_timeout_seconds, created_at, last_interaction_at FROM flow_sessions ORDER BY last_interaction_at DESC'
    );
    return result.rows.map(row => ({
      ...row,
      flow_variables: typeof row.flow_variables === 'string' ? JSON.parse(row.flow_variables) : (row.flow_variables || {}),
      awaiting_input_details: typeof row.awaiting_input_details === 'string' ? JSON.parse(row.awaiting_input_details) : (row.awaiting_input_details || null),
    }));
  } catch (error: any) {
    console.error('[DB Actions] loadAllActiveSessionsFromDB: Error loading sessions:', error);
    return [];
  }
}

// Wrapper action for client components (Server Action)
export async function deleteWorkspaceAction(workspaceId: string): Promise<{ success: boolean, error?: string }> {
  console.log(`[DB Actions Client] Attempting to delete workspace ${workspaceId}`);
  // Adicionar lógica de verificação de permissão aqui, se necessário (ex: verificar o proprietário)
  return deleteWorkspaceFromDB(workspaceId);
}
