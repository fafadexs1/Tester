'use server';

import { createSession, deleteSession } from '@/lib/auth';
import type { User } from '@/lib/types';
import { cookies } from 'next/headers';

// Em uma aplicação real, você faria a busca no banco de dados aqui.
// Para este exemplo, a validação de senha será feita aqui, no lado do servidor.
// Esta função simula a leitura do `localStorage` que está sendo usado como DB.
// ATENÇÃO: Esta abordagem é insegura e serve apenas para fins de demonstração.
// Em um app real, use um banco de dados com senhas hasheadas.
async function validateUser(username: string, pass: string): Promise<boolean> {
    // Esta é uma simulação. As credenciais são gerenciadas no lado do cliente
    // e passadas para a Server Action. Em um ambiente de produção, você
    // consultaria seu banco de dados de usuários aqui.
    // Como não podemos acessar o localStorage do browser a partir daqui,
    // a lógica de validação permanece no cliente por enquanto.
    // Esta função será chamada pelo `AuthProvider`.
    return true; // A validação real é feita no client-side `login` por enquanto.
}


export async function loginAction(formData: FormData): Promise<{ success: boolean; error?: string; user?: User }> {
  const username = formData.get('username') as string;
  const password = formData.get('password') as string;

  if (!username || !password) {
    return { success: false, error: "Nome de usuário e senha são obrigatórios." };
  }

  // A validação real da senha deveria acontecer aqui contra um banco de dados.
  // Como estamos usando localStorage, a validação é simulada e acontece
  // no `AuthProvider`. Se a validação no `AuthProvider` passar, ele chama esta
  // Server Action, que então cria a sessão.
  
  try {
    const user: User = { username };
    await createSession(user);
    return { success: true, user };
  } catch (error: any) {
    console.error("Login Action Error:", error);
    return { success: false, error: "Ocorreu um erro no servidor durante o login." };
  }
}

export async function registerAction(formData: FormData): Promise<{ success: boolean; error?: string; user?: User }> {
    const username = formData.get('username') as string;
    // A senha é apenas para o `localStorage` do cliente neste exemplo.
    // A ação do servidor apenas precisa do nome de usuário para criar a sessão.
     if (!username) {
        return { success: false, error: "Nome de usuário é obrigatório." };
    }
    
    try {
        const user: User = { username };
        await createSession(user);
        return { success: true, user };
    } catch (error: any) {
        console.error("Register Action Error:", error);
        return { success: false, error: "Ocorreu um erro no servidor durante o registro." };
    }
}


export async function logoutAction(): Promise<{ success: boolean }> {
  await deleteSession();
  return { success: true };
}
