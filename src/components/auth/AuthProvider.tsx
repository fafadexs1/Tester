
'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { User } from '@/lib/types';
import { useRouter } from 'next/navigation';
import { loginAction, logoutAction, registerAction } from '@/app/actions/authActions';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (formData: FormData, pass: string) => Promise<{ success: boolean, error?: string }>;
  logout: () => Promise<void>;
  register: (formData: FormData, pass: string) => Promise<{ success: boolean, error?: string }>;
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

  const login = useCallback(async (formData: FormData, pass: string): Promise<{ success: boolean, error?: string }> => {
    // This now correctly calls the server action which handles ALL validation.
    const result = await loginAction(formData);
    
    if (result.success && result.user) {
        setUser(result.user);
        sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(result.user));
        // We will no longer push here. The login page will handle the refresh and redirect.
        return { success: true };
    } else {
        return { success: false, error: result.error || "Falha ao criar sessão no servidor." };
    }
  }, []);

  const register = useCallback(async (formData: FormData, pass: string): Promise<{ success: boolean, error?: string }> => {
    const username = formData.get('username') as string;

    // Client-side registration logic to store the user "account"
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

    // After registering client-side, call the server action to create the session cookie.
    const result = await registerAction(formData);
     if (result.success && result.user) {
        setUser(result.user);
        sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(result.user));
        // We will no longer push here. The login page will handle the refresh and redirect.
        return { success: true };
    } else {
        // If session creation fails, roll back the client-side registration.
        delete users[username];
        localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
        return { success: false, error: result.error || "Falha ao criar sessão do servidor após o registro." };
    }
  }, []);

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
