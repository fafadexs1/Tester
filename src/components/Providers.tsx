'use client';

import { AuthProvider } from '@/components/auth/AuthProvider';
import { Toaster } from '@/components/ui/toaster';
import { SidebarProvider } from '@/components/ui/sidebar';
import AppShell from '@/components/AppShell';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AuthProvider>
        <SidebarProvider>
          <AppShell>
            {children}
          </AppShell>
        </SidebarProvider>
      </AuthProvider>
      <Toaster />
    </>
  );
}
