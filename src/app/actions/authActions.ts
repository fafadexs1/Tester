
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
    // Busca o usuário no novo banco de dados de usuários
    const dbUser = await findUserByUsername(username);

    if (!dbUser) {
        return { success: false, error: "Usuário ou senha inválidos." };
    }
    
    // Futuramente, a verificação de senha usará o hash real.
    // const passwordMatches = await verifyPassword(password, dbUser.password_hash);
    // if (!passwordMatches) {
    //     return { success: false, error: "Usuário ou senha inválidos." };
    // }

    // Cria a sessão com os dados do usuário do banco, incluindo a role.
    const user: User = { username: dbUser.username, role: dbUser.role };
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
        // Verifica se o usuário já existe
        const existingUser = await findUserByUsername(username);
        if (existingUser) {
            return { success: false, error: "Este nome de usuário já está em uso." };
        }
        
        // "Hashea" a senha (simulação)
        const passwordHash = simpleHash(password);

        // Cria o usuário na nova tabela de usuários
        const createResult = await createUser(username, passwordHash);

        if (!createResult.success) {
            return { success: false, error: createResult.error };
        }

        // Cria a sessão para o novo usuário com a role padrão 'user'
        const newUser: User = { username, role: 'user' };
        await createSession(newUser);
        console.log(`[authActions.ts] registerAction: Sessão criada com sucesso para o novo usuário: ${username}`);
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
