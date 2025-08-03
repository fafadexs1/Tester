
'use server';

import { createSession, deleteSession } from '@/lib/auth';
import type { User, Organization } from '@/lib/types';
import { cookies } from 'next/headers';
import { findUserByUsername, createUser, createOrganization, getOrganizationsForUser, setCurrentOrganizationForUser, createAuditLog } from './databaseActions';

// Simulação de hashing de senha. Em um app real, use uma biblioteca como bcrypt.
// AVISO: NÃO USE ISTO EM PRODUÇÃO.
const simpleHash = (pass: string) => `hashed_${pass}`;
const verifyPassword = (pass: string, hash: string) => hash === simpleHash(pass);


export async function loginAction(formData: FormData): Promise<{ success: boolean; error?: string; user?: User }> {
  console.log('[authActions.ts] loginAction: Iniciando...');
  const username = formData.get('username') as string;
  const password = formData.get('password') as string;

  if (!username || !password) {
    console.log('[authActions.ts] loginAction: Erro - Campos faltando.');
    return { success: false, error: "Nome de usuário e senha são obrigatórios." };
  }
  
  try {
    const dbUser = await findUserByUsername(username);

    if (!dbUser) {
        console.log(`[authActions.ts] loginAction: Usuário '${username}' não encontrado.`);
        return { success: false, error: "Usuário ou senha inválidos." };
    }
    
    // A verificação de senha real deve ser feita com uma biblioteca como bcrypt no futuro.
    const passwordMatches = verifyPassword(password, dbUser.password_hash || '');
    if (!passwordMatches) {
        console.log(`[authActions.ts] loginAction: Senha inválida para o usuário '${username}'.`);
        return { success: false, error: "Usuário ou senha inválidos." };
    }

    // Após o login bem-sucedido, busca as organizações do usuário
    let organizations = await getOrganizationsForUser(dbUser.id);
    
    // *** CORREÇÃO: Se o usuário não tem organização, cria uma para ele ***
    if (organizations.length === 0) {
        console.warn(`[authActions.ts] Usuário ${dbUser.username} não possui organizações. Criando uma organização padrão...`);
        const orgResult = await createOrganization(`Organização de ${dbUser.username}`, dbUser.id);
        if (orgResult.success && orgResult.organization) {
            // Re-busca as organizações para incluir a recém-criada
            organizations = await getOrganizationsForUser(dbUser.id);
             console.log(`[authActions.ts] Organização padrão criada com sucesso: ${orgResult.organization.name}`);
        } else {
            console.error(`[authActions.ts] Falha crítica ao criar organização padrão para o usuário ${dbUser.username}.`);
            return { success: false, error: "Falha ao configurar a conta do usuário. Não foi possível criar a organização inicial." };
        }
    }


    let currentOrganizationId = dbUser.current_organization_id;

    if (!currentOrganizationId && organizations.length > 0) {
        // Se o usuário não tiver uma organização atual definida, define a primeira da lista como padrão
        currentOrganizationId = organizations[0].id;
        await setCurrentOrganizationForUser(dbUser.id, currentOrganizationId);
    }

    // Cria a sessão com os dados do usuário do banco, incluindo id, role e o ID da organização atual.
    const user: User = { 
        id: dbUser.id, 
        username: dbUser.username, 
        role: dbUser.role,
        current_organization_id: currentOrganizationId
    };
    await createSession(user);
    
    await createAuditLog(user.id, currentOrganizationId, 'user_login', { method: 'password' });

    console.log(`[authActions.ts] loginAction: Sessão criada com sucesso para o usuário: ${username}, role: ${user.role}, org: ${user.current_organization_id}`);
    return { success: true, user };

  } catch (error: any) {
    console.error("[authActions.ts] loginAction: Exceção durante a operação:", error);
    const errorMessage = error instanceof Error ? error.message : "Ocorreu um erro no servidor durante o login.";
    return { success: false, error: errorMessage };
  }
}

export async function registerAction(formData: FormData): Promise<{ success: boolean; error?: string; user?: User }> {
    console.log('[authActions.ts] registerAction: Iniciando...');
    const username = formData.get('username') as string;
    const password = formData.get('password') as string;

    if (!username || !password) {
        return { success: false, error: "Nome de usuário e senha são obrigatórios." };
    }

    try {
        const existingUser = await findUserByUsername(username);
        if (existingUser) {
            return { success: false, error: "Este nome de usuário já está em uso." };
        }
        
        const passwordHash = simpleHash(password);

        // Cria o usuário com a role padrão 'user'
        const createResult = await createUser(username, passwordHash, 'user');

        if (!createResult.success || !createResult.user) {
            return { success: false, error: createResult.error || "Falha ao registrar usuário." };
        }
        
        const newUser = createResult.user;

        // Cria a primeira organização para o novo usuário
        const orgResult = await createOrganization(`Organização de ${username}`, newUser.id);
        if (!orgResult.success || !orgResult.organization) {
            // Em um cenário real, aqui seria necessário fazer um rollback da criação do usuário ou lidar com o erro
            return { success: false, error: "Falha ao criar la organização inicial do usuário." };
        }
        
        // Define a organização recém-criada como a atual do usuário
        await setCurrentOrganizationForUser(newUser.id, orgResult.organization.id);
        
        const finalUser: User = { ...newUser, current_organization_id: orgResult.organization.id };

        // Cria a sessão para o novo usuário
        await createSession(finalUser);
        await createAuditLog(finalUser.id, finalUser.current_organization_id, 'user_register');

        console.log(`[authActions.ts] registerAction: Sessão criada com sucesso para o novo usuário: ${finalUser.username}`);
        return { success: true, user: finalUser };

    } catch (error: any) {
        console.error("[authActions.ts] registerAction: Exceção durante o registro:", error);
        const errorMessage = error instanceof Error ? error.message : "Ocorreu um erro no servidor durante o registro.";
        return { success: false, error: errorMessage };
    }
}


export async function logoutAction(): Promise<{ success: boolean }> {
  console.log('[authActions.ts] logoutAction: Deletando sessão...');
  await deleteSession();
  console.log('[authActions.ts] logoutAction: Sessão do usuário deletada.');
  return { success: true };
}
