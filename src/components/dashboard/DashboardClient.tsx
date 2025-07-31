
'use client'; 

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { PlusCircle, Zap, Loader2 } from 'lucide-react';
import { loadWorkspacesForOwnerFromDB, createWorkspaceAction } from '@/app/actions/databaseActions';
import WorkspaceList from '@/components/dashboard/WorkspaceList';
import { useAuth } from '@/components/auth/AuthProvider';
import type { WorkspaceData, User } from '@/lib/types';
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

interface DashboardClientProps {
  user: User;
  initialWorkspaces: WorkspaceData[];
}

export default function DashboardClient({ user, initialWorkspaces }: DashboardClientProps) {
  const { logout } = useAuth();
  const [workspaces, setWorkspaces] = useState<WorkspaceData[]>(initialWorkspaces);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');

  const router = useRouter();
  const { toast } = useToast();

  const loadWorkspaces = useCallback(async () => {
    if (user && user.id) {
      setIsLoading(true);
      try {
        const loadedWorkspaces = await loadWorkspacesForOwnerFromDB(user.id);
        setWorkspaces(loadedWorkspaces);
      } catch (error) {
        console.error("[DashboardClient] Error loading workspaces:", error);
        toast({ title: "Erro ao Recarregar Fluxos", description: "Não foi possível buscar seus fluxos.", variant: "destructive" });
      } finally {
        setIsLoading(false);
      }
    }
  }, [user, toast]);

  // Sincroniza o estado com as props iniciais
  useEffect(() => {
    setWorkspaces(initialWorkspaces);
  }, [initialWorkspaces]);

  const getSuggestedWorkspaceName = useCallback(() => {
    const existingNames = workspaces.map(ws => ws.name);
    let defaultName = 'Meu Novo Fluxo';
    if (!existingNames.includes(defaultName)) {
      return defaultName;
    }
    let counter = 1;
    while (existingNames.includes(`${defaultName} (${counter})`)) {
        counter++;
    }
    return `${defaultName} (${counter})`;
  }, [workspaces]);

  useEffect(() => {
    if (isCreateDialogOpen) {
        setNewWorkspaceName(getSuggestedWorkspaceName());
    }
  }, [isCreateDialogOpen, getSuggestedWorkspaceName]);

  const handleCreateWorkspace = async () => {
    if (!user || !user.id || !newWorkspaceName.trim()) {
        toast({
            title: "Erro de Validação",
            description: "O nome do fluxo não pode estar vazio e você deve estar logado.",
            variant: "destructive",
        });
        return;
    }
    setIsCreating(true);
    try {
        const result = await createWorkspaceAction(newWorkspaceName.trim(), user.id);
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
                        onKeyPress={(e) => { if (e.key === 'Enter' && !isCreating) handleCreateWorkspace()}}
                    />
                </div>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button variant="outline" disabled={isCreating}>Cancelar</Button>
                    </DialogClose>
                    <Button onClick={handleCreateWorkspace} disabled={isCreating}>
                        {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {isCreating ? 'Criando...' : 'Criar e Editar'}
                    </Button>
                </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
        
        <div className="flex-1">
          {isLoading ? (
             <p className="text-muted-foreground text-center py-10">Carregando seus fluxos...</p>
          ) : (
             <WorkspaceList workspaces={workspaces} onWorkspacesChange={loadWorkspaces} />
          )}
        </div>
      </main>
    </div>
  );
}
