
'use server';

import { Pool, type QueryResult } from 'pg';
import dotenv from 'dotenv';
import type { WorkspaceData, FlowSession, NodeData, Connection, User } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';
import { redirect } from 'next/navigation';

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
        if (error.code === '42P01') { 
            console.warn('[DB Actions] Table not found. Attempting to initialize schema and retry...');
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
                 console.error('[DB Actions] Fatal: Failed to initialize schema after table not found.', initError);
                 throw initError;
            }
        }
        throw error;
    }
}


async function initializeDatabaseSchema(): Promise<void> {
  const poolInstance = getDbPool();
  const client = await poolInstance.connect();
  try {
    console.log('[DB Actions] Initializing database schema if needed...');
    await client.query('BEGIN');
    
    // Habilita a extensão para UUIDs se não existir
    await client.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto";');
    
    // Cria a tabela de usuários se ela não existir
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'user',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    
    // Verifica se a coluna 'id' existe na tabela 'users'
    const idColumnExists = await client.query(`
      SELECT 1 FROM information_schema.columns 
      WHERE table_name='users' AND column_name='id';
    `);

    // Se a coluna 'id' não existir, adiciona-a e a define como chave primária.
    if (idColumnExists.rowCount === 0) {
      console.log("[DB Actions] 'id' column not found in 'users' table. Migrating schema...");
      // Remove a constraint de PK antiga se ela existir (baseada no username)
      const pkConstraint = await client.query(`
        SELECT conname FROM pg_constraint 
        WHERE conrelid = 'users'::regclass AND contype = 'p';
      `);
      if (pkConstraint.rowCount > 0 && pkConstraint.rows[0].conname) {
          await client.query(`ALTER TABLE users DROP CONSTRAINT "${pkConstraint.rows[0].conname}";`);
          console.log(`[DB Actions] Dropped old primary key constraint: ${pkConstraint.rows[0].conname}`);
      }

      await client.query('ALTER TABLE users ADD COLUMN id UUID;');
      await client.query('UPDATE users SET id = gen_random_uuid() WHERE id IS NULL;');
      await client.query('ALTER TABLE users ALTER COLUMN id SET NOT NULL;');
      await client.query('ALTER TABLE users ADD PRIMARY KEY (id);');
      console.log("[DB Actions] 'id' column added and set as PRIMARY KEY on 'users' table.");
    }
    

    // Tabela de workspaces, referenciando users(id)
    await client.query(`
      CREATE TABLE IF NOT EXISTS workspaces (
        id UUID PRIMARY KEY,
        name TEXT NOT NULL,
        nodes JSONB,
        connections JSONB,
        owner UUID, 
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        evolution_api_enabled BOOLEAN DEFAULT false,
        evolution_api_url TEXT,
        evolution_api_key TEXT,
        evolution_instance_name TEXT
      );
    `);

    // Adiciona a foreign key constraint se ela não existir
    const fkConstraintExists = await client.query(`
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workspaces_owner_fkey' AND conrelid = 'workspaces'::regclass;
    `);

    if(fkConstraintExists.rowCount === 0) {
        // Antes de adicionar, remove a coluna 'owner' se ela for do tipo antigo (ex: text)
        // Isso é uma medida drástica, mas necessária se o tipo da coluna mudou.
        // Uma abordagem mais segura seria converter os dados, mas para o estado atual, isso é mais simples.
        const ownerColumnInfo = await client.query(`
            SELECT data_type FROM information_schema.columns 
            WHERE table_name = 'workspaces' AND column_name = 'owner';
        `);
        if(ownerColumnInfo.rowCount > 0 && ownerColumnInfo.rows[0].data_type !== 'uuid') {
             console.warn("[DB Actions] 'owner' column in 'workspaces' is not UUID. It will be dropped and recreated. Existing owner data will be lost.");
             await client.query('ALTER TABLE workspaces DROP COLUMN owner;');
             await client.query('ALTER TABLE workspaces ADD COLUMN owner UUID;');
        }
        await client.query(`
            ALTER TABLE workspaces 
            ADD CONSTRAINT workspaces_owner_fkey 
            FOREIGN KEY (owner) REFERENCES users(id) ON DELETE CASCADE;
        `);
         console.log("[DB Actions] Foreign key 'workspaces_owner_fkey' added.");
    }
    
    // Verifica e corrige a constraint de unicidade para (owner, name)
    const uniqueConstraintName = 'workspaces_owner_name_key';
    const oldUniqueConstraintName = 'workspaces_name_key';
    
    const correctUniqueConstraintExists = await client.query(`SELECT 1 FROM pg_constraint WHERE conname = '${uniqueConstraintName}'`);
    if(correctUniqueConstraintExists.rowCount === 0) {
        // Tenta remover a constraint antiga (apenas no nome) se ela existir
        const oldUniqueConstraintExists = await client.query(`SELECT 1 FROM pg_constraint WHERE conname = '${oldUniqueConstraintName}'`);
        if(oldUniqueConstraintExists.rowCount > 0) {
            await client.query(`ALTER TABLE workspaces DROP CONSTRAINT ${oldUniqueConstraintName};`);
            console.log(`[DB Actions] Dropped old unique constraint: ${oldUniqueConstraintName}`);
        }
        // Adiciona a constraint correta
        await client.query(`ALTER TABLE workspaces ADD CONSTRAINT ${uniqueConstraintName} UNIQUE (owner, name);`);
        console.log(`[DB Actions] Added correct unique constraint: ${uniqueConstraintName}`);
    }

    
    await client.query(`
      CREATE TABLE IF NOT EXISTS flow_sessions (
        session_id TEXT PRIMARY KEY,
        workspace_id UUID,
        current_node_id TEXT,
        flow_variables JSONB,
        awaiting_input_type TEXT,
        awaiting_input_details JSONB,
        session_timeout_seconds INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        last_interaction_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    
    await client.query('COMMIT');
    console.log('[DB Actions] Schema initialization and migration check complete.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[DB Actions] Error initializing/migrating database schema, transaction rolled back.', error);
    throw error;
  } finally {
    client.release();
  }
}

// --- User Actions ---
export async function findUserByUsername(username: string): Promise<User | null> {
    const result = await runQuery<User>(
        'SELECT id, username, role, password_hash FROM users WHERE username = $1',
        [username]
    );
    if (result.rows.length > 0) {
        return result.rows[0];
    }
    return null;
}

export async function createUser(username: string, passwordHash: string, role: 'user' | 'desenvolvedor' = 'user'): Promise<{ success: boolean; user?: User; error?: string }> {
    try {
        const result = await runQuery<User>(
            'INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3) RETURNING id, username, role',
            [username, passwordHash, role]
        );
        if (result.rows.length > 0) {
            return { success: true, user: result.rows[0] };
        }
        return { success: false, error: 'Falha ao criar usuário.' };

    } catch (error: any) {
        if (error.code === '23505') { // Unique violation on username
            return { success: false, error: 'Este nome de usuário já está em uso.' };
        }
        console.error("[DB Actions] Error creating user:", error);
        return { success: false, error: `Erro de banco de dados: ${error.message}` };
    }
}

// --- Workspace Actions ---
export async function createWorkspaceAction(
    name: string,
    ownerId: string
): Promise<{ success: boolean; workspaceId?: string; error?: string }> {
    try {
        if (!name || !ownerId) {
            return { success: false, error: 'Nome do fluxo e ID do proprietário são obrigatórios.' };
        }

        const newId = uuidv4();
        const defaultStartNode: NodeData = {
          id: uuidv4(),
          type: 'start',
          title: 'Início do Fluxo',
          x: 100,
          y: 150,
          triggers: [
              { id: uuidv4(), name: 'Manual', type: 'manual', enabled: true },
              { id: uuidv4(), name: 'Webhook', type: 'webhook', enabled: false, variableMappings: [], sessionTimeoutSeconds: 0 }
          ]
        };

        const newWorkspace: WorkspaceData = {
            id: newId,
            name: name,
            nodes: [defaultStartNode],
            connections: [],
            owner: ownerId,
            evolution_api_enabled: false,
            evolution_api_url: '',
            evolution_api_key: '',
            evolution_instance_name: '',
        };

        const saveResult = await saveWorkspaceToDB(newWorkspace);

        if (!saveResult.success) {
            return { success: false, error: saveResult.error };
        }
        
        return { success: true, workspaceId: newId };
    } catch (error: any) {
        console.error('[DB Actions] createWorkspaceAction Error:', error);
        return { success: false, error: `Erro do servidor: ${error.message}` };
    }
}


export async function saveWorkspaceToDB(workspaceData: WorkspaceData): Promise<{ success: boolean; error?: string }> {
  try {
    if (!workspaceData.owner || !workspaceData.name || !workspaceData.id) {
        return { success: false, error: "Dados do workspace incompletos (requer id, nome e proprietário)." };
    }
    
    const query = `
      INSERT INTO workspaces (id, name, nodes, connections, owner, evolution_api_enabled, evolution_api_url, evolution_api_key, evolution_instance_name, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
      ON CONFLICT (id) DO UPDATE
      SET name = EXCLUDED.name,
          nodes = EXCLUDED.nodes,
          connections = EXCLUDED.connections,
          updated_at = NOW(),
          evolution_api_enabled = EXCLUDED.evolution_api_enabled,
          evolution_api_url = EXCLUDED.evolution_api_url,
          evolution_api_key = EXCLUDED.evolution_api_key,
          evolution_instance_name = EXCLUDED.evolution_instance_name;
    `;
    
    await runQuery(query, [
      workspaceData.id,
      workspaceData.name,
      JSON.stringify(workspaceData.nodes || []), 
      JSON.stringify(workspaceData.connections || []),
      workspaceData.owner,
      workspaceData.evolution_api_enabled || false,
      workspaceData.evolution_api_url || '',
      workspaceData.evolution_api_key || '',
      workspaceData.evolution_instance_name || '',
    ]);
    
    return { success: true };
  } catch (error: any)
{
    console.error(`[DB Actions] saveWorkspaceToDB Error:`, error);
    if (error.code === '23505' && error.constraint === 'workspaces_owner_name_key') {
        return { success: false, error: `Erro: O nome do fluxo '${workspaceData.name}' já existe. Por favor, escolha um nome único.` };
    }
    let errorMessage = `Erro de banco de dados: ${error.message || 'Erro desconhecido'}. (Código: ${error.code || 'N/A'})`;
    return { success: false, error: errorMessage };
  }
}

export async function loadWorkspaceFromDB(workspaceId: string): Promise<WorkspaceData | null> {
  try {
    const result = await runQuery<WorkspaceData>(`
        SELECT 
            id, name, nodes, connections, owner, created_at, updated_at,
            evolution_api_enabled, evolution_api_url, evolution_api_key, evolution_instance_name
        FROM workspaces 
        WHERE id = $1
    `, [workspaceId]);
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

export async function loadWorkspacesForOwnerFromDB(ownerId: string): Promise<WorkspaceData[]> {
  try {
    if (!ownerId) {
        console.warn("[DB Actions] loadWorkspacesForOwnerFromDB called without an owner ID.");
        return [];
    }
    const result = await runQuery<WorkspaceData>(
      `SELECT 
        id, name, nodes, connections, owner, created_at, updated_at, 
        evolution_api_enabled, evolution_api_url, evolution_api_key, evolution_instance_name
       FROM workspaces 
       WHERE owner = $1 
       ORDER BY updated_at DESC`,
      [ownerId]
    );
     return result.rows.map(row => ({
        ...row,
        nodes: row.nodes || [],
        connections: row.connections || [],
      }));
  } catch (error: any) {
    console.error(`[DB Actions] loadWorkspacesForOwnerFromDB Error for owner ID ${ownerId}:`, error);
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
    const result = await runQuery('DELETE FROM flow_sessions WHERE session_id = $1', [sessionId]);
     if (result.rowCount > 0) {
        return { success: true };
    } else {
        // Isso pode acontecer se a sessão já foi deletada, o que não é um erro crítico.
        console.warn(`[DB Actions] deleteSessionFromDB: Session ID ${sessionId} not found for deletion.`);
        return { success: true }; // Retorna sucesso mesmo se não encontrou, a sessão não existe mais.
    }
  } catch (error: any) {
    console.error(`[DB Actions] deleteSessionFromDB Error for ID ${sessionId}:`, error);
    return { success: false, error: error.message };
  }
}


export async function loadAllActiveSessionsFromDB(ownerId: string): Promise<FlowSession[]> {
  try {
    if (!ownerId) {
      console.warn('[DB Actions] loadAllActiveSessionsFromDB called without an owner ID. Returning empty array.');
      return [];
    }

    const query = `
      SELECT 
        fs.session_id, 
        fs.workspace_id, 
        fs.current_node_id, 
        fs.flow_variables, 
        fs.awaiting_input_type, 
        fs.awaiting_input_details, 
        fs.session_timeout_seconds, 
        fs.created_at, 
        fs.last_interaction_at
      FROM flow_sessions fs
      JOIN workspaces ws ON fs.workspace_id = ws.id
      WHERE ws.owner = $1
      ORDER BY fs.last_interaction_at DESC;
    `;
    const result = await runQuery<FlowSession>(query, [ownerId]);

    return result.rows.map(row => ({
      ...row,
      flow_variables: row.flow_variables || {},
      awaiting_input_details: row.awaiting_input_details || null,
    }));
  } catch (error: any) {
    console.error(`[DB Actions] loadAllActiveSessionsFromDB Error for owner ID ${ownerId}:`, error);
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

// Deprecated function, will be removed later.
export async function loadWorkspaceByNameFromDB(name: string, owner: string): Promise<WorkspaceData | null> {
  try {
    const result = await runQuery<WorkspaceData>(
      'SELECT id, name, nodes, connections, owner FROM workspaces WHERE name = $1 AND owner = $2',
      [name, owner]
    );
    if (result.rows.length > 0) {
      return result.rows[0];
    }
    return null;
  } catch (error: any) {
    console.error(`[DB Actions] loadWorkspaceByNameFromDB Error for name ${name}:`, error);
    return null;
  }
}
