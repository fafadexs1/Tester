
'use server';

import type { User } from '@/lib/types';
import { cookies } from 'next/headers';

const SESSION_COOKIE_NAME = 'nexusflow_session_cookie';

// A função foi corrigida para ser totalmente assíncrona como o Next.js espera
export async function getCurrentUser(): Promise<User | null> {
  // Acessar a cookie store de forma assíncrona
  const cookieStore = cookies();
  const sessionCookie = await cookieStore.get(SESSION_COOKIE_NAME);

  if (sessionCookie && sessionCookie.value) {
    try {
      // O cookie armazena o objeto User como um JSON stringificado, incluindo a role e o id.
      const user: User = JSON.parse(sessionCookie.value);
      // Validação básica para garantir que o objeto de usuário tenha os campos esperados
      if (user && user.id && user.username && user.role) {
        return user;
      }
      return null;
    } catch (error) {
      console.error("[auth.ts] Erro ao analisar o cookie da sessão:", error);
      // Se o cookie estiver malformado, trata como se não houvesse sessão
      return null;
    }
  }
  return null;
}

export async function createSession(user: User) {
  const cookieStore = cookies();
  const sessionValue = JSON.stringify(user);

  cookieStore.set(SESSION_COOKIE_NAME, sessionValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24, // 24 horas
    path: '/',
  });
   console.log(`[auth.ts] Cookie de sessão criado para o usuário: ${user.username}, ID: ${user.id}, role: ${user.role}`);
}

export async function deleteSession() {
  const cookieStore = cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
  console.log('[auth.ts] Cookie de sessão deletado.');
}
