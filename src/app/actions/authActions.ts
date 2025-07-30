'use server';

import { createSession, deleteSession } from '@/lib/auth';
import type { User } from '@/lib/types';
import { cookies } from 'next/headers';

// Em uma aplicação real, você faria a busca no banco de dados aqui.
// Por enquanto, continuamos usando o localStorage como nossa "base de dados" de usuários.
// Nota: Server Actions não podem acessar diretamente localStorage/sessionStorage do browser.
// A lógica de ler os usuários precisa ser adaptada ou substituída por um DB de verdade.
// Para este exemplo, vamos simular a leitura, mas o ideal seria migrar os usuários para o DB.

// Esta é uma simulação, já que não podemos ler o localStorage do browser no servidor.
// Em uma aplicação real, você buscaria o usuário no seu banco de dados.
async function getUserFromStorage(username: string): Promise<{ password?: string } | null> {
    // Esta é uma maneira de contornar a limitação para fins de demonstração.
    // NÃO FAÇA ISSO EM PRODUÇÃO. A forma correta é usar um banco de dados.
    console.warn("Simulating user lookup. In a real app, use a database!");
    return null; // A lógica real será feita no lado do cliente por enquanto.
}

export async function loginAction(username: string): Promise<{ success: boolean; error?: string }> {
  try {
    if (!username) {
        return { success: false, error: "Nome de usuário não pode ser vazio." };
    }
    const user: User = { username };
    await createSession(user);
    return { success: true };
  } catch (error: any) {
    console.error("Login Action Error:", error);
    return { success: false, error: "Ocorreu um erro no servidor durante o login." };
  }
}


export async function logoutAction(): Promise<{ success: boolean }> {
  await deleteSession();
  return { success: true };
}
