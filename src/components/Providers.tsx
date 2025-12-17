
'use client';

import { Suspense } from 'react';
import { AuthProvider } from '@/components/auth/AuthProvider';
import { Toaster } from '@/components/ui/toaster';
import { Loader2 } from 'lucide-react';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    }>
      <AuthProvider>
        {children}
      </AuthProvider>
      <Toaster />
    </Suspense>
  );
}
