
'use client';

import { Suspense } from 'react';
import { AuthProvider } from '@/components/auth/AuthProvider';
import { TooltipProvider } from "@/components/ui/tooltip";
import { Loader2 } from "lucide-react";
import { Toaster } from "@/components/ui/toaster";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    }>
      <AuthProvider>
        <TooltipProvider delayDuration={0}>
          {children}
        </TooltipProvider>
      </AuthProvider>
      <Toaster />
    </Suspense>
  );
}
