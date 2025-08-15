
'use server';

import { z } from 'zod';
import type { EvolutionInstance, ChatwootInstance, DialogyInstance } from '@/lib/types';
import { getCurrentUser } from '@/lib/auth';
import { runQuery } from './databaseActions'; // Import the robust runQuery

const EvolutionInstanceSchema = z.object({
    id: z.string().uuid().optional().or(z.literal('')),
    name: z.string().min(1, "O nome não pode estar vazio."),
    baseUrl: z.string().url("URL inválida."),
    apiKey: z.string().optional(),
});

const ChatwootInstanceSchema = z.object({
    id: z.string().uuid().optional().or(z.literal('')),
    name: z.string().min(1, "O nome não pode estar vazio."),
    baseUrl: z.string().url("URL da instância Chatwoot é inválida."),
    apiAccessToken: z.string().min(1, "O token de acesso da API é obrigatório."),
});

const DialogyInstanceSchema = z.object({
    id: z.string().uuid().optional().or(z.literal('')),
    name: z.string().min(1, "O nome não pode estar vazio."),
    baseUrl: z.string().url("URL da instância Dialogy é inválida."),
    apiKey: z.string().min(1, "A API Key (Authorization Token) é obrigatória."),
});


export async function getEvolutionInstancesForUser(): Promise<{ data?: EvolutionInstance[]; error?: string }> {
    const user = await getCurrentUser();
    if (!user || !user.id) {
        return { error: 'Usuário não autenticado.' };
    }

    try {
        const result = await runQuery<any>(
            'SELECT id, name, base_url, api_key FROM evolution_instances WHERE user_id = $1 ORDER BY name',
            [user.id]
        );
        const instances = result.rows.map(row => ({
            id: row.id,
            name: row.name,
            baseUrl: row.base_url,
            apiKey: row.api_key,
            status: 'unconfigured' as const
        }));
        return { data: instances };
    } catch (error: any) {
        console.error('[InstanceActions] Error fetching evolution instances:', error);
        return { error: `Erro de banco de dados: ${error.message}` };
    }
}

export async function saveEvolutionInstanceAction(
    formData: FormData
): Promise<{ success: boolean; instance?: EvolutionInstance; error?: string; issues?: z.ZodIssue[] }> {
    const user = await getCurrentUser();
    if (!user || !user.id) {
        return { success: false, error: 'Usuário não autenticado.' };
    }

    const rawData = {
        id: formData.get('id') as string | undefined,
        name: formData.get('name') as string,
        baseUrl: formData.get('baseUrl') as string,
        apiKey: formData.get('apiKey') as string,
    };
    
    const validation = EvolutionInstanceSchema.safeParse(rawData);

    if (!validation.success) {
        return { success: false, error: 'Dados inválidos.', issues: validation.error.errors };
    }

    const { id, name, baseUrl, apiKey } = validation.data;

    try {
        let result;

        if (id) {
            result = await runQuery<any>(
                `UPDATE evolution_instances 
                 SET name = $1, base_url = $2, api_key = $3, updated_at = NOW() 
                 WHERE id = $4 AND user_id = $5 
                 RETURNING id, name, base_url, api_key`,
                [name, baseUrl, apiKey || '', id, user.id]
            );
        } else {
            result = await runQuery<any>(
                `INSERT INTO evolution_instances (user_id, name, base_url, api_key) 
                 VALUES ($1, $2, $3, $4) 
                 RETURNING id, name, base_url, api_key`,
                [user.id, name, baseUrl, apiKey || '']
            );
        }
        
        if (result.rows.length > 0) {
            const dbRow = result.rows[0];
            const instance: EvolutionInstance = {
                 id: dbRow.id,
                 name: dbRow.name,
                 baseUrl: dbRow.base_url,
                 apiKey: dbRow.api_key,
                 status: 'unconfigured'
            };
            return { success: true, instance: instance };
        } else {
            return { success: false, error: 'Falha ao salvar a instância. Verifique se você tem permissão.' };
        }
    } catch (error: any) {
        if (error.code === '23505') { // unique_violation
            return { success: false, error: `O nome da instância '${name}' já está em uso.` };
        }
        return { success: false, error: `Erro de banco de dados: ${error.message}` };
    }
}

export async function deleteEvolutionInstanceAction(instanceId: string): Promise<{ success: boolean; error?: string }> {
    const user = await getCurrentUser();
    if (!user || !user.id) {
        return { success: false, error: 'Usuário não autenticado.' };
    }
     if (!instanceId) {
        return { success: false, error: 'ID da instância não fornecido.' };
    }

    try {
        const result = await runQuery(
            'DELETE FROM evolution_instances WHERE id = $1 AND user_id = $2',
            [instanceId, user.id]
        );

        if (result.rowCount > 0) {
            return { success: true };
        } else {
            return { success: false, error: 'Instância não encontrada ou você não tem permissão para excluí-la.' };
        }
    } catch (error: any) {
        console.error('[InstanceActions] Error deleting evolution instance:', error);
        return { success: false, error: `Erro de banco de dados: ${error.message}` };
    }
}


// --- Chatwoot Actions ---

export async function getChatwootInstancesForUserAction(): Promise<{ data?: ChatwootInstance[]; error?: string }> {
    const user = await getCurrentUser();
    if (!user || !user.id) {
        return { error: 'Usuário não autenticado.' };
    }

    try {
        const result = await runQuery<any>(
            'SELECT id, name, base_url, api_access_token FROM chatwoot_instances WHERE user_id = $1 ORDER BY name',
            [user.id]
        );
        const instances = result.rows.map(row => ({
            id: row.id,
            name: row.name,
            baseUrl: row.base_url,
            apiAccessToken: row.api_access_token,
            status: 'unconfigured' as const
        }));
        return { data: instances };
    } catch (error: any) {
        console.error('[InstanceActions] Error fetching chatwoot instances:', error);
        return { error: `Erro de banco de dados: ${error.message}` };
    }
}

export async function saveChatwootInstanceAction(
    formData: FormData
): Promise<{ success: boolean; instance?: ChatwootInstance; error?: string; issues?: z.ZodIssue[] }> {
    const user = await getCurrentUser();
    if (!user || !user.id) {
        return { success: false, error: 'Usuário não autenticado.' };
    }

    const rawData = {
        id: formData.get('id') as string | undefined,
        name: formData.get('name') as string,
        baseUrl: formData.get('baseUrl') as string,
        apiAccessToken: formData.get('apiAccessToken') as string,
    };
    
    const validation = ChatwootInstanceSchema.safeParse(rawData);

    if (!validation.success) {
        return { success: false, error: 'Dados inválidos.', issues: validation.error.errors };
    }

    const { id, name, baseUrl, apiAccessToken } = validation.data;

    try {
        let result;

        if (id) {
            result = await runQuery<any>(
                `UPDATE chatwoot_instances 
                 SET name = $1, base_url = $2, api_access_token = $3, updated_at = NOW() 
                 WHERE id = $4 AND user_id = $5 
                 RETURNING id, name, base_url, api_access_token`,
                [name, baseUrl, apiAccessToken, id, user.id]
            );
        } else {
            result = await runQuery<any>(
                `INSERT INTO chatwoot_instances (user_id, name, base_url, api_access_token) 
                 VALUES ($1, $2, $3, $4) 
                 RETURNING id, name, base_url, api_access_token`,
                [user.id, name, baseUrl, apiAccessToken]
            );
        }
        
        if (result.rows.length > 0) {
            const dbRow = result.rows[0];
            const instance: ChatwootInstance = {
                 id: dbRow.id,
                 name: dbRow.name,
                 baseUrl: dbRow.base_url,
                 apiAccessToken: dbRow.api_access_token,
                 status: 'unconfigured'
            };
            return { success: true, instance: instance };
        } else {
            return { success: false, error: 'Falha ao salvar a instância Chatwoot. Verifique se você tem permissão.' };
        }
    } catch (error: any) {
        if (error.code === '23505') { // unique_violation
            return { success: false, error: `O nome da instância Chatwoot '${name}' já está em uso.` };
        }
        return { success: false, error: `Erro de banco de dados: ${error.message}` };
    }
}

export async function deleteChatwootInstanceAction(instanceId: string): Promise<{ success: boolean; error?: string }> {
    const user = await getCurrentUser();
    if (!user || !user.id) {
        return { success: false, error: 'Usuário não autenticado.' };
    }
     if (!instanceId) {
        return { success: false, error: 'ID da instância Chatwoot não fornecido.' };
    }

    try {
        const result = await runQuery(
            'DELETE FROM chatwoot_instances WHERE id = $1 AND user_id = $2',
            [instanceId, user.id]
        );

        if (result.rowCount > 0) {
            return { success: true };
        } else {
            return { success: false, error: 'Instância Chatwoot não encontrada ou você não tem permissão para excluí-la.' };
        }
    } catch (error: any) {
        console.error('[InstanceActions] Error deleting chatwoot instance:', error);
        return { success: false, error: `Erro de banco de dados: ${error.message}` };
    }
}

// --- Dialogy Actions ---

export async function getDialogyInstancesForUserAction(): Promise<{ data?: DialogyInstance[]; error?: string }> {
    const user = await getCurrentUser();
    if (!user || !user.id) {
        return { error: 'Usuário não autenticado.' };
    }

    try {
        const result = await runQuery<any>(
            'SELECT id, name, base_url, api_key FROM dialogy_instances WHERE user_id = $1 ORDER BY name',
            [user.id]
        );
        const instances = result.rows.map(row => ({
            id: row.id,
            name: row.name,
            baseUrl: row.base_url,
            apiKey: row.api_key,
            status: 'unconfigured' as const
        }));
        return { data: instances };
    } catch (error: any) {
        console.error('[InstanceActions] Error fetching dialogy instances:', error);
        return { error: `Erro de banco de dados: ${error.message}` };
    }
}

export async function saveDialogyInstanceAction(
    formData: FormData
): Promise<{ success: boolean; instance?: DialogyInstance; error?: string; issues?: z.ZodIssue[] }> {
    const user = await getCurrentUser();
    if (!user || !user.id) {
        return { success: false, error: 'Usuário não autenticado.' };
    }

    const rawData = {
        id: formData.get('id') as string | undefined,
        name: formData.get('name') as string,
        baseUrl: formData.get('baseUrl') as string,
        apiKey: formData.get('apiKey') as string,
    };
    
    const validation = DialogyInstanceSchema.safeParse(rawData);

    if (!validation.success) {
        return { success: false, error: 'Dados inválidos.', issues: validation.error.errors };
    }

    const { id, name, baseUrl, apiKey } = validation.data;

    try {
        let result;

        if (id) {
            result = await runQuery<any>(
                `UPDATE dialogy_instances 
                 SET name = $1, base_url = $2, api_key = $3, updated_at = NOW() 
                 WHERE id = $4 AND user_id = $5 
                 RETURNING id, name, base_url, api_key`,
                [name, baseUrl, apiKey, id, user.id]
            );
        } else {
            result = await runQuery<any>(
                `INSERT INTO dialogy_instances (user_id, name, base_url, api_key) 
                 VALUES ($1, $2, $3, $4) 
                 RETURNING id, name, base_url, api_key`,
                [user.id, name, baseUrl, apiKey]
            );
        }
        
        if (result.rows.length > 0) {
            const dbRow = result.rows[0];
            const instance: DialogyInstance = {
                 id: dbRow.id,
                 name: dbRow.name,
                 baseUrl: dbRow.base_url,
                 apiKey: dbRow.api_key,
                 status: 'unconfigured'
            };
            return { success: true, instance: instance };
        } else {
            return { success: false, error: 'Falha ao salvar a instância Dialogy. Verifique se você tem permissão.' };
        }
    } catch (error: any) {
        if (error.code === '23505') { // unique_violation
            return { success: false, error: `O nome da instância Dialogy '${name}' já está em uso.` };
        }
        return { success: false, error: `Erro de banco de dados: ${error.message}` };
    }
}

export async function deleteDialogyInstanceAction(instanceId: string): Promise<{ success: boolean; error?: string }> {
    const user = await getCurrentUser();
    if (!user || !user.id) {
        return { success: false, error: 'Usuário não autenticado.' };
    }
     if (!instanceId) {
        return { success: false, error: 'ID da instância Dialogy não fornecido.' };
    }

    try {
        const result = await runQuery(
            'DELETE FROM dialogy_instances WHERE id = $1 AND user_id = $2',
            [instanceId, user.id]
        );

        if (result.rowCount > 0) {
            return { success: true };
        } else {
            return { success: false, error: 'Instância Dialogy não encontrada ou você não tem permissão para excluí-la.' };
        }
    } catch (error: any) {
        console.error('[InstanceActions] Error deleting dialogy instance:', error);
        return { success: false, error: `Erro de banco de dados: ${error.message}` };
    }
}
