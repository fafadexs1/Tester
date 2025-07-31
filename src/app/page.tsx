
'use client'; 

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { PlusCircle, Zap, Loader2 } from 'lucide-react';
import { loadWorkspacesForOwnerFromDB, createWorkspaceAction } from '@/app/actions/databaseActions';
import Link from 'next/link';
import WorkspaceList from '@/components/dashboard/WorkspaceList';
import { useAuth } from '@/components/auth/AuthProvider';
import type { WorkspaceData } from '@/lib/types';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function DashboardPage() {
  const { user, logout, loading } = useAuth();
  const [workspaces, setWorkspaces] = useState<WorkspaceData[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');

  const router = useRouter();
  const { toast } = useToast();

  const loadWorkspaces = async () => {
    if (user) {
      console.log(`[DashboardPage Client] User "${user.username}" authenticated. Loading workspaces...`);
      setIsLoadingData(true);
      try {
        const loadedWorkspaces = await loadWorkspacesForOwnerFromDB(user.username);
        setWorkspaces(loadedWorkspaces);
        console.log(`[DashboardPage Client] ${loadedWorkspaces.length} workspaces loaded for ${user.username}.`);
      } catch (error) {
        console.error("[DashboardPage Client] Error loading workspaces:", error);
      } finally {
        setIsLoadingData(false);
      }
    }
  };
  
  useEffect(() => {
    if (!loading && user) {
       loadWorkspaces();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loading]);

  useEffect(() => {
    if (isCreateDialogOpen && user) {
        const existingNames = workspaces.map(ws => ws.name);
        let defaultName = 'Meu Fluxo';
        let counter = 1;
        while (existingNames.includes(defaultName)) {
            defaultName = `Meu Fluxo ${counter}`;
            counter++;
        }
        setNewWorkspaceName(defaultName);
    }
  }, [isCreateDialogOpen, user, workspaces]);

  const handleCreateWorkspace = async () => {
    if (!user || !newWorkspaceName.trim()) {
        toast({
            title: "Erro de Validação",
            description: "O nome do fluxo não pode estar vazio.",
            variant: "destructive",
        });
        return;
    }
    setIsCreating(true);
    try {
        const result = await createWorkspaceAction(newWorkspaceName.trim(), user.username);
        if (result.success && result.workspaceId) {
            toast({
                title: "Fluxo Criado!",
                description: `O fluxo "${newWorkspaceName.trim()}" foi criado com sucesso.`,
            });
            router.push(`/flow/${result.workspaceId}`);
        } else {
            toast({
                title: "Erro ao Criar Fluxo",
                description: result.error || "Ocorreu um erro desconhecido.",
                variant: "destructive",
            });
        }
    } catch (error: any) {
        toast({
            title: "Erro Inesperado",
            description: error.message || "Ocorreu um erro no servidor.",
            variant: "destructive",
        });
    } finally {
        setIsCreating(false);
        setIsCreateDialogOpen(false);
    }
  };


  if (loading || !user) {
    return null;
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
          <Button variant="outline" onClick={logout}>Sair</Button>
        </div>
      </header>
      <main className="flex flex-1 flex-col gap-6 p-4 sm:p-6 lg:p-8">
        <div className="flex items-center">
          <div className="flex-1">
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Meus Fluxos</h1>
            <p className="text-muted-foreground mt-1">Gerencie, edite ou crie novas automações.</p>
          </div>
          
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
                <Button className="flex items-center gap-2">
                    <PlusCircle className="h-5 w-5" />
                    <span className="hidden sm:inline">Criar Novo Fluxo</span>
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Criar Novo Fluxo</DialogTitle>
                    <DialogDescription>
                        Dê um nome para sua nova automação. Você poderá alterá-lo depois.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    <Label htmlFor="workspace-name">Nome do Fluxo</Label>
                    <Input
                        id="workspace-name"
                        value={newWorkspaceName}
                        onChange={(e) => setNewWorkspaceName(e.target.value)}
                        placeholder="Ex: Fluxo de Boas-vindas"
                        onKeyPress={(e) => { if (e.key === 'Enter') handleCreateWorkspace()}}
                    />
                </div>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button variant="outline" disabled={isCreating}>Cancelar</Button>
                    </DialogClose>
                    <Button onClick={handleCreateWorkspace} disabled={isCreating}>
                        {isCreating && <Loader2 className="animate-spin" />}
                        {isCreating ? 'Criando...' : 'Criar e Editar'}
                    </Button>
                </DialogFooter>
            </DialogContent>
          </Dialog>

        </div>
        
        <div className="flex-1">
          {isLoadingData ? (
             <p className="text-muted-foreground">Carregando seus fluxos...</p>
          ) : (
             <WorkspaceList initialWorkspaces={workspaces} onWorkspacesChange={loadWorkspaces} />
          )}
        </div>
      </main>
    </div>
  );
}
