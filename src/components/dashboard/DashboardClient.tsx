
'use client'; 

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { PlusCircle, Loader2 } from 'lucide-react';
import { loadWorkspacesForOrganizationFromDB, createWorkspaceAction } from '@/app/actions/databaseActions';
import WorkspaceList from '@/components/dashboard/WorkspaceList';
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
  const [workspaces, setWorkspaces] = useState<WorkspaceData[]>(initialWorkspaces);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');

  const router = useRouter();
  const { toast } = useToast();

  const loadWorkspaces = useCallback(async () => {
    if (user && user.current_organization_id) {
      setIsLoading(true);
      try {
        const loadedWorkspaces = await loadWorkspacesForOrganizationFromDB(user.current_organization_id);
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
    if (!user || !user.id || !user.current_organization_id || !newWorkspaceName.trim()) {
        toast({
            title: "Erro de Validação",
            description: "O nome do fluxo não pode estar vazio e você deve estar em uma organização.",
            variant: "destructive",
        });
        return;
    }
    setIsCreating(true);
    try {
        const result = await createWorkspaceAction(newWorkspaceName.trim(), user.id, user.current_organization_id);
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
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
        <div className="flex items-center justify-between">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">Meus Fluxos</h2>
                <p className="text-muted-foreground mt-1">Gerencie, edite ou crie novas automações.</p>
            </div>
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogTrigger asChild>
                    <Button>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Criar Novo Fluxo
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
        
        <div className="flex-1 mt-6">
          {isLoading ? (
             <p className="text-muted-foreground text-center py-10">Carregando seus fluxos...</p>
          ) : (
             <WorkspaceList workspaces={workspaces} onWorkspacesChange={loadWorkspaces} />
          )}
        </div>
    </div>
  );
}
