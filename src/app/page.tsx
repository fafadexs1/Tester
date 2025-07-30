
import React from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { PlusCircle, Zap } from 'lucide-react';
import { loadAllWorkspacesFromDB } from '@/app/actions/databaseActions';
import Link from 'next/link';
import WorkspaceList from '@/components/dashboard/WorkspaceList';
import { getCurrentUser } from '@/lib/auth';

// Esta página agora é um Server Component para carregamento rápido de dados.
export default async function DashboardPage() {
  // A verificação de autenticação agora pode ser feita no servidor.
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }

  // Carrega os workspaces diretamente no servidor.
  const workspaces = await loadAllWorkspacesFromDB();

  return (
    <div className="flex min-h-screen w-full flex-col bg-muted/40">
      <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
        <div className="flex items-center gap-3">
          <Zap className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-semibold tracking-tight text-primary whitespace-nowrap">NexusFlow</h1>
        </div>
        <div className="ml-auto flex items-center gap-2">
           <span className="text-sm text-muted-foreground hidden sm:inline">
            Olá, {user.username}
          </span>
          {/* O botão de logout precisará de um componente de cliente ou de uma server action */}
          <form action={async () => {
            'use server';
            // Lógica de logout aqui se movida para server action, por enquanto link/botão simples
          }}>
            <Link href="/login">
                <Button variant="outline">Sair</Button>
            </Link>
          </form>
        </div>
      </header>
      <main className="flex flex-1 flex-col p-4 sm:p-6 lg:p-8">
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
        
        <div className="flex-1 mt-8">
           {/* O componente WorkspaceList agora é um Client Component para lidar com interações */}
           <WorkspaceList initialWorkspaces={workspaces} />
        </div>
      </main>
    </div>
  );
}
