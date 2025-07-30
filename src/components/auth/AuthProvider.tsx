
'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import type { User } from '@/lib/types';
import { loginAction, logoutAction, registerAction } from '@/app/actions/authActions';
import { getCurrentUser } from '@/lib/auth';
import { Loader2 } from 'lucide-react';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (formData: FormData) => Promise<{ success: boolean; error?: string; user?: User }>;
  logout: () => Promise<void>;
  register: (formData: FormData) => Promise<{ success: boolean; error?: string; user?: User }>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const verifyUserSession = async () => {
      console.log('[AuthProvider] Iniciando verificação de sessão...');
      // Não definimos setLoading(true) aqui para evitar piscar. O estado inicial já é true.
      try {
        const sessionUser = await getCurrentUser();
        console.log('[AuthProvider] Usuário da sessão do servidor:', sessionUser);
        setUser(sessionUser);
      } catch (e) {
        console.error("[AuthProvider] Falha ao verificar sessão do servidor.", e);
        setUser(null);
      } finally {
        console.log('[AuthProvider] Verificação de sessão finalizada.');
        setLoading(false);
      }
    };
    verifyUserSession();
  }, []);

  useEffect(() => {
    console.log(`[AuthProvider Redirect Check] loading: ${loading}, user: ${!!user}, pathname: ${pathname}`);

    // Do nothing while the initial session verification is in progress.
    if (loading) {
      return;
    }

    const isAuthPage = pathname === '/login';

    if (user && isAuthPage) {
      // If user is logged in and is on the auth page AFTER initial load,
      // do NOT redirect immediately. The user might have just logged in
      // or the session was restored client-side. Let them stay or navigate manually.
      console.log('[AuthProvider] Usuário logado na página de login após carga inicial. Não redirecionando imediatamente.');
      // Potentially add a small delay or a different indicator if needed,
      // but direct redirection here causes the loop.
    } else if (!user && !isAuthPage) {
      console.log('[AuthProvider] Usuário não logado fora da página de login. Redirecionando para /login');
      router.push('/login');
    }
    // If user is logged in and not on auth page, do nothing (they are where they should be).
    // If user is not logged in and on auth page, do nothing (they are where they should be).

  }, [user, loading, pathname, router]);

  const handleAuthSuccess = useCallback((newUser: User) => {
    setUser(newUser);
    // O useEffect acima cuidará do redirecionamento de forma centralizada.
  }, []);

  const login = useCallback(async (formData: FormData): Promise<{ success: boolean; error?: string; user?: User }> => {
    const result = await loginAction(formData);
    if (result.success && result.user) {
      handleAuthSuccess(result.user);
       // Redirect to home only after successful login
      router.push('/');
    }
    return result;
  }, [handleAuthSuccess, router]);

  const register = useCallback(async (formData: FormData): Promise<{ success: boolean; error?: string; user?: User }> => {
    const result = await registerAction(formData);
    if (result.success && result.user) {
      handleAuthSuccess(result.user);
      // Redirect to home only after successful registration
      router.push('/');
    }
    return result;
  }, [handleAuthSuccess, router]);

  const logout = useCallback(async () => {
    await logoutAction();
    setUser(null);
    // The useEffect above will handle the redirection to /login if not on auth page.
  }, []);

  const value = { user, loading, login, logout, register };
  
  if (loading) {
     return (
         <div className="flex h-screen w-full items-center justify-center bg-background">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
             <span className="ml-4 text-muted-foreground">
               Verificando sessão...
             </span>
        </div>
      );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === null) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
