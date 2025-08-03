
'use server';

import { getCurrentUser } from '@/lib/auth';
import type { Organization, OrganizationUser, Team, User } from '@/lib/types';
import { getOrganizationsForUser, runQuery, findUserByUsername } from './databaseActions';
import { revalidatePath } from 'next/cache';

interface GetOrgsResult {
    success: boolean;
    data?: Organization[];
    error?: string;
}

export async function getOrganizationsForUserAction(): Promise<GetOrgsResult> {
    const user = await getCurrentUser();
    if (!user || !user.id) {
        return { success: false, error: "Usuário não autenticado." };
    }

    try {
        const organizations = await getOrganizationsForUser(user.id);
        return { success: true, data: organizations };
    } catch (error: any) {
        console.error('[OrganizationActions] Erro ao buscar organizações:', error);
        return { success: false, error: `Erro de banco de dados: ${error.message}` };
    }
}


// New Actions for Members and Teams

interface GetOrgUsersResult {
    success: boolean;
    data?: OrganizationUser[];
    error?: string;
}

export async function getUsersForOrganization(organizationId: string): Promise<GetOrgUsersResult> {
    if (!organizationId) {
        return { success: false, error: "ID da organização não fornecido." };
    }
    try {
        const query = `
            SELECT u.id, u.username, ou.role
            FROM users u
            JOIN organization_users ou ON u.id = ou.user_id
            WHERE ou.organization_id = $1
            ORDER BY u.username;
        `;
        const result = await runQuery<OrganizationUser>(query, [organizationId]);
        return { success: true, data: result.rows };
    } catch (error: any) {
        console.error('[OrganizationActions] Erro ao buscar usuários da organização:', error);
        return { success: false, error: `Erro de banco de dados: ${error.message}` };
    }
}

interface GetOrgTeamsResult {
    success: boolean;
    data?: Team[];
    error?: string;
}

export async function getTeamsForOrganization(organizationId: string): Promise<GetOrgTeamsResult> {
    if (!organizationId) {
        return { success: false, error: "ID da organização não fornecido." };
    }
    try {
        const query = `
            SELECT 
                t.id, 
                t.name, 
                t.description,
                (SELECT COALESCE(json_agg(json_build_object('id', u.id, 'username', u.username)), '[]'::json)
                 FROM users u
                 JOIN team_members tm ON u.id = tm.user_id
                 WHERE tm.team_id = t.id) as members
            FROM teams t
            WHERE t.organization_id = $1
            ORDER BY t.name;
        `;
        const result = await runQuery<any>(query, [organizationId]);
        
        // Rows are already processed by COALESCE in SQL
        const teams: Team[] = result.rows;
        return { success: true, data: teams };
    } catch (error: any) {
        console.error('[OrganizationActions] Erro ao buscar times da organização:', error);
        return { success: false, error: `Erro de banco de dados: ${error.message}` };
    }
}


export async function createTeamAction(formData: FormData): Promise<{ success: boolean; error?: string }> {
    const user = await getCurrentUser();
    const teamName = formData.get('name') as string;
    const teamDescription = formData.get('description') as string;
    const memberIds = formData.getAll('members') as string[];
    const organizationId = user?.current_organization_id;

    if (!user || !organizationId) {
        return { success: false, error: "Usuário não autenticado ou organização não selecionada." };
    }
    if (!teamName) {
        return { success: false, error: "O nome do time é obrigatório." };
    }

    const client = await (await getDbPool()).connect();
    try {
        await client.query('BEGIN');

        const teamResult = await client.query<{ id: string }>(
            'INSERT INTO teams (name, description, organization_id) VALUES ($1, $2, $3) RETURNING id',
            [teamName, teamDescription, organizationId]
        );
        const newTeamId = teamResult.rows[0].id;

        if (memberIds.length > 0) {
            for (const memberId of memberIds) {
                await client.query(
                    'INSERT INTO team_members (team_id, user_id, organization_id) VALUES ($1, $2, $3)',
                    [newTeamId, memberId, organizationId]
                );
            }
        }

        await client.query('COMMIT');
        revalidatePath('/organization/members');
        return { success: true };
    } catch (error: any) {
        await client.query('ROLLBACK');
        if (error.code === '23505') { // unique_violation
            return { success: false, error: `Um time com o nome "${teamName}" já existe nesta organização.` };
        }
        console.error('[OrganizationActions] Erro ao criar time:', error);
        return { success: false, error: `Erro de banco de dados: ${error.message}` };
    } finally {
        client.release();
    }
}

export async function inviteUserToOrganizationAction(formData: FormData): Promise<{ success: boolean; error?: string }> {
    const currentUser = await getCurrentUser();
    const usernameToInvite = formData.get('username') as string;
    const role = formData.get('role') as UserRole;
    const organizationId = currentUser?.current_organization_id;

    if (!currentUser || !organizationId) {
        return { success: false, error: "Usuário não autenticado ou organização não selecionada." };
    }
     if (!usernameToInvite || !role) {
        return { success: false, error: "Nome de usuário e função são obrigatórios." };
    }

    try {
        const userToInvite = await findUserByUsername(usernameToInvite);
        if (!userToInvite) {
            return { success: false, error: `Usuário "${usernameToInvite}" não encontrado.` };
        }

        await runQuery(
            'INSERT INTO organization_users (user_id, organization_id, role) VALUES ($1, $2, $3) ON CONFLICT (user_id, organization_id) DO UPDATE SET role = EXCLUDED.role',
            [userToInvite.id, organizationId, role]
        );
        
        revalidatePath('/organization/members');
        return { success: true };

    } catch (error: any) {
         if (error.code === '23505') { // unique_violation, though handled by ON CONFLICT
            return { success: false, error: `O usuário "${usernameToInvite}" já pertence a esta organização.` };
        }
        console.error('[OrganizationActions] Erro ao convidar usuário:', error);
        return { success: false, error: `Erro de banco de dados: ${error.message}` };
    }
}

// Import getDbPool to use transactions
import { getDbPool } from './databaseActions';
