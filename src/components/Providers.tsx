
'use client';

import { AuthProvider } from '@/components/auth/AuthProvider';
import { Toaster } from '@/components/ui/toaster';
import AppShell from '@/components/AppShell';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AuthProvider>
        <AppShell>
          {children}
        </AppShell>
      </AuthProvider>
      <Toaster />
    </>
  );
}
