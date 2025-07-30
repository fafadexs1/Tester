
'use server';

import { Pool, type QueryResult } from 'pg';
import dotenv from 'dotenv';
import type { WorkspaceData, FlowSession, NodeData, Connection } from '@/lib/types';

dotenv.config();

let pool: Pool | null = null;
let dbInitializationPromise: Promise<void> | null = null;
let dbInitializedSuccessfully: boolean = false;

console.log('[DB Actions] databaseActions.ts loaded. POSTGRES_HOST:', process.env.POSTGRES_HOST ? 'Set' : 'Not Set');

async function initializeDatabase(): Promise<void> {
  console.log('[DB Actions] initializeDatabase: Starting schema initialization...');
  let client;
  try {
    const tempPoolConfig = {
      host: process.env.POSTGRES_HOST,
      port: process.env.POSTGRES_PORT ? parseInt(process.env.POSTGRES_PORT, 10) : 5432,
      user: process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASSWORD,
      database: process.env.POSTGRES_DATABASE,
      ssl: process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : false,
      idleTimeoutMillis: 5000, 
      connectionTimeoutMillis: 10000,
    };
    const tempPool = new Pool(tempPoolConfig);
    
    client = await tempPool.connect();
    console.log('[DB Actions] initializeDatabase: Connected to DB for schema setup via temp pool.');

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
    console.log('[DB Actions] initializeDatabase: "trigger_set_timestamp" function checked/created.');

    await client.query(`
      CREATE TABLE IF NOT EXISTS workspaces (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        nodes JSONB,
        connections JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('[DB Actions] initializeDatabase: "workspaces" table checked/created.');

    // Add the 'owner' column if it doesn't exist
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS(SELECT * FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'workspaces' AND column_name = 'owner') THEN
          ALTER TABLE workspaces ADD COLUMN owner TEXT;
          RAISE NOTICE 'Column owner added to workspaces table.';
        END IF;
      END;
      $$;
    `);
    console.log('[DB Actions] initializeDatabase: "owner" column checked/added to "workspaces" table.');

    await client.query(`
      DROP TRIGGER IF EXISTS set_workspaces_timestamp ON workspaces;
      CREATE TRIGGER set_workspaces_timestamp
      BEFORE UPDATE ON workspaces
      FOR EACH ROW
      EXECUTE FUNCTION trigger_set_timestamp();
    `);
    console.log('[DB Actions] initializeDatabase: Trigger for "workspaces.updated_at" checked/created.');
    
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
    dbInitializedSuccessfully = true;
    await tempPool.end(); 
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
    dbInitializedSuccessfully = false; 
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
    const poolConfig = {
      host: process.env.POSTGRES_HOST,
      port: process.env.POSTGRES_PORT ? parseInt(process.env.POSTGRES_PORT, 10) : 5432,
      user: process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASSWORD,
      database: process.env.POSTGRES_DATABASE,
      ssl: useSSL ? { rejectUnauthorized: false } : false,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000, 
    };
    pool = new Pool(poolConfig);

    pool.on('error', (err, client) => {
      console.error('[DB Actions] getDbPoolInternal: PostgreSQL Pool Error - Idle client error', err.message, err.stack);
      pool = null; 
    });

    if(logCreation) {
      pool.connect()
        .then(client => {
          console.log('[DB Actions] getDbPoolInternal: PostgreSQL pool test connection successful.');
          client.release();
        })
        .catch(err => {
          console.error('[DB Actions] getDbPoolInternal: PostgreSQL pool test connection FAILED:', err.message);
        });
      console.log('[DB Actions] getDbPoolInternal: PostgreSQL connection pool configured.');
    }
  }
  return pool;
}

async function ensureDbInitialized(): Promise<void> {
  if (dbInitializedSuccessfully) {
    return;
  }
  if (!dbInitializationPromise) {
    console.log('[DB Actions] ensureDbInitialized: First call or previous attempt failed. Starting DB schema initialization process...');
    dbInitializationPromise = initializeDatabase()
      .then(() => {
        console.log('[DB Actions] ensureDbInitialized: Database schema initialization completed successfully.');
        dbInitializedSuccessfully = true;
      })
      .catch((error) => {
        console.error('[DB Actions] ensureDbInitialized: Database schema initialization FAILED.', error.message);
        dbInitializedSuccessfully = false;
        dbInitializationPromise = null; 
        throw new Error(`Database initialization failed: ${error.message}`);
      });
  }
  
  await dbInitializationPromise; 
}

async function getDbPool(): Promise<Pool> {
  await ensureDbInitialized(); 
  if (!dbInitializedSuccessfully) {
    throw new Error("Database schema is not initialized. Cannot get DB pool.");
  }
  return getDbPoolInternal(false);
}

if (process.env.NODE_ENV === 'development' && !dbInitializationPromise) {
  console.log('[DB Actions] Eagerly ensuring DB is initialized on module load...');
  ensureDbInitialized().catch(err => {
    console.error('[DB Actions] Eager DB initialization attempt failed:', err.message);
  });
}

// --- Workspace Actions ---
export async function saveWorkspaceToDB(workspaceData: WorkspaceData): Promise<{ success: boolean; error?: string }> {
  let client;
  try {
    const poolInstance = await getDbPool();
    client = await poolInstance.connect();
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
    await client.query(query, [
      workspaceData.id,
      workspaceData.name,
      JSON.stringify(workspaceData.nodes || []), 
      JSON.stringify(workspaceData.connections || []),
      workspaceData.owner,
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
        errorMessage += ` Detail: ${pgError.detail || 'N/A'}, Hint: ${pgError.hint || 'N/A'}`;
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
    client = await poolInstance.connect();
    console.log(`[DB Actions] loadWorkspaceFromDB: Loading workspace from DB by ID: ${workspaceId}`);
    const result: QueryResult<WorkspaceData> = await client.query('SELECT id, name, nodes, connections, owner, created_at, updated_at FROM workspaces WHERE id = $1', [workspaceId]);
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
    client = await poolInstance.connect();
    console.log(`[DB Actions] loadWorkspaceByNameFromDB: Loading workspace from DB by name: "${name}"`);
    const result: QueryResult<WorkspaceData> = await client.query('SELECT id, name, nodes, connections, owner, created_at, updated_at FROM workspaces WHERE name = $1', [name]);
    if (result.rows.length > 0) {
      const row = result.rows[0];
      const nodes = typeof row.nodes === 'string' ? JSON.parse(row.nodes) : (row.nodes || []);
      const connections = typeof row.connections === 'string' ? JSON.parse(row.connections) : (row.connections || []);
      console.log(`[DB Actions] loadWorkspaceByNameFromDB: Found workspace ${row.id} - ${row.name}`);
      return { ...row, nodes, connections } as WorkspaceData;
    }
    console.log(`[DB Actions] loadWorkspaceByNameFromDB: No workspace found with name: "${name}"`);
    return null;
  } catch (error: any) {
    console.error(`[DB Actions] loadWorkspaceByNameFromDB: Error loading workspace by name "${name}":`, error);
    return null;
  } finally {
    if (client) client.release();
  }
}

export async function loadAllWorkspacesFromDB(): Promise<WorkspaceData[]> {
  let client;
  try {
    const poolInstance = await getDbPool();
    client = await poolInstance.connect();
    console.log('[DB Actions] loadAllWorkspacesFromDB: Loading all workspaces from DB...');
    const result: QueryResult<WorkspaceData> = await client.query(
      'SELECT id, name, nodes, connections, owner, created_at, updated_at FROM workspaces ORDER BY updated_at DESC'
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
    client = await poolInstance.connect();
    console.log('[DB Actions] loadActiveWorkspaceFromDB: Loading most recent workspace from DB...');
    const result: QueryResult<WorkspaceData> = await client.query(
      'SELECT id, name, nodes, connections, owner, created_at, updated_at FROM workspaces ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST LIMIT 1'
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
    client = await poolInstance.connect();
    console.log(`[DB Actions] saveSessionToDB: Saving session to DB: ${sessionData.session_id}`);
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
    await client.query(query, [
      sessionData.session_id,
      sessionData.workspace_id,
      sessionData.current_node_id,
      JSON.stringify(sessionData.flow_variables || {}),
      sessionData.awaiting_input_type,
      sessionData.awaiting_input_details ? JSON.stringify(sessionData.awaiting_input_details) : null,
      sessionData.session_timeout_seconds || 0,
    ]);
    console.log(`[DB Actions] saveSessionToDB: Session ${sessionData.session_id} saved successfully.`);
    return { success: true };
  } catch (error: any) {
    console.error(`[DB Actions] saveSessionToDB: Error saving session ${sessionData.session_id}:`, error.message);
    const pgError = error as { code?: string; detail?: string; hint?: string; message?: string };
    const errorMessage = `PG Error saving session: ${pgError.message || 'Unknown DB error'} (Code: ${pgError.code || 'N/A'}, Detail: ${pgError.detail || 'N/A'}, Hint: ${pgError.hint || 'N/A'})`;
    console.error('[DB Actions] Full error object saving session:', pgError);
    return { success: false, error: errorMessage };
  } finally {
    if (client) client.release();
  }
}

export async function loadSessionFromDB(sessionId: string): Promise<FlowSession | null> {
  let client;
  try {
    const poolInstance = await getDbPool();
    client = await poolInstance.connect();
    // console.log(`[DB Actions] loadSessionFromDB: Loading session from DB: ${sessionId}`);
    const result: QueryResult<FlowSession> = await client.query(
      'SELECT session_id, workspace_id, current_node_id, flow_variables, awaiting_input_type, awaiting_input_details, session_timeout_seconds, created_at, last_interaction_at FROM flow_sessions WHERE session_id = $1',
      [sessionId]
    );
    if (result.rows.length > 0) {
      const row = result.rows[0];
      const flow_variables = typeof row.flow_variables === 'string' ? JSON.parse(row.flow_variables) : (row.flow_variables || {});
      const awaiting_input_details = typeof row.awaiting_input_details === 'string' ? JSON.parse(row.awaiting_input_details) : (row.awaiting_input_details || null);
      // console.log(`[DB Actions] loadSessionFromDB: Session ${sessionId} loaded.`);
      return { ...row, flow_variables, awaiting_input_details } as FlowSession;
    }
    // console.log(`[DB Actions] loadSessionFromDB: No session found for ${sessionId}.`);
    return null;
  } catch (error: any) {
    console.error(`[DB Actions] loadSessionFromDB: Error loading session ${sessionId}:`, error);
    return null;
  } finally {
    if (client) client.release();
  }
}

export async function deleteSessionFromDB(sessionId: string): Promise<{ success: boolean; error?: string }> {
  let client;
  try {
    const poolInstance = await getDbPool();
    client = await poolInstance.connect();
    console.log(`[DB Actions] deleteSessionFromDB: Deleting session from DB: ${sessionId}`);
    await client.query('DELETE FROM flow_sessions WHERE session_id = $1', [sessionId]);
    console.log(`[DB Actions] deleteSessionFromDB: Session ${sessionId} deleted.`);
    return { success: true };
  } catch (error: any) {
    console.error(`[DB Actions] deleteSessionFromDB: Error deleting session ${sessionId}:`, error.message);
    return { success: false, error: error.message };
  } finally {
    if (client) client.release();
  }
}

export async function loadAllActiveSessionsFromDB(): Promise<FlowSession[]> {
  let client;
  try {
    const poolInstance = await getDbPool();
    client = await poolInstance.connect();
    console.log('[DB Actions] loadAllActiveSessionsFromDB: Loading all active sessions...');
    const result = await client.query<FlowSession>(
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
  } finally {
    if (client) client.release();
  }
}

// Wrapper functions to be called from client components
export async function clientSideLoadWorkspacesAction(): Promise<WorkspaceData[]> {
  console.log('[DB Actions Client] Attempting to load all workspaces from DB...');
  try {
    const workspaces = await loadAllWorkspacesFromDB();
    console.log(`[DB Actions Client] Loaded ${workspaces.length} workspaces from DB.`);
    return workspaces;
  } catch (error:any) {
    console.error('[DB Actions Client] Error in clientSideLoadWorkspacesAction:', error.message);
    return []; 
  }
}

export async function clientSideSaveWorkspacesAction(workspaces: WorkspaceData[]): Promise<{ success: boolean; errors: { workspaceId: string; error: string }[] }> {
  console.log(`[DB Actions Client] Attempting to save ${workspaces.length} workspaces to DB.`);
  const errors: { workspaceId: string; error: string }[] = [];
  let overallSuccess = true;

  for (const ws of workspaces) {
    const result = await saveWorkspaceToDB(ws);
    if (!result.success) {
      overallSuccess = false;
      errors.push({ workspaceId: ws.id, error: result.error || 'Unknown error saving workspace' });
    }
  }

  if (!overallSuccess) {
    console.error(`[DB Actions Client] Errors saving some workspaces:`, errors);
    return { success: false, errors };
  }
  console.log('[DB Actions Client] All workspaces saved successfully to DB.');
  return { success: true, errors: [] };
}
