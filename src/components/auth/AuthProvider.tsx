
'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import type { User, Organization } from '@/lib/types';
import { loginAction, logoutAction, registerAction } from '@/app/actions/authActions';
import { getCurrentUser } from '@/lib/auth';
import { getOrganizationsForUserAction } from '@/app/actions/organizationActions';
import { Loader2 } from 'lucide-react';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  organizations: Organization[];
  currentOrganization: (Organization & { is_owner: boolean }) | null;
  login: (formData: FormData) => Promise<{ success: boolean; error?: string; user?: User }>;
  logout: () => void; 
  register: (formData: FormData) => Promise<{ success: boolean; error?: string; user?: User }>;
  setCurrentOrganization: (org: Organization) => void;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [currentOrganization, setCurrentOrganization] = useState<(Organization & { is_owner: boolean }) | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  const fetchUserAndOrgs = useCallback(async () => {
    console.log('[AuthProvider] Iniciando verificação de sessão e organizações...');
    try {
      const sessionUser = await getCurrentUser();
      console.log('[AuthProvider] Usuário da sessão:', sessionUser);
      setUser(sessionUser);

      if (sessionUser) {
        const orgsResult = await getOrganizationsForUserAction();
        if (orgsResult.success && orgsResult.data) {
          setOrganizations(orgsResult.data);
          const activeOrg = orgsResult.data.find(org => org.id === sessionUser.current_organization_id);
          if (activeOrg) {
            setCurrentOrganization({ ...activeOrg, is_owner: activeOrg.owner_id === sessionUser.id });
          } else if (orgsResult.data.length > 0) {
            // Se não houver org atual, mas houver orgs, talvez definir a primeira como padrão?
            console.warn(`[AuthProvider] Usuário ${sessionUser.username} não tem organização atual válida, mas pertence a outras.`)
          }
        }
      } else {
        setOrganizations([]);
        setCurrentOrganization(null);
      }
    } catch (e) {
      console.error("[AuthProvider] Falha ao verificar sessão/organizações.", e);
      setUser(null);
      setOrganizations([]);
      setCurrentOrganization(null);
    } finally {
      console.log('[AuthProvider] Verificação finalizada.');
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUserAndOrgs();
  }, [fetchUserAndOrgs]);

  useEffect(() => {
    if (loading) return;

    const isAuthPage = pathname === '/login';

    if (user && isAuthPage) {
      router.push('/');
    } else if (!user && !isAuthPage && pathname !== '/logout') {
      router.push('/login');
    }
  }, [user, loading, pathname, router]);

  const login = useCallback(async (formData: FormData): Promise<{ success: boolean; error?: string; user?: User }> => {
    const result = await loginAction(formData);
    if (result.success) {
      await fetchUserAndOrgs(); // Refetch everything after login
    }
    return result;
  }, [fetchUserAndOrgs]);

  const register = useCallback(async (formData: FormData): Promise<{ success: boolean; error?: string; user?: User }> => {
    const result = await registerAction(formData);
    if (result.success) {
      await fetchUserAndOrgs(); // Refetch everything after register
    }
    return result;
  }, [fetchUserAndOrgs]);

  const logout = useCallback(() => {
    router.push('/logout');
  }, [router]);
  
  const handleSetCurrentOrg = (org: Organization) => {
     if(user) {
         setCurrentOrganization({ ...org, is_owner: org.owner_id === user.id });
     }
  };

  const value = { 
      user, 
      loading, 
      login, 
      logout, 
      register, 
      organizations, 
      currentOrganization,
      setCurrentOrganization: handleSetCurrentOrg,
      refreshAuth: fetchUserAndOrgs,
  };
  
  if (loading) {
     return (
         <div className="flex h-screen w-full items-center justify-center bg-background">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <span className="ml-4 text-muted-foreground">Verificando sessão...</span>
        </div>
      );
  }
  
  if (!user && !['/login', '/logout'].includes(pathname)) {
     return (
         <div className="flex h-screen w-full items-center justify-center bg-background">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <span className="ml-4 text-muted-foreground">Redirecionando para o login...</span>
        </div>
      );
  }

  if (user && pathname === '/login') {
     return (
         <div className="flex h-screen w-full items-center justify-center bg-background">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <span className="ml-4 text-muted-foreground">Redirecionando para o dashboard...</span>
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
