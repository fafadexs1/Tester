
'use server';

import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { getSmtpSettings, saveSmtpSettings } from './databaseActions';
import type { SmtpSettings } from '@/lib/types';
import { revalidatePath } from 'next/cache';


const SmtpSettingsSchema = z.object({
    host: z.string().min(1, "O host é obrigatório."),
    port: z.coerce.number().min(1, "A porta é obrigatória."),
    secure: z.boolean(),
    username: z.string().optional(),
    password: z.string().optional(),
    from_name: z.string().optional(),
    from_email: z.string().optional(),
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
    };

    const result = await saveSmtpSettings(settingsToSave);

    if (result.success) {
        revalidatePath('/organization/email');
    }

    return result;
}
