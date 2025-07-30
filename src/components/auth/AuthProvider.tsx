
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
      setLoading(true);
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
    // Este useEffect agora gerencia os redirecionamentos após a verificação de sessão.
    console.log(`[AuthProvider Redirect] Verificando... loading: ${loading}, user: ${user?.username}, pathname: ${pathname}`);
    if (!loading) {
      if (user && pathname === '/login') {
        console.log('[AuthProvider Redirect] Usuário logado na página de login. Redirecionando para /');
        router.push('/');
      } else if (!user && pathname !== '/login') {
        console.log('[AuthProvider Redirect] Usuário não logado fora da página de login. Redirecionando para /login');
        router.push('/login');
      }
    }
  }, [user, loading, pathname, router]);

  const login = useCallback(async (formData: FormData): Promise<{ success: boolean; error?: string; user?: User }> => {
    const result = await loginAction(formData);
    if (result.success && result.user) {
      console.log('[AuthProvider] Login bem-sucedido. Atualizando estado do usuário.');
      setUser(result.user); // Apenas atualiza o estado, o useEffect cuidará do redirect.
    }
    return result;
  }, []);

  const register = useCallback(async (formData: FormData): Promise<{ success: boolean; error?: string; user?: User }> => {
    const result = await registerAction(formData);
    if (result.success && result.user) {
      console.log('[AuthProvider] Registro bem-sucedido. Atualizando estado do usuário.');
      setUser(result.user); // Apenas atualiza o estado, o useEffect cuidará do redirect.
    }
    return result;
  }, []);

  const logout = useCallback(async () => {
    console.log('[AuthProvider] Executando logout...');
    await logoutAction();
    setUser(null); // O useEffect cuidará de redirecionar para /login
  }, []);

  const value = {
    user,
    loading,
    login,
    logout,
    register,
  };
  
  // Renderiza os filhos apenas se a verificação inicial não estiver mais em andamento.
  // E se a rota for protegida, espera ter um usuário.
  const isProtectedRoute = pathname !== '/login';
  if (loading || (isProtectedRoute && !user)) {
     return (
         <div className="flex h-screen w-full items-center justify-center bg-background">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
             <span className="ml-4 text-muted-foreground">
               {isProtectedRoute ? 'Verificando autenticação...' : 'Carregando...'}
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
