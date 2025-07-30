
'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { User } from '@/lib/types';
import { loginAction, logoutAction, registerAction } from '@/app/actions/authActions';
import { getCurrentUser } from '@/lib/auth';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (formData: FormData) => Promise<{ success: boolean, error?: string }>;
  logout: () => Promise<void>;
  register: (formData: FormData) => Promise<{ success: boolean, error?: string }>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true); // Começa como true para verificar a sessão

  useEffect(() => {
    // Verifica a sessão com o servidor ao carregar o provedor
    const checkSession = async () => {
      try {
        const sessionUser = await getCurrentUser();
        if (sessionUser) {
          setUser(sessionUser);
        } else {
          setUser(null);
        }
      } catch (e) {
        console.error("Falha ao verificar a sessão do servidor", e);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    checkSession();
  }, []);

  const login = useCallback(async (formData: FormData): Promise<{ success: boolean, error?: string }> => {
    const result = await loginAction(formData);
    
    if (result.success && result.user) {
        setUser(result.user);
        return { success: true };
    } else {
        return { success: false, error: result.error };
    }
  }, []);

  const register = useCallback(async (formData: FormData): Promise<{ success: boolean, error?: string }> => {
    const result = await registerAction(formData);
    if (result.success && result.user) {
        setUser(result.user);
        return { success: true };
    } else {
        return { success: false, error: result.error };
    }
  }, []);

  const logout = useCallback(async () => {
    await logoutAction();
    setUser(null);
    // O redirecionamento será tratado pela página ou por um componente wrapper
    // que observa o estado de autenticação.
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
