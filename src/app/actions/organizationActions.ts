
'use server';

import { getCurrentUser } from '@/lib/auth';
import type { Organization, OrganizationUser, Team } from '@/lib/types';
import { getOrganizationsForUser, runQuery } from './databaseActions';

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
