"use client";

import React, { useState, useCallback } from 'react';
import type { FlowSession, EvolutionInstance, ChatwootInstance, WorkspaceVersion, DialogyInstance, WorkspaceData } from '@/lib/types';
import { Button } from '@/components/ui/button';
import {
  SaveAll, UserCircle, Settings, LogOut, PlugZap, PanelRightOpen, PanelRightClose,
  TerminalSquare, History, Download, Upload, Home, ChevronsLeft,
  Sparkles, Save, Settings2
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from '@/hooks/use-toast';
import { cn } from "@/lib/utils";
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from '@/components/auth/AuthProvider';
import Link from 'next/link';
import { getEvolutionInstancesForUser, getChatwootInstancesForUserAction, getDialogyInstancesForUserAction } from '@/app/actions/instanceActions';
import { getWorkspaceVersionsAction, restoreWorkspaceVersionAction } from '@/app/actions/versionActions';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Textarea } from '@/components/ui/textarea';
import { exportFlow, importFlow } from '@/components/flow-builder/utils/exportImportUtils';

interface TopBarProps {
  workspaceName: string;
  onSaveWorkspaces: (description?: string | null) => void;
  onDiscardChanges: () => void;
  onUpdateWorkspace: (newSettings: Partial<WorkspaceData>) => void;
  isChatPanelOpen: boolean;
  onToggleChatPanel: () => void;
  onHighlightNode: (nodeId: string | null, steps?: string[]) => void;
  activeWorkspace: WorkspaceData | null | undefined;
}

const TopBar: React.FC<TopBarProps> = ({
  workspaceName,
  onSaveWorkspaces,
  onDiscardChanges,
  onUpdateWorkspace,
  isChatPanelOpen,
  onToggleChatPanel,
  onHighlightNode,
  activeWorkspace
}) => {
  const { toast } = useToast();
  const { user, logout } = useAuth();

  const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false);
  const [isSessionsDialogOpen, setIsSessionsDialogOpen] = useState(false);
  const [activeSessions, setActiveSessions] = useState<FlowSession[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [isInstanceManagerOpen, setIsInstanceManagerOpen] = useState(false);
  const [evolutionInstances, setEvolutionInstances] = useState<EvolutionInstance[]>([]);
  const [chatwootInstances, setChatwootInstances] = useState<ChatwootInstance[]>([]);
  const [dialogyInstances, setDialogyInstances] = useState<DialogyInstance[]>([]);
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [saveDescription, setSaveDescription] = useState('');
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);
  const [history, setHistory] = useState<WorkspaceVersion[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const fetchWorkspaceHistory = useCallback(async () => {
    if (!activeWorkspace?.id) return;
    setIsLoadingHistory(true);
    const result = await getWorkspaceVersionsAction(activeWorkspace.id);
    if (result.data) setHistory(result.data);
    setIsLoadingHistory(false);
  }, [activeWorkspace?.id]);

  const handleExportFlow = () => {
    if (!activeWorkspace) return;
    exportFlow(activeWorkspace);
    toast({ title: "Fluxo Exportado", description: "O arquivo JSON está pronto." });
  };

  const handleImportClick = () => fileInputRef.current?.click();

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = '';
    if (confirm("Importar fluxo substituirá as alterações atuais. Continuar?") && activeWorkspace) {
      try {
        await importFlow(file, onUpdateWorkspace);
        toast({ title: "Fluxo Importado" });
      } catch (e: any) {
        toast({ title: "Erro na Importação", description: e.message, variant: "destructive" });
      }
    }
  };

  const handleRestoreVersion = async (versionId: number) => {
    const result = await restoreWorkspaceVersionAction(versionId);
    if (result.success) {
      onDiscardChanges();
      setIsHistoryDialogOpen(false);
      toast({ title: "Versão Restaurada" });
    }
  };

  const fetchInstances = useCallback(async () => {
    const [evo, cw, dy] = await Promise.all([
      getEvolutionInstancesForUser(),
      getChatwootInstancesForUserAction(),
      getDialogyInstancesForUserAction()
    ]);
    if (evo.data) setEvolutionInstances(evo.data);
    if (cw.data) setChatwootInstances(cw.data);
    if (dy && dy.data) setDialogyInstances(dy.data);
  }, []);

  const handleOpenSettings = async () => {
    setIsSettingsDialogOpen(true);
    await fetchInstances();
  };

  const handleOpenInstanceManager = async () => {
    setIsInstanceManagerOpen(true);
    await fetchInstances();
  };

  const fetchActiveSessions = useCallback(async () => {
    setIsLoadingSessions(true);
    try {
      const url = activeWorkspace?.id
        ? `/api/sessions/active?workspaceId=${activeWorkspace.id}`
        : '/api/sessions/active';

      const res = await fetch(url);
      if (res.ok) setActiveSessions(await res.json());
    } finally {
      setIsLoadingSessions(false);
    }
  }, [activeWorkspace?.id]);

  return (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 pointer-events-none flex justify-center w-full">
      <header className="neo-glass pointer-events-auto rounded-full px-6 h-12 flex items-center gap-6 shadow-2xl border border-white/10">

        {/* Left Section: Context & Title */}
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2 p-1.5 rounded-full hover:bg-white/5 transition-all group">
            <ChevronsLeft className="w-4 h-4 text-zinc-400 group-hover:text-white" />
            <Home className="w-4 h-4 text-zinc-400 group-hover:text-white" />
          </Link>
          <div className="w-px h-6 bg-white/10" />
          <div className="flex items-center gap-2">
            <span className="text-[9px] uppercase tracking-[0.2em] text-zinc-500 font-bold">Studio</span>
            <input
              className="bg-transparent border-0 focus-visible:ring-0 text-sm font-bold text-white/90 w-auto min-w-[120px] max-w-[200px] truncate hover:text-white transition-colors"
              value={workspaceName}
              onChange={(e) => onUpdateWorkspace({ name: e.target.value })}
              disabled={!activeWorkspace}
            />
          </div>
        </div>

        {/* Center Section: Core Actions */}
        <div className="flex items-center gap-3">
          <Button
            className="h-9 px-6 rounded-full text-[11px] font-bold bg-gradient-to-r from-primary to-violet-600 hover:from-primary/90 hover:to-violet-500 text-white shadow-[0_8px_16px_-6px_rgba(139,92,246,0.5)] transition-all duration-300 gap-2 border border-white/20 active:scale-95"
            onClick={() => setIsSaveDialogOpen(true)}
            disabled={!activeWorkspace}
          >
            <Save className="w-3.5 h-3.5 fill-white/20" />
            Salvar Projeto
          </Button>

          <div className="w-px h-4 bg-white/10" />

          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-full bg-white/[0.03] border border-white/5 hover:bg-white/10 hover:border-white/10 transition-all group"
            onClick={() => { fetchWorkspaceHistory(); setIsHistoryDialogOpen(true); }}
            title="Histórico de Versões"
          >
            <History className="w-4 h-4 text-zinc-400 group-hover:text-primary transition-colors" />
          </Button>
        </div>

        {/* Right Section: Navigation & Tools */}
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-white/10">
                <TerminalSquare className="w-4 h-4 text-zinc-400" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="neo-glass border-white/10 min-w-[200px]">
              <DropdownMenuItem onSelect={() => { setIsSessionsDialogOpen(true); fetchActiveSessions(); }}>
                <Sparkles className="mr-2 h-4 w-4 text-primary" />
                Sessões Ativas
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportFlow}>
                <Download className="mr-2 h-4 w-4" />
                Exportar JSON
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleImportClick}>
                <Upload className="mr-2 h-4 w-4" />
                Importar JSON
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="ghost"
            size="icon"
            className={cn("h-8 w-8 rounded-full transition-all", isChatPanelOpen ? "bg-primary/20 text-white" : "hover:bg-white/10")}
            onClick={onToggleChatPanel}
          >
            {isChatPanelOpen ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4 text-zinc-400" />}
          </Button>

          <div className="w-px h-6 bg-white/10 mx-1" />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full h-8 w-8 p-0 border border-white/10 hover:border-primary/50 transition-all overflow-hidden">
                <Avatar className="h-full w-full">
                  <AvatarImage src={`https://api.dicebear.com/7.x/shapes/svg?seed=${user?.username}`} />
                  <AvatarFallback className="bg-primary/20 text-[10px] uppercase font-bold text-primary">{user?.username?.substring(0, 1)}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="neo-glass min-w-48 border-white/10">
              <DropdownMenuLabel className="flex flex-col px-4 py-3">
                <span className="text-sm font-bold text-white/90">{user?.username}</span>
                <span className="text-[10px] text-zinc-500 truncate mt-0.5">{user?.email}</span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-white/10" />
              <DropdownMenuItem onSelect={handleOpenSettings}>
                <Settings className="mr-2 h-4 w-4" /> Configurações
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={handleOpenInstanceManager}>
                <PlugZap className="mr-2 h-4 w-4" /> Instâncias
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-white/10" />
              <DropdownMenuItem onClick={logout} className="text-red-400 focus:text-red-400 focus:bg-red-400/10">
                <LogOut className="mr-2 h-4 w-4" /> Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".json" className="hidden" />

      {/* Save Dialog */}
      <Dialog open={isSaveDialogOpen} onOpenChange={setIsSaveDialogOpen}>
        <DialogContent className="neo-glass border-white/10 shadow-2xl rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Salvar Versão</DialogTitle>
            <DialogDescription className="text-zinc-400">Documente as alterações realizadas neste passo.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              className="bg-black/50 border-white/10 h-32 text-xs rounded-2xl focus:ring-primary/40 focus:border-primary/40"
              placeholder="Ex: Ajustes na lógica de saudação e correção de typos..."
              value={saveDescription}
              onChange={(e) => setSaveDescription(e.target.value)}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" className="text-xs font-bold rounded-xl" onClick={() => { onSaveWorkspaces(null); setIsSaveDialogOpen(false); }}>Salvar Rápido</Button>
            <Button className="bg-primary hover:bg-primary/80 text-white font-bold rounded-xl px-6" onClick={() => { onSaveWorkspaces(saveDescription); setIsSaveDialogOpen(false); }}>Salvar Versão</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History Dialog */}
      <Dialog open={isHistoryDialogOpen} onOpenChange={setIsHistoryDialogOpen}>
        <DialogContent className="sm:max-w-2xl neo-glass border-white/10 max-h-[80vh] flex flex-col shadow-2xl rounded-3xl p-0 overflow-hidden">
          <DialogHeader className="p-6 border-b border-white/5">
            <DialogTitle className="text-xl font-bold">Histórico de Versões</DialogTitle>
            <DialogDescription className="text-zinc-500">Restore points and version logs.</DialogDescription>
          </DialogHeader>
          <ScrollArea className="flex-1">
            <div className="p-4">
              <Table>
                <TableHeader className="border-white/5">
                  <TableRow className="hover:bg-transparent border-white/5">
                    <TableHead className="text-zinc-500 font-bold uppercase text-[9px] tracking-widest">Version</TableHead>
                    <TableHead className="text-zinc-500 font-bold uppercase text-[9px] tracking-widest text-right">Created At</TableHead>
                    <TableHead className="w-[100px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.length === 0 ? (
                    <TableRow><TableCell colSpan={3} className="text-center py-12 text-zinc-600 italic">No history found</TableCell></TableRow>
                  ) : history.map(v => (
                    <TableRow key={v.id} className="border-white/5 hover:bg-white/[0.03] transition-colors group">
                      <TableCell className="py-4">
                        <div className="flex flex-col gap-1">
                          <span className="font-bold text-white/90">v{v.version}</span>
                          <span className="text-[10px] text-zinc-500 line-clamp-1 w-64">{v.description || 'Sem descrição'}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-[10px] text-zinc-500 font-medium">
                        {formatDistanceToNow(new Date(v.created_at), { addSuffix: true, locale: ptBR })}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          className="opacity-0 group-hover:opacity-100 h-8 px-3 rounded-xl border-white/10 bg-white/5 hover:bg-primary/20 hover:border-primary/40 hover:text-white transition-all text-[10px] font-bold"
                          onClick={() => handleRestoreVersion(v.id)}
                        >
                          Restaurar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <Dialog open={isSessionsDialogOpen} onOpenChange={setIsSessionsDialogOpen}>
        <DialogContent className="sm:max-w-4xl neo-glass border-white/10 max-h-[90vh] flex flex-col shadow-2xl rounded-3xl p-0 overflow-hidden">
          <DialogHeader className="p-6 border-b border-white/5 flex flex-row items-center justify-between">
            <div>
              <DialogTitle className="text-xl font-bold">Sessões Ativas</DialogTitle>
              <DialogDescription className="text-zinc-400">Gerencie as sessões em execução no fluxo atual.</DialogDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="destructive"
                size="sm"
                onClick={async () => {
                  if (!confirm("Tem certeza que deseja encerrar TODAS as sessões ativas deste fluxo?")) return;
                  setIsLoadingSessions(true);
                  try {
                    const url = activeWorkspace?.id
                      ? `/api/sessions/active?workspaceId=${activeWorkspace.id}`
                      : '/api/sessions/active';
                    await fetch(url, { method: 'DELETE' });
                    await fetchActiveSessions();
                    toast({ title: "Sessões encerradas", description: "Todas as sessões foram limpas." });
                  } catch (e) {
                    toast({ title: "Erro", description: "Falha ao limpar sessões.", variant: "destructive" });
                  } finally {
                    setIsLoadingSessions(false);
                  }
                }}
                className="bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Encerrar Todas
              </Button>
              <Button variant="outline" size="icon" onClick={() => fetchActiveSessions()} title="Atualizar">
                <History className="w-4 h-4" />
              </Button>
            </div>
          </DialogHeader>
          <ScrollArea className="flex-1 h-[600px]">
            <div className="p-6">
              <Table>
                <TableHeader className="border-white/5 sticky top-0 bg-black/80 backdrop-blur-md z-10 shadow-sm">
                  <TableRow className="hover:bg-transparent border-white/5">
                    <TableHead className="text-zinc-400 font-bold uppercase text-[11px] tracking-widest w-[300px]">Session ID</TableHead>
                    <TableHead className="text-zinc-400 font-bold uppercase text-[11px] tracking-widest">Node Atual</TableHead>
                    <TableHead className="text-zinc-400 font-bold uppercase text-[11px] tracking-widest text-right">Iniciado</TableHead>
                    <TableHead className="w-[100px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoadingSessions ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-12"><div className="flex justify-center flex-col items-center gap-2"><Sparkles className="w-6 h-6 animate-spin text-primary" /><span className="text-xs text-zinc-500">Carregando sessões...</span></div></TableCell></TableRow>
                  ) : activeSessions.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-20 text-zinc-500 italic text-lg">Nenhuma sessão ativa encontrada.</TableCell></TableRow>
                  ) : activeSessions.map(s => (
                    <TableRow key={s.session_id} className="border-white/5 hover:bg-white/[0.03] transition-colors group">
                      <TableCell className="font-mono text-xs text-zinc-300 py-4 select-all cursor-pointer hover:text-white transition-colors" title="Clique para copiar" onClick={() => { navigator.clipboard.writeText(s.session_id); toast({ title: "ID Copiado" }); }}>
                        {s.session_id}
                      </TableCell>
                      <TableCell className="text-sm font-bold text-white/90">
                        <div className="flex items-center gap-2">
                          <div className={cn("w-2 h-2 rounded-full", s.current_node_id ? "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" : "bg-zinc-600")} />
                          {s.current_node_id ? 'Em Andamento' : 'Aguardando'}
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-xs text-zinc-400 font-medium">
                        {s.created_at ? formatDistanceToNow(new Date(s.created_at), { addSuffix: true, locale: ptBR }) : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1 opacity-50 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 rounded-full hover:bg-primary/20 hover:text-white"
                            onClick={() => { setIsSessionsDialogOpen(false); onHighlightNode(s.current_node_id || null, s.steps); }}
                            title="Localizar no Fluxo"
                          >
                            <PanelRightOpen className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 rounded-full hover:bg-red-500/20 hover:text-red-400"
                            onClick={async (e) => {
                              e.stopPropagation();
                              const res = await fetch(`/api/sessions/active?sessionId=${s.session_id}`, { method: 'DELETE' });
                              if (res.ok) {
                                setActiveSessions(prev => prev.filter(sess => sess.session_id !== s.session_id));
                                toast({ title: "Sessão Encerrada" });
                              }
                            }}
                            title="Encerrar Sessão"
                          >
                            <LogOut className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TopBar;
