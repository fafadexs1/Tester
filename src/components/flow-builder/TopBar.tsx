
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { WorkspaceData, FlowSession, EvolutionInstance } from '@/lib/types';
import { Button } from '@/components/ui/button';
import {
  Save, Undo2, Zap, UserCircle, Settings, LogOut, CreditCard,
  Database, ChevronDown, PlugZap, BotMessageSquare, Rocket, PanelRightOpen, PanelRightClose, KeyRound, Copy, FileJson2,
  TerminalSquare, ListOrdered, RefreshCw, AlertCircle, FileText, Webhook as WebhookIcon, Users, Target, ZoomIn, ZoomOut, Trash2, Home, ChevronsLeft, CircleDot, Circle, Cloud, CloudOff, Loader2, PlusCircle, Shield
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
import { useAuth } from '@/components/auth/AuthProvider';
import Link from 'next/link';
import { v4 as uuidv4 } from 'uuid';
import { checkEvolutionInstanceStatus } from '@/app/actions/evolutionApiActions';

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

type SettingsCategory = 'integrations';
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
  workspaceNameParam?: string;
}

interface TopBarProps {
  workspaceName: string;
  onSaveWorkspaces: () => void;
  onDiscardChanges: () => void;
  onUpdateWorkspaceName: (newName: string, newSettings?: Partial<WorkspaceData>) => void;
  isChatPanelOpen: boolean;
  onToggleChatPanel: () => void;
  onZoom: (direction: 'in' | 'out' | 'reset') => void;
  currentZoomLevel: number;
  onHighlightNode: (nodeId: string | null) => void;
  activeWorkspace: WorkspaceData | null | undefined;
}

const TopBar: React.FC<TopBarProps> = ({
  workspaceName,
  onSaveWorkspaces,
  onDiscardChanges,
  onUpdateWorkspaceName,
  isChatPanelOpen,
  onToggleChatPanel,
  onZoom,
  currentZoomLevel,
  onHighlightNode,
  activeWorkspace
}) => {
  const { toast } = useToast();
  const { user, logout } = useAuth();
  const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false);
  
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
  
  const [nexusFlowAppBaseUrl, setNexusFlowAppBaseUrl] = useState('');
  
  const evolutionWebhookUrlForCurrentFlow = useMemo(() => {
    const baseUrl = nexusFlowAppBaseUrl || (typeof window !== 'undefined' ? window.location.origin : '');
    const webhookId = activeWorkspace?.id || '[ID_DO_FLUXO]';
    if (baseUrl) {
      return `${baseUrl}/api/evolution/trigger/${webhookId}`;
    }
    return `[URL_BASE]/api/evolution/trigger/${webhookId}`;
  }, [nexusFlowAppBaseUrl, activeWorkspace?.id]);


  useEffect(() => {
    if (typeof window !== 'undefined') {
      setNexusFlowAppBaseUrl(window.location.origin);
    }
  }, []);

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

  const handleDeleteSession = async (sessionId: string) => {
    try {
      const response = await fetch(`/api/sessions/active?sessionId=${sessionId}`, {
        method: 'DELETE',
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || `Failed to delete session ${sessionId}`);
      }
      toast({
        title: "Sessão Encerrada",
        description: `A sessão ${sessionId} foi encerrada com sucesso.`,
      });
      fetchActiveSessions(); 
    } catch (error: any) {
      toast({
        title: "Erro ao Encerrar Sessão",
        description: error.message,
        variant: "destructive",
      });
    }
  };


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
    if (onHighlightNode && session.current_node_id) {
        if (session.workspace_id !== activeWorkspace?.id) {
            toast({
                title: "Ação Interrompida",
                description: "Esta sessão pertence a um fluxo diferente do que está aberto.",
                variant: "destructive"
            });
            return;
        }
        onHighlightNode(session.current_node_id);
        setIsSessionsDialogOpen(false); 
    } else {
        toast({
            title: "Informação Incompleta",
            description: "Não foi possível determinar o nó da sessão.",
            variant: "destructive"
        });
    }
  };

  const handleCopyToClipboard = (e: React.MouseEvent<HTMLButtonElement>, text: string, type: string) => {
    e.preventDefault();
    e.stopPropagation();
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
            <Link href="/" className='flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors'>
                <ChevronsLeft className='w-5 h-5' />
                <Home className="w-5 h-5" />
            </Link>
          <div className='w-px h-6 bg-border mx-2'></div>
          <Input 
            className="text-lg font-semibold tracking-tight text-foreground whitespace-nowrap bg-transparent border-0 focus-visible:ring-0 focus-visible:ring-offset-0 p-0 h-auto"
            value={workspaceName}
            onChange={(e) => onUpdateWorkspaceName(e.target.value)}
            disabled={!activeWorkspace}
          />
           <Button
            onClick={() => setIsSettingsDialogOpen(true)}
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground"
            disabled={!activeWorkspace}
            title="Configurações do Fluxo"
          >
            <Settings className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex items-center gap-1 md:gap-2">
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
                className="h-9 w-9"
                aria-label="Console e Logs"
              >
                <TerminalSquare className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
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
              <DropdownMenuItem onSelect={() => { console.log("Frontend logs can be viewed in the browser's developer console (F12)."); toast({title: "Logs do Frontend", description: "Logs de erro e de depuração do frontend podem ser vistos no console do seu navegador (geralmente F12)."}); }}>
                <FileText className="mr-2 h-4 w-4" />
                <span>Logs da Aplicação</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          
          <Button
            onClick={onSaveWorkspaces}
            variant="default"
            size="sm"
            className="bg-accent hover:bg-accent/90 text-accent-foreground hidden md:inline-flex h-9"
            disabled={!activeWorkspace}
          >
            <Rocket className="mr-2 h-4 w-4" /> Publicar
          </Button>

          <Button
            onClick={onSaveWorkspaces}
            variant="secondary"
            size="sm"
            disabled={!activeWorkspace}
            className="hidden md:inline-flex h-9"
          >
            <Save className="mr-2 h-4 w-4" /> Salvar
          </Button>

          <Button
            onClick={onDiscardChanges}
            variant="ghost"
            size="sm"
            disabled={!activeWorkspace}
            className="hidden text-muted-foreground hover:text-destructive-foreground hover:bg-destructive/90 md:inline-flex h-9"
          >
            <Undo2 className="mr-2 h-4 w-4" /> Descartar
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
                  <AvatarImage src="https://placehold.co/40x40.png?text=UE" alt={user?.username} data-ai-hint="user avatar"/>
                  <AvatarFallback>{user?.username?.substring(0,2).toUpperCase() || 'U'}</AvatarFallback>
                </Avatar>
                <span className="sr-only">Abrir menu do usuário</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>{user?.username || 'Minha Conta'}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <Link href="/profile" passHref>
                <DropdownMenuItem>
                    <UserCircle className="mr-2 h-4 w-4" />
                    <span>Perfil</span>
                </DropdownMenuItem>
              </Link>
              <DropdownMenuItem onSelect={() => setIsSettingsDialogOpen(true)}>
                <Settings className="mr-2 h-4 w-4" />
                <span>Configurações do Fluxo</span>
              </DropdownMenuItem>
              {user?.role === 'desenvolvedor' && (
                <Link href="/admin" passHref>
                    <DropdownMenuItem>
                        <Shield className="mr-2 h-4 w-4" />
                        <span>Administração</span>
                    </DropdownMenuItem>
                </Link>
              )}
              <DropdownMenuItem disabled>
                <CreditCard className="mr-2 h-4 w-4" />
                <span>Assinatura</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={logout}>
                <LogOut className="mr-2 h-4 w-4" />
                <span>Sair</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Workspace Settings Dialog */}
      <Dialog open={isSettingsDialogOpen} onOpenChange={setIsSettingsDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Configurações do Fluxo: {workspaceName}</DialogTitle>
            <DialogDescription>
              Ajustes específicos para este fluxo de trabalho.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-6">
            <Accordion type="single" collapsible className="w-full" defaultValue="evolution-api">
              <AccordionItem value="evolution-api">
                <AccordionTrigger className="font-semibold">
                  <div className="flex items-center gap-2">
                    <BotMessageSquare className="w-5 h-5 text-teal-500" />
                    API Evolution (WhatsApp)
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pt-4 space-y-4">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="enable-evolution-api"
                      checked={activeWorkspace?.evolution_api_enabled}
                      onCheckedChange={(checked) => onUpdateWorkspaceName(activeWorkspace?.name || '', { evolution_api_enabled: checked })}
                      aria-label="Habilitar Integração API Evolution"
                    />
                    <Label htmlFor="enable-evolution-api">Habilitar para este fluxo</Label>
                  </div>
                  {activeWorkspace?.evolution_api_enabled && (
                    <div className="space-y-3 pl-2 border-l-2 ml-2">
                      <div>
                        <Label htmlFor="evolution_api_url">URL Base</Label>
                        <Input
                          id="evolution_api_url"
                          placeholder="http://localhost:8080"
                          value={activeWorkspace?.evolution_api_url || ''}
                          onChange={(e) => onUpdateWorkspaceName(activeWorkspace?.name || '', { evolution_api_url: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="evolution_instance_name">Nome da Instância</Label>
                        <Input
                          id="evolution_instance_name"
                          placeholder="evolution_instance"
                          value={activeWorkspace?.evolution_instance_name || ''}
                          onChange={(e) => onUpdateWorkspaceName(activeWorkspace?.name || '', { evolution_instance_name: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="evolution_api_key">Chave da API (Opcional)</Label>
                        <Input
                          id="evolution_api_key"
                          type="password"
                          placeholder="Sua chave de API secreta"
                          value={activeWorkspace?.evolution_api_key || ''}
                          onChange={(e) => onUpdateWorkspaceName(activeWorkspace?.name || '', { evolution_api_key: e.target.value })}
                        />
                      </div>
                       <div className="pt-2">
                        <Label className="text-card-foreground/90 text-sm font-medium">URL de Webhook para este Fluxo</Label>
                        <div className="flex items-center space-x-2 mt-1">
                            <Input 
                            id="flow-webhook-url-for-evolution" 
                            type="text" 
                            value={evolutionWebhookUrlForCurrentFlow} 
                            readOnly 
                            className="bg-input text-foreground flex-1 cursor-default break-all h-9"
                            />
                            <Button 
                            variant="outline" 
                            size="icon" 
                            onClick={(e) => handleCopyToClipboard(e, evolutionWebhookUrlForCurrentFlow, "URL de Webhook")} 
                            title="Copiar URL de Webhook" 
                            className="h-9 w-9"
                            >
                            <Copy className="w-4 w-4" />
                            </Button>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1.5">Use esta URL para que a API Evolution envie eventos para este fluxo específico.</p>
                       </div>
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                Fechar
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>


       {/* Webhook Logs Dialog */}
      <Dialog open={isWebhookLogsDialogOpen} onOpenChange={setIsWebhookLogsDialogOpen}>
        <DialogContent className="sm:max-w-3xl md:max-w-4xl lg:max-w-5xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Logs de Eventos da API Evolution</DialogTitle>
            <DialogDescription>
              Webhooks HTTP recebidos no endpoint <code className="mx-1 p-0.5 text-xs bg-muted rounded-sm break-all">{`${nexusFlowAppBaseUrl}/api/evolution/trigger/[ID_DO_FLUXO]`}</code>.
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
                      <TableHead className="w-[180px] text-right">Ações</TableHead>
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
                           <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="destructive" size="icon" className="h-7 w-7">
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Encerrar Sessão?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Tem certeza que deseja encerrar a sessão para <strong className='break-all'>{session.session_id}</strong>? Esta ação não pode ser desfeita e o fluxo será interrompido para este usuário.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteSession(session.session_id)}>Encerrar</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
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

    