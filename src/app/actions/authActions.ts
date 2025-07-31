
'use server';

import { createSession, deleteSession } from '@/lib/auth';
import type { User } from '@/lib/types';
import { cookies } from 'next/headers';
import { findUserByUsername, createUser } from './databaseActions';

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
    // const passwordMatches = await verifyPassword(password, dbUser.password_hash);
    // if (!passwordMatches) {
    //     console.log(`[authActions.ts] loginAction: Senha inválida para o usuário '${username}'.`);
    //     return { success: false, error: "Usuário ou senha inválidos." };
    // }

    // Cria a sessão com os dados do usuário do banco, incluindo id e role.
    const user: User = { id: dbUser.id, username: dbUser.username, role: dbUser.role };
    await createSession(user);
    console.log(`[authActions.ts] loginAction: Sessão criada com sucesso para o usuário: ${username}, role: ${user.role}`);
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
        
        // createResult.user contém o usuário recém-criado com id, username, e role
        const newUser = createResult.user;

        // Cria a sessão para o novo usuário
        await createSession(newUser);
        console.log(`[authActions.ts] registerAction: Sessão criada com sucesso para o novo usuário: ${newUser.username}`);
        return { success: true, user: newUser };

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
