'use client';

import { AuthProvider } from '@/components/auth/AuthProvider';
import { Toaster } from '@/components/ui/toaster';
import { SidebarProvider } from '@/components/ui/sidebar';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AuthProvider>
        <SidebarProvider>
            {children}
        </SidebarProvider>
      </AuthProvider>
      <Toaster />
    </>
  );
}
