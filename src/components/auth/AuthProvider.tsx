'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import type { User, Organization } from '@/lib/types';
import { loginAction, logoutAction, registerAction } from '@/app/actions/authActions';
import { getCurrentUser } from '@/lib/auth';
import { getOrganizationsForUserAction } from '@/app/actions/organizationActions';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  organizations: Organization[];
  currentOrganization: (Organization & { is_owner: boolean }) | null;
  login: (formData: FormData) => Promise<{ success: boolean; error?: string; user?: User }>;
  logout: () => Promise<void>;
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
  const [isProcessingSSO, setIsProcessingSSO] = useState(false);

  const authRequestIdRef = useRef(0);
  const isLoggingOutRef = useRef(false);

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const fetchUserAndOrgs = useCallback(async () => {
    const requestId = ++authRequestIdRef.current;
    console.log('[AuthProvider] Iniciando verificacao de sessao e organizacoes...');

    try {
      const sessionUser = await getCurrentUser();
      if (requestId !== authRequestIdRef.current) return;

      console.log('[AuthProvider] Usuario da sessao:', sessionUser);
      setUser(sessionUser);

      if (!sessionUser) {
        setOrganizations([]);
        setCurrentOrganization(null);
        return;
      }

      const orgsResult = await getOrganizationsForUserAction();
      if (requestId !== authRequestIdRef.current) return;

      if (orgsResult.success && orgsResult.data) {
        setOrganizations(orgsResult.data);
        const activeOrg = orgsResult.data.find((org) => org.id === sessionUser.current_organization_id);

        if (activeOrg) {
          setCurrentOrganization({ ...activeOrg, is_owner: activeOrg.owner_id === sessionUser.id });
        } else {
          setCurrentOrganization(null);
          if (orgsResult.data.length > 0) {
            console.warn(`[AuthProvider] Usuario ${sessionUser.username} nao tem organizacao atual valida.`);
          }
        }
      } else {
        setOrganizations([]);
        setCurrentOrganization(null);
      }
    } catch (e) {
      if (requestId !== authRequestIdRef.current) return;
      console.error('[AuthProvider] Falha ao verificar sessao/organizacoes.', e);
      setUser(null);
      setOrganizations([]);
      setCurrentOrganization(null);
    } finally {
      if (requestId !== authRequestIdRef.current) return;
      console.log('[AuthProvider] Verificacao finalizada.');
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUserAndOrgs();
  }, [fetchUserAndOrgs]);

  useEffect(() => {
    const authParam = searchParams.get('auth');
    if (!authParam || isProcessingSSO || isLoggingOutRef.current) return;
    const encodedAuthParam = authParam;

    async function runSSO() {
      try {
        const base64 = decodeURIComponent(encodedAuthParam);
        const uriEncoded = atob(base64);
        const jsonStr = decodeURIComponent(uriEncoded);
        const decoded = JSON.parse(jsonStr);
        const { user: incomingUser } = decoded;

        if (user && incomingUser && user.email === incomingUser.email) {
          const newUrl = new URL(window.location.href);
          if (newUrl.searchParams.has('auth')) {
            newUrl.searchParams.delete('auth');
            window.history.replaceState({}, '', newUrl.toString());
          }
          return;
        }

        if (!incomingUser) return;

        setIsProcessingSSO(true);
        console.log('[AuthProvider] Auth param detected. Attempting SSO for:', incomingUser.email);

        const { ssoLoginAction } = await import('@/app/actions/authActions');
        const result = await ssoLoginAction(incomingUser);

        if (result.success && result.user) {
          console.log('[AuthProvider] SSO Success:', result.user.username);
          await fetchUserAndOrgs();

          const newUrl = new URL(window.location.href);
          newUrl.searchParams.delete('auth');
          window.history.replaceState({}, '', newUrl.toString());
        } else {
          console.error('[AuthProvider] SSO Failed:', result.error);
        }
      } catch (err) {
        console.error('[AuthProvider] SSO Error:', err);
      } finally {
        setIsProcessingSSO(false);
      }
    }

    runSSO();
  }, [searchParams, user, isProcessingSSO, fetchUserAndOrgs]);

  useEffect(() => {
    if (loading || isProcessingSSO || isLoggingOutRef.current) return;

    const noRedirectPages = ['/login', '/logout', '/profile', '/admin', '/presentation'];
    const isNoRedirectPage = noRedirectPages.some((p) => pathname === p) || pathname.startsWith('/flow/');
    const isAuthPage = pathname === '/login';

    if (user && isAuthPage) {
      router.push('/');
      return;
    }

    if (!user && !isNoRedirectPage) {
      const currentSearch = searchParams.toString();
      const nextUrl = currentSearch ? `/login?${currentSearch}` : '/login';
      router.push(nextUrl);
    }
  }, [user, loading, pathname, router, isProcessingSSO, searchParams]);

  const login = useCallback(async (formData: FormData): Promise<{ success: boolean; error?: string; user?: User }> => {
    const result = await loginAction(formData);
    if (result.success) {
      isLoggingOutRef.current = false;
      await fetchUserAndOrgs();
    }
    return result;
  }, [fetchUserAndOrgs]);

  const register = useCallback(async (formData: FormData): Promise<{ success: boolean; error?: string; user?: User }> => {
    const result = await registerAction(formData);
    if (result.success) {
      isLoggingOutRef.current = false;
      await fetchUserAndOrgs();
    }
    return result;
  }, [fetchUserAndOrgs]);

  const logout = useCallback(async () => {
    isLoggingOutRef.current = true;
    authRequestIdRef.current += 1;

    setLoading(false);
    setUser(null);
    setOrganizations([]);
    setCurrentOrganization(null);

    try {
      await logoutAction();
    } catch (error) {
      console.error('[AuthProvider] Erro ao executar logoutAction:', error);
    } finally {
      router.replace('/login');
      router.refresh();

      setTimeout(() => {
        isLoggingOutRef.current = false;
      }, 400);
    }
  }, [router]);

  const handleSetCurrentOrg = (org: Organization) => {
    if (user) {
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

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === null) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

