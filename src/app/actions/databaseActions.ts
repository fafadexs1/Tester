
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
    // Para garantir que estamos usando o pool que será criado ou já existe
    const tempPool = getDbPoolInternal(false); // Chama uma versão interna que não tenta inicializar
    client = await tempPool.connect();
    console.log('[DB Actions] initializeDatabase: Connected to DB for schema setup.');

    await client.query('BEGIN');

    // Função para atualizar 'updated_at'
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

    // Tabela 'workspaces'
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

    // Trigger para 'workspaces'
    await client.query(`
      DROP TRIGGER IF EXISTS set_workspaces_timestamp ON workspaces;
      CREATE TRIGGER set_workspaces_timestamp
      BEFORE UPDATE ON workspaces
      FOR EACH ROW
      EXECUTE FUNCTION trigger_set_timestamp();
    `);
    console.log('[DB Actions] initializeDatabase: Trigger for "workspaces" checked/created.');
    
    // Função para atualizar 'last_interaction_at' em flow_sessions
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

    // Tabela 'flow_sessions'
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

    // Trigger para 'flow_sessions'
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
    (globalThis as any).__db_initialized = true; // Define o flag global
  } catch (error: any) {
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('[DB Actions] initializeDatabase: Error during ROLLBACK:', rollbackError);
      }
    }
    console.error('[DB Actions] initializeDatabase: Error initializing database schema:', error);
    (globalThis as any).__db_initialized = false; // Garante que tentemos novamente se falhar
    throw error; // Re-throw para que a chamada de ensureDbInitialized saiba da falha
  } finally {
    if (client) {
      client.release();
      console.log('[DB Actions] initializeDatabase: DB client released.');
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
      connectionTimeoutMillis: 10000, // Aumentado para 10s
    });

    pool.on('error', (err, client) => {
      console.error('[DB Actions] getDbPoolInternal: PostgreSQL Pool Error - Idle client error', err.message, err.stack);
      // Considerar resetar o pool ou tomar alguma ação de recuperação aqui
      pool = null; // Força a recriação do pool na próxima chamada
    });
    if(logCreation) console.log('[DB Actions] getDbPoolInternal: PostgreSQL connection pool configured.');

    // Teste de conexão inicial
    if(logCreation){ // Só loga o teste se for uma criação "normal" do pool
        pool.connect()
            .then(client => {
                console.log('[DB Actions] getDbPoolInternal: PostgreSQL pool test connection successful.');
                client.release();
            })
            .catch(err => {
                console.error('[DB Actions] getDbPoolInternal: PostgreSQL pool test connection failed:', err);
                pool = null; // Invalida o pool se o teste falhar
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
    console.log('[DB Actions] ensureDbInitialized: First call. Starting DB schema initialization process...');
    dbInitializationPromise = initializeDatabase()
      .then(() => {
        console.log('[DB Actions] ensureDbInitialized: Database schema initialization completed successfully.');
        (globalThis as any).__db_initialized = true;
      })
      .catch((error) => {
        console.error('[DB Actions] ensureDbInitialized: Database schema initialization failed. Will retry on next relevant DB action.', error.message);
        (globalThis as any).__db_initialized = false; // Permite nova tentativa
        dbInitializationPromise = null; // Limpa a promessa para permitir nova tentativa
        throw error; // Re-throw para que a chamada original saiba da falha
      });
  } else {
    console.log('[DB Actions] ensureDbInitialized: Database initialization already in progress or completed. Waiting for it to settle...');
  }
  await dbInitializationPromise;
}


async function getDbPool(): Promise<Pool> {
  // console.log('[DB Actions] getDbPool: Called.');
  if (!(globalThis as any).__db_initialized) {
      // console.log('[DB Actions] getDbPool: Database not marked as initialized. Ensuring initialization...');
      try {
        await ensureDbInitialized();
      } catch (initError) {
        console.error('[DB Actions] getDbPool: Initialization failed during getDbPool. Returning potentially uninitialized pool or erroring out.', initError);
        // Mesmo se a inicialização falhar, tentamos retornar o pool interno,
        // pois ele pode ter sido criado, e a operação subsequente falhará se as tabelas não existirem.
        // Ou, poderíamos lançar o erro aqui para interromper mais cedo.
        // Por agora, vamos deixar a operação seguinte tentar.
      }
  }
  return getDbPoolInternal();
}


// --- Workspace Actions ---
export async function saveWorkspaceToDB(workspaceData: WorkspaceData): Promise<{ success: boolean; error?: string }> {
  let client;
  try {
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
      JSON.stringify(workspaceData.nodes || []), // Garante que não seja null
      JSON.stringify(workspaceData.connections || []), // Garante que não seja null
    ]);
    return { success: true };
  } catch (error: any) {
    console.error(`[DB Actions] saveWorkspaceToDB: Error saving workspace ${workspaceData.id}:`, error.message);
    console.error('[DB Actions] Full error object saving workspace:', error); // Log completo do erro
    const pgError = error as { code?: string; detail?: string; hint?: string };
    return { 
      success: false, 
      error: `Erro PG: ${error.message} (Código: ${pgError.code || 'N/A'}, Detalhe: ${pgError.detail || 'N/A'}, Dica: ${pgError.hint || 'N/A'})` 
    };
  } finally {
    if (client) client.release();
  }
}

export async function loadWorkspaceFromDB(workspaceId: string): Promise<WorkspaceData | null> {
  let client;
  try {
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
  const summaryList = await loadAllWorkspacesFromDB();
  const fullWorkspaces: WorkspaceData[] = [];
  for (const summary of summaryList) {
    const fullWs = await loadWorkspaceFromDB(summary.id);
    if (fullWs) {
      fullWorkspaces.push(fullWs);
    } else {
      console.warn(`[DB Actions Client] Failed to load full details for workspace ID: ${summary.id}`);
    }
  }
  return fullWorkspaces;
}

console.log('[DB Actions] databaseActions.ts loaded. POSTGRES_HOST:', process.env.POSTGRES_HOST ? 'Set' : 'Not Set', 'POSTGRES_USER:', process.env.POSTGRES_USER ? 'Set' : 'Not Set');

// Eagerly try to initialize the DB when this module is first loaded in a server context
// This helps ensure tables are ready for the first actual DB operation.
if (process.env.NODE_ENV === 'development') { // Or some other condition to run only once
  (async () => {
    try {
      console.log('[DB Actions] Eagerly ensuring DB is initialized on module load...');
      await ensureDbInitialized();
    } catch (e) {
      console.error('[DB Actions] Eager DB initialization failed on module load:', e);
    }
  })();
}

    