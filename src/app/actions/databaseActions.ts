
'use server';

import { Pool, type QueryResult } from 'pg';
import dotenv from 'dotenv';
import type { WorkspaceData, FlowSession, NodeData, Connection, User, EvolutionInstance, ChatwootInstance, Organization, Team, OrganizationUser, SmtpSettings, Role, Permission } from '@/lib/types';
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

export async function runQuery<T>(query: string, params: any[] = []): Promise<QueryResult<T>> {
    const poolInstance = getDbPool();
    const client = await poolInstance.connect();
    try {
        await client.query('BEGIN');
        const result = await client.query<T>(query, params);
        await client.query('COMMIT');
        return result;
    } catch (error: any) {
        await client.query('ROLLBACK');
        console.error(`[DB Actions] Query failed and rolled back: ${query.substring(0, 100)}...`, { error: error.message, code: error.code });
        
        if (['ECONNRESET', 'ECONNREFUSED'].includes(error.code) || error.message.includes('timeout')) {
            if (pool) await pool.end();
            pool = null;
        }
        
        if (error.code === '42P01') { 
            console.warn('[DB Actions] Table not found. Attempting to initialize schema and retry...');
            try {
                await initializeDatabaseSchema();
                console.log('[DB Actions] Schema initialized. Retrying query...');
                await client.query('BEGIN');
                const result = await client.query<T>(query, params);
                await client.query('COMMIT');
                return result;
            } catch (initError: any) {
                 await client.query('ROLLBACK');
                 console.error('[DB Actions] Fatal: Failed to initialize schema after table not found. Rolled back.', initError);
                 throw initError;
            }
        }
        throw error;
    } finally {
        client.release();
    }
}


async function initializeDatabaseSchema(): Promise<void> {
 const client = await getDbPool().connect();
 try {
    console.log('[DB Actions] Initializing database schema if needed...');
    
    // Ensure the extension for generating UUIDs is enabled BEFORE any transaction.
    await client.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto";');

    await client.query('BEGIN');
    
    // Users Table - Created before organizations for the foreign key
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        username TEXT NOT NULL UNIQUE,
        email TEXT UNIQUE,
        full_name TEXT,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'user',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        current_organization_id UUID -- Will be referenced later
      );
    `);

    // **START OF FIX FOR NULL ID ERROR**
    // Ensures the 'id' column has the default value to generate UUIDs,
    // even if the table already existed from an older schema version.
    const idDefaultCheck = await client.query(`
        SELECT column_default
        FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'id';
    `);

    if (idDefaultCheck.rowCount > 0 && !idDefaultCheck.rows[0].column_default) {
        console.log("[DB Migration] Default value for 'users.id' is missing. Applying fix...");
        await client.query('ALTER TABLE users ALTER COLUMN id SET DEFAULT gen_random_uuid();');
        console.log("[DB Migration] Default value for 'users.id' has been set.");
    }
    // **END OF FIX FOR NULL ID ERROR**

    // Migration block for the 'email' column
    const emailColExists = await client.query(`
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='users' AND column_name='email';
    `);
    if (emailColExists.rowCount === 0) {
        console.log("[DB Actions] 'email' column not found in 'users' table. Adding column...");
        await client.query('ALTER TABLE users ADD COLUMN email TEXT UNIQUE;');
    }
    
    // Migration block for the 'full_name' column
    const fullNameColExists = await client.query(`
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='users' AND column_name='full_name';
    `);
    if (fullNameColExists.rowCount === 0) {
        console.log("[DB Actions] 'full_name' column not found in 'users' table. Adding column...");
        await client.query('ALTER TABLE users ADD COLUMN full_name TEXT;');
    }

    // Organizations Table
    await client.query(`
        CREATE TABLE IF NOT EXISTS organizations (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name TEXT NOT NULL,
            owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );
    `);

    // Now that 'organizations' exists, we can add the foreign key in 'users'
    const fkExists = await client.query(`
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'users_current_organization_id_fkey' AND conrelid = 'users'::regclass
    `);

    if (fkExists.rowCount === 0) {
        await client.query(`
            ALTER TABLE users 
            ADD CONSTRAINT users_current_organization_id_fkey 
            FOREIGN KEY (current_organization_id) REFERENCES organizations(id) ON DELETE SET NULL;
        `);
    }

    // --- RBAC TABLES ---
    await client.query(`
        CREATE TABLE IF NOT EXISTS roles (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            description TEXT,
            is_system_role BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            UNIQUE(organization_id, name)
        );
    `);

    await client.query(`
        CREATE TABLE IF NOT EXISTS permissions (
            id TEXT PRIMARY KEY,
            description TEXT NOT NULL,
            subject TEXT NOT NULL
        );
    `);

    await client.query(`
        CREATE TABLE IF NOT EXISTS role_permissions (
            role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
            permission_id TEXT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
            PRIMARY KEY (role_id, permission_id)
        );
    `);

    // User-Organization association table (many-to-many) - now with role_id
    await client.query(`
        CREATE TABLE IF NOT EXISTS organization_users (
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
            role_id UUID REFERENCES roles(id) ON DELETE SET NULL -- Changed from 'role TEXT'
        );
    `);

    // Migration block for the `role_id` column in organization_users
    const oldRoleColInfo = await client.query(`SELECT 1 FROM information_schema.columns WHERE table_name='organization_users' AND column_name='role'`);
    if(oldRoleColInfo.rowCount > 0) {
        console.log(`[DB Migration] Old 'role' column found in 'organization_users'. Migrating to 'role_id'...`);
        
        const newRoleIdColInfo = await client.query(`SELECT 1 FROM information_schema.columns WHERE table_name='organization_users' AND column_name='role_id'`);
        if (newRoleIdColInfo.rowCount === 0) {
            await client.query(`ALTER TABLE organization_users ADD COLUMN role_id UUID;`);
        }
        
        await client.query(`
            INSERT INTO roles (organization_id, name, description, is_system_role)
            SELECT id, 'Admin', 'Acesso total a todas as configurações e fluxos.', TRUE FROM organizations
            ON CONFLICT (organization_id, name) DO NOTHING;
        `);
        await client.query(`
            INSERT INTO roles (organization_id, name, description, is_system_role)
            SELECT id, 'Membro', 'Acesso para visualizar e editar fluxos.', TRUE FROM organizations
            ON CONFLICT (organization_id, name) DO NOTHING;
        `);
        
        await client.query(`
            UPDATE organization_users ou SET role_id = (
                SELECT r.id FROM roles r
                WHERE r.organization_id = ou.organization_id
                  AND r.name = (CASE 
                                  WHEN ou.role = 'admin' THEN 'Admin' 
                                  ELSE 'Membro' 
                                END)
                LIMIT 1
            )
            WHERE ou.role_id IS NULL AND ou.role IS NOT NULL;
        `);
        
        await client.query(`ALTER TABLE organization_users DROP COLUMN role;`);
        
        await client.query(`ALTER TABLE organization_users ADD CONSTRAINT fk_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE SET NULL;`);
        
        console.log(`[DB Migration] Migration from 'role' to 'role_id' in 'organization_users' completed.`);
    }

    const pkConstraintInfo = await client.query(`SELECT 1 FROM pg_constraint WHERE conname = 'organization_users_pkey'`);
    if (pkConstraintInfo.rowCount === 0) {
        await client.query(`ALTER TABLE organization_users ADD PRIMARY KEY (user_id, organization_id);`);
    }

    
    // Teams Table
    await client.query(`
        CREATE TABLE IF NOT EXISTS teams (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            description TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            UNIQUE(organization_id, name)
        );
    `);

    // Member-Team association table
    await client.query(`
        CREATE TABLE IF NOT EXISTS team_members (
            team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, -- For integrity and easier queries
            PRIMARY KEY (team_id, user_id)
        );
    `);

    await client.query(`
        CREATE TABLE IF NOT EXISTS audit_logs (
            id BIGSERIAL PRIMARY KEY,
            user_id UUID REFERENCES users(id) ON DELETE SET NULL,
            organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
            action TEXT NOT NULL, -- Ex: 'user_login', 'create_workspace', 'update_node'
            details JSONB,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );
    `);
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS workspaces (
        id UUID PRIMARY KEY,
        name TEXT NOT NULL,
        nodes JSONB,
        connections JSONB,
        owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
        organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        evolution_instance_id UUID,
        chatwoot_enabled BOOLEAN DEFAULT false,
        chatwoot_instance_id UUID
      );
    `);

    const orgIdColExistsInWorkspaces = await client.query(`
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='workspaces' AND column_name='organization_id';
    `);
    if (orgIdColExistsInWorkspaces.rowCount === 0) {
        console.log(`[DB Actions] 'organization_id' column not found in 'workspaces' table. Adding column...`);
        await client.query('ALTER TABLE workspaces ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;');
    }
    
     await client.query(`
      CREATE TABLE IF NOT EXISTS evolution_instances (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        base_url TEXT,
        api_key TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, name)
      );
    `);
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS chatwoot_instances (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        base_url TEXT NOT NULL,
        api_access_token TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, name)
      );
    `);

    await client.query(`
        CREATE TABLE IF NOT EXISTS smtp_settings (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            organization_id UUID NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
            host TEXT NOT NULL,
            port INTEGER NOT NULL,
            secure BOOLEAN NOT NULL DEFAULT true,
            username TEXT,
            password TEXT,
            from_name TEXT,
            from_email TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        );
    `);
    
    const ownerIdColInfo = await client.query(`SELECT 1 FROM information_schema.columns WHERE table_name='workspaces' AND column_name='owner_id'`);
    if(ownerIdColInfo.rowCount === 0) {
        console.log(`[DB Actions] Column 'owner_id' not found in 'workspaces'. Starting migration...`);
        const oldOwnerColInfo = await client.query(`SELECT 1 FROM information_schema.columns WHERE table_name='workspaces' AND column_name='owner'`);
        if(oldOwnerColInfo.rowCount > 0) {
             console.log(`[DB Actions] Found old 'owner' column. Attempting to rename to 'owner_id'...`);
             await client.query(`ALTER TABLE workspaces RENAME COLUMN owner TO owner_id;`);
             console.log(`[DB Actions] Renamed 'owner' to 'owner_id'.`);
        } else {
            console.log(`[DB Actions] Old 'owner' column not found. Adding 'owner_id' column.`);
            await client.query(`ALTER TABLE workspaces ADD COLUMN owner_id UUID;`);
        }
        
        const fkConstraintExists = await client.query(`SELECT 1 FROM pg_constraint WHERE conname = 'workspaces_owner_id_fkey' AND conrelid = 'workspaces'::regclass`);
        if(fkConstraintExists.rowCount === 0) {
            console.log(`[DB Actions] Adding foreign key constraint 'workspaces_owner_id_fkey'.`);
            await client.query(`ALTER TABLE workspaces ADD CONSTRAINT workspaces_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE;`);
        }
    }

    const evoInstanceIdColInfo = await client.query(`SELECT 1 FROM information_schema.columns WHERE table_name='workspaces' AND column_name='evolution_instance_id'`);
    if (evoInstanceIdColInfo.rowCount === 0) {
      console.log("[DB Actions] 'evolution_instance_id' column not found in 'workspaces'. Adding column...");
      await client.query('ALTER TABLE workspaces ADD COLUMN evolution_instance_id UUID;');
    }
    
    const chatwootEnabledColInfo = await client.query(`SELECT 1 FROM information_schema.columns WHERE table_name='workspaces' AND column_name='chatwoot_enabled'`);
    if (chatwootEnabledColInfo.rowCount === 0) {
      console.log("[DB Actions] 'chatwoot_enabled' column not found in 'workspaces'. Adding column...");
      await client.query('ALTER TABLE workspaces ADD COLUMN chatwoot_enabled BOOLEAN DEFAULT false;');
    }
    
    const chatwootInstanceIdColInfo = await client.query(`SELECT 1 FROM information_schema.columns WHERE table_name='workspaces' AND column_name='chatwoot_instance_id'`);
    if (chatwootInstanceIdColInfo.rowCount === 0) {
      console.log("[DB Actions] 'chatwoot_instance_id' column not found in 'workspaces'. Adding column...");
      await client.query('ALTER TABLE workspaces ADD COLUMN chatwoot_instance_id UUID;');
    }
    
    const fkConstraintExistsEvo = await client.query(`
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workspaces_evolution_instance_id_fkey' AND conrelid = 'workspaces'::regclass;
    `);

    if (fkConstraintExistsEvo.rowCount === 0) {
      console.log("[DB Actions] Foreign key for 'evolution_instance_id' not found. Adding constraint...");
      await client.query(`
        ALTER TABLE workspaces 
        ADD CONSTRAINT workspaces_evolution_instance_id_fkey 
        FOREIGN KEY (evolution_instance_id) REFERENCES evolution_instances(id) ON DELETE SET NULL;
      `);
      console.log("[DB Actions] Foreign key 'workspaces_evolution_instance_id_fkey' added.");
    }
    
    const fkConstraintExistsChatwoot = await client.query(`
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workspaces_chatwoot_instance_id_fkey' AND conrelid = 'workspaces'::regclass;
    `);

    if (fkConstraintExistsChatwoot.rowCount === 0) {
      console.log("[DB Actions] Foreign key for 'chatwoot_instance_id' not found. Adding constraint...");
      await client.query(`
        ALTER TABLE workspaces 
        ADD CONSTRAINT workspaces_chatwoot_instance_id_fkey 
        FOREIGN KEY (chatwoot_instance_id) REFERENCES chatwoot_instances(id) ON DELETE SET NULL;
      `);
      console.log("[DB Actions] Foreign key 'workspaces_chatwoot_instance_id_fkey' added.");
    }


    const correctUniqueConstraintExists = await client.query(`SELECT 1 FROM pg_constraint WHERE conname = 'workspaces_organization_id_name_key'`);
    if(correctUniqueConstraintExists.rowCount === 0) {
        // Drop old constraint if it exists
        const oldUniqueConstraint = await client.query(`SELECT 1 FROM pg_constraint WHERE conname = 'workspaces_owner_id_name_key'`);
        if(oldUniqueConstraint.rowCount > 0) {
            await client.query(`ALTER TABLE workspaces DROP CONSTRAINT workspaces_owner_id_name_key;`);
        }
        await client.query(`ALTER TABLE workspaces ADD CONSTRAINT workspaces_organization_id_name_key UNIQUE (organization_id, name);`);
        console.log(`[DB Actions] Added correct unique constraint: workspaces_organization_id_name_key`);
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
        last_interaction_at TIMESTAMPTZ DEFAULT NOW(),
        flow_context TEXT
      );
    `);
     const flowContextColInfo = await client.query(`SELECT 1 FROM information_schema.columns WHERE table_name='flow_sessions' AND column_name='flow_context'`);
    if (flowContextColInfo.rowCount === 0) {
        console.log("[DB Actions] 'flow_context' column not found in 'flow_sessions'. Adding column...");
        await client.query(`ALTER TABLE flow_sessions ADD COLUMN flow_context TEXT;`);
    }

    // --- Seed Permissions ---
    const permissionsToSeed: Permission[] = [
      { id: 'workspace:create', subject: 'Workspace', description: 'Pode criar novos fluxos.' },
      { id: 'workspace:read', subject: 'Workspace', description: 'Pode visualizar fluxos.' },
      { id: 'workspace:update', subject: 'Workspace', description: 'Pode editar e salvar fluxos.' },
      { id: 'workspace:delete', subject: 'Workspace', description: 'Pode excluir fluxos.' },
      { id: 'member:invite', subject: 'Member', description: 'Pode convidar novos membros para a organização.' },
      { id: 'member:remove', subject: 'Member', description: 'Pode remover membros da organização.' },
      { id: 'member:update_role', subject: 'Member', description: 'Pode alterar o cargo de outros membros.' },
      { id: 'billing:read', subject: 'Billing', description: 'Pode visualizar o faturamento e o plano atual.' },
      { id: 'billing:update', subject: 'Billing', description: 'Pode gerenciar a assinatura e alterar o plano.' },
      { id: 'organization:update', subject: 'Organization', description: 'Pode alterar as configurações gerais da organização.' },
      { id: 'role:create', subject: 'Role', description: 'Pode criar novos cargos.' },
      { id: 'role:update', subject: 'Role', description: 'Pode editar cargos e suas permissões.' },
      { id: 'role:delete', subject: 'Role', description: 'Pode excluir cargos personalizados.' },
    ];

    const insertPermissionQuery = `
      INSERT INTO permissions (id, subject, description) VALUES ($1, $2, $3)
      ON CONFLICT (id) DO UPDATE SET subject = EXCLUDED.subject, description = EXCLUDED.description;
    `;
    for (const p of permissionsToSeed) {
      await client.query(insertPermissionQuery, [p.id, p.subject, p.description]);
    }

    // Associate all permissions with the 'Admin' role for each organization that has it
    const adminRoles = await client.query<{ id: string }>(`SELECT id FROM roles WHERE name = 'Admin'`);
    if (adminRoles.rowCount > 0) {
        const allPermissionIds = permissionsToSeed.map(p => p.id);
        for (const role of adminRoles.rows) {
            for (const permId of allPermissionIds) {
                await client.query(
                    `INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
                    [role.id, permId]
                );
            }
        }
    }
    
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

// --- Audit Log Actions ---
export async function createAuditLog(
    userId: string | null,
    organizationId: string | null,
    action: string,
    details: object = {}
): Promise<void> {
    try {
        await runQuery(
            'INSERT INTO audit_logs (user_id, organization_id, action, details) VALUES ($1, $2, $3, $4)',
            [userId, organizationId, action, JSON.stringify(details)]
        );
    } catch (error) {
        console.error('[DB Actions] Failed to create audit log:', { userId, action, error });
    }
}


// --- User Actions ---
export async function findUserByUsername(username: string): Promise<User | null> {
    const result = await runQuery<User>(
        'SELECT id, username, email, full_name, role, password_hash, current_organization_id FROM users WHERE username = $1',
        [username]
    );
    if (result.rows.length > 0) {
        return result.rows[0];
    }
    return null;
}

export async function getUserById(userId: string): Promise<User | null> {
    const result = await runQuery<User>(
        'SELECT id, username, email, full_name, role, password_hash, current_organization_id FROM users WHERE id = $1',
        [userId]
    );
    return result.rows.length > 0 ? result.rows[0] : null;
}

export async function createUser(
    username: string, 
    passwordHash: string, 
    fullName: string, 
    email: string, 
    role: 'user' | 'desenvolvedor' = 'user'
): Promise<{ success: boolean; user?: User; error?: string }> {
    try {
        const result = await runQuery<User>(
            'INSERT INTO users (username, password_hash, full_name, email, role) VALUES ($1, $2, $3, $4, $5) RETURNING id, username, full_name, email, role',
            [username, passwordHash, fullName, email, role]
        );
        if (result.rows.length > 0) {
            return { success: true, user: result.rows[0] };
        }
        return { success: false, error: 'Falha ao criar usuário.' };

    } catch (error: any) {
        if (error.code === '23505') { 
            const constraint = error.constraint || '';
            if (constraint.includes('username')) {
                return { success: false, error: 'Este nome de usuário já está em uso.' };
            }
            if (constraint.includes('email')) {
                return { success: false, error: 'Este endereço de e-mail já está em uso.' };
            }
        }
        console.error("[DB Actions] Error creating user:", error);
        return { success: false, error: `Erro de banco de dados: ${error.message}` };
    }
}


// --- Organization Actions ---
export async function createOrganization(name: string, ownerId: string): Promise<{ success: boolean; organization?: Organization; error?: string }> {
    let client;
    try {
        const pool = getDbPool();
        client = await pool.connect();
        await client.query('BEGIN');

        const orgResult = await client.query<Organization>(
            'INSERT INTO organizations (name, owner_id) VALUES ($1, $2) RETURNING id, name, owner_id, created_at',
            [name, ownerId]
        );
        const newOrg = orgResult.rows[0];
        if (!newOrg) {
            throw new Error("Falha ao criar a linha da organização.");
        }

        // Create the Admin role for the new organization and get the ID
        const adminRoleResult = await client.query<{ id: string }>(
            `INSERT INTO roles (organization_id, name, description, is_system_role) VALUES ($1, 'Admin', 'Acesso total a todas as configurações e fluxos.', TRUE) RETURNING id`,
            [newOrg.id]
        );
        const adminRoleId = adminRoleResult.rows[0]?.id;
        if (!adminRoleId) {
            throw new Error("Falha ao criar o cargo de Admin para a nova organização.");
        }

        // Associate the owner with the organization with the Admin role
        await client.query(
            'INSERT INTO organization_users (user_id, organization_id, role_id) VALUES ($1, $2, $3)',
            [ownerId, newOrg.id, adminRoleId]
        );
        
        await client.query('COMMIT');
        
        return { success: true, organization: newOrg };
        
    } catch (error: any) {
        if (client) await client.query('ROLLBACK');
        console.error('[DB Actions] Erro ao criar organização:', error);
        return { success: false, error: `Erro de banco de dados: ${error.message}` };
    } finally {
        if (client) client.release();
    }
}

export async function updateOrganizationInDB(id: string, name: string): Promise<{ success: boolean; error?: string }> {
    try {
        const result = await runQuery('UPDATE organizations SET name = $1 WHERE id = $2', [name, id]);
        if (result.rowCount === 0) {
            return { success: false, error: "Organização não encontrada para atualização." };
        }
        return { success: true };
    } catch (error: any) {
        console.error('[DB Actions] Error updating organization:', error);
        return { success: false, error: `Erro de banco de dados: ${error.message}` };
    }
}

export async function getOrganizationsForUser(userId: string): Promise<Organization[]> {
    const result = await runQuery<Organization>(
        `SELECT o.id, o.name, o.owner_id, o.created_at 
         FROM organizations o
         JOIN organization_users ou ON o.id = ou.organization_id
         WHERE ou.user_id = $1`,
        [userId]
    );
    return result.rows;
}

export async function setCurrentOrganizationForUser(userId: string, organizationId: string): Promise<void> {
    await runQuery('UPDATE users SET current_organization_id = $1 WHERE id = $2', [organizationId, userId]);
}

export async function deleteOrganizationFromDB(organizationId: string): Promise<{ success: boolean; error?: string }> {
    try {
        const result = await runQuery('DELETE FROM organizations WHERE id = $1', [organizationId]);
        if (result.rowCount === 0) {
            return { success: false, error: "Organização não encontrada para exclusão." };
        }
        return { success: true };
    } catch (error: any) {
        console.error('[DB Actions] Error deleting organization:', error);
        return { success: false, error: `Erro de banco de dados: ${error.message}` };
    }
}


// --- Workspace Actions ---
export async function createWorkspaceAction(
    name: string,
    ownerId: string,
    organizationId: string
): Promise<{ success: boolean; workspaceId?: string; error?: string }> {
    try {
        if (!name || !ownerId || !organizationId) {
            return { success: false, error: 'Nome do fluxo, ID do proprietário e ID da organização são obrigatórios.' };
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
            owner_id: ownerId,
            organization_id: organizationId,
            chatwoot_enabled: false,
        };

        const saveResult = await saveWorkspaceToDB(newWorkspace);

        if (!saveResult.success) {
            return { success: false, error: saveResult.error };
        }
        
        await createAuditLog(ownerId, organizationId, 'create_workspace', { workspaceId: newId, workspaceName: name });
        return { success: true, workspaceId: newId };
    } catch (error: any) {
        console.error('[DB Actions] createWorkspaceAction Error:', error);
        return { success: false, error: `Erro do servidor: ${error.message}` };
    }
}


export async function saveWorkspaceToDB(workspaceData: WorkspaceData): Promise<{ success: boolean; error?: string }> {
  try {
    if (!workspaceData.owner_id || !workspaceData.name || !workspaceData.id || !workspaceData.organization_id) {
        return { success: false, error: "Dados do workspace incompletos (requer id, nome, proprietário e organização)." };
    }
    
    const query = `
      INSERT INTO workspaces (id, name, nodes, connections, owner_id, organization_id, evolution_instance_id, chatwoot_enabled, chatwoot_instance_id, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
      ON CONFLICT (id) DO UPDATE
      SET name = EXCLUDED.name,
          nodes = EXCLUDED.nodes,
          connections = EXCLUDED.connections,
          updated_at = NOW(),
          evolution_instance_id = EXCLUDED.evolution_instance_id,
          chatwoot_enabled = EXCLUDED.chatwoot_enabled,
          chatwoot_instance_id = EXCLUDED.chatwoot_instance_id;
    `;
    
    await runQuery(query, [
      workspaceData.id,
      workspaceData.name,
      JSON.stringify(workspaceData.nodes || []), 
      JSON.stringify(workspaceData.connections || []),
      workspaceData.owner_id,
      workspaceData.organization_id,
      workspaceData.evolution_instance_id || null,
      workspaceData.chatwoot_enabled || false,
      workspaceData.chatwoot_instance_id || null,
    ]);
    
    return { success: true };
  } catch (error: any)
{
    console.error(`[DB Actions] saveWorkspaceToDB Error:`, error);
    if (error.code === '23505' && error.constraint === 'workspaces_organization_id_name_key') {
        return { success: false, error: `Erro: O nome do fluxo '${workspaceData.name}' já existe nesta organização. Por favor, escolha um nome único.` };
    }
    let errorMessage = `Erro de banco de dados: ${error.message || 'Erro desconhecido'}. (Código: ${error.code || 'N/A'})`;
    return { success: false, error: errorMessage };
  }
}

export async function loadWorkspaceFromDB(workspaceId: string): Promise<WorkspaceData | null> {
  try {
    const result = await runQuery<WorkspaceData>(`
        SELECT 
            id, name, nodes, connections, owner_id, organization_id, created_at, updated_at, evolution_instance_id, chatwoot_enabled, chatwoot_instance_id
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

export async function loadWorkspacesForOrganizationFromDB(organizationId: string): Promise<WorkspaceData[]> {
  try {
    if (!organizationId) {
        console.warn("[DB Actions] loadWorkspacesForOrganizationFromDB called without an organization ID.");
        return [];
    }
    const result = await runQuery<WorkspaceData>(
      `SELECT 
        id, name, nodes, connections, owner_id, organization_id, created_at, updated_at, evolution_instance_id, chatwoot_enabled, chatwoot_instance_id
       FROM workspaces 
       WHERE organization_id = $1 
       ORDER BY updated_at DESC`,
      [organizationId]
    );
     return result.rows.map(row => ({
        ...row,
        nodes: row.nodes || [],
        connections: row.connections || [],
      }));
  } catch (error: any) {
    console.error(`[DB Actions] loadWorkspacesForOrganizationFromDB Error for organization ID ${organizationId}:`, error);
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
      INSERT INTO flow_sessions (session_id, workspace_id, current_node_id, flow_variables, awaiting_input_type, awaiting_input_details, session_timeout_seconds, flow_context, last_interaction_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      ON CONFLICT (session_id) DO UPDATE
      SET workspace_id = EXCLUDED.workspace_id,
          current_node_id = EXCLUDED.current_node_id,
          flow_variables = EXCLUDED.flow_variables,
          awaiting_input_type = EXCLUDED.awaiting_input_type,
          awaiting_input_details = EXCLUDED.awaiting_input_details,
          session_timeout_seconds = EXCLUDED.session_timeout_seconds,
          flow_context = EXCLUDED.flow_context,
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
      sessionData.flow_context || null,
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
      'SELECT session_id, workspace_id, current_node_id, flow_variables, awaiting_input_type, awaiting_input_details, session_timeout_seconds, flow_context, created_at, last_interaction_at FROM flow_sessions WHERE session_id = $1',
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
        console.warn(`[DB Actions] deleteSessionFromDB: Session ID ${sessionId} not found for deletion.`);
        return { success: true };
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
        fs.flow_context,
        fs.created_at, 
        fs.last_interaction_at
      FROM flow_sessions fs
      JOIN workspaces ws ON fs.workspace_id = ws.id
      WHERE ws.owner_id = $1
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

export async function deleteAllSessionsForOwnerFromDB(ownerId: string): Promise<{ success: boolean; error?: string; count: number }> {
  try {
    if (!ownerId) {
        return { success: false, error: "ID do proprietário não fornecido.", count: 0 };
    }

    const query = `
        DELETE FROM flow_sessions
        WHERE workspace_id IN (SELECT id FROM workspaces WHERE owner_id = $1);
    `;
    const result = await runQuery(query, [ownerId]);

    console.log(`[DB Actions] Deleted ${result.rowCount} sessions for owner ID ${ownerId}.`);
    return { success: true, count: result.rowCount };
  } catch (error: any) {
    console.error(`[DB Actions] deleteAllSessionsForOwnerFromDB Error for owner ID ${ownerId}:`, error);
    return { success: false, error: error.message, count: 0 };
  }
}

// --- Chatwoot Instance Actions ---
export async function getChatwootInstancesForUser(userId: string): Promise<{ data?: ChatwootInstance[]; error?: string }> {
    try {
        const result = await runQuery<ChatwootInstance>(
            'SELECT id, name, base_url, api_access_token FROM chatwoot_instances WHERE user_id = $1 ORDER BY name',
            [userId]
        );
        return {
            data: result.rows.map(row => ({
                id: row.id,
                name: row.name,
                baseUrl: (row as any).base_url,
                apiAccessToken: (row as any).api_access_token,
                status: 'unconfigured'
            }))
        };
    } catch (error: any) {
        console.error('[DB Actions] Error fetching Chatwoot instances:', error);
        return { error: `Erro de banco de dados: ${error.message}` };
    }
}

export async function loadChatwootInstanceFromDB(instanceId: string): Promise<ChatwootInstance | null> {
    const result = await runQuery<ChatwootInstance>(
        'SELECT id, name, base_url, api_access_token FROM chatwoot_instances WHERE id = $1',
        [instanceId]
    );
    if (result.rows.length > 0) {
        const row = result.rows[0];
        return {
            id: row.id,
            name: row.name,
            baseUrl: (row as any).base_url,
            apiAccessToken: (row as any).api_access_token,
            status: 'unconfigured'
        };
    }
    return null;
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
export async function loadWorkspaceByNameFromDB(name: string, ownerId: string): Promise<WorkspaceData | null> {
  try {
    const result = await runQuery<WorkspaceData>(
      'SELECT id, name, nodes, connections, owner_id FROM workspaces WHERE name = $1 AND owner_id = $2',
      [name, ownerId]
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

// --- Team & Member Actions ---
export async function getUsersForOrganization(organizationId: string): Promise<OrganizationUser[]> {
    const query = `
        SELECT 
            u.id, 
            u.username, 
            u.email,
            u.full_name,
            r.name as role,
            (o.owner_id = u.id) as is_owner
        FROM users u
        JOIN organization_users ou ON u.id = ou.user_id
        JOIN organizations o ON ou.organization_id = o.id
        LEFT JOIN roles r ON ou.role_id = r.id
        WHERE ou.organization_id = $1
        ORDER BY u.username;
    `;
    const result = await runQuery<OrganizationUser>(query, [organizationId]);
    return result.rows;
}

export async function getTeamsForOrganization(organizationId: string): Promise<Team[]> {
    const query = `
        SELECT t.id, t.name, t.description,
               (SELECT json_agg(u.*)
                FROM users u
                JOIN team_members tm ON u.id = tm.user_id
                WHERE tm.team_id = t.id) as members
        FROM teams t
        WHERE t.organization_id = $1
    `;
    const result = await runQuery<any>(query, [organizationId]);
    
    // Process rows to ensure members is an array, even if null from DB
    return result.rows.map(row => ({
        ...row,
        members: row.members || [],
    }));
}


// --- SMTP Settings Actions ---

export async function getSmtpSettings(organizationId: string): Promise<SmtpSettings | null> {
    if (!organizationId) return null;
    const result = await runQuery<SmtpSettings>(
        'SELECT * FROM smtp_settings WHERE organization_id = $1',
        [organizationId]
    );
    return result.rows.length > 0 ? result.rows[0] : null;
}

export async function saveSmtpSettings(settings: Omit<SmtpSettings, 'id' | 'created_at' | 'updated_at'>): Promise<{ success: boolean, error?: string }> {
    const { organization_id, host, port, secure, username, password, from_name, from_email } = settings;

    const query = `
        INSERT INTO smtp_settings (organization_id, host, port, secure, username, password, from_name, from_email, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
        ON CONFLICT (organization_id) DO UPDATE
        SET host = EXCLUDED.host,
            port = EXCLUDED.port,
            secure = EXCLUDED.secure,
            username = EXCLUDED.username,
            password = EXCLUDED.password,
            from_name = EXCLUDED.from_name,
            from_email = EXCLUDED.from_email,
            updated_at = NOW();
    `;
    try {
        await runQuery(query, [organization_id, host, port, secure, username, password, from_name, from_email]);
        return { success: true };
    } catch (error: any) {
        console.error('[DB Actions] Error saving SMTP settings:', error);
        return { success: false, error: `Erro de banco de dados: ${error.message}` };
    }
}


// --- RBAC Actions ---
export async function getRolesForOrganization(organizationId: string): Promise<Role[]> {
    const query = `
        SELECT 
            r.id, 
            r.name, 
            r.description,
            r.is_system_role,
            COALESCE(
                (SELECT json_agg(rp.permission_id) 
                 FROM role_permissions rp 
                 WHERE rp.role_id = r.id),
                '[]'::json
            ) as permissions
        FROM roles r
        WHERE r.organization_id = $1
        ORDER BY r.is_system_role DESC, r.name ASC;
    `;
    const result = await runQuery<any>(query, [organizationId]);
    return result.rows.map(row => ({
        ...row,
        permissions: Array.isArray(row.permissions) ? row.permissions : [],
    }));
}

export async function getPermissions(): Promise<Permission[]> {
    const result = await runQuery<Permission>('SELECT id, subject, description FROM permissions ORDER BY subject, id');
    return result.rows;
}

export async function createRole(
    organizationId: string,
    name: string,
    description: string,
    permissionIds: string[]
): Promise<{ success: boolean; role?: Role; error?: string }> {
    let client;
    try {
        const pool = getDbPool();
        client = await pool.connect();
        await client.query('BEGIN');

        const roleResult = await client.query<Role>(
            'INSERT INTO roles (organization_id, name, description, is_system_role) VALUES ($1, $2, $3, FALSE) RETURNING *',
            [organizationId, name, description]
        );
        const newRole = roleResult.rows[0];
        if (!newRole) throw new Error("Falha ao criar o cargo.");

        if (permissionIds.length > 0) {
            const values = permissionIds.map(permId => `('${newRole.id}', '${permId}')`).join(',');
            await client.query(`INSERT INTO role_permissions (role_id, permission_id) VALUES ${values}`);
        }

        await client.query('COMMIT');
        
        newRole.permissions = permissionIds;
        return { success: true, role: newRole };
    } catch (error: any) {
        if (client) await client.query('ROLLBACK');
        if (error.code === '23505') { // unique_violation
            return { success: false, error: `Um cargo com o nome "${name}" já existe.` };
        }
        console.error('[DB Actions] Erro ao criar cargo:', error);
        return { success: false, error: `Erro de banco de dados: ${error.message}` };
    } finally {
        if (client) client.release();
    }
}

export async function updateRole(
    roleId: string,
    name: string,
    description: string,
    permissionIds: string[]
): Promise<{ success: boolean; role?: Role; error?: string }> {
     let client;
    try {
        const pool = getDbPool();
        client = await pool.connect();
        await client.query('BEGIN');

        const roleResult = await client.query<Role>(
            'UPDATE roles SET name = $1, description = $2 WHERE id = $3 RETURNING *',
            [name, description, roleId]
        );
        const updatedRole = roleResult.rows[0];
        if (!updatedRole) throw new Error("Cargo não encontrado para atualização.");

        await client.query('DELETE FROM role_permissions WHERE role_id = $1', [roleId]);

        if (permissionIds.length > 0) {
            const values = permissionIds.map(permId => `('${roleId}', '${permId}')`).join(',');
            await client.query(`INSERT INTO role_permissions (role_id, permission_id) VALUES ${values}`);
        }

        await client.query('COMMIT');
        
        updatedRole.permissions = permissionIds;
        return { success: true, role: updatedRole };
    } catch (error: any) {
        if (client) await client.query('ROLLBACK');
        if (error.code === '23505') { // unique_violation
            return { success: false, error: `Um cargo com o nome "${name}" já existe.` };
        }
        console.error('[DB Actions] Erro ao atualizar cargo:', error);
        return { success: false, error: `Erro de banco de dados: ${error.message}` };
    } finally {
        if (client) client.release();
    }
}

export async function deleteRole(roleId: string): Promise<{ success: boolean; error?: string }> {
    try {
        const result = await runQuery('DELETE FROM roles WHERE id = $1 AND is_system_role = FALSE', [roleId]);
        if (result.rowCount === 0) {
            return { success: false, error: "Cargo não encontrado ou é um cargo do sistema que não pode ser excluído." };
        }
        return { success: true };
    } catch (error: any) {
        console.error('[DB Actions] Erro ao excluir cargo:', error);
        return { success: false, error: `Erro de banco de dados: ${error.message}` };
    }
}
