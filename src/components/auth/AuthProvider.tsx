
'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { User } from '@/lib/types';
import { loginAction, logoutAction, registerAction } from '@/app/actions/authActions';
import { getCurrentUser } from '@/lib/auth';

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

  // This effect ensures that we check the server-side session cookie
  // once when the provider mounts on the client.
  useEffect(() => {
    const verifyUserSession = async () => {
      console.log('[AuthProvider] useEffect: Verificando a sessão do usuário no servidor...');
      setLoading(true);
      try {
        const sessionUser = await getCurrentUser();
        console.log('[AuthProvider] useEffect: Sessão do servidor retornou:', sessionUser ? sessionUser.username : 'null');
        setUser(sessionUser);
      } catch (e) {
        console.error("[AuthProvider] useEffect: Falha ao verificar a sessão do servidor.", e);
        setUser(null);
      } finally {
        console.log('[AuthProvider] useEffect: Verificação da sessão concluída. setLoading(false).');
        setLoading(false);
      }
    };
    verifyUserSession();
  }, []);

  const login = useCallback(async (formData: FormData): Promise<{ success: boolean; error?: string; user?: User }> => {
    console.log('[AuthProvider] login: Iniciando chamada para loginAction.');
    setLoading(true);
    const result = await loginAction(formData);
    if (result.success && result.user) {
        console.log('[AuthProvider] login: Sucesso. Atualizando estado do usuário para:', result.user.username);
        setUser(result.user);
    } else {
        console.log('[AuthProvider] login: Falha. Erro:', result.error);
    }
    setLoading(false);
    console.log('[AuthProvider] login: Fim.');
    return result;
  }, []);

  const register = useCallback(async (formData: FormData): Promise<{ success: boolean; error?: string; user?: User }> => {
    console.log('[AuthProvider] register: Iniciando chamada para registerAction.');
    setLoading(true);
    const result = await registerAction(formData);
    if (result.success && result.user) {
        console.log('[AuthProvider] register: Sucesso. Atualizando estado do usuário para:', result.user.username);
        setUser(result.user);
    } else {
        console.log('[AuthProvider] register: Falha. Erro:', result.error);
    }
    setLoading(false);
     console.log('[AuthProvider] register: Fim.');
    return result;
  }, []);

  const logout = useCallback(async () => {
    console.log('[AuthProvider] logout: Iniciando logout.');
    setLoading(true);
    await logoutAction();
    setUser(null);
    setLoading(false);
    console.log('[AuthProvider] logout: Fim. Usuário deslogado.');
  }, []);

  const value = {
    user,
    loading,
    login,
    logout,
    register,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === null) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
