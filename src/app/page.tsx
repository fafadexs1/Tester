
'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PlusCircle, ArrowRight, BotMessageSquare, Loader2 } from 'lucide-react';
import { clientSideLoadWorkspacesAction } from '@/app/actions/databaseActions';
import type { WorkspaceData } from '@/lib/types';
import TopBar from '@/components/flow-builder/TopBar'; // Reutilizando para consistência

export default function DashboardPage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const [workspaces, setWorkspaces] = useState<WorkspaceData[]>([]);
  const [isLoadingWorkspaces, setIsLoadingWorkspaces] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  useEffect(() => {
    async function loadWorkspaces() {
      if (user) {
        setIsLoadingWorkspaces(true);
        const userWorkspaces = await clientSideLoadWorkspacesAction();
        // Futuramente, filtrar por user.id, por enquanto carrega todos
        setWorkspaces(userWorkspaces);
        setIsLoadingWorkspaces(false);
      }
    }
    loadWorkspaces();
  }, [user]);

  const handleCreateNewWorkspace = () => {
    // Por enquanto, navega para a página de criação/edição.
    // A lógica de criação será movida para lá.
    router.push('/flow/new');
  };

  const handleOpenWorkspace = (workspaceId: string) => {
    router.push(`/flow/${workspaceId}`);
  };

  if (loading || !user) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-muted/20">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full flex-col bg-muted/40">
      {/* TopBar pode ser adaptado para um contexto de dashboard */}
      <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
         <div className="flex items-center gap-3">
          <Zap className="w-6 h-6 text-primary" />
          <h1 className="text-xl font-semibold tracking-tight text-primary whitespace-nowrap">NexusFlow</h1>
        </div>
        <div className="ml-auto flex items-center gap-2">
            <Button onClick={logout}>Sair</Button>
        </div>
      </header>
      <main className="flex flex-1 flex-col gap-4 p-4 sm:px-6 sm:py-0 md:gap-8">
        <div className="flex items-center pt-4">
          <div className="flex-1">
            <h1 className="text-2xl font-semibold md:text-3xl">Meus Fluxos</h1>
            <p className="text-muted-foreground mt-1">Gerencie, edite ou crie novas automações.</p>
          </div>
          <Button onClick={handleCreateNewWorkspace} className="flex items-center gap-2">
            <PlusCircle className="h-5 w-5" />
            <span className="hidden sm:inline">Criar Novo Fluxo</span>
          </Button>
        </div>
        
        {isLoadingWorkspaces ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[...Array(3)].map((_, i) => (
                 <Card key={i} className="h-[180px] animate-pulse bg-background/50"></Card>
            ))}
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {workspaces.map((ws) => (
              <Card 
                key={ws.id} 
                className="group flex flex-col justify-between overflow-hidden rounded-lg shadow-sm transition-all hover:shadow-lg hover:-translate-y-1"
                onClick={() => handleOpenWorkspace(ws.id)}
              >
                <CardHeader>
                  <CardTitle className="flex items-start justify-between">
                    <span className="truncate pr-4">{ws.name}</span>
                    <BotMessageSquare className="h-6 w-6 text-muted-foreground transition-colors group-hover:text-primary" />
                  </CardTitle>
                  <CardDescription>
                    {`Atualizado em: ${new Date(ws.updated_at || Date.now()).toLocaleDateString()}`}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex items-center justify-end p-4 bg-muted/40 transition-colors group-hover:bg-muted/60">
                   <div className="flex items-center text-sm font-medium text-primary cursor-pointer">
                        Abrir Editor
                        <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </div>
                </CardContent>
              </Card>
            ))}
             {workspaces.length === 0 && !isLoadingWorkspaces && (
                <div className="col-span-full flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-muted-foreground/30 py-20 text-center">
                    <h3 className="text-xl font-semibold">Nenhum fluxo encontrado</h3>
                    <p className="text-muted-foreground mt-2 mb-6">Comece criando seu primeiro fluxo de automação.</p>
                    <Button onClick={handleCreateNewWorkspace} className="flex items-center gap-2">
                        <PlusCircle className="h-5 w-5" />
                        Criar seu Primeiro Fluxo
                    </Button>
                </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
