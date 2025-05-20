
'use server';

import { Pool, type QueryResult } from 'pg';
import dotenv from 'dotenv';
import type { WorkspaceData, FlowSession, NodeData, Connection } from '@/lib/types';

dotenv.config();

let pool: Pool | null = null;
let dbInitializationPromise: Promise<void> | null = null;

async function initializeDatabase(): Promise<void> {
  console.log('[DB Actions] initializeDatabase: Starting schema initialization...');
  let client;
  try {
    const tempPool = getDbPoolInternal(false); 
    client = await tempPool.connect();
    console.log('[DB Actions] initializeDatabase: Connected to DB for schema setup.');

    await client.query('BEGIN');

    // Função para auto-update 'updated_at'
    await client.query(`
      CREATE OR REPLACE FUNCTION trigger_set_timestamp()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    console.log('[DB Actions] initializeDatabase: "trigger_set_timestamp" function checked/created.');

    // Tabela Workspaces
    await client.query(`
      CREATE TABLE IF NOT EXISTS workspaces (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE, -- Adicionada restrição UNIQUE para 'name'
        nodes JSONB,
        connections JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('[DB Actions] initializeDatabase: "workspaces" table checked/created (with UNIQUE name).');

    await client.query(`
      DROP TRIGGER IF EXISTS set_workspaces_timestamp ON workspaces;
      CREATE TRIGGER set_workspaces_timestamp
      BEFORE UPDATE ON workspaces
      FOR EACH ROW
      EXECUTE FUNCTION trigger_set_timestamp();
    `);
    console.log('[DB Actions] initializeDatabase: Trigger for "workspaces.updated_at" checked/created.');
    
    // Função para 'last_interaction_at' das sessões
    await client.query(`
      CREATE OR REPLACE FUNCTION trigger_set_session_interaction_timestamp()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.last_interaction_at = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    console.log('[DB Actions] initializeDatabase: "trigger_set_session_interaction_timestamp" function checked/created.');

    // Tabela Flow Sessions
    await client.query(`
      CREATE TABLE IF NOT EXISTS flow_sessions (
        session_id TEXT PRIMARY KEY,
        workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
        current_node_id TEXT,
        flow_variables JSONB,
        awaiting_input_type TEXT,
        awaiting_input_details JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        last_interaction_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('[DB Actions] initializeDatabase: "flow_sessions" table checked/created.');

    await client.query(`
      DROP TRIGGER IF EXISTS set_flow_sessions_interaction_timestamp ON flow_sessions;
      CREATE TRIGGER set_flow_sessions_interaction_timestamp
      BEFORE UPDATE ON flow_sessions
      FOR EACH ROW
      EXECUTE FUNCTION trigger_set_session_interaction_timestamp();
    `);
    console.log('[DB Actions] initializeDatabase: Trigger for "flow_sessions.last_interaction_at" checked/created.');

    await client.query('COMMIT');
    console.log('[DB Actions] initializeDatabase: Database schema initialized successfully.');
    (globalThis as any).__db_initialized = true; 
  } catch (error: any) {
    if (client) {
      try {
        await client.query('ROLLBACK');
        console.error('[DB Actions] initializeDatabase: ROLLBACK successful due to error.');
      } catch (rollbackError) {
        console.error('[DB Actions] initializeDatabase: Error during ROLLBACK:', rollbackError);
      }
    }
    console.error('[DB Actions] initializeDatabase: Error initializing database schema:', error);
    (globalThis as any).__db_initialized = false; 
    dbInitializationPromise = null; 
    throw error; 
  } finally {
    if (client) {
      client.release();
    }
  }
}

function getDbPoolInternal(logCreation: boolean = true): Pool {
  if (!pool) {
    const useSSL = process.env.POSTGRES_SSL === 'true';
    if(logCreation) console.log('[DB Actions] getDbPoolInternal: Creating new PostgreSQL connection pool...');
    pool = new Pool({
      host: process.env.POSTGRES_HOST,
      port: process.env.POSTGRES_PORT ? parseInt(process.env.POSTGRES_PORT, 10) : 5432,
      user: process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASSWORD,
      database: process.env.POSTGRES_DATABASE,
      ssl: useSSL ? { rejectUnauthorized: false } : false,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000, 
    });

    pool.on('error', (err, client) => {
      console.error('[DB Actions] getDbPoolInternal: PostgreSQL Pool Error - Idle client error', err.message, err.stack);
      pool = null; 
    });
    if(logCreation) {
      console.log('[DB Actions] getDbPoolInternal: PostgreSQL connection pool configured. Testing connection...');
      pool.connect()
          .then(client => {
              console.log('[DB Actions] getDbPoolInternal: PostgreSQL pool test connection successful.');
              client.release();
          })
          .catch(err => {
              console.error('[DB Actions] getDbPoolInternal: PostgreSQL pool test connection failed:', err.message);
          });
    }
  }
  return pool;
}

async function ensureDbInitialized(): Promise<void> {
  if ((globalThis as any).__db_initialized === true) {
    return;
  }
  if (!dbInitializationPromise) {
    console.log('[DB Actions] ensureDbInitialized: First call or previous attempt failed. Starting DB schema initialization process...');
    dbInitializationPromise = initializeDatabase()
      .then(() => {
        console.log('[DB Actions] ensureDbInitialized: Database schema initialization completed successfully.');
        (globalThis as any).__db_initialized = true;
      })
      .catch((error) => {
        console.error('[DB Actions] ensureDbInitialized: Database schema initialization FAILED. Will retry on next relevant DB action.', error.message);
        (globalThis as any).__db_initialized = false;
        dbInitializationPromise = null; 
      });
  }
  try {
    await dbInitializationPromise;
  } catch (e) {
    console.warn('[DB Actions] ensureDbInitialized: Caught error while awaiting dbInitializationPromise, this is expected if initialization failed previously.');
  }
}

async function getDbPool(): Promise<Pool> {
  await ensureDbInitialized(); 
  return getDbPoolInternal();
}

// --- Workspace Actions ---
export async function saveWorkspaceToDB(workspaceData: WorkspaceData): Promise<{ success: boolean; error?: string }> {
  let client;
  try {
    const poolInstance = await getDbPool();
     if (!(globalThis as any).__db_initialized) {
      throw new Error("Database schema is not initialized. Cannot save workspace.");
    }
    client = await poolInstance.connect();
    console.log(`[DB Actions] saveWorkspaceToDB: Saving workspace to DB: ${workspaceData.id} (${workspaceData.name})`);
    const query = `
      INSERT INTO workspaces (id, name, nodes, connections, updated_at)
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (id) DO UPDATE
      SET name = EXCLUDED.name,
          nodes = EXCLUDED.nodes,
          connections = EXCLUDED.connections,
          updated_at = NOW();
    `;
    await client.query(query, [
      workspaceData.id,
      workspaceData.name,
      JSON.stringify(workspaceData.nodes || []), 
      JSON.stringify(workspaceData.connections || []), 
    ]);
    console.log(`[DB Actions] saveWorkspaceToDB: Query executed for workspace ${workspaceData.id}.`);
    return { success: true };
  } catch (error: any) {
    console.error(`[DB Actions] saveWorkspaceToDB: Error saving workspace ${workspaceData.id}:`, error.message);
    const pgError = error as { code?: string; detail?: string; hint?: string; message?: string, constraint?: string };
    let errorMessage = `PG Error: ${pgError.message || 'Unknown DB error'} (Code: ${pgError.code || 'N/A'})`;
    if (pgError.constraint === 'workspaces_name_key') {
        errorMessage = `Error: Workspace name '${workspaceData.name}' already exists. Please use a unique name.`;
    } else {
        errorMessage += ` (Detail: ${pgError.detail || 'N/A'}, Hint: ${pgError.hint || 'N/A'})`;
    }
    console.error('[DB Actions] Full error object saving workspace:', pgError);
    return { success: false, error: errorMessage };
  } finally {
    if (client) client.release();
  }
}

export async function loadWorkspaceFromDB(workspaceId: string): Promise<WorkspaceData | null> {
  let client;
  try {
    const poolInstance = await getDbPool();
    if (!(globalThis as any).__db_initialized) {
      console.warn("[DB Actions] loadWorkspaceFromDB: Database schema not initialized. Returning null.");
      return null;
    }
    client = await poolInstance.connect();
    console.log(`[DB Actions] loadWorkspaceFromDB: Loading workspace from DB by ID: ${workspaceId}`);
    const result: QueryResult<WorkspaceData> = await client.query('SELECT id, name, nodes, connections, created_at, updated_at FROM workspaces WHERE id = $1', [workspaceId]);
    if (result.rows.length > 0) {
      const row = result.rows[0];
      const nodes = typeof row.nodes === 'string' ? JSON.parse(row.nodes) : (row.nodes || []);
      const connections = typeof row.connections === 'string' ? JSON.parse(row.connections) : (row.connections || []);
      return { ...row, nodes, connections } as WorkspaceData;
    }
    return null;
  } catch (error: any) {
    console.error(`[DB Actions] loadWorkspaceFromDB: Error loading workspace ${workspaceId}:`, error);
    return null;
  } finally {
    if (client) client.release();
  }
}

export async function loadWorkspaceByNameFromDB(name: string): Promise<WorkspaceData | null> {
  let client;
  try {
    const poolInstance = await getDbPool();
    if (!(globalThis as any).__db_initialized) {
      console.warn("[DB Actions] loadWorkspaceByNameFromDB: Database schema not initialized. Returning null.");
      return null;
    }
    client = await poolInstance.connect();
    console.log(`[DB Actions] loadWorkspaceByNameFromDB: Loading workspace from DB by name: ${name}`);
    const result: QueryResult<WorkspaceData> = await client.query('SELECT id, name, nodes, connections, created_at, updated_at FROM workspaces WHERE name = $1', [name]);
    if (result.rows.length > 0) {
      const row = result.rows[0];
      const nodes = typeof row.nodes === 'string' ? JSON.parse(row.nodes) : (row.nodes || []);
      const connections = typeof row.connections === 'string' ? JSON.parse(row.connections) : (row.connections || []);
      console.log(`[DB Actions] loadWorkspaceByNameFromDB: Found workspace ${row.id} - ${row.name}`);
      return { ...row, nodes, connections } as WorkspaceData;
    }
    console.log(`[DB Actions] loadWorkspaceByNameFromDB: No workspace found with name: ${name}`);
    return null;
  } catch (error: any) {
    console.error(`[DB Actions] loadWorkspaceByNameFromDB: Error loading workspace by name ${name}:`, error);
    return null;
  } finally {
    if (client) client.release();
  }
}


export async function loadAllWorkspacesFromDB(): Promise<WorkspaceData[]> {
  let client;
  try {
    const poolInstance = await getDbPool();
    if (!(globalThis as any).__db_initialized) {
      console.warn("[DB Actions] loadAllWorkspacesFromDB: Database schema not initialized. Returning empty array.");
      return [];
    }
    client = await poolInstance.connect();
    console.log('[DB Actions] loadAllWorkspacesFromDB: Loading all workspaces from DB...');
    const result: QueryResult<WorkspaceData> = await client.query(
      'SELECT id, name, nodes, connections, created_at, updated_at FROM workspaces ORDER BY updated_at DESC'
    );
     return result.rows.map(row => {
        const nodes = typeof row.nodes === 'string' ? JSON.parse(row.nodes) : (row.nodes || []);
        const connections = typeof row.connections === 'string' ? JSON.parse(row.connections) : (row.connections || []);
        return { ...row, nodes, connections } as WorkspaceData;
      });
  } catch (error: any) {
    console.error('[DB Actions] loadAllWorkspacesFromDB: Error loading all workspaces:', error);
    return [];
  } finally {
    if (client) client.release();
  }
}

export async function loadActiveWorkspaceFromDB(): Promise<WorkspaceData | null> {
  let client;
  try {
    const poolInstance = await getDbPool();
    if (!(globalThis as any).__db_initialized) {
      console.warn("[DB Actions] loadActiveWorkspaceFromDB: Database schema not initialized. Returning null.");
      return null;
    }
    client = await poolInstance.connect();
    console.log('[DB Actions] loadActiveWorkspaceFromDB: Loading most recent workspace from DB...');
    const result: QueryResult<WorkspaceData> = await client.query(
      'SELECT id, name, nodes, connections, created_at, updated_at FROM workspaces ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST LIMIT 1'
    );
    if (result.rows.length > 0) {
      const row = result.rows[0];
      console.log(`[DB Actions] loadActiveWorkspaceFromDB: Found workspace ${row.id} - ${row.name}`);
      const nodes = typeof row.nodes === 'string' ? JSON.parse(row.nodes) : (row.nodes || []);
      const connections = typeof row.connections === 'string' ? JSON.parse(row.connections) : (row.connections || []);
      return { ...row, nodes, connections } as WorkspaceData;
    }
    console.log('[DB Actions] loadActiveWorkspaceFromDB: No workspaces found in DB.');
    return null;
  } catch (error: any) {
    console.error('[DB Actions] loadActiveWorkspaceFromDB: Error loading active workspace:', error);
    return null;
  } finally {
    if (client) client.release();
  }
}


export async function deleteWorkspaceFromDB(workspaceId: string): Promise<{ success: boolean; error?: string }> {
  let client;
  try {
    const poolInstance = await getDbPool();
    if (!(globalThis as any).__db_initialized) {
      throw new Error("Database schema is not initialized. Cannot delete workspace.");
    }
    client = await poolInstance.connect();
    console.log(`[DB Actions] deleteWorkspaceFromDB: Deleting workspace from DB: ${workspaceId}`);
    await client.query('DELETE FROM workspaces WHERE id = $1', [workspaceId]);
    return { success: true };
  } catch (error: any) {
    console.error(`[DB Actions] deleteWorkspaceFromDB: Error deleting workspace ${workspaceId}:`, error.message);
    return { success: false, error: error.message };
  } finally {
    if (client) client.release();
  }
}

// --- Flow Session Actions ---
export async function saveSessionToDB(sessionData: FlowSession): Promise<{ success: boolean; error?: string }> {
  let client;
  try {
    const poolInstance = await getDbPool();
    if (!(globalThis as any).__db_initialized) {
      throw new Error("Database schema is not initialized. Cannot save session.");
    }
    client = await poolInstance.connect();
    console.log(`[DB Actions] saveSessionToDB: Saving session to DB: ${sessionData.session_id}`);
    const query = `
      INSERT INTO flow_sessions (session_id, workspace_id, current_node_id, flow_variables, awaiting_input_type, awaiting_input_details, last_interaction_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      ON CONFLICT (session_id) DO UPDATE
      SET workspace_id = EXCLUDED.workspace_id,
          current_node_id = EXCLUDED.current_node_id,
          flow_variables = EXCLUDED.flow_variables,
          awaiting_input_type = EXCLUDED.awaiting_input_type,
          awaiting_input_details = EXCLUDED.awaiting_input_details,
          last_interaction_at = NOW();
    `;
    await client.query(query, [
      sessionData.session_id,
      sessionData.workspace_id,
      sessionData.current_node_id,
      JSON.stringify(sessionData.flow_variables || {}),
      sessionData.awaiting_input_type,
      sessionData.awaiting_input_details ? JSON.stringify(sessionData.awaiting_input_details) : null,
    ]);
    console.log(`[DB Actions] saveSessionToDB: Session ${sessionData.session_id} saved successfully.`);
    return { success: true };
  } catch (error: any) {
    console.error(`[DB Actions] saveSessionToDB: Error saving session ${sessionData.session_id}:`, error);
    const pgError = error as { code?: string; detail?: string; hint?: string; message?: string };
    return { 
      success: false, 
      error: `PG Error saving session: ${pgError.message || 'Unknown DB error'} (Code: ${pgError.code || 'N/A'})`
    };
  } finally {
    if (client) client.release();
  }
}

export async function loadSessionFromDB(sessionId: string): Promise<FlowSession | null> {
  let client;
  try {
    const poolInstance = await getDbPool();
     if (!(globalThis as any).__db_initialized) {
       console.warn("[DB Actions] loadSessionFromDB: Database schema not initialized. Returning null.");
       return null;
     }
    client = await poolInstance.connect();
    console.log(`[DB Actions] loadSessionFromDB: Loading session from DB: ${sessionId}`);
    const result: QueryResult<FlowSession> = await client.query(
      'SELECT session_id, workspace_id, current_node_id, flow_variables, awaiting_input_type, awaiting_input_details, last_interaction_at, created_at FROM flow_sessions WHERE session_id = $1',
      [sessionId]
    );
    if (result.rows.length > 0) {
      const row = result.rows[0];
      console.log(`[DB Actions] loadSessionFromDB: Session ${sessionId} loaded. Awaiting type: ${row.awaiting_input_type}`);
      return {
        ...row,
        flow_variables: typeof row.flow_variables === 'string' ? JSON.parse(row.flow_variables) : (row.flow_variables || {}),
        awaiting_input_details: row.awaiting_input_details && typeof row.awaiting_input_details === 'string' 
                                  ? JSON.parse(row.awaiting_input_details) 
                                  : (row.awaiting_input_details || null),
      };
    }
    console.log(`[DB Actions] loadSessionFromDB: No session found for ID: ${sessionId}`);
    return null;
  } catch (error: any) {
    console.error(`[DB Actions] loadSessionFromDB: Error loading session ${sessionId}:`, error);
    return null;
  } finally {
    if (client) client.release();
  }
}

export async function loadAllActiveSessionsFromDB(): Promise<FlowSession[]> {
  let client;
  try {
    const poolInstance = await getDbPool();
    if (!(globalThis as any).__db_initialized) {
      console.warn("[DB Actions] loadAllActiveSessionsFromDB: Database schema not initialized. Returning empty array.");
      return [];
    }
    client = await poolInstance.connect();
    console.log('[DB Actions] loadAllActiveSessionsFromDB: Loading all active sessions...');
    const result: QueryResult<FlowSession> = await client.query(
      'SELECT session_id, workspace_id, current_node_id, flow_variables, awaiting_input_type, awaiting_input_details, last_interaction_at, created_at FROM flow_sessions ORDER BY last_interaction_at DESC'
    );
    console.log(`[DB Actions] loadAllActiveSessionsFromDB: Found ${result.rows.length} sessions.`);
    return result.rows.map(row => ({
      ...row,
      flow_variables: typeof row.flow_variables === 'string' ? JSON.parse(row.flow_variables) : (row.flow_variables || {}),
      awaiting_input_details: row.awaiting_input_details && typeof row.awaiting_input_details === 'string' 
                                ? JSON.parse(row.awaiting_input_details) 
                                : (row.awaiting_input_details || null),
    }));
  } catch (error: any) {
    console.error('[DB Actions] loadAllActiveSessionsFromDB: Error loading all active sessions:', error);
    return [];
  } finally {
    if (client) client.release();
  }
}

export async function deleteSessionFromDB(sessionId: string): Promise<{ success: boolean; error?: string }> {
  let client;
  try {
    const poolInstance = await getDbPool();
    if (!(globalThis as any).__db_initialized) {
      throw new Error("Database schema is not initialized. Cannot delete session.");
    }
    client = await poolInstance.connect();
    console.log(`[DB Actions] deleteSessionFromDB: Deleting session from DB: ${sessionId}`);
    await client.query('DELETE FROM flow_sessions WHERE session_id = $1', [sessionId]);
    return { success: true };
  } catch (error: any) {
    console.error(`[DB Actions] deleteSessionFromDB: Error deleting session ${sessionId}:`, error.message);
    return { success: false, error: error.message };
  } finally {
    if (client) client.release();
  }
}

// Client-side invokable actions (wrappers)
export async function clientSideSaveWorkspacesAction(workspaces: WorkspaceData[]): Promise<{ success: boolean; errors?: any[] }> {
  console.log(`[DB Actions Client] Attempting to save ${workspaces.length} workspaces to DB.`);
  let allSuccessful = true;
  const errors = [];
  for (const ws of workspaces) {
    const result = await saveWorkspaceToDB(ws);
    if (!result.success) {
      allSuccessful = false;
      errors.push({ workspaceId: ws.id, error: result.error });
    }
  }
  return { success: allSuccessful, errors: errors.length > 0 ? errors : undefined };
}

export async function clientSideLoadWorkspacesAction(): Promise<WorkspaceData[]> {
  console.log(`[DB Actions Client] Attempting to load all workspaces from DB.`);
  return loadAllWorkspacesFromDB();
}

console.log('[DB Actions] databaseActions.ts loaded. POSTGRES_HOST:', process.env.POSTGRES_HOST ? 'Set' : 'Not Set', 'POSTGRES_USER:', process.env.POSTGRES_USER ? 'Set' : 'Not Set');

if (process.env.NODE_ENV === 'development') {
  (async () => {
    try {
      console.log('[DB Actions] Eagerly ensuring DB is initialized on module load (dev mode)...');
      await ensureDbInitialized();
    } catch (e: any) {
      console.error('[DB Actions] Eager DB initialization failed on module load (dev mode):', e.message);
    }
  })();
}
    

    