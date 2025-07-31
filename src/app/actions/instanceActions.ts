
'use server';

import { z } from 'zod';
import type { EvolutionInstance } from '@/lib/types';
import { getCurrentUser } from '@/lib/auth';
import { runQuery } from './databaseActions'; // Import the robust runQuery

const InstanceSchema = z.object({
    id: z.string().uuid().optional().or(z.literal('')),
    name: z.string().min(1, "O nome não pode estar vazio."),
    baseUrl: z.string().url("URL inválida."),
    apiKey: z.string().optional(),
});


export async function getEvolutionInstancesForUser(): Promise<{ data?: EvolutionInstance[]; error?: string }> {
    const user = await getCurrentUser();
    if (!user || !user.id) {
        return { error: 'Usuário não autenticado.' };
    }

    try {
        const result = await runQuery<EvolutionInstance>(
            'SELECT id, name, base_url, api_key FROM evolution_instances WHERE user_id = $1 ORDER BY name',
            [user.id]
        );
        // Correctly map database columns to object properties
        const instances = result.rows.map(row => ({
            id: row.id,
            name: row.name,
            baseUrl: (row as any).base_url, // Use snake_case from DB
            apiKey: row.api_key,
            status: 'unconfigured' // Default status
        }));
        return { data: instances };
    } catch (error: any) {
        console.error('[InstanceActions] Error fetching instances:', error);
        return { error: `Erro de banco de dados: ${error.message}` };
    }
}

export async function saveEvolutionInstanceAction(
    formData: FormData
): Promise<{ success: boolean; instance?: EvolutionInstance; error?: string; issues?: z.ZodIssue[] }> {
    console.log('[InstanceActions] Iniciando saveEvolutionInstanceAction...');
    const user = await getCurrentUser();
    if (!user || !user.id) {
        console.error('[InstanceActions] Erro: Usuário não autenticado.');
        return { success: false, error: 'Usuário não autenticado.' };
    }

    const rawData = {
        id: formData.get('id') as string | undefined,
        name: formData.get('name') as string,
        baseUrl: formData.get('baseUrl') as string,
        apiKey: formData.get('apiKey') as string,
    };
    
    console.log('[InstanceActions] Raw data from FormData:', rawData);

    const validation = InstanceSchema.safeParse(rawData);

    if (!validation.success) {
        console.error('[InstanceActions] Erro de validação Zod:', validation.error.errors);
        return { success: false, error: 'Dados inválidos.', issues: validation.error.errors };
    }

    const { id, name, baseUrl, apiKey } = validation.data;
    console.log('[InstanceActions] Dados validados:', { id, name, baseUrl, apiKey: apiKey ? 'presente' : 'ausente' });

    try {
        let result;

        if (id) { // Update
            console.log(`[InstanceActions] Executando UPDATE para a instância ID: ${id}`);
            result = await runQuery<EvolutionInstance>(
                `UPDATE evolution_instances 
                 SET name = $1, base_url = $2, api_key = $3, updated_at = NOW() 
                 WHERE id = $4 AND user_id = $5 
                 RETURNING id, name, base_url, api_key`,
                [name, baseUrl, apiKey || '', id, user.id]
            );
        } else { // Create
            console.log(`[InstanceActions] Executando INSERT para a nova instância com nome: ${name}`);
            result = await runQuery<EvolutionInstance>(
                `INSERT INTO evolution_instances (user_id, name, base_url, api_key) 
                 VALUES ($1, $2, $3, $4) 
                 RETURNING id, name, base_url, api_key`,
                [user.id, name, baseUrl, apiKey || '']
            );
        }
        
        console.log('[InstanceActions] Resultado da query no banco:', result.rows);

        if (result.rows.length > 0) {
            console.log('[InstanceActions] Operação bem-sucedida.');
            const dbRow = result.rows[0];
            const instance: EvolutionInstance = {
                 id: dbRow.id,
                 name: dbRow.name,
                 baseUrl: (dbRow as any).base_url, // Ensure correct property access
                 apiKey: dbRow.api_key,
                 status: 'unconfigured'
            };
            return { success: true, instance: instance };
        } else {
            console.error('[InstanceActions] Erro: Nenhuma linha retornada do banco de dados após a operação.');
            return { success: false, error: 'Falha ao salvar a instância. Verifique se você tem permissão.' };
        }
    } catch (error: any) {
        console.error('[InstanceActions] Erro ao salvar instância no banco:', error);
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
        console.error('[InstanceActions] Error deleting instance:', error);
        return { success: false, error: `Erro de banco de dados: ${error.message}` };
    }
}
