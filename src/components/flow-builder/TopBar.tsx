
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import type { WorkspaceData } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  PlusCircle, Save, Undo2, Zap, UserCircle, Settings, LogOut, CreditCard, 
  Database, ChevronDown, PlugZap, BotMessageSquare, Rocket, PanelRightOpen, PanelRightClose, KeyRound, Copy,
  TerminalSquare, ListOrdered, RotateCcw as ResetZoomIcon, RefreshCw, AlertCircle, FileText
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';


const SupabaseIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
    <path d="M12.1721 2.00244C12.8801 1.98791 13.576 2.21863 14.1116 2.64953C14.6472 3.08043 14.9816 3.68122 15.0491 4.32663L15.0536 4.43311L15.2402 13.4907C15.2811 14.5963 14.4145 15.5223 13.3045 15.5629C12.9977 15.5745 12.6978 15.5302 12.4233 15.4326L12.1933 15.3496C11.2835 14.9872 10.7389 13.9861 10.9305 13.005L11.9976 7.54346C11.7963 7.44211 11.5823 7.36858 11.3608 7.32471L8.75981 8.00806C7.7488 8.25358 6.85304 7.43087 6.85179 6.39187C6.85091 5.69923 7.32011 5.09048 7.97152 4.89367L8.08993 4.85168L12.0001 3.56348V2.09302C12.0001 2.06352 12.0025 2.03488 12.007 2.00767L12.1721 2.00244ZM12.0001 16.8091L11.9425 16.8323C10.3604 17.5281 8.97375 18.6318 8.06805 20.0061C7.51501 20.8504 7.84881 22.0024 8.78293 22.0024H15.2172C16.1513 22.0024 16.4851 20.8504 15.9321 20.0061C15.0264 18.6318 13.6397 17.5281 12.0577 16.8323L12.0001 16.8091Z"/>
  </svg>
);

const PostgresIcon = () => (
 <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
    <path d="M5.10526 2H18.8947C19.9381 2 20.7895 2.82911 20.7895 3.8421V7.52631H16.6316V14.0526C16.6316 15.3461 15.5772 16.3684 14.2632 16.3684H9.73684C8.42283 16.3684 7.36842 15.3461 7.36842 14.0526V7.52631H3.21053V3.8421C3.21053 2.82911 4.06193 2 5.10526 2ZM12.5789 7.52631H16.6316V3.8421H12.5789V7.52631ZM7.36842 7.52631H11.4211V3.8421H7.36842V7.52631ZM9.73684 17.6316H14.2632C16.3051 17.6316 17.9474 19.2293 17.9474 21.2105C17.9474 21.6453 17.6047 22 17.1579 22H6.84211C6.39526 22 6.05263 21.6453 6.05263 21.2105C6.05263 19.2293 7.69491 17.6316 9.73684 17.6316ZM13.7368 11.2105H10.2632C9.91571 11.2105 9.73684 11.0373 9.73684 10.7895C9.73684 10.5416 9.91571 10.3684 10.2632 10.3684H13.7368C14.0843 10.3684 14.2632 10.5416 14.2632 10.7895C14.2632 11.0373 14.0843 11.2105 13.7368 11.2105Z" />
  </svg>
);

type SettingsCategory = 'database' | 'integrations';
interface WebhookLogEntry {
  timestamp: string;
  payload?: any;
  error?: any;
}

interface TopBarProps {
  workspaces: WorkspaceData[];
  activeWorkspaceId: string | null;
  onAddWorkspace: () => void;
  onSwitchWorkspace: (id: string) => void;
  onSaveWorkspaces: () => void;
  onDiscardChanges: () => void;
  appName?: string;
  isChatPanelOpen: boolean;
  onToggleChatPanel: () => void;
}

const TopBar: React.FC<TopBarProps> = ({
  workspaces,
  activeWorkspaceId,
  onAddWorkspace,
  onSwitchWorkspace,
  onSaveWorkspaces,
  onDiscardChanges,
  appName = "Flowise Lite",
  isChatPanelOpen,
  onToggleChatPanel,
}) => {
  const { toast } = useToast();
  const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false);
  const [activeSettingsCategory, setActiveSettingsCategory] = useState<SettingsCategory>('database');
  
  // States for Webhook Logs Dialog
  const [isWebhookLogsDialogOpen, setIsWebhookLogsDialogOpen] = useState(false);
  const [evolutionWebhookLogEntries, setEvolutionWebhookLogEntries] = useState<WebhookLogEntry[]>([]);
  const [isLoadingEvolutionLogs, setIsLoadingEvolutionLogs] = useState(false);
  const [evolutionLogsError, setEvolutionLogsError] = useState<string | null>(null);
  
  const [supabaseUrl, setSupabaseUrl] = useState(''); 
  const [supabaseAnonKey, setSupabaseAnonKey] = useState(''); 
  const [supabaseServiceKey, setSupabaseServiceKey] = useState('');
  const [isSupabaseEnabled, setIsSupabaseEnabled] = useState(false);

  const [postgresHost, setPostgresHost] = useState('');
  const [postgresPort, setPostgresPort] = useState('');
  const [postgresUser, setPostgresUser] = useState('');
  const [postgresPassword, setPostgresPassword] = useState('');
  const [postgresDatabase, setPostgresDatabase] = useState('');
  const [isPostgresEnabled, setIsPostgresEnabled] = useState(false);

  const [evolutionApiBaseUrl, setEvolutionApiBaseUrl] = useState('');
  const [evolutionGlobalApiKey, setEvolutionGlobalApiKey] = useState('');
  const [defaultEvolutionInstanceName, setDefaultEvolutionInstanceName] = useState('');
  const [isEvolutionApiEnabled, setIsEvolutionApiEnabled] = useState(false);
  const [flowiseLiteGlobalWebhookUrl, setFlowiseLiteGlobalWebhookUrl] = useState('');


  useEffect(() => {
    if (typeof window !== 'undefined') {
      setFlowiseLiteGlobalWebhookUrl(`${window.location.origin}/api/evolution/webhook`);
    }
  }, []);

  useEffect(() => {
    if (isSettingsDialogOpen) { 
      const savedSupabaseUrl = localStorage.getItem('supabaseUrl') || '';
      const savedSupabaseAnonKey = localStorage.getItem('supabaseAnonKey') || '';
      const savedSupabaseServiceKey = localStorage.getItem('supabaseServiceKey') || '';
      const savedIsSupabaseEnabled = localStorage.getItem('isSupabaseEnabled') === 'true';
      
      setSupabaseUrl(savedSupabaseUrl);
      setSupabaseAnonKey(savedSupabaseAnonKey);
      setSupabaseServiceKey(savedSupabaseServiceKey);
      setIsSupabaseEnabled(savedIsSupabaseEnabled);

      const savedPostgresHost = localStorage.getItem('postgresHost') || '';
      const savedPostgresPort = localStorage.getItem('postgresPort') || '';
      const savedPostgresUser = localStorage.getItem('postgresUser') || '';
      const savedPostgresPassword = localStorage.getItem('postgresPassword') || '';
      const savedPostgresDatabase = localStorage.getItem('postgresDatabase') || '';
      const savedIsPostgresEnabled = localStorage.getItem('isPostgresEnabled') === 'true';

      setPostgresHost(savedPostgresHost);
      setPostgresPort(savedPostgresPort);
      setPostgresUser(savedPostgresUser);
      setPostgresPassword(savedPostgresPassword);
      setPostgresDatabase(savedPostgresDatabase);
      setIsPostgresEnabled(savedIsPostgresEnabled);

      const savedEvolutionApiBaseUrl = localStorage.getItem('evolutionApiBaseUrl') || '';
      const savedEvolutionGlobalApiKey = localStorage.getItem('evolutionApiKey') || '';
      const savedDefaultEvolutionInstanceName = localStorage.getItem('defaultEvolutionInstanceName') || '';
      const savedIsEvolutionApiEnabled = localStorage.getItem('isEvolutionApiEnabled') === 'true';

      setEvolutionApiBaseUrl(savedEvolutionApiBaseUrl);
      setEvolutionGlobalApiKey(savedEvolutionGlobalApiKey);
      setDefaultEvolutionInstanceName(savedDefaultEvolutionInstanceName);
      setIsEvolutionApiEnabled(savedIsEvolutionApiEnabled);
    }
  }, [isSettingsDialogOpen]);

  const handleSaveSettings = () => {
    localStorage.setItem('supabaseUrl', supabaseUrl);
    localStorage.setItem('supabaseAnonKey', supabaseAnonKey);
    localStorage.setItem('supabaseServiceKey', supabaseServiceKey);
    localStorage.setItem('isSupabaseEnabled', String(isSupabaseEnabled));

    localStorage.setItem('postgresHost', postgresHost);
    localStorage.setItem('postgresPort', postgresPort);
    localStorage.setItem('postgresUser', postgresUser);
    localStorage.setItem('postgresPassword', postgresPassword);
    localStorage.setItem('postgresDatabase', postgresDatabase);
    localStorage.setItem('isPostgresEnabled', String(isPostgresEnabled));

    localStorage.setItem('evolutionApiBaseUrl', evolutionApiBaseUrl);
    localStorage.setItem('evolutionApiKey', evolutionGlobalApiKey);
    localStorage.setItem('defaultEvolutionInstanceName', defaultEvolutionInstanceName);
    localStorage.setItem('isEvolutionApiEnabled', String(isEvolutionApiEnabled));

    console.log("Configurações Salvas:", { 
      supabase: { supabaseUrl, supabaseAnonKey, supabaseServiceKeyExists: supabaseServiceKey.length > 0, isSupabaseEnabled },
      postgresql: { postgresHost, postgresPort, postgresUser, postgresDatabase, isPostgresEnabled, postgresPasswordExists: postgresPassword.length > 0 },
      evolutionApi: { evolutionApiBaseUrl, evolutionApiKeyExists: evolutionGlobalApiKey.length > 0, defaultEvolutionInstanceName, isEvolutionApiEnabled, flowiseLiteGlobalWebhookUrl }
    });
    toast({
      title: "Configurações Salvas!",
      description: "Suas configurações foram salvas no localStorage.",
    });
    setIsSettingsDialogOpen(false);
  };

  const handlePublishFlow = () => {
    if (!activeWorkspaceId) {
      toast({
        title: "Nenhum fluxo ativo",
        description: "Por favor, selecione um fluxo para publicar.",
        variant: "destructive",
      });
      return;
    }
    const currentWorkspace = workspaces.find(ws => ws.id === activeWorkspaceId);
    toast({
      title: "Publicar Fluxo",
      description: `O fluxo "${currentWorkspace?.name || 'Selecionado'}" seria colocado em produção. (Funcionalidade de placeholder)`,
      variant: "default",
    });
  };

  const fetchEvolutionWebhookLogs = async () => {
    setIsLoadingEvolutionLogs(true);
    setEvolutionLogsError(null);
    try {
      const response = await fetch('/api/evolution/webhook-logs');
      if (!response.ok) {
        throw new Error(`Erro ao buscar logs: ${response.statusText}`);
      }
      const data: WebhookLogEntry[] = await response.json();
      setEvolutionWebhookLogEntries(data);
    } catch (error: any) {
      console.error("Erro ao buscar logs do webhook da Evolution API:", error);
      setEvolutionLogsError(error.message || "Falha ao buscar logs.");
      setEvolutionWebhookLogEntries([]);
    } finally {
      setIsLoadingEvolutionLogs(false);
    }
  };

  useEffect(() => {
    if (isWebhookLogsDialogOpen) {
      fetchEvolutionWebhookLogs();
    }
  }, [isWebhookLogsDialogOpen]);


  const settingsCategories: { id: SettingsCategory; label: string; icon: React.ReactNode }[] = [
    { id: 'database', label: 'Banco de Dados', icon: <Database className="w-5 h-5 mr-2" /> },
    { id: 'integrations', label: 'Integrações', icon: <PlugZap className="w-5 h-5 mr-2" /> },
  ];

  const handleCopyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast({ title: `${type} Copiada!`, description: `A ${type.toLowerCase()} foi copiada para a área de transferência.` });
    }).catch(err => {
      toast({ title: `Erro ao Copiar ${type}`, description: `Não foi possível copiar a ${type.toLowerCase()}.`, variant: "destructive" });
      console.error(`Erro ao copiar ${type}: `, err);
    });
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

        <div className="flex items-center gap-1 md:gap-2">
          <div className="md:hidden">
            {activeWorkspaceId && workspaces.length > 0 && (
              <Select
                  value={activeWorkspaceId || ""}
                  onValueChange={onSwitchWorkspace}
                >
                  <SelectTrigger 
                    id="workspace-select-topbar-mobile" 
                    className="h-9 w-auto min-w-[calc(100vw-400px)] max-w-[180px] text-sm" 
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
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="outline" 
                size="icon"
                className="hidden md:inline-flex"
                aria-label="Console e Logs"
              >
                <TerminalSquare className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Console e Logs</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setIsWebhookLogsDialogOpen(true)}>
                <ListOrdered className="mr-2 h-4 w-4" />
                <span>Logs de Eventos API Evolution</span>
              </DropdownMenuItem>
              <DropdownMenuItem disabled>
                {/* <History className="mr-2 h-4 w-4" /> */}
                <span>Logs de Execução do Fluxo</span>
                <span className="ml-auto text-xs text-muted-foreground">(Em Breve)</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>


          <Button 
            onClick={handlePublishFlow} 
            variant="default" 
            size="sm"
            className="bg-teal-600 hover:bg-teal-700 text-white hidden md:inline-flex"
            disabled={!activeWorkspaceId}
          >
            <Rocket className="mr-2 h-4 w-4" /> Publicar
          </Button>
           <Button 
            onClick={handlePublishFlow} 
            variant="default" 
            size="icon"
            className="bg-teal-600 hover:bg-teal-700 text-white md:hidden"
            disabled={!activeWorkspaceId}
            aria-label="Publicar Fluxo"
          >
            <Rocket className="h-4 w-4" />
          </Button>

          <Button 
            onClick={onSaveWorkspaces} 
            variant="outline"
            size="sm"
            disabled={!activeWorkspaceId}
            className="hidden md:inline-flex"
          >
            <Save className="mr-2 h-4 w-4" /> Salvar
          </Button>
           <Button 
            onClick={onSaveWorkspaces} 
            variant="outline" 
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

          <Button
            onClick={onToggleChatPanel}
            variant="outline"
            size="icon"
            aria-label={isChatPanelOpen ? "Fechar painel de chat" : "Abrir painel de chat"}
            className="ml-1 md:ml-2"
          >
            {isChatPanelOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full ml-1 md:ml-2">
                <Avatar className="h-8 w-8">
                  <AvatarImage src="https://placehold.co/40x40.png?text=UE" alt="@usuarioexemplo" data-ai-hint="user avatar"/>
                  <AvatarFallback>UE</AvatarFallback>
                </Avatar>
                <span className="sr-only">Abrir menu do usuário</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
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
              <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setActiveSettingsCategory('database'); setIsSettingsDialogOpen(true); }}>
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
        <DialogContent className="sm:max-w-2xl md:max-w-3xl lg:max-w-4xl xl:max-w-5xl bg-card max-h-[85vh] flex flex-col p-0">
          <DialogHeader className="px-6 py-4 border-b">
            <DialogTitle className="text-xl">Configurações da Aplicação</DialogTitle>
          </DialogHeader>
          
          <div className="flex flex-1 overflow-hidden">
            <aside className="w-1/4 min-w-[200px] border-r bg-muted/40 p-4 space-y-2 overflow-y-auto">
              {settingsCategories.map(category => (
                <Button
                  key={category.id}
                  variant={activeSettingsCategory === category.id ? "secondary" : "ghost"}
                  className={cn(
                    "w-full justify-start text-sm",
                    activeSettingsCategory === category.id ? "font-semibold" : "font-normal"
                  )}
                  onClick={() => setActiveSettingsCategory(category.id)}
                >
                  {category.icon}
                  {category.label}
                </Button>
              ))}
            </aside>

            <main className="flex-1 p-6 overflow-y-auto space-y-6">
              {activeSettingsCategory === 'database' && (
                <section>
                  <h3 className="text-lg font-semibold text-card-foreground mb-4">Configurações de Banco de Dados</h3>
                  <Accordion type="single" collapsible className="w-full space-y-4" defaultValue={isSupabaseEnabled ? 'supabase' : (isPostgresEnabled ? 'postgresql' : undefined) }>
                    <AccordionItem value="supabase" className="border rounded-lg shadow-sm">
                      <AccordionTrigger className="px-4 py-3 hover:bg-muted/50 rounded-t-lg">
                        <div className="flex items-center space-x-3">
                          <SupabaseIcon />
                          <span className="font-medium text-card-foreground">Supabase</span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-4 pt-3 pb-4 border-t">
                        <div className="flex items-center space-x-2 mb-4">
                          <Switch 
                            id="enable-supabase" 
                            checked={isSupabaseEnabled} 
                            onCheckedChange={setIsSupabaseEnabled}
                            aria-label="Habilitar Integração Supabase"
                          />
                          <Label htmlFor="enable-supabase" className="text-sm font-medium">Habilitar Integração Supabase</Label>
                        </div>
                        {isSupabaseEnabled && (
                          <div className="space-y-4 animate-in fade-in-0 slide-in-from-top-2 duration-300">
                            <div>
                              <Label htmlFor="supabase-url" className="text-card-foreground/90 text-sm">URL do Projeto Supabase</Label>
                              <Input
                                id="supabase-url"
                                placeholder="https://seunomeprojeto.supabase.co"
                                value={supabaseUrl}
                                onChange={(e) => setSupabaseUrl(e.target.value)}
                                className="bg-input text-foreground mt-1"
                              />
                            </div>
                            <div>
                              <Label htmlFor="supabase-anon-key" className="text-card-foreground/90 text-sm">Chave Pública (Anon Key)</Label>
                               <div className="flex items-center space-x-2 mt-1">
                                <KeyRound className="w-4 h-4 text-muted-foreground" />
                                <Input
                                    id="supabase-anon-key"
                                    type="password"
                                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                                    value={supabaseAnonKey}
                                    onChange={(e) => setSupabaseAnonKey(e.target.value)}
                                    className="bg-input text-foreground flex-1"
                                />
                               </div>
                              <p className="text-xs text-muted-foreground mt-1">
                                Usada para acesso público e RLS (Row Level Security).
                              </p>
                            </div>
                             <div>
                              <Label htmlFor="supabase-service-key" className="text-card-foreground/90 text-sm">Chave de Serviço (Service Role Key)</Label>
                               <div className="flex items-center space-x-2 mt-1">
                                <KeyRound className="w-4 h-4 text-muted-foreground" />
                                <Input
                                    id="supabase-service-key"
                                    type="password"
                                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                                    value={supabaseServiceKey}
                                    onChange={(e) => setSupabaseServiceKey(e.target.value)}
                                    className="bg-input text-foreground flex-1"
                                />
                               </div>
                              <p className="text-xs text-muted-foreground mt-1">
                                Usada para operações de backend que bypassam RLS (ex: buscar schema). Mantenha em segredo.
                              </p>
                            </div>
                          </div>
                        )}
                      </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="postgresql" className="border rounded-lg shadow-sm">
                      <AccordionTrigger className="px-4 py-3 hover:bg-muted/50 rounded-t-lg">
                        <div className="flex items-center space-x-3">
                          <PostgresIcon />
                          <span className="font-medium text-card-foreground">PostgreSQL (Exemplo)</span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-4 pt-3 pb-4 border-t">
                        <div className="flex items-center space-x-2 mb-4">
                          <Switch 
                            id="enable-postgres" 
                            checked={isPostgresEnabled} 
                            onCheckedChange={setIsPostgresEnabled}
                            aria-label="Habilitar Integração PostgreSQL"
                          />
                          <Label htmlFor="enable-postgres" className="text-sm font-medium">Habilitar Integração PostgreSQL</Label>
                        </div>
                        {isPostgresEnabled && (
                          <div className="space-y-4 animate-in fade-in-0 slide-in-from-top-2 duration-300">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                                <div>
                                    <Label htmlFor="postgres-host" className="text-card-foreground/90 text-sm">Host</Label>
                                    <Input id="postgres-host" placeholder="localhost" value={postgresHost} onChange={e => setPostgresHost(e.target.value)} className="bg-input text-foreground mt-1" />
                                </div>
                                <div>
                                    <Label htmlFor="postgres-port" className="text-card-foreground/90 text-sm">Porta</Label>
                                    <Input id="postgres-port" placeholder="5432" value={postgresPort} onChange={e => setPostgresPort(e.target.value)} className="bg-input text-foreground mt-1" />
                                </div>
                                <div>
                                    <Label htmlFor="postgres-user" className="text-card-foreground/90 text-sm">Usuário</Label>
                                    <Input id="postgres-user" placeholder="seu_usuario" value={postgresUser} onChange={e => setPostgresUser(e.target.value)} className="bg-input text-foreground mt-1" />
                                </div>
                                <div>
                                    <Label htmlFor="postgres-password" className="text-card-foreground/90 text-sm">Senha</Label>
                                     <div className="flex items-center space-x-2 mt-1">
                                        <KeyRound className="w-4 h-4 text-muted-foreground" />
                                        <Input id="postgres-password" type="password" placeholder="********" value={postgresPassword} onChange={e => setPostgresPassword(e.target.value)} className="bg-input text-foreground flex-1" />
                                     </div>
                                </div>
                                <div className="md:col-span-2">
                                    <Label htmlFor="postgres-database" className="text-card-foreground/90 text-sm">Nome do Banco</Label>
                                    <Input id="postgres-database" placeholder="nome_do_banco" value={postgresDatabase} onChange={e => setPostgresDatabase(e.target.value)} className="bg-input text-foreground mt-1" />
                                </div>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                                As configurações do PostgreSQL são para demonstração e não estão funcionalmente integradas.
                            </p>
                          </div>
                        )}
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </section>
              )}

              {activeSettingsCategory === 'integrations' && (
                 <section>
                  <h3 className="text-lg font-semibold text-card-foreground mb-4">Configurações de Integrações</h3>
                  <Accordion type="single" collapsible className="w-full space-y-4" defaultValue={isEvolutionApiEnabled ? 'evolution-api' : undefined}>
                    <AccordionItem value="evolution-api" className="border rounded-lg shadow-sm">
                      <AccordionTrigger className="px-4 py-3 hover:bg-muted/50 rounded-t-lg">
                        <div className="flex items-center space-x-3">
                          <BotMessageSquare className="w-5 h-5 text-teal-500" />
                          <span className="font-medium text-card-foreground">API Evolution (WhatsApp)</span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-4 pt-3 pb-4 border-t">
                        <div className="flex items-center space-x-2 mb-4">
                          <Switch 
                            id="enable-evolution-api" 
                            checked={isEvolutionApiEnabled} 
                            onCheckedChange={setIsEvolutionApiEnabled}
                            aria-label="Habilitar Integração API Evolution"
                          />
                          <Label htmlFor="enable-evolution-api" className="text-sm font-medium">Habilitar Integração API Evolution</Label>
                        </div>
                        {isEvolutionApiEnabled && (
                          <div className="space-y-4 animate-in fade-in-0 slide-in-from-top-2 duration-300">
                            <div>
                              <Label htmlFor="evolution-api-base-url" className="text-card-foreground/90 text-sm">URL Base da API Evolution (para enviar mensagens)</Label>
                              <Input
                                id="evolution-api-base-url"
                                placeholder="http://localhost:8080"
                                value={evolutionApiBaseUrl}
                                onChange={(e) => setEvolutionApiBaseUrl(e.target.value)}
                                className="bg-input text-foreground mt-1"
                              />
                            </div>
                             <div>
                              <Label htmlFor="default-evolution-instance-name" className="text-card-foreground/90 text-sm">Nome da Instância Padrão</Label>
                              <Input
                                id="default-evolution-instance-name"
                                placeholder="evolution_instance_padrao"
                                value={defaultEvolutionInstanceName}
                                onChange={(e) => setDefaultEvolutionInstanceName(e.target.value)}
                                className="bg-input text-foreground mt-1"
                              />
                            </div>
                            <div>
                              <Label htmlFor="evolution-api-key" className="text-card-foreground/90 text-sm">Chave de API Global da Evolution (Opcional)</Label>
                               <div className="flex items-center space-x-2 mt-1">
                                <KeyRound className="w-4 h-4 text-muted-foreground" />
                                <Input
                                    id="evolution-api-key"
                                    type="password"
                                    placeholder="Sua chave de API global, se configurada"
                                    value={evolutionGlobalApiKey}
                                    onChange={(e) => setEvolutionGlobalApiKey(e.target.value)}
                                    className="bg-input text-foreground flex-1"
                                />
                               </div>
                            </div>
                             <div className="pt-4 border-t border-border">
                                <Label className="text-card-foreground/90 text-sm font-medium">URL de Webhook do Flowise Lite (para Evolution API enviar eventos)</Label>
                                <p className="text-xs text-muted-foreground mt-1 mb-2">
                                  Configure sua instância da API Evolution para enviar eventos (webhooks) para esta URL. Os payloads recebidos serão registrados e poderão ser visualizados no console da aplicação.
                                </p>
                                <div className="flex items-center space-x-2">
                                    <Input
                                        id="flowise-webhook-url-for-evolution"
                                        type="text"
                                        value={flowiseLiteGlobalWebhookUrl}
                                        readOnly
                                        className="bg-input text-foreground flex-1 cursor-default break-all"
                                    />
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        onClick={() => handleCopyToClipboard(flowiseLiteGlobalWebhookUrl, "URL de Webhook")}
                                        title="Copiar URL de Webhook"
                                    >
                                        <Copy className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>
                          </div>
                        )}
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </section>
              )}
            </main>
          </div>
          
          <DialogFooter className="px-6 py-4 border-t mt-auto">
            <Button variant="outline" onClick={() => setIsSettingsDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveSettings}>Salvar Configurações</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isWebhookLogsDialogOpen} onOpenChange={setIsWebhookLogsDialogOpen}>
        <DialogContent className="sm:max-w-2xl md:max-w-3xl lg:max-w-4xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Logs de Eventos da API Evolution</DialogTitle>
            <DialogDescription>
              Webhooks recebidos no endpoint <code className="mx-1 p-0.5 text-xs bg-muted rounded-sm break-all">{flowiseLiteGlobalWebhookUrl}</code>.
              Os logs são armazenados em memória e zerados ao reiniciar o servidor.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-hidden flex flex-col py-4 space-y-2">
             <Button 
                onClick={fetchEvolutionWebhookLogs} 
                variant="outline"
                size="sm"
                className="self-start mb-2"
                disabled={isLoadingEvolutionLogs}
              >
                <RefreshCw className={cn("mr-2 h-4 w-4", isLoadingEvolutionLogs && "animate-spin")} />
                {isLoadingEvolutionLogs ? "Atualizando..." : "Atualizar Logs"}
              </Button>
            
            {evolutionLogsError && (
              <div className="p-3 bg-destructive/10 border border-destructive text-destructive rounded-md text-sm">
                <div className="flex items-center gap-2 font-medium">
                  <AlertCircle className="h-5 w-5"/> Erro ao carregar logs:
                </div>
                <p className="mt-1 text-xs">{evolutionLogsError}</p>
              </div>
            )}

            {!isLoadingEvolutionLogs && !evolutionLogsError && evolutionWebhookLogEntries.length === 0 && (
              <div className="flex-1 flex flex-col items-center justify-center text-center text-muted-foreground p-4">
                <FileText className="w-12 h-12 mb-3"/>
                <p className="text-sm">Nenhum log de webhook da API Evolution encontrado.</p>
                <p className="text-xs mt-1">Verifique se sua API Evolution está configurada para enviar webhooks para a URL correta.</p>
              </div>
            )}
            
            {!isLoadingEvolutionLogs && evolutionWebhookLogEntries.length > 0 && (
              <ScrollArea className="flex-1 border rounded-md bg-muted/30">
                <div className="p-3 space-y-3">
                  {evolutionWebhookLogEntries.map((log, index) => (
                    <details key={index} className="bg-background p-2.5 rounded shadow-sm text-xs">
                      <summary className="cursor-pointer font-medium text-foreground/80 hover:text-foreground select-none">
                        <span className="font-mono bg-muted px-1.5 py-0.5 rounded-sm text-primary/80 mr-2">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                        {log.error ? (
                            <span className="text-destructive font-semibold">Erro ao Processar Webhook</span>
                        ) : log.payload?.event ? (
                            <span className="text-accent font-semibold">{log.payload.event}</span>
                        ) : log.payload?.type ? (
                            <span className="text-accent font-semibold">{log.payload.type}</span>
                        ) : (
                            <span>Payload Recebido</span>
                        )}
                      </summary>
                      <pre className="mt-2 p-2 bg-muted rounded-sm overflow-auto text-xs text-foreground/70 max-h-60">
                        {JSON.stringify(log.payload || log.error, null, 2)}
                      </pre>
                    </details>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsWebhookLogsDialogOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default TopBar;
    
