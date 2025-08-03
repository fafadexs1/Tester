
'use server';

import { getCurrentUser } from '@/lib/auth';
import type { Organization } from '@/lib/types';
import { getOrganizationsForUser } from './databaseActions';

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
