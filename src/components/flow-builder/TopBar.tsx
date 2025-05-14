
"use client";

import type React from 'react';
import { useState } from 'react'; // Adicionado useState
import type { WorkspaceData } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PlusCircle, Save, Undo2, Zap, UserCircle, Settings, LogOut, CreditCard } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger, // Não será usado diretamente no item, mas o Dialog o gerencia
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from '@/hooks/use-toast';


interface TopBarProps {
  workspaces: WorkspaceData[];
  activeWorkspaceId: string | null;
  onAddWorkspace: () => void;
  onSwitchWorkspace: (id: string) => void;
  onSaveWorkspaces: () => void;
  onDiscardChanges: () => void;
  appName?: string;
}

const TopBar: React.FC<TopBarProps> = ({
  workspaces,
  activeWorkspaceId,
  onAddWorkspace,
  onSwitchWorkspace,
  onSaveWorkspaces,
  onDiscardChanges,
  appName = "Flowise Lite"
}) => {
  const { toast } = useToast();
  const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false);
  const [supabaseUrl, setSupabaseUrl] = useState(''); // Simulação de estado para config
  const [supabaseAnonKey, setSupabaseAnonKey] = useState(''); // Simulação de estado para config

  const handleSaveSettings = () => {
    // Em uma aplicação real, você salvaria isso (ex: localStorage ou backend)
    console.log("Configurações Salvas (Simulado):", { supabaseUrl, supabaseAnonKey });
    toast({
      title: "Configurações Salvas!",
      description: "Suas configurações foram (simuladamente) salvas.",
    });
    setIsSettingsDialogOpen(false);
  };

  return (
    <>
      <header className="flex items-center justify-between h-16 px-4 md:px-6 border-b bg-card text-card-foreground shadow-sm shrink-0">
        <div className="flex items-center gap-3">
          <Zap className="w-6 h-6 text-primary" />
          <h1 className="text-xl font-semibold tracking-tight text-primary whitespace-nowrap">{appName}</h1>
          
          {workspaces.length > 0 && activeWorkspaceId && (
            <div className="ml-4 hidden md:flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Fluxo:</span>
              <Select
                value={activeWorkspaceId}
                onValueChange={onSwitchWorkspace}
              >
                <SelectTrigger 
                  id="workspace-select-topbar" 
                  className="h-9 w-auto min-w-[150px] max-w-[250px] text-sm"
                  aria-label="Selecionar Fluxo de Trabalho"
                >
                  <SelectValue placeholder="Selecione um fluxo" />
                </SelectTrigger>
                <SelectContent>
                  {workspaces.map(ws => (
                    <SelectItem key={ws.id} value={ws.id} className="text-sm">
                      {ws.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
           <Button onClick={onAddWorkspace} variant="outline" size="sm" className="ml-2 hidden md:inline-flex">
            <PlusCircle className="mr-2 h-4 w-4" /> Novo Fluxo
          </Button>
        </div>

        <div className="flex items-center gap-2">
          {/* Dropdown para telas menores */}
          <div className="md:hidden">
            {activeWorkspaceId && workspaces.length > 0 && (
              <Select
                  value={activeWorkspaceId || ""}
                  onValueChange={onSwitchWorkspace}
                >
                  <SelectTrigger 
                    id="workspace-select-topbar-mobile" 
                    className="h-9 w-auto min-w-[calc(100vw-280px)] max-w-[200px] text-sm" // Ajustado para ocupar espaço
                    aria-label="Selecionar Fluxo de Trabalho"
                  >
                    <SelectValue placeholder="Selecionar Fluxo" />
                  </SelectTrigger>
                  <SelectContent>
                    {workspaces.map(ws => (
                      <SelectItem key={ws.id} value={ws.id} className="text-sm">
                        {ws.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
              </Select>
            )}
          </div>
           <Button onClick={onAddWorkspace} variant="outline" size="icon" className="ml-1 md:hidden">
            <PlusCircle className="h-4 w-4" />
            <span className="sr-only">Novo Fluxo</span>
          </Button>

          <Button 
            onClick={onSaveWorkspaces} 
            variant="default" 
            size="sm"
            disabled={!activeWorkspaceId}
            className="hidden md:inline-flex"
          >
            <Save className="mr-2 h-4 w-4" /> Salvar
          </Button>
           <Button 
            onClick={onSaveWorkspaces} 
            variant="default" 
            size="icon"
            disabled={!activeWorkspaceId}
            className="md:hidden"
            aria-label="Salvar Fluxos"
          >
            <Save className="h-4 w-4" />
          </Button>

          <Button 
            onClick={onDiscardChanges} 
            variant="destructive" 
            size="sm"
            disabled={!activeWorkspaceId}
            className="hidden md:inline-flex"
          >
            <Undo2 className="mr-2 h-4 w-4" /> Descartar
          </Button>
          <Button 
            onClick={onDiscardChanges} 
            variant="destructive" 
            size="icon"
            disabled={!activeWorkspaceId}
            className="md:hidden"
            aria-label="Descartar Alterações"
          >
            <Undo2 className="h-4 w-4" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full">
                <Avatar className="h-8 w-8">
                  <AvatarImage src="https://placehold.co/40x40.png?text=UE" alt="@usuarioexemplo" data-ai-hint="user avatar" />
                  <AvatarFallback>UE</AvatarFallback>
                </Avatar>
                <span className="sr-only">Abrir menu do usuário</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Minha Conta</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <UserCircle className="mr-2 h-4 w-4" />
                <span>Perfil</span>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <CreditCard className="mr-2 h-4 w-4" />
                <span>Assinatura</span>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setIsSettingsDialogOpen(true); }}>
                <Settings className="mr-2 h-4 w-4" />
                <span>Configurações</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <LogOut className="mr-2 h-4 w-4" />
                <span>Sair</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <Dialog open={isSettingsDialogOpen} onOpenChange={setIsSettingsDialogOpen}>
        <DialogContent className="sm:max-w-[525px] bg-card">
          <DialogHeader>
            <DialogTitle>Configurações da Aplicação</DialogTitle>
            <DialogDescription>
              Gerencie as configurações globais da sua aplicação aqui.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-6 py-4">
            <div className="space-y-2">
              <h4 className="font-medium leading-none text-lg text-card-foreground">Supabase</h4>
              <p className="text-sm text-muted-foreground">
                Configure as credenciais para integração com seu projeto Supabase.
              </p>
            </div>
            <div className="grid gap-3">
              <Label htmlFor="supabase-url" className="text-card-foreground">URL do Projeto Supabase</Label>
              <Input
                id="supabase-url"
                placeholder="https://seunomeprojeto.supabase.co"
                value={supabaseUrl}
                onChange={(e) => setSupabaseUrl(e.target.value)}
                className="bg-input text-foreground"
              />
            </div>
            <div className="grid gap-3">
              <Label htmlFor="supabase-anon-key" className="text-card-foreground">Chave Anônima (Anon Key) Supabase</Label>
              <Input
                id="supabase-anon-key"
                type="password"
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                value={supabaseAnonKey}
                onChange={(e) => setSupabaseAnonKey(e.target.value)}
                className="bg-input text-foreground"
              />
               <p className="text-xs text-muted-foreground">
                Esta chave é usada para acesso público aos dados do seu projeto.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSettingsDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveSettings}>Salvar Configurações</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default TopBar;

