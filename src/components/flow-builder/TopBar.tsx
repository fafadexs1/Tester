
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { WorkspaceData, StartNodeTrigger, FlowSession } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  PlusCircle, Save, Undo2, Zap, UserCircle, Settings, LogOut, CreditCard,
  Database, ChevronDown, PlugZap, BotMessageSquare, Rocket, PanelRightOpen, PanelRightClose, KeyRound, Copy,
  TerminalSquare, ListOrdered, RefreshCw, AlertCircle, FileText, Webhook as WebhookIcon, Users
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const SupabaseIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
    <path d="M12.1721 2.00244C12.8801 1.98791 13.576 2.21863 14.1116 2.64953C14.6472 3.08043 14.9816 3.68122 15.0491 4.32663L15.0536 4.43311L15.2402 13.4907C15.2811 14.5963 14.4145 15.5223 13.3045 15.5629C12.9977 15.5745 12.6978 15.5302 12.4233 15.4326L12.1933 15.3496C11.2835 14.9872 10.7389 13.9861 10.9305 13.005L11.9976 7.54346C11.7963 7.44211 11.5823 7.36858 11.3608 7.32471L8.75981 8.00806C7.7488 8.25358 6.85304 7.43087 6.85179 6.39187C6.85091 5.69923 7.32011 5.09048 7.97152 4.89367L8.08993 4.85168L12.0001 3.56348V2.09302C12.0001 2.06352 12.0025 2.03488 12.007 2.00767L12.1721 2.00244ZM12.0001 16.8091L11.9425 16.8323C10.3604 17.5281 8.97375 18.6318 8.06805 20.0061C7.51501 20.8504 7.84881 22.0024 8.78293 22.0024H15.2172C16.1513 22.0024 16.4851 20.8504 15.9321 20.0061C15.0264 18.6318 13.6397 17.5281 12.0577 16.8323L12.0001 16.8091Z" />
  </svg>
);

const PostgresIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
    <path d="M5.10526 2H18.8947C19.9381 2 20.7895 2.82911 20.7895 3.8421V7.52631H16.6316V14.0526C16.6316 15.3461 15.5772 16.3684 14.2632 16.3684H9.73684C8.42283 16.3684 7.36842 15.3461 7.36842 14.0526V7.52631H3.21053V3.8421C3.21053 2.82911 4.06193 2 5.10526 2ZM12.5789 7.52631H16.6316V3.8421H12.5789V7.52631ZM7.36842 7.52631H11.4211V3.8421H7.36842V7.52631ZM9.73684 17.6316H14.2632C16.3051 17.6316 17.9474 19.2293 17.9474 21.2105C17.9474 21.6453 17.6047 22 17.1579 22H6.84211C6.39526 22 6.05263 21.6453 6.05263 21.2105C6.05263 19.2293 7.69491 17.6316 9.73684 17.6316ZM13.7368 11.2105H10.2632C9.91571 11.2105 9.73684 11.0373 9.73684 10.7895C9.73684 10.5416 9.71571 10.3684 10.2632 10.3684H13.7368C14.0843 10.3684 14.2632 10.5416 14.2632 10.7895C14.2632 11.0373 14.0843 11.2105 13.7368 11.2105Z" />
  </svg>
);

const ResetZoomIcon = () => ( // Manter este se for usado
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-4 h-4">
    <path d="M7.99999 2.66667C6.07999 2.66667 4.24666 3.40001 2.92666 4.72001L2.66666 5.00001L3.66666 6.00001L4.79332 4.87334C5.77999 3.89334 7.09999 3.33334 8.49999 3.33334C9.63332 3.33334 10.7133 3.68001 11.5867 4.34001C12.48 5.01334 13.1067 5.93334 13.3 6.94667L13.3333 7.33334H12C11.8233 7.33334 11.6533 7.26001 11.5267 7.13334C11.4 7.00667 11.3267 6.83667 11.3267 6.66001L11.3333 6.66667C11.06 5.76001 10.4267 4.99334 9.58666 4.50667C8.74666 4.02001 7.76666 3.84667 6.83332 4.02001C5.89332 4.18667 5.03999 4.68667 4.40666 5.43334L2.66666 7.17334V2.66667H7.99999Z" fill="currentColor" />
    <path d="M7.99999 13.3333C9.91999 13.3333 11.7533 12.6 13.0733 11.28L13.3333 11L12.3333 10L11.2067 11.1267C10.22 12.1067 8.90002 12.6667 7.50002 12.6667C6.36669 12.6667 5.28669 12.32 4.41335 11.66C3.52002 10.9867 2.89335 10.0667 2.70002 9.05333L2.66669 8.66666H4.00002C4.17669 8.66666 4.34669 8.74 4.47335 8.86666C4.60002 8.99333 4.67335 9.16333 4.67335 9.34L4.66669 9.33333C4.94002 10.24 5.57335 11.0067 6.41335 11.4933C7.25335 11.98 8.23335 12.1533 9.16669 11.98C10.1067 11.8133 10.96 11.3133 11.5933 10.5667L13.3333 8.82666V13.3333H7.99999Z" fill="currentColor" />
  </svg>
);

type SettingsCategory = 'database' | 'integrations';
interface WebhookLogEntry {
  timestamp: string;
  method?: string;
  url?: string;
  headers?: Record<string, string>;
  payload?: any;
  ip?: string;
  geo?: any;
  extractedMessage?: string | null;
  webhook_remoteJid?: string | null;
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
  onZoom: (direction: 'in' | 'out' | 'reset') => void;
  currentZoomLevel: number;
  onHighlightNode: (nodeId: string | null) => void; 
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
  onZoom,
  currentZoomLevel,
  onHighlightNode
}) => {
  const { toast } = useToast();
  const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false);
  const [activeSettingsCategory, setActiveSettingsCategory] = useState<SettingsCategory>('database');

  const [isWebhookLogsDialogOpen, setIsWebhookLogsDialogOpen] = useState(false);
  const [evolutionWebhookLogEntries, setEvolutionWebhookLogEntries] = useState<WebhookLogEntry[]>([]);
  const [isLoadingEvolutionLogs, setIsLoadingEvolutionLogs] = useState(false);
  const [evolutionLogsError, setEvolutionLogsError] = useState<string | null>(null);
  
  const [isSessionsDialogOpen, setIsSessionsDialogOpen] = useState(false);
  const [activeSessions, setActiveSessions] = useState<FlowSession[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [sessionsError, setSessionsError] = useState<string | null>(null);
  const [selectedSessionVariables, setSelectedSessionVariables] = useState<Record<string, any> | null>(null);
  const [isSessionVariablesModalOpen, setIsSessionVariablesModalOpen] = useState(false);

  // Supabase States
  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [supabaseAnonKey, setSupabaseAnonKey] = useState('');
  const [supabaseServiceKey, setSupabaseServiceKey] = useState('');
  const [isSupabaseEnabled, setIsSupabaseEnabled] = useState(false);

  // PostgreSQL States
  const [postgresHost, setPostgresHost] = useState('');
  const [postgresPort, setPostgresPort] = useState('');
  const [postgresUser, setPostgresUser] = useState('');
  const [postgresPassword, setPostgresPassword] = useState('');
  const [postgresDatabase, setPostgresDatabase] = useState('');
  const [isPostgresEnabled, setIsPostgresEnabled] = useState(false);
  const [postgresSsl, setPostgresSsl] = useState(false);


  // Evolution API States
  const [evolutionApiBaseUrl, setEvolutionApiBaseUrl] = useState('');
  const [evolutionGlobalApiKey, setEvolutionGlobalApiKey] = useState('');
  const [defaultEvolutionInstanceName, setDefaultEvolutionInstanceName] = useState('');
  const [isEvolutionApiEnabled, setIsEvolutionApiEnabled] = useState(false);
  const [flowiseLiteGlobalWebhookUrl, setFlowiseLiteGlobalWebhookUrl] = useState('');
  
  const activeWorkspace = useMemo(() => workspaces.find(ws => ws.id === activeWorkspaceId), [workspaces, activeWorkspaceId]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setFlowiseLiteGlobalWebhookUrl(`${window.location.origin}/api/evolution/workspace`);
    }
  }, []);

  useEffect(() => {
    if (isSettingsDialogOpen) {
      setSupabaseUrl(localStorage.getItem('supabaseUrl') || '');
      setSupabaseAnonKey(localStorage.getItem('supabaseAnonKey') || '');
      setSupabaseServiceKey(localStorage.getItem('supabaseServiceKey') || '');
      setIsSupabaseEnabled(localStorage.getItem('isSupabaseEnabled') === 'true');

      setPostgresHost(localStorage.getItem('postgresHost') || '');
      setPostgresPort(localStorage.getItem('postgresPort') || '');
      setPostgresUser(localStorage.getItem('postgresUser') || '');
      setPostgresPassword(localStorage.getItem('postgresPassword') || '');
      setPostgresDatabase(localStorage.getItem('postgresDatabase') || '');
      setIsPostgresEnabled(localStorage.getItem('isPostgresEnabled') === 'true');
      setPostgresSsl(localStorage.getItem('postgresSsl') === 'true');

      setEvolutionApiBaseUrl(localStorage.getItem('evolutionApiBaseUrl') || '');
      setEvolutionGlobalApiKey(localStorage.getItem('evolutionApiKey') || '');
      setDefaultEvolutionInstanceName(localStorage.getItem('defaultEvolutionInstanceName') || '');
      setIsEvolutionApiEnabled(localStorage.getItem('isEvolutionApiEnabled') === 'true');
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
    localStorage.setItem('postgresSsl', String(postgresSsl));

    localStorage.setItem('evolutionApiBaseUrl', evolutionApiBaseUrl);
    localStorage.setItem('evolutionApiKey', evolutionGlobalApiKey);
    localStorage.setItem('defaultEvolutionInstanceName', defaultEvolutionInstanceName);
    localStorage.setItem('isEvolutionApiEnabled', String(isEvolutionApiEnabled));

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
    const currentWorkspaceToPublish = workspaces.find(ws => ws.id === activeWorkspaceId);
    toast({
      title: "Publicar Fluxo (Simulado)",
      description: `O fluxo "${currentWorkspaceToPublish?.name || 'Selecionado'}" seria colocado em produção.`,
      variant: "default",
    });
  };

  const fetchEvolutionWebhookLogs = useCallback(async () => {
    setIsLoadingEvolutionLogs(true);
    setEvolutionLogsError(null);
    try {
      const response = await fetch('/api/evolution/webhook-logs');
      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Erro ao buscar logs: ${response.status} - ${errorData}`);
      }
      const data: WebhookLogEntry[] = await response.json();
      setEvolutionWebhookLogEntries(data);
    } catch (error: any) {
      console.error("Erro ao buscar logs do webhook da API Evolution:", error);
      setEvolutionLogsError(error.message || "Falha ao buscar logs.");
      setEvolutionWebhookLogEntries([]);
    } finally {
      setIsLoadingEvolutionLogs(false);
    }
  }, []);

  useEffect(() => {
    if (isWebhookLogsDialogOpen) {
      fetchEvolutionWebhookLogs();
    }
  }, [isWebhookLogsDialogOpen, fetchEvolutionWebhookLogs]);

  const fetchActiveSessions = useCallback(async () => {
    setIsLoadingSessions(true);
    setSessionsError(null);
    try {
      const response = await fetch('/api/sessions/active');
      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Erro ao buscar sessões: ${response.status} - ${errorData || response.statusText}`);
      }
      const data: FlowSession[] = await response.json();
      setActiveSessions(data);
    } catch (error: any) {
      console.error("Erro ao buscar sessões ativas:", error);
      setSessionsError(error.message || "Falha ao buscar sessões ativas.");
      setActiveSessions([]);
    } finally {
      setIsLoadingSessions(false);
    }
  }, []);

  useEffect(() => {
    if (isSessionsDialogOpen) {
      fetchActiveSessions();
    }
  }, [isSessionsDialogOpen, fetchActiveSessions]);

  const handleViewSessionVariables = (variables: Record<string, any>) => {
    setSelectedSessionVariables(variables);
    setIsSessionVariablesModalOpen(true);
  };
  
  const handleGoToNode = (session: FlowSession) => {
    if (onSwitchWorkspace && onHighlightNode && session.workspace_id && session.current_node_id) {
        onSwitchWorkspace(session.workspace_id);
        onHighlightNode(session.current_node_id);
        setIsSessionsDialogOpen(false); // Fecha o diálogo de sessões
    } else {
        toast({
            title: "Informação Incompleta",
            description: "Não foi possível determinar o fluxo ou nó da sessão.",
            variant: "destructive"
        });
    }
  };

  const settingsCategories: { id: SettingsCategory; label: string; icon: React.ReactNode }[] = [
    { id: 'database', label: 'Banco de Dados', icon: <Database className="w-5 h-5 mr-2" /> },
    { id: 'integrations', label: 'Integrações', icon: <PlugZap className="w-5 h-5 mr-2" /> },
  ];

  const handleCopyToClipboard = (text: string, type: string) => {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        navigator.clipboard.writeText(text).then(() => {
          toast({ title: `${type} Copiada!`, description: `A ${type.toLowerCase()} foi copiada para a área de transferência.` });
        }).catch(err => {
          toast({ title: `Erro ao Copiar ${type}`, description: `Não foi possível copiar a ${type.toLowerCase()}.`, variant: "destructive" });
          console.error(`Erro ao copiar ${type}: `, err);
        });
    } else {
        toast({
            title: "Erro ao Copiar",
            description: "Copiar para a área de transferência não é suportado ou permitido neste navegador/contexto.",
            variant: "destructive"
        });
    }
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
                className="hidden md:inline-flex h-9 w-9"
                aria-label="Console e Logs"
              >
                <TerminalSquare className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Console e Logs</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setIsWebhookLogsDialogOpen(true)}>
                <WebhookIcon className="mr-2 h-4 w-4" />
                <span>Logs Webhook Evolution</span>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setIsSessionsDialogOpen(true)}>
                <Users className="mr-2 h-4 w-4" />
                <span>Sessões Ativas</span>
              </DropdownMenuItem>
              <DropdownMenuItem disabled>
                <FileText className="mr-2 h-4 w-4" />
                <span>Logs de Execução do Fluxo</span>
                <span className="ml-auto text-xs text-muted-foreground">(Em Breve)</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          
          {/* Removidos botões de zoom conforme solicitado anteriormente */}

          <Button
            onClick={handlePublishFlow}
            variant="default"
            size="sm"
            className="bg-teal-600 hover:bg-teal-700 text-white hidden md:inline-flex h-9"
            disabled={!activeWorkspaceId}
          >
            <Rocket className="mr-2 h-4 w-4" /> Publicar
          </Button>
          <Button
            onClick={handlePublishFlow}
            variant="default"
            size="icon"
            className="bg-teal-600 hover:bg-teal-700 text-white md:hidden h-9 w-9"
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
            className="hidden md:inline-flex h-9"
          >
            <Save className="mr-2 h-4 w-4" /> Salvar
          </Button>
          <Button
            onClick={onSaveWorkspaces}
            variant="outline"
            size="icon"
            disabled={!activeWorkspaceId}
            className="md:hidden h-9 w-9"
            aria-label="Salvar Fluxos"
          >
            <Save className="h-4 w-4" />
          </Button>

          <Button
            onClick={onDiscardChanges}
            variant="destructive"
            size="sm"
            disabled={!activeWorkspaceId}
            className="hidden md:inline-flex h-9"
          >
            <Undo2 className="mr-2 h-4 w-4" /> Descartar
          </Button>
          <Button
            onClick={onDiscardChanges}
            variant="destructive"
            size="icon"
            disabled={!activeWorkspaceId}
            className="md:hidden h-9 w-9"
            aria-label="Descartar Alterações"
          >
            <Undo2 className="h-4 w-4" />
          </Button>

          <Button
            onClick={onToggleChatPanel}
            variant="outline"
            size="icon"
            aria-label={isChatPanelOpen ? "Fechar painel de chat" : "Abrir painel de chat"}
            className="ml-1 md:ml-2 h-9 w-9"
          >
            {isChatPanelOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full ml-1 md:ml-2 h-9 w-9">
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
                <span>Configurações Globais</span>
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

      {/* Settings Dialog */}
      <Dialog open={isSettingsDialogOpen} onOpenChange={setIsSettingsDialogOpen}>
        <DialogContent className="sm:max-w-2xl md:max-w-3xl lg:max-w-4xl xl:max-w-5xl bg-card max-h-[85vh] flex flex-col p-0">
          <DialogHeader className="px-6 py-4 border-b">
            <DialogTitle className="text-xl">Configurações Globais</DialogTitle>
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
                  <h3 className="text-lg font-semibold text-card-foreground mb-4">Configuração do Banco de Dados</h3>
                  <Accordion type="single" collapsible className="w-full space-y-4" defaultValue={isPostgresEnabled ? 'postgresql' : (isSupabaseEnabled ? 'supabase' : undefined) }>
                    <AccordionItem value="postgresql" className="border rounded-lg shadow-sm">
                      <AccordionTrigger className="px-4 py-3 hover:bg-muted/50 rounded-t-lg">
                        <div className="flex items-center space-x-3"><PostgresIcon /><span className="font-medium text-card-foreground">PostgreSQL</span></div>
                      </AccordionTrigger>
                      <AccordionContent className="px-4 pt-3 pb-4 border-t">
                        <div className="flex items-center space-x-2 mb-4">
                          <Switch id="enable-postgres" checked={isPostgresEnabled} onCheckedChange={setIsPostgresEnabled} aria-label="Habilitar Conexão PostgreSQL"/>
                          <Label htmlFor="enable-postgres" className="text-sm font-medium">Habilitar Conexão PostgreSQL (para persistência de fluxos/sessões)</Label>
                        </div>
                        {isPostgresEnabled && (
                          <div className="space-y-3 animate-in fade-in-0 slide-in-from-top-2 duration-300">
                            <p className="text-xs text-muted-foreground">As credenciais de conexão são gerenciadas via variáveis de ambiente (arquivo `.env`). Os campos abaixo são apenas para sua referência.</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                              <div><Label htmlFor="postgres-host" className="text-card-foreground/90 text-sm">Host (Ref: POSTGRES_HOST)</Label><Input id="postgres-host" placeholder="localhost" value={postgresHost} onChange={e => setPostgresHost(e.target.value)} className="bg-input text-foreground mt-1"/></div>
                              <div><Label htmlFor="postgres-port" className="text-card-foreground/90 text-sm">Porta (Ref: POSTGRES_PORT)</Label><Input id="postgres-port" placeholder="5432" value={postgresPort} onChange={e => setPostgresPort(e.target.value)} className="bg-input text-foreground mt-1"/></div>
                              <div><Label htmlFor="postgres-user" className="text-card-foreground/90 text-sm">Usuário (Ref: POSTGRES_USER)</Label><Input id="postgres-user" placeholder="seu_usuario" value={postgresUser} onChange={e => setPostgresUser(e.target.value)} className="bg-input text-foreground mt-1"/></div>
                              <div><Label htmlFor="postgres-db" className="text-card-foreground/90 text-sm">Banco (Ref: POSTGRES_DATABASE)</Label><Input id="postgres-db" placeholder="flowise_lite_db" value={postgresDatabase} onChange={e => setPostgresDatabase(e.target.value)} className="bg-input text-foreground mt-1"/></div>
                              <div className="md:col-span-2"><Label htmlFor="postgres-password" className="text-card-foreground/90 text-sm">Senha (Ref: POSTGRES_PASSWORD)</Label><div className="flex items-center space-x-2 mt-1"><KeyRound className="w-4 h-4 text-muted-foreground" /><Input id="postgres-password" type="password" placeholder="********" value={postgresPassword} onChange={e => setPostgresPassword(e.target.value)} className="bg-input text-foreground flex-1"/></div></div>
                              <div className="flex items-center space-x-2">
                                <Switch id="postgres-ssl" checked={postgresSsl} onCheckedChange={setPostgresSsl} />
                                <Label htmlFor="postgres-ssl" className="text-sm">Usar SSL (Ref: POSTGRES_SSL=true)</Label>
                              </div>
                            </div>
                          </div>
                        )}
                      </AccordionContent>
                    </AccordionItem>
                     <AccordionItem value="supabase" className="border rounded-lg shadow-sm">
                      <AccordionTrigger className="px-4 py-3 hover:bg-muted/50 rounded-t-lg">
                        <div className="flex items-center space-x-3">
                          <SupabaseIcon />
                          <span className="font-medium text-card-foreground">Supabase</span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-4 pt-3 pb-4 border-t">
                        <div className="flex items-center space-x-2 mb-4">
                          <Switch id="enable-supabase" checked={isSupabaseEnabled} onCheckedChange={setIsSupabaseEnabled} aria-label="Habilitar Integração Supabase"/>
                          <Label htmlFor="enable-supabase" className="text-sm font-medium">Habilitar Integração Supabase (para buscar schema)</Label>
                        </div>
                        {isSupabaseEnabled && (
                          <div className="space-y-4 animate-in fade-in-0 slide-in-from-top-2 duration-300">
                            <div><Label htmlFor="supabase-url" className="text-card-foreground/90 text-sm">URL do Projeto Supabase</Label><Input id="supabase-url" placeholder="https://seunomeprojeto.supabase.co" value={supabaseUrl} onChange={(e) => setSupabaseUrl(e.target.value)} className="bg-input text-foreground mt-1"/></div>
                            <div><Label htmlFor="supabase-anon-key" className="text-card-foreground/90 text-sm">Chave Pública (Anon Key)</Label><div className="flex items-center space-x-2 mt-1"><KeyRound className="w-4 h-4 text-muted-foreground" /><Input id="supabase-anon-key" type="password" placeholder="eyJhbGciOi..." value={supabaseAnonKey} onChange={(e) => setSupabaseAnonKey(e.target.value)} className="bg-input text-foreground flex-1"/></div><p className="text-xs text-muted-foreground mt-1">Usada para acesso no lado do cliente (ex: TestChatPanel), respeitando RLS.</p></div>
                            <div><Label htmlFor="supabase-service-key" className="text-card-foreground/90 text-sm">Chave de Serviço (Service Role Key)</Label><div className="flex items-center space-x-2 mt-1"><KeyRound className="w-4 h-4 text-muted-foreground" /><Input id="supabase-service-key" type="password" placeholder="eyJhbGciOi..." value={supabaseServiceKey} onChange={(e) => setSupabaseServiceKey(e.target.value)} className="bg-input text-foreground flex-1"/></div><p className="text-xs text-muted-foreground mt-1">Usada por Server Actions para buscar schema (tabelas/colunas). Mantenha em segredo.</p></div>
                          </div>
                        )}
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </section>
              )}
              {activeSettingsCategory === 'integrations' && (
                <section>
                  <h3 className="text-lg font-semibold text-card-foreground mb-4">Integrações de Plataformas</h3>
                  <Accordion type="single" collapsible className="w-full space-y-4" defaultValue={isEvolutionApiEnabled ? 'evolution-api' : undefined}>
                    <AccordionItem value="evolution-api" className="border rounded-lg shadow-sm">
                      <AccordionTrigger className="px-4 py-3 hover:bg-muted/50 rounded-t-lg">
                        <div className="flex items-center space-x-3"><BotMessageSquare className="w-5 h-5 text-teal-500" /><span className="font-medium text-card-foreground">API Evolution (WhatsApp)</span></div>
                      </AccordionTrigger>
                      <AccordionContent className="px-4 pt-3 pb-4 border-t">
                        <div className="flex items-center space-x-2 mb-4">
                          <Switch id="enable-evolution-api" checked={isEvolutionApiEnabled} onCheckedChange={setIsEvolutionApiEnabled} aria-label="Habilitar Integração API Evolution"/>
                          <Label htmlFor="enable-evolution-api" className="text-sm font-medium">Habilitar Integração API Evolution</Label>
                        </div>
                        {isEvolutionApiEnabled && (
                          <div className="space-y-4 animate-in fade-in-0 slide-in-from-top-2 duration-300">
                            <div><Label htmlFor="evolution-api-base-url" className="text-card-foreground/90 text-sm">URL Base da API Evolution (para enviar mensagens)</Label><Input id="evolution-api-base-url" placeholder="http://localhost:8080" value={evolutionApiBaseUrl} onChange={(e) => setEvolutionApiBaseUrl(e.target.value)} className="bg-input text-foreground mt-1"/></div>
                            <div><Label htmlFor="default-evolution-instance-name" className="text-card-foreground/90 text-sm">Nome da Instância Padrão (Opcional)</Label><Input id="default-evolution-instance-name" placeholder="evolution_instance" value={defaultEvolutionInstanceName} onChange={(e) => setDefaultEvolutionInstanceName(e.target.value)} className="bg-input text-foreground mt-1"/></div>
                            <div><Label htmlFor="evolution-api-key" className="text-card-foreground/90 text-sm">Chave de API Global da Evolution (Opcional)</Label><div className="flex items-center space-x-2 mt-1"><KeyRound className="w-4 h-4 text-muted-foreground" /><Input id="evolution-api-key" type="password" placeholder="Sua chave de API global, se configurada" value={evolutionGlobalApiKey} onChange={(e) => setEvolutionGlobalApiKey(e.target.value)} className="bg-input text-foreground flex-1"/></div></div>
                            <div className="pt-4 border-t border-border space-y-2">
                              <Label className="text-card-foreground/90 text-sm font-medium">Recepção de Webhooks da API Evolution</Label>
                              <p className="text-xs text-muted-foreground mt-1 mb-2">Configure a URL abaixo na sua instância da API Evolution para que o Flowise Lite receba eventos (ex: novas mensagens). Substitua `[NOME_DO_SEU_FLUXO]` pelo nome exato do seu fluxo (workspace), codificado para URL se necessário (ex: `Meu%20Fluxo`).</p>
                              <div className="flex items-center space-x-2">
                                <Input id="flowise-webhook-url-for-evolution" type="text" value={`${flowiseLiteGlobalWebhookUrl}/[NOME_DO_SEU_FLUXO]`} readOnly className="bg-input text-foreground flex-1 cursor-default break-all"/>
                                <Button variant="outline" size="icon" onClick={() => handleCopyToClipboard(`${flowiseLiteGlobalWebhookUrl}/[NOME_DO_SEU_FLUXO]`, "URL de Webhook Exemplo")} title="Copiar URL de Webhook Exemplo" className="h-9 w-9"><Copy className="w-4 h-4" /></Button>
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">Payloads recebidos são logados no console do servidor e visíveis no "Console" do app.</p>
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
            <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
            <Button onClick={handleSaveSettings}>Salvar Configurações</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Webhook Logs Dialog */}
      <Dialog open={isWebhookLogsDialogOpen} onOpenChange={setIsWebhookLogsDialogOpen}>
        <DialogContent className="sm:max-w-3xl md:max-w-4xl lg:max-w-5xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Logs de Eventos da API Evolution</DialogTitle>
            <DialogDescription>
              Webhooks HTTP recebidos no endpoint <code className="mx-1 p-0.5 text-xs bg-muted rounded-sm break-all">{flowiseLiteGlobalWebhookUrl}/[NOME_DO_FLUXO]</code>.
              Os logs são armazenados em memória no servidor (máx. 50) e zerados ao reiniciar.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-hidden flex flex-col py-4 space-y-2">
            <Button onClick={fetchEvolutionWebhookLogs} variant="outline" size="sm" className="self-start mb-2 h-9" disabled={isLoadingEvolutionLogs}>
              <RefreshCw className={cn("mr-2 h-4 w-4", isLoadingEvolutionLogs && "animate-spin")} />
              {isLoadingEvolutionLogs ? "Atualizando..." : "Atualizar Logs"}
            </Button>
            {isLoadingEvolutionLogs && <p className="text-sm text-muted-foreground text-center py-4">Carregando logs...</p>}
            {evolutionLogsError && (<div className="p-3 bg-destructive/10 border border-destructive text-destructive rounded-md text-sm"><div className="flex items-center gap-2 font-medium"><AlertCircle className="h-5 w-5" /> Erro ao carregar logs:</div><p className="mt-1 text-xs">{evolutionLogsError}</p></div>)}
            {!isLoadingEvolutionLogs && !evolutionLogsError && evolutionWebhookLogEntries.length === 0 && (
              <div className="flex-1 flex flex-col items-center justify-center text-center text-muted-foreground p-4"><FileText className="w-12 h-12 mb-3" /><p className="text-sm">Nenhum log de webhook da API Evolution encontrado.</p><p className="text-xs mt-1">Verifique sua API Evolution e o endpoint de webhook.</p></div>
            )}
            {!isLoadingEvolutionLogs && evolutionWebhookLogEntries.length > 0 && (
              <ScrollArea className="flex-1 border rounded-md bg-muted/30">
                <div className="p-3 space-y-3">
                  {evolutionWebhookLogEntries.map((log, index) => (
                    <details key={index} className="bg-background p-2.5 rounded shadow-sm text-xs">
                      <summary className="cursor-pointer font-medium text-foreground/80 hover:text-foreground select-none">
                        <span className="font-mono bg-muted px-1.5 py-0.5 rounded-sm text-primary/80 mr-2">{new Date(log.timestamp).toLocaleTimeString()}</span>
                        <span className="font-semibold mr-1">{log.method || (log.payload?.event ? '' : 'Evento Desconhecido')}</span>
                        {log.payload?.event && (<span className="text-accent font-semibold">{log.payload.event}</span>)}
                        {log.extractedMessage && (<span className="ml-2 text-slate-500 italic">Msg: "{log.extractedMessage.substring(0, 30)}{log.extractedMessage.length > 30 ? '...' : ''}"</span>)}
                        {log.webhook_remoteJid && (<span className="ml-2 text-blue-500 text-xs">De: {log.webhook_remoteJid}</span>)}
                      </summary>
                      <div className="mt-2 p-2 bg-muted/20 rounded-sm overflow-auto text-xs text-foreground/70 space-y-1.5">
                        {log.method && log.url && (<div><strong>Endpoint:</strong> {log.method} {log.url}</div>)}
                        {log.ip && (<div><strong>IP Origem:</strong> {log.ip} {log.geo?.city && `(${log.geo.city}, ${log.geo.country})`}</div>)}
                        {log.headers && (<div><strong>Headers:</strong><pre className="mt-1 p-1 bg-background/30 rounded text-xs max-h-24 overflow-y-auto">{JSON.stringify(log.headers, null, 2)}</pre></div>)}
                        <div><strong>Payload Completo:</strong>
                          <pre className="mt-1 p-1 bg-background/30 rounded text-xs max-h-60 overflow-y-auto">
                            {log.payload && typeof log.payload === 'object' ? JSON.stringify(log.payload, null, 2) : String(log.payload)}
                          </pre>
                        </div>
                      </div>
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

       {/* Session Variables Modal */}
      <Dialog open={isSessionVariablesModalOpen} onOpenChange={setIsSessionVariablesModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Variáveis da Sessão</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] mt-4">
            <pre className="text-xs bg-muted p-3 rounded-md whitespace-pre-wrap break-all">
              {selectedSessionVariables ? JSON.stringify(selectedSessionVariables, null, 2) : 'Nenhuma variável para exibir.'}
            </pre>
          </ScrollArea>
          <DialogFooter className="mt-4">
            <DialogClose asChild>
              <Button type="button" variant="secondary">Fechar</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default TopBar;


    