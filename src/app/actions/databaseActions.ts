
'use server';

import { Pool, type QueryResult } from 'pg';
import dotenv from 'dotenv';
import type { WorkspaceData, NodeData, Connection } from '@/lib/types'; // Assuming types.ts is in src/lib

dotenv.config(); // Load environment variables from .env

interface FlowSession {
  session_id: string;
  workspace_id: string;
  current_node_id: string | null;
  flow_variables: Record<string, any>;
  last_interaction_at?: Date;
  // Add other relevant session fields if needed
}

let pool: Pool | null = null;

function getDbPool(): Pool {
  if (!pool) {
    const useSSL = process.env.POSTGRES_SSL === 'true';
    pool = new Pool({
      host: process.env.POSTGRES_HOST,
      port: process.env.POSTGRES_PORT ? parseInt(process.env.POSTGRES_PORT, 10) : 5432,
      user: process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASSWORD,
      database: process.env.POSTGRES_DATABASE,
      ssl: useSSL ? { rejectUnauthorized: false } : false, // Adjust SSL as per your DB provider
    });

    pool.on('error', (err, client) => {
      console.error('[PostgreSQL Pool Error] Idle client error', err.message, err.stack);
    });
    console.log('[PostgreSQL Pool] Connection pool created.');
  }
  return pool;
}

export async function initializeDatabase(): Promise<{ success: boolean; message: string }> {
  const client = await getDbPool().connect();
  console.log('[DB Actions] Initializing database schema...');
  try {
    await client.query('BEGIN');

    // Workspaces Table
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
    console.log('[DB Actions] "workspaces" table checked/created.');

    // Flow Sessions Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS flow_sessions (
        session_id TEXT PRIMARY KEY,
        workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
        current_node_id TEXT,
        flow_variables JSONB,
        last_interaction_at TIMESTAMPTZ DEFAULT NOW(),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('[DB Actions] "flow_sessions" table checked/created.');

    // Trigger function to update updated_at timestamp
    await client.query(`
      CREATE OR REPLACE FUNCTION trigger_set_timestamp()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    console.log('[DB Actions] "trigger_set_timestamp" function checked/created.');
    
    // Trigger for workspaces table
    await client.query(`
      DROP TRIGGER IF EXISTS set_workspaces_timestamp ON workspaces;
      CREATE TRIGGER set_workspaces_timestamp
      BEFORE UPDATE ON workspaces
      FOR EACH ROW
      EXECUTE FUNCTION trigger_set_timestamp();
    `);
    console.log('[DB Actions] Trigger "set_workspaces_timestamp" on "workspaces" table checked/created.');

    // Trigger for flow_sessions table (for last_interaction_at)
     await client.query(`
      CREATE OR REPLACE FUNCTION trigger_set_session_interaction_timestamp()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.last_interaction_at = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    console.log('[DB Actions] "trigger_set_session_interaction_timestamp" function checked/created.');

    await client.query(`
      DROP TRIGGER IF EXISTS set_flow_sessions_timestamp ON flow_sessions;
      CREATE TRIGGER set_flow_sessions_timestamp
      BEFORE UPDATE ON flow_sessions
      FOR EACH ROW
      EXECUTE FUNCTION trigger_set_session_interaction_timestamp();
    `);
     console.log('[DB Actions] Trigger "set_flow_sessions_timestamp" on "flow_sessions" table checked/created.');


    await client.query('COMMIT');
    console.log('[DB Actions] Database schema initialized successfully.');
    return { success: true, message: 'Database schema initialized successfully.' };
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('[DB Actions] Error initializing database schema:', error);
    return { success: false, message: `Error initializing database schema: ${error.message}` };
  } finally {
    client.release();
  }
}

// --- Workspace Actions ---
export async function saveWorkspaceToDB(workspaceData: WorkspaceData): Promise<{ success: boolean; error?: string }> {
  const client = await getDbPool().connect();
  console.log(`[DB Actions] Saving workspace to DB: ${workspaceData.id}`);
  try {
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
      JSON.stringify(workspaceData.nodes),
      JSON.stringify(workspaceData.connections),
    ]);
    return { success: true };
  } catch (error: any) {
    console.error(`[DB Actions] Error saving workspace ${workspaceData.id}:`, error);
    return { success: false, error: error.message };
  } finally {
    client.release();
  }
}

export async function loadWorkspaceFromDB(workspaceId: string): Promise<WorkspaceData | null> {
  const client = await getDbPool().connect();
  console.log(`[DB Actions] Loading workspace from DB: ${workspaceId}`);
  try {
    const result: QueryResult<WorkspaceData> = await client.query('SELECT id, name, nodes, connections FROM workspaces WHERE id = $1', [workspaceId]);
    if (result.rows.length > 0) {
      // Nodes and connections are stored as JSONB and need to be parsed
      const row = result.rows[0];
      return {
        ...row,
        nodes: typeof row.nodes === 'string' ? JSON.parse(row.nodes) : row.nodes,
        connections: typeof row.connections === 'string' ? JSON.parse(row.connections) : row.connections,
      } as WorkspaceData;
    }
    return null;
  } catch (error: any) {
    console.error(`[DB Actions] Error loading workspace ${workspaceId}:`, error);
    return null;
  } finally {
    client.release();
  }
}

export async function loadAllWorkspacesFromDB(): Promise<Pick<WorkspaceData, 'id' | 'name'>[]> {
   const client = await getDbPool().connect();
  console.log('[DB Actions] Loading all workspace names from DB...');
  try {
    const result: QueryResult<Pick<WorkspaceData, 'id' | 'name'>> = await client.query(
      'SELECT id, name FROM workspaces ORDER BY updated_at DESC'
    );
    return result.rows;
  } catch (error: any) {
    console.error('[DB Actions] Error loading all workspace names:', error);
    return [];
  } finally {
    client.release();
  }
}

export async function deleteWorkspaceFromDB(workspaceId: string): Promise<{ success: boolean; error?: string }> {
  const client = await getDbPool().connect();
  console.log(`[DB Actions] Deleting workspace from DB: ${workspaceId}`);
  try {
    // ON DELETE CASCADE should handle related flow_sessions
    await client.query('DELETE FROM workspaces WHERE id = $1', [workspaceId]);
    return { success: true };
  } catch (error: any) {
    console.error(`[DB Actions] Error deleting workspace ${workspaceId}:`, error);
    return { success: false, error: error.message };
  } finally {
    client.release();
  }
}


// --- Flow Session Actions ---
export async function saveSessionToDB(sessionId: string, sessionData: Omit<FlowSession, 'session_id' | 'last_interaction_at' | 'created_at'>): Promise<{ success: boolean; error?: string }> {
  const client = await getDbPool().connect();
  console.log(`[DB Actions] Saving session to DB: ${sessionId}`);
  try {
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
      JSON.stringify(sessionData.flow_variables),
    ]);
    return { success: true };
  } catch (error: any) {
    console.error(`[DB Actions] Error saving session ${sessionId}:`, error);
    return { success: false, error: error.message };
  } finally {
    client.release();
  }
}

export async function loadSessionFromDB(sessionId: string): Promise<FlowSession | null> {
  const client = await getDbPool().connect();
  console.log(`[DB Actions] Loading session from DB: ${sessionId}`);
  try {
    const result: QueryResult<FlowSession> = await client.query(
      'SELECT session_id, workspace_id, current_node_id, flow_variables, last_interaction_at FROM flow_sessions WHERE session_id = $1',
      [sessionId]
    );
    if (result.rows.length > 0) {
      const row = result.rows[0];
      // flow_variables is stored as JSONB and needs to be parsed
      return {
        ...row,
        flow_variables: typeof row.flow_variables === 'string' ? JSON.parse(row.flow_variables) : row.flow_variables,
      };
    }
    return null;
  } catch (error: any) {
    console.error(`[DB Actions] Error loading session ${sessionId}:`, error);
    return null;
  } finally {
    client.release();
  }
}

export async function deleteSessionFromDB(sessionId: string): Promise<{ success: boolean; error?: string }> {
  const client = await getDbPool().connect();
  console.log(`[DB Actions] Deleting session from DB: ${sessionId}`);
  try {
    await client.query('DELETE FROM flow_sessions WHERE session_id = $1', [sessionId]);
    return { success: true };
  } catch (error: any) {
    console.error(`[DB Actions] Error deleting session ${sessionId}:`, error);
    return { success: false, error: error.message };
  } finally {
    client.release();
  }
}

// Helper function to call initializeDatabase (e.g., on server startup, if needed)
// This is more for demonstration; in a real app, migrations are preferred.
async function tryInitializeDb() {
  console.log('[DB Actions] Checking database schema...');
  try {
    const result = await initializeDatabase();
    if(result.success){
      console.log('[DB Actions] Database initialization check successful.');
    } else {
      console.error('[DB Actions] Database initialization check failed:', result.message);
    }
  } catch (err) {
    console.error('[DB Actions] Critical error during database initialization check:', err);
  }
}

// Call this once, e.g. when the module is first loaded in a server context.
// Be mindful of multiple calls if your server reloads modules frequently in dev.
// (async () => {
//  if (process.env.NODE_ENV === 'development') { // Or some other condition
//    await tryInitializeDb();
//  }
// })();
// For Next.js, it's better to call this explicitly, perhaps from a global setup or an admin UI.
// For now, you can call `initializeDatabase()` manually via a test or an admin endpoint if needed.

console.log('[DB Actions] databaseActions.ts loaded. POSTGRES_HOST:', process.env.POSTGRES_HOST ? 'Set' : 'Not Set');

// Placeholder for actions that might be called from the client
// These would typically interact with the database via the functions above

export async function clientSideSaveWorkspacesAction(workspaces: WorkspaceData[]): Promise<{success: boolean; errors?: any[]}> {
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
  // This should ideally load full workspace data if needed by client, or just summaries
  // For now, let's assume we load full data for simplicity, though it might be heavy
  const summaryList = await loadAllWorkspacesFromDB();
  const fullWorkspaces: WorkspaceData[] = [];
  for (const summary of summaryList) {
    const fullWs = await loadWorkspaceFromDB(summary.id);
    if (fullWs) {
      fullWorkspaces.push(fullWs);
    }
  }
  return fullWorkspaces;
}

    