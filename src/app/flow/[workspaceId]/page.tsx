
'use client';

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import ErrorBoundary from "@/components/ErrorBoundary";
import FlowBuilderClient from "@/components/flow-builder/FlowBuilderClient";
import { Loader2 } from "lucide-react";

// Esta página agora lidará com a renderização do editor de fluxo para um ID específico.
export default function FlowEditorPage({ params }: { params: { workspaceId: string } }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  
  const { workspaceId } = params;

  // Um estado para garantir que a verificação do cliente seja feita antes de renderizar
  const [isClient, setIsClient] = useState(false);
  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (isClient && !loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router, isClient]);

  if (!isClient || loading || !user) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-muted/20">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <ErrorBoundary>
        <FlowBuilderClient workspaceId={workspaceId} />
    </ErrorBoundary>
  );
}
