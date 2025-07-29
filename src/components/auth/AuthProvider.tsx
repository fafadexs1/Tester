
'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { User } from '@/lib/types';
import { useRouter, usePathname } from 'next/navigation';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (username: string, pass: string) => void;
  logout: () => void;
  register: (username: string, pass: string) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

const USERS_STORAGE_KEY = 'nexusflow_users';
const SESSION_STORAGE_KEY = 'nexusflow_session';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

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

  const login = useCallback((username: string, pass: string) => {
    const usersData = localStorage.getItem(USERS_STORAGE_KEY);
    if (!usersData) {
      throw new Error("Nenhum usuário registrado.");
    }
    const users = JSON.parse(usersData);
    const foundUser = users[username];
    if (foundUser && foundUser.password === pass) {
        const userData = { username };
        setUser(userData);
        sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(userData));
    } else {
      throw new Error("Usuário ou senha inválidos.");
    }
  }, []);

  const register = useCallback((username: string, pass: string) => {
    const usersData = localStorage.getItem(USERS_STORAGE_KEY);
    const users = usersData ? JSON.parse(usersData) : {};
    
    if (users[username]) {
      throw new Error("Nome de usuário já existe.");
    }
    if(!username.trim() || !pass.trim()){
        throw new Error("Usuário e senha não podem ser vazios.");
    }

    users[username] = { password: pass };
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));

    // After registering, log the user in automatically
    const userData = { username };
    setUser(userData);
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(userData));

  }, []);

  const logout = useCallback(() => {
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
