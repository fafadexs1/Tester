'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/auth';
import {
  deleteOrganizationAiKey,
  getOrganizationsForUser,
  listOrganizationAiKeys,
  saveOrganizationAiKey,
  setDefaultOrganizationAiKey,
} from './databaseActions';
import type { OrganizationAiKeySummary } from '@/lib/types';

const OrganizationGeminiKeySchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, 'O nome da chave é obrigatório.').max(80, 'Use no máximo 80 caracteres.'),
  api_key: z.string().trim().optional(),
  is_default: z.boolean().optional(),
});

const ensureWriteAccess = async (): Promise<{ organizationId?: string; error?: string }> => {
  const user = await getCurrentUser();
  if (!user?.current_organization_id) {
    return { error: 'Usuário ou organização não encontrados.' };
  }
  if (user.role !== 'desenvolvedor') {
    return { error: 'Acesso negado.' };
  }
  return { organizationId: user.current_organization_id };
};

export async function getOrganizationGeminiKeysAction(organizationId?: string): Promise<{
  success: boolean;
  data?: OrganizationAiKeySummary[];
  error?: string;
}> {
  const user = await getCurrentUser();
  if (!user?.current_organization_id) {
    return { success: false, error: 'Usuário ou organização não encontrados.' };
  }

  const targetOrganizationId = organizationId || user.current_organization_id;
  if (!targetOrganizationId) {
    return { success: false, error: 'Organizacao nao encontrada.' };
  }

  if (targetOrganizationId !== user.current_organization_id && user.role !== 'desenvolvedor') {
    const organizations = await getOrganizationsForUser(user.id);
    const isMember = organizations.some((item) => item.id === targetOrganizationId);
    if (!isMember) {
      return { success: false, error: 'Acesso negado para esta organizacao.' };
    }
  }

  try {
    const data = await listOrganizationAiKeys(targetOrganizationId, 'google');
    return { success: true, data };
  } catch (error: any) {
    return { success: false, error: `Erro de banco de dados: ${error.message}` };
  }
}

export async function saveOrganizationGeminiKeyAction(payload: unknown): Promise<{
  success: boolean;
  key?: OrganizationAiKeySummary;
  error?: string;
  issues?: z.ZodIssue[];
}> {
  const access = await ensureWriteAccess();
  if (!access.organizationId) {
    return { success: false, error: access.error };
  }

  const validation = OrganizationGeminiKeySchema.safeParse(payload);
  if (!validation.success) {
    return { success: false, error: 'Dados inválidos.', issues: validation.error.errors };
  }

  const result = await saveOrganizationAiKey({
    id: validation.data.id,
    organization_id: access.organizationId,
    provider: 'google',
    name: validation.data.name,
    api_key: validation.data.api_key || undefined,
    is_default: validation.data.is_default,
  });

  if (result.success) {
    revalidatePath('/organization/integrations');
  }

  return {
    success: result.success,
    key: result.key,
    error: result.error,
  };
}

export async function deleteOrganizationGeminiKeyAction(keyId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  const access = await ensureWriteAccess();
  if (!access.organizationId) {
    return { success: false, error: access.error };
  }

  const result = await deleteOrganizationAiKey(access.organizationId, keyId);
  if (result.success) {
    revalidatePath('/organization/integrations');
  }
  return result;
}

export async function setDefaultOrganizationGeminiKeyAction(keyId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  const access = await ensureWriteAccess();
  if (!access.organizationId) {
    return { success: false, error: access.error };
  }

  const result = await setDefaultOrganizationAiKey(access.organizationId, keyId);
  if (result.success) {
    revalidatePath('/organization/integrations');
  }
  return result;
}
