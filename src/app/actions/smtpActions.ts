
'use server';

import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { getSmtpSettings, saveSmtpSettings } from './databaseActions';
import type { SmtpSettings } from '@/lib/types';
import { revalidatePath } from 'next/cache';
import nodemailer from 'nodemailer';


const SmtpSettingsSchema = z.object({
    host: z.string().min(1, "O host é obrigatório."),
    port: z.coerce.number().min(1, "A porta é obrigatória."),
    secure: z.boolean(),
    username: z.string().optional(),
    password: z.string().optional(),
    from_name: z.string().optional(),
    from_email: z.string().email("E-mail do remetente inválido.").optional().or(z.literal('')),
});


export async function getSmtpSettingsAction(): Promise<{ success: boolean; data?: SmtpSettings | null; error?: string }> {
    const user = await getCurrentUser();
    if (!user?.current_organization_id) {
        return { success: false, error: 'Usuário ou organização não encontrados.' };
    }
    if (user.role !== 'desenvolvedor') {
        return { success: false, error: 'Acesso negado.' };
    }

    try {
        const settings = await getSmtpSettings(user.current_organization_id);
        return { success: true, data: settings };
    } catch (error: any) {
        return { success: false, error: `Erro de banco de dados: ${error.message}` };
    }
}

export async function saveSmtpSettingsAction(
    formData: unknown
): Promise<{ success: boolean; error?: string, issues?: z.ZodIssue[] }> {
    const user = await getCurrentUser();
    if (!user?.current_organization_id) {
        return { success: false, error: 'Usuário ou organização não encontrados.' };
    }
    if (user.role !== 'desenvolvedor') {
        return { success: false, error: 'Acesso negado.' };
    }

    const validation = SmtpSettingsSchema.safeParse(formData);
    if (!validation.success) {
        return { success: false, error: 'Dados inválidos.', issues: validation.error.errors };
    }

    const settingsToSave: Omit<SmtpSettings, 'id' | 'created_at' | 'updated_at'> = {
        ...validation.data,
        organization_id: user.current_organization_id,
        from_email: validation.data.from_email || null, // Garante que string vazia vira null no BD
        username: validation.data.username || null,
        password: validation.data.password || null,
        from_name: validation.data.from_name || null,
    };

    const result = await saveSmtpSettings(settingsToSave);

    if (result.success) {
        revalidatePath('/organization/email');
    }

    return result;
}

export async function testSmtpConnectionAction(
    formData: unknown
): Promise<{ success: boolean; error?: string, issues?: z.ZodIssue[] }> {
     const user = await getCurrentUser();
    if (!user?.current_organization_id || user.role !== 'desenvolvedor') {
        return { success: false, error: 'Acesso negado.' };
    }

    const validation = SmtpSettingsSchema.safeParse(formData);
    if (!validation.success) {
        return { success: false, error: 'Dados de SMTP inválidos para o teste.', issues: validation.error.errors };
    }
    
    const { host, port, secure, username, password } = validation.data;

    const transporter = nodemailer.createTransport({
        host: host,
        port: port,
        secure: secure, // true for 465, false for other ports
        auth: {
            user: username,
            pass: password,
        },
         tls: {
            // não falhar em certificados inválidos
            rejectUnauthorized: false
        }
    });

    try {
        console.log(`[SMTP Test] Verifying connection to ${host}:${port}...`);
        await transporter.verify();
        console.log('[SMTP Test] Connection successful.');
        return { success: true };
    } catch (error: any) {
        console.error('[SMTP Test] Connection failed:', error);
        let errorMessage = `Falha na conexão: ${error.message}`;
        if (error.code === 'ETIMEDOUT') {
            errorMessage = 'Falha na conexão: O tempo limite foi atingido. Verifique o host e a porta.';
        } else if (error.code === 'ECONNREFUSED') {
            errorMessage = 'Falha na conexão: Conexão recusada. Verifique o host e a porta.';
        } else if (error.code === 'EAUTH') {
             errorMessage = 'Falha na autenticação: Usuário ou senha inválidos.';
        }
        return { success: false, error: errorMessage };
    }
}
