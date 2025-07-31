
'use server';

import { Pool, type QueryResult } from 'pg';
import { z } from 'zod';
import type { EvolutionInstance } from '@/lib/types';
import { getCurrentUser } from '@/lib/auth';

// This is a simplified version of the DB connection from databaseActions.ts
// In a real app, you would centralize this logic.
let pool: Pool | null = null;
function getDbPool(): Pool {
    if (pool) return pool;
    const useSSL = process.env.POSTGRES_SSL === 'true';
    pool = new Pool({
        host: process.env.POSTGRES_HOST,
        port: process.env.POSTGRES_PORT ? parseInt(process.env.POSTGRES_PORT, 10) : 5432,
        user: process.env.POSTGRES_USER,
        password: process.env.POSTGRES_PASSWORD,
        database: process.env.POSTGRES_DATABASE,
        ssl: useSSL ? { rejectUnauthorized: false } : false,
    });
    return pool;
}

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
        const poolInstance = getDbPool();
        const result = await poolInstance.query<EvolutionInstance>(
            'SELECT id, name, base_url, api_key FROM evolution_instances WHERE user_id = $1 ORDER BY name',
            [user.id]
        );
        return { data: result.rows };
    } catch (error: any) {
        console.error('[InstanceActions] Error fetching instances:', error);
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
    
    const validation = InstanceSchema.safeParse(rawData);

    if (!validation.success) {
        return { success: false, error: 'Dados inválidos.', issues: validation.error.errors };
    }

    const { id, name, baseUrl, apiKey } = validation.data;

    try {
        const poolInstance = getDbPool();
        let result: QueryResult<EvolutionInstance>;

        if (id) { // Update
            result = await poolInstance.query<EvolutionInstance>(
                `UPDATE evolution_instances 
                 SET name = $1, base_url = $2, api_key = $3, updated_at = NOW() 
                 WHERE id = $4 AND user_id = $5 
                 RETURNING id, name, base_url, api_key`,
                [name, baseUrl, apiKey || '', id, user.id]
            );
        } else { // Create
            result = await poolInstance.query<EvolutionInstance>(
                `INSERT INTO evolution_instances (user_id, name, base_url, api_key) 
                 VALUES ($1, $2, $3, $4) 
                 RETURNING id, name, base_url, api_key`,
                [user.id, name, baseUrl, apiKey || '']
            );
        }

        if (result.rows.length > 0) {
            return { success: true, instance: result.rows[0] };
        } else {
            return { success: false, error: 'Falha ao salvar a instância. Verifique se você tem permissão.' };
        }
    } catch (error: any) {
        console.error('[InstanceActions] Error saving instance:', error);
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
        const poolInstance = getDbPool();
        const result = await poolInstance.query(
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
