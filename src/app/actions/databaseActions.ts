
'use server';

import { Pool, type QueryResult } from 'pg';
import dotenv from 'dotenv';
import type { WorkspaceData } from '@/lib/types'; // Assumindo que NodeData e Connection não são usados diretamente aqui, mas WorkspaceData é

dotenv.config(); // Carrega variáveis de ambiente do .env

interface FlowSession {
  session_id: string;
  workspace_id: string;
  current_node_id: string | null;
  flow_variables: Record<string, any>;
  last_interaction_at?: Date;
  created_at?: Date;
}

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
        name TEXT NOT NULL,
        nodes JSONB,
        connections JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('[DB Actions] initializeDatabase: "workspaces" table checked/created.');

    await client.query(`
      DROP TRIGGER IF EXISTS set_workspaces_timestamp ON workspaces;
      CREATE TRIGGER set_workspaces_timestamp
      BEFORE UPDATE ON workspaces
      FOR EACH ROW
      EXECUTE FUNCTION trigger_set_timestamp();
    `);
    console.log('[DB Actions] initializeDatabase: Trigger for "workspaces" checked/created.');
    
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
        created_at TIMESTAMPTZ DEFAULT NOW(),
        last_interaction_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('[DB Actions] initializeDatabase: "flow_sessions" table checked/created.');

    await client.query(`
      DROP TRIGGER IF EXISTS set_flow_sessions_timestamp ON flow_sessions;
      CREATE TRIGGER set_flow_sessions_timestamp
      BEFORE UPDATE ON flow_sessions
      FOR EACH ROW
      EXECUTE FUNCTION trigger_set_session_interaction_timestamp();
    `);
    console.log('[DB Actions] initializeDatabase: Trigger for "flow_sessions" checked/created.');

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
    dbInitializationPromise = null; // Reset promise on failure to allow retry
    throw error; 
  } finally {
    if (client) {
      client.release();
      // console.log('[DB Actions] initializeDatabase: DB client released.');
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
              // pool = null; // Invalidate pool if test fails, but this might be too aggressive if it's a transient issue
          });
    }
  }
  return pool;
}


async function ensureDbInitialized(): Promise<void> {
  if ((globalThis as any).__db_initialized === true) {
    // console.log('[DB Actions] ensureDbInitialized: Database already marked as initialized.');
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
        dbInitializationPromise = null; // Reset promise to allow a new attempt
        // Do not re-throw here, let the calling DB action handle its own failure
      });
  } else {
    // console.log('[DB Actions] ensureDbInitialized: Database initialization already in progress or completed/failed. Waiting for it to settle...');
  }
  // Always await, even if it might fail, so subsequent operations don't run prematurely
  try {
    await dbInitializationPromise;
  } catch (e) {
    // The error is already logged by the promise. We just catch it here to prevent unhandled rejection if the promise was already rejected.
    console.warn('[DB Actions] ensureDbInitialized: Caught error while awaiting dbInitializationPromise, this is expected if initialization failed previously.');
  }
}


async function getDbPool(): Promise<Pool> {
  // console.log('[DB Actions] getDbPool: Called.');
  if (!(globalThis as any).__db_initialized) {
      // console.log('[DB Actions] getDbPool: Database not marked as initialized. Ensuring initialization...');
      await ensureDbInitialized(); // This will attempt initialization if needed.
      // If ensureDbInitialized failed, __db_initialized will still be false, but we proceed to get the pool.
      // The subsequent DB operation will then likely fail if tables are missing, which is desired behavior.
  }
  return getDbPoolInternal();
}


// --- Workspace Actions ---
export async function saveWorkspaceToDB(workspaceData: WorkspaceData): Promise<{ success: boolean; error?: string }> {
  let client;
  try {
    await ensureDbInitialized(); // Ensure DB is ready before connecting
    if (!(globalThis as any).__db_initialized) {
      throw new Error("Database schema is not initialized. Cannot save workspace.");
    }
    const poolInstance = await getDbPool();
    client = await poolInstance.connect();
    console.log(`[DB Actions] saveWorkspaceToDB: Saving workspace to DB: ${workspaceData.id}`);
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
    console.log(`[DB Actions] saveWorkspaceToDB: Query executed for workspace ${workspaceData.id}. Success presumed by pg driver unless an error was caught.`);
    return { success: true };
  } catch (error: any) {
    console.error(`[DB Actions] saveWorkspaceToDB: Error saving workspace ${workspaceData.id}:`, error.message);
    console.error('[DB Actions] Full error object saving workspace:', error); 
    const pgError = error as { code?: string; detail?: string; hint?: string; message?: string };
    return { 
      success: false, 
      error: `PG Error: ${pgError.message || 'Unknown DB error'} (Code: ${pgError.code || 'N/A'}, Detail: ${pgError.detail || 'N/A'}, Hint: ${pgError.hint || 'N/A'})` 
    };
  } finally {
    if (client) client.release();
  }
}

export async function loadWorkspaceFromDB(workspaceId: string): Promise<WorkspaceData | null> {
  let client;
  try {
    await ensureDbInitialized();
     if (!(globalThis as any).__db_initialized) {
      console.warn("[DB Actions] loadWorkspaceFromDB: Database schema not initialized. Returning null.");
      return null;
    }
    const poolInstance = await getDbPool();
    client = await poolInstance.connect();
    console.log(`[DB Actions] loadWorkspaceFromDB: Loading workspace from DB: ${workspaceId}`);
    const result: QueryResult<WorkspaceData> = await client.query('SELECT id, name, nodes, connections FROM workspaces WHERE id = $1', [workspaceId]);
    if (result.rows.length > 0) {
      const row = result.rows[0];
      return {
        ...row,
        nodes: typeof row.nodes === 'string' ? JSON.parse(row.nodes) : (row.nodes || []),
        connections: typeof row.connections === 'string' ? JSON.parse(row.connections) : (row.connections || []),
      } as WorkspaceData;
    }
    return null;
  } catch (error: any) {
    console.error(`[DB Actions] loadWorkspaceFromDB: Error loading workspace ${workspaceId}:`, error);
    return null;
  } finally {
    if (client) client.release();
  }
}

export async function loadAllWorkspacesFromDB(): Promise<Pick<WorkspaceData, 'id' | 'name'>[]> {
  let client;
  try {
    await ensureDbInitialized();
    if (!(globalThis as any).__db_initialized) {
      console.warn("[DB Actions] loadAllWorkspacesFromDB: Database schema not initialized. Returning empty array.");
      return [];
    }
    const poolInstance = await getDbPool();
    client = await poolInstance.connect();
    console.log('[DB Actions] loadAllWorkspacesFromDB: Loading all workspace names from DB...');
    const result: QueryResult<Pick<WorkspaceData, 'id' | 'name'>> = await client.query(
      'SELECT id, name FROM workspaces ORDER BY updated_at DESC'
    );
    return result.rows;
  } catch (error: any) {
    console.error('[DB Actions] loadAllWorkspacesFromDB: Error loading all workspace names:', error);
    return [];
  } finally {
    if (client) client.release();
  }
}

export async function deleteWorkspaceFromDB(workspaceId: string): Promise<{ success: boolean; error?: string }> {
  let client;
  try {
    await ensureDbInitialized();
    if (!(globalThis as any).__db_initialized) {
      throw new Error("Database schema is not initialized. Cannot delete workspace.");
    }
    const poolInstance = await getDbPool();
    client = await poolInstance.connect();
    console.log(`[DB Actions] deleteWorkspaceFromDB: Deleting workspace from DB: ${workspaceId}`);
    await client.query('DELETE FROM workspaces WHERE id = $1', [workspaceId]);
    return { success: true };
  } catch (error: any) {
    console.error(`[DB Actions] deleteWorkspaceFromDB: Error deleting workspace ${workspaceId}:`, error);
    return { success: false, error: error.message };
  } finally {
    if (client) client.release();
  }
}

// --- Flow Session Actions ---
export async function saveSessionToDB(sessionId: string, sessionData: Omit<FlowSession, 'session_id' | 'last_interaction_at' | 'created_at'>): Promise<{ success: boolean; error?: string }> {
  let client;
  try {
    await ensureDbInitialized();
    if (!(globalThis as any).__db_initialized) {
      throw new Error("Database schema is not initialized. Cannot save session.");
    }
    const poolInstance = await getDbPool();
    client = await poolInstance.connect();
    console.log(`[DB Actions] saveSessionToDB: Saving session to DB: ${sessionId}`);
    const query = `
      INSERT INTO flow_sessions (session_id, workspace_id, current_node_id, flow_variables, last_interaction_at)
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (session_id) DO UPDATE
      SET workspace_id = EXCLUDED.workspace_id,
          current_node_id = EXCLUDED.current_node_id,
          flow_variables = EXCLUDED.flow_variables,
          last_interaction_at = NOW();
    `;
    await client.query(query, [
      sessionId,
      sessionData.workspace_id,
      sessionData.current_node_id,
      JSON.stringify(sessionData.flow_variables || {}),
    ]);
    return { success: true };
  } catch (error: any) {
    console.error(`[DB Actions] saveSessionToDB: Error saving session ${sessionId}:`, error);
    return { success: false, error: error.message };
  } finally {
    if (client) client.release();
  }
}

export async function loadSessionFromDB(sessionId: string): Promise<FlowSession | null> {
  let client;
  try {
    await ensureDbInitialized();
     if (!(globalThis as any).__db_initialized) {
       console.warn("[DB Actions] loadSessionFromDB: Database schema not initialized. Returning null.");
       return null;
     }
    const poolInstance = await getDbPool();
    client = await poolInstance.connect();
    console.log(`[DB Actions] loadSessionFromDB: Loading session from DB: ${sessionId}`);
    const result: QueryResult<FlowSession> = await client.query(
      'SELECT session_id, workspace_id, current_node_id, flow_variables, last_interaction_at, created_at FROM flow_sessions WHERE session_id = $1',
      [sessionId]
    );
    if (result.rows.length > 0) {
      const row = result.rows[0];
      return {
        ...row,
        flow_variables: typeof row.flow_variables === 'string' ? JSON.parse(row.flow_variables) : (row.flow_variables || {}),
      };
    }
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
    await ensureDbInitialized();
    if (!(globalThis as any).__db_initialized) {
      throw new Error("Database schema is not initialized. Cannot delete session.");
    }
    const poolInstance = await getDbPool();
    client = await poolInstance.connect();
    console.log(`[DB Actions] deleteSessionFromDB: Deleting session from DB: ${sessionId}`);
    await client.query('DELETE FROM flow_sessions WHERE session_id = $1', [sessionId]);
    return { success: true };
  } catch (error: any) {
    console.error(`[DB Actions] deleteSessionFromDB: Error deleting session ${sessionId}:`, error);
    return { success: false, error: error.message };
  } finally {
    if (client) client.release();
  }
}

// Client-side invokable actions
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
  // Primeiro, carrega a lista de sumários (ID e nome) para evitar carregar todos os dados desnecessariamente
  // se o usuário só quiser listar os workspaces.
  // Para este cliente, que provavelmente precisa dos dados completos, vamos carregar um por um.
  // Em uma UI mais complexa, você poderia ter um loadAllWorkspaceSummaries e depois um loadFullWorkspace(id).
  const summaryList = await loadAllWorkspacesFromDB();
  const fullWorkspaces: WorkspaceData[] = [];
  for (const summary of summaryList) {
    const fullWs = await loadWorkspaceFromDB(summary.id);
    if (fullWs) {
      fullWorkspaces.push(fullWs);
    } else {
      // Logar um aviso se um workspace da lista de sumário não puder ser carregado completamente
      console.warn(`[DB Actions Client] Failed to load full details for workspace ID: ${summary.id}`);
    }
  }
  return fullWorkspaces;
}

console.log('[DB Actions] databaseActions.ts loaded. POSTGRES_HOST:', process.env.POSTGRES_HOST ? 'Set' : 'Not Set', 'POSTGRES_USER:', process.env.POSTGRES_USER ? 'Set' : 'Not Set');

// Eagerly try to initialize the DB when this module is first loaded in a server context
if (typeof process !== 'undefined' && process.env.NODE_ENV === 'development') { // Check for process to ensure server-side
  (async () => {
    try {
      console.log('[DB Actions] Eagerly ensuring DB is initialized on module load...');
      await ensureDbInitialized();
    } catch (e: any) {
      console.error('[DB Actions] Eager DB initialization failed on module load:', e.message);
      // Não re-throw, pois a falha será tratada nas chamadas de ação individuais
    }
  })();
}
    
