
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { WorkspaceData, FlowSession, EvolutionInstance, ChatwootInstance, WorkspaceVersion, DialogyInstance } from '@/lib/types';
import { Button } from '@/components/ui/button';
import {
  Save, Undo2, Zap, UserCircle, Settings, LogOut, CreditCard,
  Database, ChevronDown, PlugZap, BotMessageSquare, Rocket, PanelRightOpen, PanelRightClose, KeyRound, Copy, FileJson2,
  TerminalSquare, ListOrdered, RefreshCw, AlertCircle, FileText, Webhook as WebhookIcon, Users, Target, ZoomIn, ZoomOut, Trash2, Home, ChevronsLeft, CircleDot, Circle, Cloud, CloudOff, Loader2, PlusCircle, Shield, MessageCircle, History, GitCommit
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from '@/hooks/use-toast';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Switch } from '@/components/ui/switch';
import { cn } from "@/lib/utils";
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from '@/components/auth/AuthProvider';
import Link from 'next/link';
import { v4 as uuidv4 } from 'uuid';
import { checkEvolutionInstanceStatus } from '@/app/actions/evolutionApiActions';
import { checkChatwootInstanceStatus } from '@/app/actions/chatwootApiActions';
import { checkDialogyInstanceStatus } from '@/app/actions/dialogyApiActions';
import { saveEvolutionInstanceAction, deleteEvolutionInstanceAction, getEvolutionInstancesForUser, getChatwootInstancesForUserAction, saveChatwootInstanceAction, deleteChatwootInstanceAction, getDialogyInstancesForUserAction, saveDialogyInstanceAction, deleteDialogyInstanceAction } from '@/app/actions/instanceActions';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { getWorkspaceVersionsAction, restoreWorkspaceVersionAction } from '@/app/actions/versionActions';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Textarea } from '@/components/ui/textarea';


interface TopBarProps {
  workspaceName: string;
  onSaveWorkspaces: (description?: string | null) => void;
  onDiscardChanges: () => void;
  onUpdateWorkspace: (newSettings: Partial<WorkspaceData>) => void;
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
  onUpdateWorkspace,
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
  const [evolutionWebhookLogEntries, setEvolutionWebhookLogEntries] = useState<any[]>([]);
  const [isLoadingEvolutionLogs, setIsLoadingEvolutionLogs] = useState(false);
  const [evolutionLogsError, setEvolutionLogsError] = useState<string | null>(null);
  
  const [isSessionsDialogOpen, setIsSessionsDialogOpen] = useState(false);
  const [activeSessions, setActiveSessions] = useState<FlowSession[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [sessionsError, setSessionsError] = useState<string | null>(null);
  const [selectedSessionVariables, setSelectedSessionVariables] = useState<Record<string, any> | null>(null);
  const [isSessionVariablesModalOpen, setIsSessionVariablesModalOpen] = useState(false);
  
  const [nexusFlowAppBaseUrl, setNexusFlowAppBaseUrl] = useState('');
  
  const [isInstanceManagerOpen, setIsInstanceManagerOpen] = useState(false);
  const [instanceManagerTab, setInstanceManagerTab] = useState('evolution');

  const [evolutionInstances, setEvolutionInstances] = useState<EvolutionInstance[]>([]);
  const [isLoadingEvolutionInstances, setIsLoadingEvolutionInstances] = useState(false);
  const [editingEvolutionInstance, setEditingEvolutionInstance] = useState<EvolutionInstance | null>(null);
  
  const [chatwootInstances, setChatwootInstances] = useState<ChatwootInstance[]>([]);
  const [isLoadingChatwootInstances, setIsLoadingChatwootInstances] = useState(false);
  const [editingChatwootInstance, setEditingChatwootInstance] = useState<ChatwootInstance | null>(null);

  const [dialogyInstances, setDialogyInstances] = useState<DialogyInstance[]>([]);
  const [isLoadingDialogyInstances, setIsLoadingDialogyInstances] = useState(false);
  const [editingDialogyInstance, setEditingDialogyInstance] = useState<DialogyInstance | null>(null);

  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [saveDescription, setSaveDescription] = useState('');
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);
  const [history, setHistory] = useState<WorkspaceVersion[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const fetchWorkspaceHistory = useCallback(async () => {
    if (!activeWorkspace?.id) return;
    setIsLoadingHistory(true);
    const result = await getWorkspaceVersionsAction(activeWorkspace.id);
    if (result.data) {
        setHistory(result.data);
    } else {
        toast({ title: "Erro ao buscar histórico", description: result.error, variant: "destructive" });
    }
    setIsLoadingHistory(false);
  }, [activeWorkspace?.id, toast]);

  const handleOpenHistoryDialog = () => {
    fetchWorkspaceHistory();
    setIsHistoryDialogOpen(true);
  };
  
  const handleRestoreVersion = async (versionId: number) => {
    if (!user) return;
    const result = await restoreWorkspaceVersionAction(versionId);
    if (result.success) {
      toast({ title: "Fluxo Restaurado", description: "O fluxo será recarregado para a versão selecionada."});
      onDiscardChanges(); // This reloads the workspace from DB
      setIsHistoryDialogOpen(false);
    } else {
      toast({ title: "Erro ao Restaurar", description: result.error, variant: "destructive" });
    }
  };


  const handleSaveWithDescription = () => {
    onSaveWorkspaces(saveDescription);
    setIsSaveDialogOpen(false);
    setSaveDescription('');
  };

  const fetchEvolutionInstances = useCallback(async () => {
    setIsLoadingEvolutionInstances(true);
    try {
      const result = await getEvolutionInstancesForUser();
      if (result.error) throw new Error(result.error);
      setEvolutionInstances(result.data || []);
      return result.data || [];
    } catch (error: any) {
      toast({ title: "Erro ao Carregar Instâncias Evolution", description: error.message, variant: "destructive" });
      setEvolutionInstances([]);
      return [];
    } finally {
      setIsLoadingEvolutionInstances(false);
    }
  }, [toast]);

  const fetchChatwootInstances = useCallback(async () => {
    setIsLoadingChatwootInstances(true);
    try {
      const result = await getChatwootInstancesForUserAction();
      if (result.error) throw new Error(result.error);
      setChatwootInstances(result.data || []);
      return result.data || [];
    } catch (error: any) {
      toast({ title: "Erro ao Carregar Instâncias Chatwoot", description: error.message, variant: "destructive" });
      setChatwootInstances([]);
      return [];
    } finally {
      setIsLoadingChatwootInstances(false);
    }
  }, [toast]);

  const fetchDialogyInstances = useCallback(async () => {
    setIsLoadingDialogyInstances(true);
    try {
      const result = await getDialogyInstancesForUserAction();
      if (result.error) throw new Error(result.error);
      setDialogyInstances(result.data || []);
      return result.data || [];
    } catch (error: any) {
      toast({ title: "Erro ao Carregar Instâncias Dialogy", description: error.message, variant: "destructive" });
      setDialogyInstances([]);
      return [];
    } finally {
      setIsLoadingDialogyInstances(false);
    }
  }, [toast]);

  const handleOpenSettings = useCallback(async () => {
    setIsSettingsDialogOpen(true);
    await Promise.all([
      fetchEvolutionInstances(),
      fetchChatwootInstances(),
      fetchDialogyInstances()
    ]);
  }, [fetchEvolutionInstances, fetchChatwootInstances, fetchDialogyInstances]);

  const handleOpenInstanceManager = useCallback(async () => {
    setIsInstanceManagerOpen(true);
    await Promise.all([
      fetchEvolutionInstances(),
      fetchChatwootInstances(),
      fetchDialogyInstances()
    ]);
  }, [fetchEvolutionInstances, fetchChatwootInstances, fetchDialogyInstances]);


  const handleSaveEvolutionInstance = async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const formData = new FormData(event.currentTarget);
      const result = await saveEvolutionInstanceAction(formData);

      if (result.success) {
          toast({ title: "Sucesso!", description: "Instância da API Evolution salva." });
          setEditingEvolutionInstance(null);
          await fetchEvolutionInstances();
      } else {
          toast({ title: "Erro", description: result.error || "Falha ao salvar instância.", variant: "destructive" });
      }
  };

  const handleDeleteEvolutionInstance = async (instanceId: string) => {
      const result = await deleteEvolutionInstanceAction(instanceId);
      if (result.success) {
          toast({ title: "Sucesso!", description: "Instância da API Evolution excluída." });
          await fetchEvolutionInstances();
      } else {
          toast({ title: "Erro", description: result.error || "Falha ao excluir instância.", variant: "destructive" });
      }
  };

  const handleSaveChatwootInstance = async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const formData = new FormData(event.currentTarget);
      const result = await saveChatwootInstanceAction(formData);

      if (result.success) {
          toast({ title: "Sucesso!", description: "Instância do Chatwoot salva." });
          setEditingChatwootInstance(null);
          await fetchChatwootInstances();
      } else {
          toast({ title: "Erro", description: result.error || "Falha ao salvar instância.", variant: "destructive" });
      }
  };

  const handleDeleteChatwootInstance = async (instanceId: string) => {
      const result = await deleteChatwootInstanceAction(instanceId);
      if (result.success) {
          toast({ title: "Sucesso!", description: "Instância do Chatwoot excluída." });
          await fetchChatwootInstances();
      } else {
          toast({ title: "Erro", description: result.error || "Falha ao excluir instância.", variant: "destructive" });
      }
  };

  const handleSaveDialogyInstance = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const result = await saveDialogyInstanceAction(formData);

    if (result.success) {
        toast({ title: "Sucesso!", description: "Instância da Dialogy salva." });
        setEditingDialogyInstance(null);
        await fetchDialogyInstances();
    } else {
        toast({ title: "Erro", description: result.error || "Falha ao salvar instância.", variant: "destructive" });
    }
  };

  const handleDeleteDialogyInstance = async (instanceId: string) => {
      const result = await deleteDialogyInstanceAction(instanceId);
      if (result.success) {
          toast({ title: "Sucesso!", description: "Instância da Dialogy excluída." });
          await fetchDialogyInstances();
      } else {
          toast({ title: "Erro", description: result.error || "Falha ao excluir instância.", variant: "destructive" });
      }
  };


  useEffect(() => {
    if (typeof window !== 'undefined') {
      setNexusFlowAppBaseUrl(window.location.origin);
    }
  }, []);

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

  const handleDeleteAllSessions = async () => {
    try {
        const response = await fetch(`/api/sessions/active`, {
            method: 'DELETE',
        });
        const result = await response.json();
        if (!response.ok) {
            throw new Error(result.error || 'Falha ao encerrar todas as sessões');
        }
        toast({
            title: "Sessões Encerradas",
            description: result.message || "Todas as sessões ativas foram encerradas.",
        });
        fetchActiveSessions();
    } catch (error: any) {
        toast({
            title: "Erro ao Encerrar Sessões",
            description: error.message,
            variant: "destructive",
        });
    }
  };


  const getSessionStatus = (session: FlowSession): { text: string; color: string } => {
    if (session.awaiting_input_type) {
      return { text: `Aguardando ${session.awaiting_input_type}`, color: 'bg-yellow-500' };
    }
    if (session.current_node_id === null) {
      return { text: 'Pausado', color: 'bg-gray-400' };
    }
    return { text: 'Ativo', color: 'bg-green-500' };
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
            onChange={(e) => onUpdateWorkspace({ name: e.target.value })}
            disabled={!activeWorkspace}
            name="workspaceName"
          />
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
          
           <Button
            onClick={handleOpenHistoryDialog}
            variant="outline"
            size="icon"
            className="h-9 w-9"
            aria-label="Histórico de Versões"
            >
             <History className="h-4 w-4" />
           </Button>

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
            onClick={() => setIsSaveDialogOpen(true)}
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
              <DropdownMenuItem onSelect={handleOpenSettings}>
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
              <DropdownMenuItem onSelect={handleOpenInstanceManager}>
                <PlugZap className="mr-2 h-4 w-4" />
                <span>Gerenciar Instâncias</span>
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
      
      {/* Save Dialog */}
      <Dialog open={isSaveDialogOpen} onOpenChange={setIsSaveDialogOpen}>
        <DialogContent>
            <DialogHeader>
            <DialogTitle>Salvar Versão do Fluxo</DialogTitle>
            <DialogDescription>
                Adicione uma breve descrição para esta versão. Isso ajudará você a identificar esta alteração no futuro.
            </DialogDescription>
            </DialogHeader>
            <div className="py-4">
            <Label htmlFor="save-description">Descrição (Opcional)</Label>
            <Textarea
                id="save-description"
                value={saveDescription}
                onChange={(e) => setSaveDescription(e.target.value)}
                placeholder="Ex: Adicionado nó de boas-vindas"
            />
            </div>
            <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onSaveWorkspaces(null)}>Salvar sem Descrição</Button>
            <Button type="button" onClick={handleSaveWithDescription}>Salvar Versão</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* History Dialog */}
        <Dialog open={isHistoryDialogOpen} onOpenChange={setIsHistoryDialogOpen}>
            <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Histórico de Versões: {workspaceName}</DialogTitle>
                    <DialogDescription>
                        Visualize e restaure versões anteriores do seu fluxo de trabalho.
                    </DialogDescription>
                </DialogHeader>
                <div className="flex-1 overflow-hidden">
                    {isLoadingHistory ? (
                         <div className="flex justify-center items-center h-full"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
                    ) : history.length === 0 ? (
                        <div className="text-center text-muted-foreground py-10">Nenhuma versão anterior encontrada.</div>
                    ) : (
                        <ScrollArea className="h-full">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Versão</TableHead>
                                        <TableHead>Descrição</TableHead>
                                        <TableHead>Salvo Por</TableHead>
                                        <TableHead>Data</TableHead>
                                        <TableHead className="text-right">Ações</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {history.map(v => (
                                        <TableRow key={v.id}>
                                            <TableCell className="font-bold">v{v.version}</TableCell>
                                            <TableCell className="text-muted-foreground italic">{v.description || 'Nenhuma descrição'}</TableCell>
                                            <TableCell>{v.created_by_username || 'Usuário desconhecido'}</TableCell>
                                            <TableCell title={new Date(v.created_at).toLocaleString()}>{formatDistanceToNow(new Date(v.created_at), { addSuffix: true, locale: ptBR })}</TableCell>
                                            <TableCell className="text-right">
                                                 <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                         <Button variant="outline" size="sm" disabled={v.version === history[0].version}>
                                                            <Undo2 className="mr-2 h-3.5 w-3.5" /> Restaurar
                                                        </Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>Restaurar para a Versão {v.version}?</AlertDialogTitle>
                                                            <AlertDialogDescription>
                                                                Suas alterações atuais não salvas serão perdidas. O fluxo será revertido para o estado da versão {v.version}. Uma nova versão "Restaurado da v{v.version}" será criada.
                                                            </AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                            <AlertDialogAction onClick={() => handleRestoreVersion(v.id)}>Sim, Restaurar</AlertDialogAction>
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
                    <Button variant="outline" onClick={() => setIsHistoryDialogOpen(false)}>Fechar</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>


      {/* Workspace Settings Dialog */}
      <Dialog open={isSettingsDialogOpen} onOpenChange={setIsSettingsDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Configurações do Fluxo: {workspaceName}</DialogTitle>
            <DialogDescription>
              Ajustes de integração para este fluxo de trabalho específico.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
             <Accordion type="single" collapsible className="w-full" defaultValue="evolution-api">
              <AccordionItem value="evolution-api">
                  <AccordionTrigger className="font-semibold text-base py-3">
                  <div className="flex items-center gap-3">
                      <BotMessageSquare className="w-6 h-6 text-teal-500" />
                      API Evolution (WhatsApp)
                  </div>
                  </AccordionTrigger>
                  <AccordionContent className="pt-4 space-y-4">
                  <div className="space-y-3">
                    <div>
                        <Label htmlFor="evolution_instance_id">Instância da API Evolution</Label>
                        <Select
                          value={activeWorkspace?.evolution_instance_id || 'none'}
                          onValueChange={(value) => onUpdateWorkspace({ evolution_instance_id: value === 'none' ? undefined : value })}
                        >
                          <SelectTrigger id="evolution_instance_id">
                            <SelectValue placeholder="Nenhuma instância selecionada" />
                          </SelectTrigger>
                          <SelectContent>
                             <SelectItem value="none">
                                <em>Nenhuma</em>
                              </SelectItem>
                            {evolutionInstances.map(instance => (
                              <SelectItem key={instance.id} value={instance.id}>
                                {instance.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                         <p className="text-xs text-muted-foreground mt-1.5">
                          Precisa adicionar ou alterar uma instância?
                          <Button variant="link" size="sm" className="p-0 h-auto text-xs ml-1" onClick={() => { setIsSettingsDialogOpen(false); handleOpenInstanceManager(); }}>
                            Gerenciar Instâncias
                          </Button>
                        </p>
                      </div>
                  </div>
                  </AccordionContent>
              </AccordionItem>
              <AccordionItem value="chatwoot">
                  <AccordionTrigger className="font-semibold text-base py-3">
                  <div className="flex items-center gap-3">
                      <MessageCircle className="w-6 h-6 text-blue-500" />
                      Chatwoot
                  </div>
                  </AccordionTrigger>
                  <AccordionContent className="pt-4 space-y-4">
                     <div className="flex items-center space-x-2">
                        <Switch
                          id="chatwoot-enabled"
                          checked={activeWorkspace?.chatwoot_enabled || false}
                          onCheckedChange={(checked) => onUpdateWorkspace({ chatwoot_enabled: checked })}
                        />
                        <Label htmlFor="chatwoot-enabled">Habilitar Detecção de Webhook Chatwoot</Label>
                    </div>
                     <p className="text-xs text-muted-foreground">
                        Habilite para que o sistema identifique webhooks do Chatwoot e injete variáveis como `chatwoot_conversation_id` no fluxo.
                    </p>
                    <div className="space-y-3">
                      <Label htmlFor="chatwoot_instance_id">Instância do Chatwoot para Respostas</Label>
                       <Select
                          value={activeWorkspace?.chatwoot_instance_id || 'none'}
                          onValueChange={(value) => onUpdateWorkspace({ chatwoot_instance_id: value === 'none' ? undefined : value })}
                        >
                          <SelectTrigger id="chatwoot_instance_id">
                            <SelectValue placeholder="Nenhuma instância selecionada" />
                          </SelectTrigger>
                          <SelectContent>
                             <SelectItem value="none">
                                <em>Nenhuma (não responderá no Chatwoot)</em>
                              </SelectItem>
                            {chatwootInstances.map(instance => (
                              <SelectItem key={instance.id} value={instance.id}>
                                {instance.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground mt-1.5">
                         Selecione uma instância para que nós como "Exibir Texto" possam responder diretamente na conversa do Chatwoot.
                        </p>
                    </div>
                  </AccordionContent>
              </AccordionItem>
              <AccordionItem value="dialogy">
                <AccordionTrigger className="font-semibold text-base py-3">
                  <div className="flex items-center gap-3">
                    <Rocket className="w-6 h-6 text-orange-500" />
                    Dialogy
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pt-4 space-y-4">
                  <div className="space-y-3">
                    <Label htmlFor="dialogy_instance_id">Instância da Dialogy</Label>
                    <Select
                      value={activeWorkspace?.dialogy_instance_id || 'none'}
                      onValueChange={(value) => onUpdateWorkspace({ dialogy_instance_id: value === 'none' ? undefined : value })}
                    >
                      <SelectTrigger id="dialogy_instance_id">
                        <SelectValue placeholder="Nenhuma instância selecionada" />
                      </SelectTrigger>
                      <SelectContent>
                          <SelectItem value="none">
                            <em>Nenhuma</em>
                          </SelectItem>
                        {dialogyInstances.map(instance => (
                          <SelectItem key={instance.id} value={instance.id}>
                            {instance.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1.5">
                      Selecione uma instância para usar o nó "Enviar Mensagem (Dialogy)".
                      <Button variant="link" size="sm" className="p-0 h-auto text-xs ml-1" onClick={() => { setIsSettingsDialogOpen(false); handleOpenInstanceManager(); setInstanceManagerTab('dialogy'); }}>
                        Gerenciar Instâncias
                      </Button>
                    </p>
                  </div>
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
      
      {/* Instance Management Dialog */}
      <Dialog open={isInstanceManagerOpen} onOpenChange={setIsInstanceManagerOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>Gerenciar Instâncias de Integração</DialogTitle>
              <DialogDescription>
                Adicione e configure suas conexões com a API Evolution, Chatwoot e Dialogy.
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-hidden mt-2">
                <Tabs value={instanceManagerTab} onValueChange={setInstanceManagerTab} className="flex flex-col h-full">
                    <TabsList className="self-start">
                        <TabsTrigger value="evolution">API Evolution</TabsTrigger>
                        <TabsTrigger value="chatwoot">Chatwoot</TabsTrigger>
                        <TabsTrigger value="dialogy">Dialogy</TabsTrigger>
                    </TabsList>
                    <TabsContent value="evolution" className="flex-1 overflow-y-auto pr-2 -mr-2 mt-2">
                        <Card>
                            <CardHeader>
                                <CardTitle>Instâncias da API Evolution</CardTitle>
                                <CardDescription>Gerencie suas conexões com a API do WhatsApp.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {editingEvolutionInstance ? (
                                    <form onSubmit={handleSaveEvolutionInstance} key={editingEvolutionInstance.id || 'new-evo'} className="p-4 border rounded-lg space-y-3">
                                        <h3 className="font-semibold">{editingEvolutionInstance.id ? 'Editando Instância' : 'Nova Instância'}</h3>
                                        <input type="hidden" name="id" value={editingEvolutionInstance.id || ''} />
                                        <div>
                                            <Label htmlFor="evo-name">Nome</Label>
                                            <Input id="evo-name" name="name" defaultValue={editingEvolutionInstance.name} required />
                                        </div>
                                        <div>
                                            <Label htmlFor="evo-baseUrl">URL Base</Label>
                                            <Input id="evo-baseUrl" name="baseUrl" defaultValue={editingEvolutionInstance.baseUrl} placeholder="http://localhost:8080" required />
                                        </div>
                                        <div>
                                            <Label htmlFor="evo-apiKey">API Key (Opcional)</Label>
                                            <Input id="evo-apiKey" name="apiKey" defaultValue={editingEvolutionInstance.apiKey} />
                                        </div>
                                        <div className="flex justify-end gap-2">
                                            <Button type="button" variant="ghost" onClick={() => setEditingEvolutionInstance(null)}>Cancelar</Button>
                                            <Button type="submit">Salvar</Button>
                                        </div>
                                    </form>
                                ) : (
                                    <Button onClick={() => setEditingEvolutionInstance({ id: '', name: '', baseUrl: '', apiKey: '', status: 'unconfigured' })}>
                                        <PlusCircle className="mr-2" /> Adicionar Instância Evolution
                                    </Button>
                                )}
                                 <ScrollArea className="h-64">
                                    <Table>
                                        <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>URL</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
                                        <TableBody>
                                            {evolutionInstances.map(instance => (
                                                <TableRow key={instance.id}>
                                                    <TableCell>{instance.name}</TableCell>
                                                    <TableCell>{instance.baseUrl}</TableCell>
                                                    <TableCell className="text-right">
                                                        <Button variant="ghost" size="sm" onClick={() => setEditingEvolutionInstance(instance)}>Editar</Button>
                                                        <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleDeleteEvolutionInstance(instance.id)}>Excluir</Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </ScrollArea>
                            </CardContent>
                        </Card>
                    </TabsContent>
                    <TabsContent value="chatwoot" className="flex-1 overflow-y-auto pr-2 -mr-2 mt-2">
                        <Card>
                             <CardHeader>
                                <CardTitle>Instâncias do Chatwoot</CardTitle>
                                <CardDescription>Gerencie suas conexões com a API do Chatwoot.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {editingChatwootInstance ? (
                                    <form onSubmit={handleSaveChatwootInstance} key={editingChatwootInstance.id || 'new-cw'} className="p-4 border rounded-lg space-y-3">
                                        <h3 className="font-semibold">{editingChatwootInstance.id ? 'Editando Instância' : 'Nova Instância'}</h3>
                                        <input type="hidden" name="id" value={editingChatwootInstance.id || ''} />
                                        <div>
                                            <Label htmlFor="cw-name">Nome</Label>
                                            <Input id="cw-name" name="name" defaultValue={editingChatwootInstance.name} required />
                                        </div>
                                        <div>
                                            <Label htmlFor="cw-baseUrl">URL da Instância Chatwoot</Label>
                                            <Input id="cw-baseUrl" name="baseUrl" defaultValue={editingChatwootInstance.baseUrl} placeholder="https://app.chatwoot.com" required />
                                        </div>
                                        <div>
                                            <Label htmlFor="cw-apiAccessToken">Token de Acesso da API (Agente)</Label>
                                            <Input id="cw-apiAccessToken" name="apiAccessToken" defaultValue={editingChatwootInstance.apiAccessToken} required />
                                        </div>
                                        <div className="flex justify-end gap-2">
                                            <Button type="button" variant="ghost" onClick={() => setEditingChatwootInstance(null)}>Cancelar</Button>
                                            <Button type="submit">Salvar</Button>
                                        </div>
                                    </form>
                                ) : (
                                    <Button onClick={() => setEditingChatwootInstance({ id: '', name: '', baseUrl: '', apiAccessToken: '', status: 'unconfigured' })}>
                                        <PlusCircle className="mr-2" /> Adicionar Instância Chatwoot
                                    </Button>
                                )}
                                 <ScrollArea className="h-64">
                                    <Table>
                                        <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>URL</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
                                        <TableBody>
                                            {chatwootInstances.map(instance => (
                                                <TableRow key={instance.id}>
                                                    <TableCell>{instance.name}</TableCell>
                                                    <TableCell>{instance.baseUrl}</TableCell>
                                                    <TableCell className="text-right">
                                                        <Button variant="ghost" size="sm" onClick={() => setEditingChatwootInstance(instance)}>Editar</Button>
                                                        <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleDeleteChatwootInstance(instance.id)}>Excluir</Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </ScrollArea>
                            </CardContent>
                             <CardFooter>
                                <p className="text-xs text-muted-foreground">O token de acesso pode ser encontrado no seu Perfil > Configurações dentro do Chatwoot.</p>
                            </CardFooter>
                        </Card>
                    </TabsContent>
                    <TabsContent value="dialogy" className="flex-1 overflow-y-auto pr-2 -mr-2 mt-2">
                        <Card>
                             <CardHeader>
                                <CardTitle>Instâncias da Dialogy</CardTitle>
                                <CardDescription>Gerencie suas conexões com a API da Dialogy.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {editingDialogyInstance ? (
                                    <form onSubmit={handleSaveDialogyInstance} key={editingDialogyInstance.id || 'new-dgy'} className="p-4 border rounded-lg space-y-3">
                                        <h3 className="font-semibold">{editingDialogyInstance.id ? 'Editando Instância' : 'Nova Instância'}</h3>
                                        <input type="hidden" name="id" value={editingDialogyInstance.id || ''} />
                                        <div>
                                            <Label htmlFor="dgy-name">Nome</Label>
                                            <Input id="dgy-name" name="name" defaultValue={editingDialogyInstance.name} required />
                                        </div>
                                        <div>
                                            <Label htmlFor="dgy-baseUrl">URL da Instância Dialogy</Label>
                                            <Input id="dgy-baseUrl" name="baseUrl" defaultValue={editingDialogyInstance.baseUrl} placeholder="https://api.dialogy.com.br" required />
                                        </div>
                                        <div>
                                            <Label htmlFor="dgy-apiKey">API Key (Authorization Token)</Label>
                                            <Input id="dgy-apiKey" name="apiKey" defaultValue={editingDialogyInstance.apiKey} required />
                                        </div>
                                        <div className="flex justify-end gap-2">
                                            <Button type="button" variant="ghost" onClick={() => setEditingDialogyInstance(null)}>Cancelar</Button>
                                            <Button type="submit">Salvar</Button>
                                        </div>
                                    </form>
                                ) : (
                                    <Button onClick={() => setEditingDialogyInstance({ id: '', name: '', baseUrl: '', apiKey: '', status: 'unconfigured' })}>
                                        <PlusCircle className="mr-2" /> Adicionar Instância Dialogy
                                    </Button>
                                )}
                                 <ScrollArea className="h-64">
                                    <Table>
                                        <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>URL</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
                                        <TableBody>
                                            {dialogyInstances.map(instance => (
                                                <TableRow key={instance.id}>
                                                    <TableCell>{instance.name}</TableCell>
                                                    <TableCell>{instance.baseUrl}</TableCell>
                                                    <TableCell className="text-right">
                                                        <Button variant="ghost" size="sm" onClick={() => setEditingDialogyInstance(instance)}>Editar</Button>
                                                        <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleDeleteDialogyInstance(instance.id)}>Excluir</Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </ScrollArea>
                            </CardContent>
                             <CardFooter>
                                <p className="text-xs text-muted-foreground">O token de autorização é fornecido no painel da sua conta Dialogy.</p>
                            </CardFooter>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>
            <DialogFooter>
                <DialogClose asChild><Button type="button" variant="secondary" onClick={() => { setIsInstanceManagerOpen(false); }}>Fechar</Button></DialogClose>
            </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Sessions Dialog */}
      <Dialog open={isSessionsDialogOpen} onOpenChange={setIsSessionsDialogOpen}>
        <DialogContent className="sm:max-w-3xl md:max-w-4xl lg:max-w-5xl xl:max-w-6xl max-h-[85vh] flex flex-col">
          <DialogHeader>
             <div className="flex items-center justify-between">
                <div>
                  <DialogTitle>Sessões Ativas</DialogTitle>
                  <DialogDescription>
                    Lista de conversas e fluxos atualmente ativos no banco de dados.
                  </DialogDescription>
                </div>
                <div className="flex items-center gap-2">
                    <Button onClick={fetchActiveSessions} variant="outline" size="sm" className="h-9" disabled={isLoadingSessions}>
                      <RefreshCw className={cn("mr-2 h-4 w-4", isLoadingSessions && "animate-spin")} />
                      {isLoadingSessions ? "Atualizando..." : "Atualizar"}
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="sm" className="h-9" disabled={isLoadingSessions || activeSessions.length === 0}>
                           <Trash2 className="mr-2 h-4 w-4" /> Encerrar Todas
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Encerrar Todas as Sessões?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Esta ação não pode ser desfeita. Isso encerrará permanentemente todas as sessões de fluxo ativas para sua conta.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={handleDeleteAllSessions} className="bg-destructive hover:bg-destructive/90">
                              Sim, encerrar todas
                            </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                </div>
             </div>
          </DialogHeader>
          <div className="flex-1 overflow-hidden flex flex-col py-4">
            {isLoadingSessions && <div className="flex justify-center items-center h-full"><Loader2 className="w-8 w-8 animate-spin text-muted-foreground" /></div>}
            {sessionsError && (<div className="p-3 bg-destructive/10 border border-destructive text-destructive rounded-md text-sm"><div className="flex items-center gap-2 font-medium"><AlertCircle className="h-5 w-5" /> Erro ao carregar sessões:</div><p className="mt-1 text-xs">{sessionsError}</p></div>)}
            {!isLoadingSessions && !sessionsError && activeSessions.length === 0 && (
              <div className="flex-1 flex flex-col items-center justify-center text-center text-muted-foreground p-4"><Users className="w-12 h-12 mb-3" /><p className="text-sm">Nenhuma sessão ativa encontrada.</p><p className="text-xs mt-1">Interaja com um fluxo para criar uma sessão.</p></div>
            )}
            {!isLoadingSessions && activeSessions.length > 0 && (
              <ScrollArea className="flex-1 -m-3">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-3">
                    {activeSessions.map((session) => (
                      <Card key={session.session_id} className="flex flex-col">
                        <CardHeader>
                            <CardTitle className="flex items-center justify-between">
                                <span className="truncate font-mono text-base" title={session.session_id}>
                                    {session.session_id.split('@@')[0]}
                                </span>
                                <span className={cn("flex items-center gap-1.5 text-xs font-normal", getSessionStatus(session).color.replace('bg-', 'text-'))}>
                                  <span className={cn("w-2 h-2 rounded-full", getSessionStatus(session).color)} />
                                  {getSessionStatus(session).text}
                                </span>
                            </CardTitle>
                            <CardDescription className="text-xs truncate" title={session.workspace_id}>
                                Fluxo: {session.workspace_id}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-2 text-sm flex-grow">
                           <div>
                                <p className="font-medium text-muted-foreground text-xs">Nó Atual</p>
                                <p className="font-mono text-xs truncate" title={session.current_node_id || 'N/A'}>{session.current_node_id || 'Nenhum (Pausado)'}</p>
                           </div>
                           <div>
                                <p className="font-medium text-muted-foreground text-xs">Última Interação</p>
                                <p className="text-xs">{session.last_interaction_at ? new Date(session.last_interaction_at).toLocaleString() : 'N/A'}</p>
                           </div>
                        </CardContent>
                        <CardFooter className="flex justify-end space-x-2 border-t pt-4">
                           <Button variant="outline" size="sm" onClick={() => handleViewSessionVariables(session.flow_variables)}>
                                <FileJson2 className="mr-1.5 h-4 w-4" /> Variáveis
                           </Button>
                           <Button variant="outline" size="sm" onClick={() => handleGoToNodeInFlow(session)}>
                                <Target className="mr-1.5 h-4 w-4" /> Ir para Nó
                           </Button>
                           <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="destructive" size="icon">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Encerrar Sessão?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Tem certeza que deseja encerrar a sessão para <strong className='break-all font-mono'>{session.session_id.split('@@')[0]}</strong>? Esta ação não pode ser interrompido para este usuário.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteSession(session.session_id)}>Encerrar</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </CardFooter>
                      </Card>
                    ))}
                </div>
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

    