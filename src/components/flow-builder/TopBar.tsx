
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { WorkspaceData, FlowSession } from '@/lib/types'; // Removido StartNodeTrigger se não usado aqui
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  PlusCircle, Save, Undo2, Zap, UserCircle, Settings, LogOut, CreditCard,
  Database, ChevronDown, PlugZap, BotMessageSquare, Rocket, PanelRightOpen, PanelRightClose, KeyRound, Copy,
  TerminalSquare, ListOrdered, RefreshCw, AlertCircle, FileText, Webhook as WebhookIcon, Users, Target, ZoomIn, ZoomOut
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

const ResetZoomIcon = () => ( // Adicionado um ícone simples para resetar zoom
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/>
    <path d="M7 11h8M11 7v8"/>
    <path d="M11 15a4 4 0 0 0 0-8M11 7a4 4 0 0 0 0 8"/>
    <path d="M11 11h.01"/> {/* Ponto central */}
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
  workspaceNameParam?: string; // Adicionado para logs de workspace
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
  
  const [flowiseLiteAppBaseUrl, setFlowiseLiteAppBaseUrl] = useState('');
  
  const activeWorkspace = useMemo(() => workspaces.find(ws => ws.id === activeWorkspaceId), [workspaces, activeWorkspaceId]);
  
  const evolutionWebhookUrlForCurrentFlow = useMemo(() => {
    if (flowiseLiteAppBaseUrl && activeWorkspace?.name) {
      return `${flowiseLiteAppBaseUrl}/api/evolution/workspace/${encodeURIComponent(activeWorkspace.name)}`;
    }
    return `${flowiseLiteAppBaseUrl}/api/evolution/workspace/[SELECIONE_UM_FLUXO]`;
  }, [flowiseLiteAppBaseUrl, activeWorkspace]);


  useEffect(() => {
    if (typeof window !== 'undefined') {
      setFlowiseLiteAppBaseUrl(window.location.origin);
    }
  }, []);

  useEffect(() => {
    if (isSettingsDialogOpen) {
      setSupabaseUrl(localStorage.getItem('supabaseUrl') || '');
      setSupabaseAnonKey(localStorage.getItem('supabaseAnonKey') || '');
      setSupabaseServiceKey(localStorage.getItem('supabaseServiceKey') || '');
      setIsSupabaseEnabled(localStorage.getItem('isSupabaseEnabled') === 'true');

      setPostgresHost(localStorage.getItem('postgresHost') || '');
      setPostgresPort(localStorage.getItem('postgresPort') || '5432');
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
  
  const handleGoToNodeInFlow = (session: FlowSession) => {
    if (onSwitchWorkspace && onHighlightNode && session.workspace_id && session.current_node_id) {
        onSwitchWorkspace(session.workspace_id);
        setTimeout(() => {
            onHighlightNode(session.current_node_id);
        }, 100); 
        setIsSessionsDialogOpen(false); 
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
        const textArea = document.createElement("textarea");
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
            document.execCommand('copy');
            toast({ title: `${type} Copiada!`, description: `A ${type.toLowerCase()} foi copiada para a área de transferência.` });
        } catch (err) {
            toast({ title: `Erro ao Copiar ${type}`, description: 'Não foi possível copiar. Tente manualmente.', variant: "destructive" });
            console.error('Fallback: Oops, unable to copy', err);
        }
        document.body.removeChild(textArea);
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
                  className="h-9 w-auto min-w-[calc(100vw-400px)] max-w-[180px] text-sm" // Ajuste de largura para mobile
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

           <div className="flex items-center gap-1 ml-2">
            <Button onClick={() => onZoom('out')} variant="outline" size="icon" className="h-9 w-9">
              <ZoomOut className="h-4 w-4" />
              <span className="sr-only">Diminuir Zoom</span>
            </Button>
            <Button 
              onClick={() => onZoom('reset')} 
              variant="outline" 
              size="sm" 
              className="h-9 px-2 text-xs w-[60px]"
              title="Resetar Zoom"
            >
              {Math.round(currentZoomLevel * 100)}%
            </Button>
            <Button onClick={() => onZoom('in')} variant="outline" size="icon" className="h-9 w-9">
              <ZoomIn className="h-4 w-4" />
              <span className="sr-only">Aumentar Zoom</span>
            </Button>
          </div>


          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9" // Removido hidden md:inline-flex
                aria-label="Console e Logs"
              >
                <TerminalSquare className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60"> {/* Aumentado um pouco */}
              <DropdownMenuLabel>Console e Diagnósticos</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setIsWebhookLogsDialogOpen(true)}>
                <WebhookIcon className="mr-2 h-4 w-4" />
                <span>Logs de Eventos da API Evolution</span>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setIsSessionsDialogOpen(true)}>
                <Users className="mr-2 h-4 w-4" />
                <span>Sessões Ativas</span>
              </DropdownMenuItem>
              <DropdownMenuItem disabled>
                <FileText className="mr-2 h-4 w-4" />
                <span>Logs da Aplicação</span>
                <span className="ml-auto text-xs text-muted-foreground">(Em Breve)</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          
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
                          <Label htmlFor="enable-postgres" className="text-sm font-medium">Habilitar Conexão PostgreSQL (para persistência)</Label>
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
                          <Label htmlFor="enable-supabase" className="text-sm font-medium">Habilitar Integração Supabase (para schema e teste de nós)</Label>
                        </div>
                        {isSupabaseEnabled && (
                          <div className="space-y-4 animate-in fade-in-0 slide-in-from-top-2 duration-300">
                            <div><Label htmlFor="supabase-url" className="text-card-foreground/90 text-sm">URL do Projeto Supabase</Label><Input id="supabase-url" placeholder="https://seunomeprojeto.supabase.co" value={supabaseUrl} onChange={(e) => setSupabaseUrl(e.target.value)} className="bg-input text-foreground mt-1"/></div>
                            <div><Label htmlFor="supabase-anon-key" className="text-card-foreground/90 text-sm">Chave Pública (Anon Key)</Label><div className="flex items-center space-x-2 mt-1"><KeyRound className="w-4 h-4 text-muted-foreground" /><Input id="supabase-anon-key" type="password" placeholder="eyJhbGciOi..." value={supabaseAnonKey} onChange={(e) => setSupabaseAnonKey(e.target.value)} className="bg-input text-foreground flex-1"/></div><p className="text-xs text-muted-foreground mt-1">Usada para acesso no TestChatPanel (respeitando RLS).</p></div>
                            <div><Label htmlFor="supabase-service-key" className="text-card-foreground/90 text-sm">Chave de Serviço (Service Role Key)</Label><div className="flex items-center space-x-2 mt-1"><KeyRound className="w-4 h-4 text-muted-foreground" /><Input id="supabase-service-key" type="password" placeholder="eyJhbGciOi..." value={supabaseServiceKey} onChange={(e) => setSupabaseServiceKey(e.target.value)} className="bg-input text-foreground flex-1"/></div><p className="text-xs text-muted-foreground mt-1">Usada por Server Actions para buscar schema. Mantenha em segredo.</p></div>
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
                            <div><Label htmlFor="default-evolution-instance-name" className="text-card-foreground/90 text-sm">Nome da Instância Padrão</Label><Input id="default-evolution-instance-name" placeholder="evolution_instance" value={defaultEvolutionInstanceName} onChange={(e) => setDefaultEvolutionInstanceName(e.target.value)} className="bg-input text-foreground mt-1"/></div>
                            <div><Label htmlFor="evolution-api-key" className="text-card-foreground/90 text-sm">Chave de API Global da Evolution (Opcional)</Label><div className="flex items-center space-x-2 mt-1"><KeyRound className="w-4 h-4 text-muted-foreground" /><Input id="evolution-api-key" type="password" placeholder="Sua chave de API global" value={evolutionGlobalApiKey} onChange={(e) => setEvolutionGlobalApiKey(e.target.value)} className="bg-input text-foreground flex-1"/></div></div>
                            
                            <div className="pt-4 border-t border-border space-y-2">
                              <Label className="text-card-foreground/90 text-sm font-medium">Recepção de Webhooks da API Evolution</Label>
                              <p className="text-xs text-muted-foreground mt-1 mb-2">
                                Configure a URL abaixo na sua API Evolution para o Flowise Lite receber eventos.
                                Substitua <code className="bg-muted px-1 rounded-sm text-xs">[NOME_DO_SEU_FLUXO]</code> pelo nome exato do fluxo ativo:
                                <strong className="text-primary ml-1">{activeWorkspace?.name ? encodeURIComponent(activeWorkspace.name) : "[SELECIONE_UM_FLUXO]"}</strong>.
                              </p>
                              <div className="flex items-center space-x-2">
                                <Input 
                                  id="flowise-webhook-url-for-evolution" 
                                  type="text" 
                                  value={evolutionWebhookUrlForCurrentFlow} 
                                  readOnly 
                                  className="bg-input text-foreground flex-1 cursor-default break-all"
                                />
                                <Button 
                                  variant="outline" 
                                  size="icon" 
                                  onClick={() => handleCopyToClipboard(evolutionWebhookUrlForCurrentFlow, "URL de Webhook")} 
                                  title="Copiar URL de Webhook" 
                                  className="h-9 w-9"
                                  disabled={!activeWorkspace?.name}
                                >
                                  <Copy className="w-4 h-4" />
                                </Button>
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
              Webhooks HTTP recebidos no endpoint <code className="mx-1 p-0.5 text-xs bg-muted rounded-sm break-all">{`${flowiseLiteAppBaseUrl}/api/evolution/workspace/[NOME_DO_FLUXO]`}</code>.
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
                        {(log.payload?.event || log.workspaceNameParam) && (<span className="text-accent font-semibold">{log.payload?.event || `GET para ${log.workspaceNameParam}`}</span>)}
                        {log.extractedMessage && (<span className="ml-2 text-slate-500 italic">Msg: "{log.extractedMessage.substring(0, 30)}{log.extractedMessage.length > 30 ? '...' : ''}"</span>)}
                        {log.webhook_remoteJid && (<span className="ml-2 text-blue-500 text-xs">De: {log.webhook_remoteJid}</span>)}
                      </summary>
                      <div className="mt-2 p-2 bg-muted/20 rounded-sm overflow-auto text-xs text-foreground/70 space-y-1.5">
                        {log.method && log.url && (<div><strong>Endpoint:</strong> <span className="break-all">{log.method} {log.url}</span></div>)}
                        {log.ip && (<div><strong>IP Origem:</strong> {log.ip} {log.geo?.city && `(${log.geo.city}, ${log.geo.country})`}</div>)}
                        {log.headers && (<div><strong>Headers:</strong><pre className="mt-1 p-1 bg-background/30 rounded text-xs max-h-24 overflow-y-auto">{JSON.stringify(log.headers, null, 2)}</pre></div>)}
                        <div><strong>Payload Completo:</strong>
                          <pre className="mt-1 p-1 bg-background/30 rounded text-xs max-h-60 overflow-y-auto">
                            {typeof log.payload === 'string' ? log.payload : (log.payload ? JSON.stringify(log.payload, null, 2) : 'N/A')}
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
      
      {/* Sessions Dialog */}
      <Dialog open={isSessionsDialogOpen} onOpenChange={setIsSessionsDialogOpen}>
        <DialogContent className="sm:max-w-3xl md:max-w-4xl lg:max-w-5xl xl:max-w-6xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Sessões Ativas</DialogTitle>
            <DialogDescription>
              Lista de conversas/sessões de fluxo atualmente ativas no banco de dados.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-hidden flex flex-col py-4 space-y-2">
             <Button onClick={fetchActiveSessions} variant="outline" size="sm" className="self-start mb-2 h-9" disabled={isLoadingSessions}>
              <RefreshCw className={cn("mr-2 h-4 w-4", isLoadingSessions && "animate-spin")} />
              {isLoadingSessions ? "Atualizando..." : "Atualizar Sessões"}
            </Button>
            {isLoadingSessions && <p className="text-sm text-muted-foreground text-center py-4">Carregando sessões...</p>}
            {sessionsError && (<div className="p-3 bg-destructive/10 border border-destructive text-destructive rounded-md text-sm"><div className="flex items-center gap-2 font-medium"><AlertCircle className="h-5 w-5" /> Erro ao carregar sessões:</div><p className="mt-1 text-xs">{sessionsError}</p></div>)}
            {!isLoadingSessions && !sessionsError && activeSessions.length === 0 && (
              <div className="flex-1 flex flex-col items-center justify-center text-center text-muted-foreground p-4"><Users className="w-12 h-12 mb-3" /><p className="text-sm">Nenhuma sessão ativa encontrada.</p><p className="text-xs mt-1">Interaja com um fluxo para criar uma sessão.</p></div>
            )}
            {!isLoadingSessions && activeSessions.length > 0 && (
              <ScrollArea className="flex-1 border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[200px]">ID da Sessão (Usuário)</TableHead>
                      <TableHead className="w-[150px]">ID do Fluxo</TableHead>
                      <TableHead>ID do Nó Atual</TableHead>
                      <TableHead className="w-[120px]">Aguardando</TableHead>
                      <TableHead className="w-[180px]">Última Interação</TableHead>
                      <TableHead className="w-[150px] text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeSessions.map((session) => (
                      <TableRow key={session.session_id}>
                        <TableCell className="font-medium truncate" title={session.session_id}>{session.session_id}</TableCell>
                        <TableCell className="truncate" title={session.workspace_id}>{session.workspace_id}</TableCell>
                        <TableCell className="truncate" title={session.current_node_id || undefined}>{session.current_node_id || 'N/A'}</TableCell>
                        <TableCell>{session.awaiting_input_type || 'N/A'}</TableCell>
                        <TableCell>{session.last_interaction_at ? new Date(session.last_interaction_at).toLocaleString() : 'N/A'}</TableCell>
                        <TableCell className="text-right space-x-1">
                          <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => handleViewSessionVariables(session.flow_variables)}>
                            <FileJson2 className="mr-1 h-3.5 w-3.5" /> Ver
                          </Button>
                           <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => handleGoToNodeInFlow(session)}>
                            <Target className="mr-1 h-3.5 w-3.5" /> Ir Nó
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            )}
          </div>
           <DialogFooter>
            <Button variant="outline" onClick={() => setIsSessionsDialogOpen(false)}>Fechar</Button>
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
