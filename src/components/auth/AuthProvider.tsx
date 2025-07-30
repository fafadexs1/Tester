
'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
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
  const router = useRouter();
  const pathname = usePathname();

  // This effect runs once on mount to check the session from the server
  // and handles redirection logic.
  useEffect(() => {
    const verifyUserSession = async () => {
      try {
        const sessionUser = await getCurrentUser();
        setUser(sessionUser);
        
        // Redirection logic now lives inside AuthProvider
        if (sessionUser && pathname === '/login') {
          router.push('/');
        }
      } catch (e) {
        console.error("[AuthProvider] Failed to verify server session.", e);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    verifyUserSession();
  }, [pathname, router]);

  const handleAuthSuccess = (newUser: User) => {
    setUser(newUser);
    router.push('/');
  };

  const login = useCallback(async (formData: FormData): Promise<{ success: boolean; error?: string; user?: User }> => {
    setLoading(true);
    const result = await loginAction(formData);
    if (result.success && result.user) {
      handleAuthSuccess(result.user);
    }
    setLoading(false);
    return result;
  }, [router]);

  const register = useCallback(async (formData: FormData): Promise<{ success: boolean; error?: string; user?: User }> => {
    setLoading(true);
    const result = await registerAction(formData);
    if (result.success && result.user) {
      handleAuthSuccess(result.user);
    }
    setLoading(false);
    return result;
  }, [router]);

  const logout = useCallback(async () => {
    setLoading(true);
    await logoutAction();
    setUser(null);
    setLoading(false);
    // No need to push to /login here, as the protected routes will handle it.
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
