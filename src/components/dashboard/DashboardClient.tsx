
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
    <div className="flex-1 space-y-8 p-8 pt-10 min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-900 via-zinc-950 to-black">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-zinc-300 to-zinc-500 bg-clip-text text-transparent">
            Meus Fluxos
          </h2>
          <p className="text-zinc-400 text-sm md:text-base max-w-lg">
            Gerencie suas automações e crie novas experiências conversacionais.
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-violet-600 hover:bg-violet-700 text-white shadow-lg shadow-violet-900/20 border border-violet-500/20 transition-all duration-300 hover:scale-[1.02]">
              <PlusCircle className="mr-2 h-4 w-4" />
              Criar Novo Fluxo
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-zinc-950/95 backdrop-blur-xl border-white/10 sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle className="text-xl font-semibold text-white">Criar Novo Fluxo</DialogTitle>
              <DialogDescription className="text-zinc-400">
                Dê um nome para sua nova automação. Você poderá alterá-lo depois.
              </DialogDescription>
            </DialogHeader>
            <div className="py-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="workspace-name" className="text-zinc-300">Nome do Fluxo</Label>
                <Input
                  id="workspace-name"
                  value={newWorkspaceName}
                  onChange={(e) => setNewWorkspaceName(e.target.value)}
                  placeholder="Ex: Fluxo de Boas-vindas"
                  className="bg-black/40 border-white/10 focus:border-violet-500/50 text-white placeholder:text-zinc-600"
                  onKeyPress={(e) => { if (e.key === 'Enter' && !isCreating) handleCreateWorkspace() }}
                  autoFocus
                />
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="ghost" disabled={isCreating} className="text-zinc-400 hover:text-white hover:bg-white/5">Cancelar</Button>
              </DialogClose>
              <Button onClick={handleCreateWorkspace} disabled={isCreating} className="bg-violet-600 hover:bg-violet-700 text-white">
                {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isCreating ? 'Criando...' : 'Criar Fluxo'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex-1 mt-8">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
            <p className="text-zinc-500 text-sm">Carregando seus fluxos...</p>
          </div>
        ) : (
          <WorkspaceList workspaces={workspaces} onWorkspacesChange={loadWorkspaces} />
        )}
      </div>
    </div>
  );
}
