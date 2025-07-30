
import type { User } from '@/lib/types';
import { cookies } from 'next/headers';

// Esta é uma implementação de "sessão" do lado do servidor muito simples usando cookies.
// Em uma aplicação real, você usaria uma solução mais robusta como NextAuth.js ou JWTs.

const SESSION_COOKIE_NAME = 'nexusflow_session_cookie';

export async function createSession(user: User) {
  const sessionData = JSON.stringify(user);
  cookies().set(SESSION_COOKIE_NAME, sessionData, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 7, // 1 semana
    path: '/',
  });
}

export async function getCurrentUser(): Promise<User | null> {
  const sessionCookie = cookies().get(SESSION_COOKIE_NAME);

  if (!sessionCookie) {
    return null;
  }

  try {
    const user: User = JSON.parse(sessionCookie.value);
    return user;
  } catch (error) {
    console.error("Failed to parse session cookie:", error);
    return null;
  }
}

export async function deleteSession() {
  cookies().delete(SESSION_COOKIE_NAME);
}
