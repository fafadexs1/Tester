
'use server';

import type { User } from '@/lib/types';
import { cookies } from 'next/headers';

const SESSION_COOKIE_NAME = 'nexusflow_session_cookie';

export async function getCurrentUser(): Promise<User | null> {
  const cookieStore = cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);

  if (sessionCookie && sessionCookie.value) {
    try {
      // O cookie armazena o objeto User como um JSON stringificado
      const user: User = JSON.parse(sessionCookie.value);
      return user;
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
   console.log(`[auth.ts] Cookie de sessão criado para o usuário: ${user.username}`);
}

export async function deleteSession() {
  const cookieStore = cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
  console.log('[auth.ts] Cookie de sessão deletado.');
}
