
'use client'; // Converter para Client Component para usar o hook useAuth

import React from 'react';
import { Button } from '@/components/ui/button';
import { PlusCircle, Zap } from 'lucide-react';
import { loadWorkspacesForOwnerFromDB } from '@/app/actions/databaseActions';
import Link from 'next/link';
import WorkspaceList from '@/components/dashboard/WorkspaceList';
import { useAuth } from '@/components/auth/AuthProvider';
import type { WorkspaceData } from '@/lib/types';

// O Dashboard agora precisa ser um Client Component para usar o hook useAuth para o logout.
// Os dados iniciais ainda podem ser carregados no servidor e passados como props,
// mas para este caso, vamos simplificar e fazer o carregamento no cliente
// para garantir a funcionalidade do logout.
export default function DashboardPage() {
  const { user, logout, loading } = useAuth();
  const [workspaces, setWorkspaces] = React.useState<WorkspaceData[]>([]);
  const [isLoadingData, setIsLoadingData] = React.useState(true);
  
  React.useEffect(() => {
    // Carrega os workspaces no lado do cliente, pois a página agora é um client component
    async function loadWorkspaces() {
      if (user) {
        console.log(`[DashboardPage Client] Usuário "${user.username}" autenticado. Carregando workspaces...`);
        setIsLoadingData(true);
        try {
          const loadedWorkspaces = await loadWorkspacesForOwnerFromDB(user.username);
          setWorkspaces(loadedWorkspaces);
          console.log(`[DashboardPage Client] ${loadedWorkspaces.length} workspaces carregados para ${user.username}.`);
        } catch (error) {
          console.error("[DashboardPage Client] Erro ao carregar workspaces:", error);
        } finally {
          setIsLoadingData(false);
        }
      }
    }
    
    if (!loading) {
       loadWorkspaces();
    }
  }, [user, loading]);


  // O AuthProvider já mostra um loader global, então não precisamos de um aqui
  // a menos que o carregamento dos workspaces seja demorado.
  if (loading || !user) {
    return null; // O AuthProvider cuida do redirecionamento ou da tela de carregamento global
  }

  return (
    <div className="flex min-h-screen w-full flex-col bg-muted/40">
      <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <Zap className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-semibold tracking-tight text-primary whitespace-nowrap">NexusFlow</h1>
        </div>
        <div className="ml-auto flex items-center gap-4">
           <span className="text-sm text-muted-foreground hidden sm:inline">
            Olá, {user.username}
          </span>
          {/* O botão de sair agora é um botão simples que chama a função logout do useAuth */}
          <Button variant="outline" onClick={logout}>Sair</Button>
        </div>
      </header>
      <main className="flex flex-1 flex-col gap-6 p-4 sm:p-6 lg:p-8">
        <div className="flex items-center">
          <div className="flex-1">
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Meus Fluxos</h1>
            <p className="text-muted-foreground mt-1">Gerencie, edite ou crie novas automações.</p>
          </div>
          <Link href="/flow/new">
            <Button className="flex items-center gap-2">
              <PlusCircle className="h-5 w-5" />
              <span className="hidden sm:inline">Criar Novo Fluxo</span>
            </Button>
          </Link>
        </div>
        
        <div className="flex-1">
          {isLoadingData ? (
             <p className="text-muted-foreground">Carregando seus fluxos...</p>
          ) : (
             <WorkspaceList initialWorkspaces={workspaces} />
          )}
        </div>
      </main>
    </div>
  );
}
