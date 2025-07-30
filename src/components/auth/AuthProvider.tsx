
'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { User } from '@/lib/types';
import { useRouter } from 'next/navigation';
import { loginAction, logoutAction } from '@/app/actions/authActions';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (username: string, pass: string) => Promise<{ success: boolean, error?: string }>;
  logout: () => Promise<void>;
  register: (username: string, pass: string) => Promise<{ success: boolean, error?: string }>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const USERS_STORAGE_KEY = 'nexusflow_users';
const SESSION_STORAGE_KEY = 'nexusflow_session_client';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    try {
        const sessionUser = sessionStorage.getItem(SESSION_STORAGE_KEY);
        if (sessionUser) {
            setUser(JSON.parse(sessionUser));
        }
    } catch (e) {
        console.error("Failed to parse user session from sessionStorage", e);
        sessionStorage.removeItem(SESSION_STORAGE_KEY);
    }
    setLoading(false);
  }, []);

  const login = useCallback(async (username: string, pass: string): Promise<{ success: boolean, error?: string }> => {
    // A validação da senha permanece no cliente, pois não temos um DB.
    const usersData = localStorage.getItem(USERS_STORAGE_KEY);
    if (!usersData) {
      return { success: false, error: "Nenhum usuário registrado." };
    }
    const users = JSON.parse(usersData);
    const foundUser = users[username];
    
    if (foundUser && foundUser.password === pass) {
        // Se a senha estiver correta, chame a Server Action para criar o cookie.
        const result = await loginAction(username);
        if (result.success) {
            const userData = { username };
            setUser(userData);
            sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(userData));
            router.push('/');
            return { success: true };
        } else {
            return { success: false, error: result.error };
        }
    } else {
      return { success: false, error: "Usuário ou senha inválidos." };
    }
  }, [router]);

  const register = useCallback(async (username: string, pass: string): Promise<{ success: boolean, error?: string }> => {
    // Registro ainda manipula o localStorage do cliente.
    const usersData = localStorage.getItem(USERS_STORAGE_KEY);
    const users = usersData ? JSON.parse(usersData) : {};
    
    if (users[username]) {
       return { success: false, error: "Nome de usuário já existe." };
    }
    if(!username.trim() || !pass.trim()){
       return { success: false, error: "Usuário e senha não podem ser vazios." };
    }

    users[username] = { password: pass };
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));

    // Após registrar, chame a Server Action para criar o cookie.
    const result = await loginAction(username);
     if (result.success) {
        const userData = { username };
        setUser(userData);
        sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(userData));
        router.push('/');
        return { success: true };
    } else {
        // Se a criação da sessão falhar, desfaça o registro (ou trate o erro de outra forma)
        delete users[username];
        localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
        return { success: false, error: result.error };
    }
  }, [router]);

  const logout = useCallback(async () => {
    await logoutAction();
    setUser(null);
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
    router.push('/login');
  }, [router]);

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
