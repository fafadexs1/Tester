
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
  logout: () => void; // A função logout agora não precisa ser async aqui
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

    if (loading) {
      return; 
    }

    const isAuthPage = pathname === '/login';

    if (user && isAuthPage) {
      console.log('[AuthProvider] Usuário logado na página de login, redirecionando para /...');
      router.push('/');
    } else if (!user && !isAuthPage) {
      console.log('[AuthProvider] Usuário não logado fora da página de login. Redirecionando para /login...');
      router.push('/login');
    }

  }, [user, loading, pathname, router]);


  const login = useCallback(async (formData: FormData): Promise<{ success: boolean; error?: string; user?: User }> => {
    const result = await loginAction(formData);
    if (result.success && result.user) {
      setUser(result.user);
      // O useEffect cuidará do redirecionamento para /
    }
    return result;
  }, []);

  const register = useCallback(async (formData: FormData): Promise<{ success: boolean; error?: string; user?: User }> => {
    const result = await registerAction(formData);
    if (result.success && result.user) {
      setUser(result.user);
       // O useEffect cuidará do redirecionamento para /
    }
    return result;
  }, []);

  const logout = useCallback(async () => {
    console.log('[AuthProvider] Iniciando logout...');
    await logoutAction();
    setUser(null);
    console.log('[AuthProvider] Estado do usuário definido como nulo, redirecionando para /login...');
    // O redirecionamento será tratado pelo useEffect, que verá que o usuário é nulo e não está na página de login.
    // Forçar a navegação aqui para uma resposta mais imediata.
    router.push('/login');
  }, [router]);

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
  
  // Se o usuário não está logado e não está na página de login, o useEffect irá redirecionar,
  // mas podemos mostrar o loader para evitar um piscar de conteúdo indesejado.
  if (!user && pathname !== '/login') {
     return (
         <div className="flex h-screen w-full items-center justify-center bg-background">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
             <span className="ml-4 text-muted-foreground">
               Redirecionando para o login...
             </span>
        </div>
      );
  }

  // Similarmente, se o usuário está logado e na página de login, mostramos o loader enquanto redirecionamos.
  if (user && pathname === '/login') {
     return (
         <div className="flex h-screen w-full items-center justify-center bg-background">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
             <span className="ml-4 text-muted-foreground">
               Redirecionando para o dashboard...
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
