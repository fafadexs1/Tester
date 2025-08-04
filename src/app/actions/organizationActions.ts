

'use server';

import { getCurrentUser } from '@/lib/auth';
import type { Organization, OrganizationUser, Team, User, Role, Permission } from '@/lib/types';
import { getOrganizationsForUser, runQuery, findUserByUsername, getRolesForOrganization, getUsersForOrganization, getPermissions, createRole, updateRole, deleteRole } from './databaseActions';
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

export async function getUsersForOrganizationAction(organizationId: string): Promise<GetOrgUsersResult> {
    if (!organizationId) {
        return { success: false, error: "ID da organização não fornecido." };
    }
    try {
        const result = await getUsersForOrganization(organizationId);
        return { success: true, data: result };
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

export async function getTeamsForOrganizationAction(organizationId: string): Promise<GetOrgTeamsResult> {
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
    
    try {
        const teamResult = await runQuery<{ id: string }>(
            'INSERT INTO teams (name, description, organization_id) VALUES ($1, $2, $3) RETURNING id',
            [teamName, teamDescription, organizationId]
        );
        const newTeamId = teamResult.rows[0].id;

        if (memberIds.length > 0) {
            let valuesString = '';
            const queryParams: any[] = [newTeamId, organizationId];
            for (let i = 0; i < memberIds.length; i++) {
                valuesString += `($1, $2, $${i+3})${i === memberIds.length - 1 ? '' : ','}`;
                queryParams.push(memberIds[i]);
            }
            
            if(memberIds.length > 0) {
               await runQuery(
                  `INSERT INTO team_members (team_id, organization_id, user_id) VALUES ${valuesString}`,
                  queryParams
               );
            }
        }

        revalidatePath('/organization/members');
        return { success: true };
    } catch (error: any) {
        if (error.code === '23505') { // unique_violation
            return { success: false, error: `Um time com o nome "${teamName}" já existe nesta organização.` };
        }
        console.error('[OrganizationActions] Erro ao criar time:', error);
        return { success: false, error: `Erro de banco de dados: ${error.message}` };
    }
}

export async function inviteUserToOrganizationAction(formData: FormData): Promise<{ success: boolean; error?: string }> {
    const currentUser = await getCurrentUser();
    const usernameToInvite = formData.get('username') as string;
    const roleId = formData.get('roleId') as string; // Changed from role to roleId
    const organizationId = currentUser?.current_organization_id;

    if (!currentUser || !organizationId) {
        return { success: false, error: "Usuário não autenticado ou organização não selecionada." };
    }
     if (!usernameToInvite || !roleId) {
        return { success: false, error: "Nome de usuário e cargo são obrigatórios." };
    }

    try {
        const userToInvite = await findUserByUsername(usernameToInvite);
        if (!userToInvite) {
            return { success: false, error: `Usuário "${usernameToInvite}" não encontrado.` };
        }

        // Insert/update using role_id now
        await runQuery(
            'INSERT INTO organization_users (user_id, organization_id, role_id) VALUES ($1, $2, $3) ON CONFLICT (user_id, organization_id) DO UPDATE SET role_id = EXCLUDED.role_id',
            [userToInvite.id, organizationId, roleId]
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

// --- RBAC Actions ---

export async function getRolesForOrganizationAction(): Promise<{ success: boolean; data?: Role[]; error?: string }> {
    const user = await getCurrentUser();
    if (!user?.current_organization_id) {
        return { success: false, error: 'Usuário ou organização não encontrados.' };
    }
    try {
        const roles = await getRolesForOrganization(user.current_organization_id);
        return { success: true, data: roles };
    } catch (error: any) {
        return { success: false, error: `Erro de banco de dados: ${error.message}` };
    }
}

export async function getPermissionsAction(): Promise<{ success: boolean; data?: Permission[]; error?: string }> {
    try {
        const permissions = await getPermissions();
        return { success: true, data: permissions };
    } catch (error: any) {
        return { success: false, error: `Erro de banco de dados: ${error.message}` };
    }
}

export async function createRoleAction(formData: FormData): Promise<{ success: boolean; error?: string }> {
    const user = await getCurrentUser();
    const organizationId = user?.current_organization_id;

    if (!user || !organizationId) {
        return { success: false, error: "Usuário não autenticado ou organização não selecionada." };
    }

    const name = formData.get('name') as string;
    const description = formData.get('description') as string;
    const permissionIds = formData.getAll('permissions') as string[];

    if (!name) {
        return { success: false, error: "O nome do cargo é obrigatório." };
    }

    const result = await createRole(organizationId, name, description, permissionIds);
    if (result.success) {
        revalidatePath('/organization/members');
    }
    return result;
}

export async function updateRoleAction(formData: FormData): Promise<{ success: boolean; error?: string }> {
    const user = await getCurrentUser();
    if (!user?.current_organization_id) return { success: false, error: "Usuário não autenticado." };

    const roleId = formData.get('roleId') as string;
    const name = formData.get('name') as string;
    const description = formData.get('description') as string;
    const permissionIds = formData.getAll('permissions') as string[];

    if (!roleId || !name) return { success: false, error: "ID e nome do cargo são obrigatórios." };
    
    const result = await updateRole(roleId, name, description, permissionIds);
    if (result.success) {
        revalidatePath('/organization/members');
    }
    return result;
}

export async function deleteRoleAction(roleId: string): Promise<{ success: boolean; error?: string }> {
    const user = await getCurrentUser();
    if (!user?.current_organization_id) return { success: false, error: "Usuário não autenticado." };

    const result = await deleteRole(roleId);
     if (result.success) {
        revalidatePath('/organization/members');
    }
    return result;
}
