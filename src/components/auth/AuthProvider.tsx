
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

  useEffect(() => {
    const verifyUserSession = async () => {
      setLoading(true);
      try {
        const sessionUser = await getCurrentUser();
        console.log('[AuthProvider] verifyUserSession: sessionUser from server:', sessionUser);
        setUser(sessionUser);
        
        if (sessionUser && pathname === '/login') {
          console.log('[AuthProvider] User is on login page but already has a session. Redirecting to /');
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

  const handleAuthSuccess = useCallback((newUser: User) => {
    console.log('[AuthProvider] handleAuthSuccess: Setting user and redirecting to /');
    setUser(newUser);
    router.push('/');
  }, [router]);

  const login = useCallback(async (formData: FormData): Promise<{ success: boolean; error?: string; user?: User }> => {
    const result = await loginAction(formData);
    if (result.success && result.user) {
      handleAuthSuccess(result.user);
    }
    return result;
  }, [handleAuthSuccess]);

  const register = useCallback(async (formData: FormData): Promise<{ success: boolean; error?: string; user?: User }> => {
    const result = await registerAction(formData);
    if (result.success && result.user) {
      handleAuthSuccess(result.user);
    }
    return result;
  }, [handleAuthSuccess]);

  const logout = useCallback(async () => {
    await logoutAction();
    setUser(null);
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
