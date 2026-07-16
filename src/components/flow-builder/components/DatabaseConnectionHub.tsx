"use client";

import React, { useState } from 'react';
import type { DatabaseConnection } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
    Database, Plus, Pencil, Trash2, Save, Sparkles, Zap, CheckCircle2, XCircle, Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { v4 as uuidv4 } from 'uuid';

interface DatabaseConnectionHubProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    connections: DatabaseConnection[];
    onConnectionsChange: (connections: DatabaseConnection[]) => void;
}

const EMPTY_POSTGRES: Partial<DatabaseConnection> = {
    type: 'postgres',
    host: '',
    port: 5432,
    database: '',
    username: '',
    password: '',
    ssl: false,
};

const EMPTY_SUPABASE: Partial<DatabaseConnection> = {
    type: 'supabase',
    supabaseUrl: '',
    supabaseKey: '',
};

export const DatabaseConnectionHub: React.FC<DatabaseConnectionHubProps> = ({
    open, onOpenChange, connections, onConnectionsChange,
}) => {
    const [editingConnection, setEditingConnection] = useState<DatabaseConnection | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [createType, setCreateType] = useState<'postgres' | 'supabase' | null>(null);
    const [isTesting, setIsTesting] = useState(false);
    const [testResult, setTestResult] = useState<{ success: boolean; error?: string } | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const [formData, setFormData] = useState<Partial<DatabaseConnection>>({});

    const startCreate = (type: 'postgres' | 'supabase') => {
        setEditingConnection(null);
        setCreateType(type);
        setFormData({ ...(type === 'postgres' ? EMPTY_POSTGRES : EMPTY_SUPABASE), name: '' });
        setTestResult(null);
        setIsCreating(true);
    };

    const startEdit = (conn: DatabaseConnection) => {
        setEditingConnection(conn);
        setCreateType(conn.type);
        setFormData({ ...conn });
        setTestResult(null);
        setIsCreating(true);
    };

    const handleDelete = (id: string) => {
        if (!confirm('Tem certeza que deseja excluir esta conexão?')) return;
        onConnectionsChange(connections.filter(c => c.id !== id));
    };

    const handleTestConnection = async () => {
        setIsTesting(true);
        setTestResult(null);
        try {
            const res = await fetch('/api/database/schema', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'test', connection: formData }),
            });
            const data = await res.json();
            setTestResult(data);
        } catch (e: any) {
            setTestResult({ success: false, error: e.message });
        } finally {
            setIsTesting(false);
        }
    };

    const handleSave = () => {
        if (!formData.name?.trim()) return;
        setIsSaving(true);

        const conn: DatabaseConnection = {
            id: editingConnection?.id || uuidv4(),
            name: formData.name!.trim(),
            type: formData.type as 'postgres' | 'supabase',
            host: formData.host,
            port: formData.port,
            database: formData.database,
            username: formData.username,
            password: formData.password,
            ssl: formData.ssl,
            supabaseUrl: formData.supabaseUrl,
            supabaseKey: formData.supabaseKey,
        };

        if (editingConnection) {
            onConnectionsChange(connections.map(c => c.id === conn.id ? conn : c));
        } else {
            onConnectionsChange([...connections, conn]);
        }

        setIsCreating(false);
        setEditingConnection(null);
        setCreateType(null);
        setIsSaving(false);
    };

    const pgConnections = connections.filter(c => c.type === 'postgres');
    const sbConnections = connections.filter(c => c.type === 'supabase');

    const renderConnectionCard = (conn: DatabaseConnection) => (
        <div key={conn.id} className="flex items-center justify-between p-4 rounded-2xl border bg-white/[0.02] border-white/5 hover:border-white/10 hover:bg-white/[0.04] transition-all group">
            <div className="flex items-center gap-4">
                <div className={cn(
                    "p-2 rounded-lg border",
                    conn.type === 'postgres'
                        ? "bg-sky-500/10 border-sky-500/20"
                        : "bg-emerald-500/10 border-emerald-500/20"
                )}>
                    <Database className={cn("w-4 h-4", conn.type === 'postgres' ? "text-sky-400" : "text-emerald-400")} />
                </div>
                <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-bold text-white/90">{conn.name}</span>
                    <span className="text-[10px] text-zinc-500 font-mono">
                        {conn.type === 'postgres'
                            ? `${conn.host}:${conn.port}/${conn.database}`
                            : conn.supabaseUrl?.replace('https://', '').split('.')[0]
                        }
                    </span>
                </div>
            </div>
            <div className="flex items-center gap-1 opacity-50 group-hover:opacity-100 transition-opacity">
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10" onClick={() => startEdit(conn)} title="Editar">
                    <Pencil className="w-3.5 h-3.5" />
                </Button>
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0 rounded-xl text-zinc-400 hover:text-red-400 hover:bg-red-500/10" onClick={() => handleDelete(conn.id)} title="Excluir">
                    <Trash2 className="w-3.5 h-3.5" />
                </Button>
            </div>
        </div>
    );

    const renderEmptyState = (type: 'postgres' | 'supabase') => (
        <div className="flex flex-col items-center justify-center h-40 bg-white/5 rounded-2xl border border-dashed border-white/10 gap-2">
            <Database className="w-8 h-8 text-zinc-600" />
            <p className="text-sm font-medium text-zinc-400">Nenhuma conexão {type === 'postgres' ? 'PostgreSQL' : 'Supabase'}</p>
            <p className="text-[10px] text-zinc-600 max-w-[200px] text-center">
                Adicione uma conexão para usar blocos de banco de dados no fluxo.
            </p>
        </div>
    );

    return (
        <>
            <Dialog open={open && !isCreating} onOpenChange={onOpenChange}>
                <DialogContent className="sm:max-w-3xl neo-glass border-white/10 h-[600px] flex flex-col shadow-2xl rounded-3xl p-0 overflow-hidden">
                    <DialogHeader className="p-6 border-b border-white/5 pb-4">
                        <DialogTitle className="text-xl font-bold flex items-center gap-2">
                            <Database className="w-5 h-5 text-primary" />
                            Banco de Dados
                        </DialogTitle>
                        <DialogDescription className="text-zinc-400">
                            Gerencie conexões de banco de dados para uso nos blocos do fluxo.
                        </DialogDescription>
                    </DialogHeader>

                    <Tabs defaultValue="postgres" className="flex-1 flex flex-col overflow-hidden">
                        <div className="px-6 pt-4">
                            <TabsList className="bg-black/20 border border-white/5 p-1 h-9 w-full justify-start rounded-xl">
                                <TabsTrigger value="postgres" className="rounded-lg text-xs font-medium data-[state=active]:bg-sky-500/20 data-[state=active]:text-sky-400">
                                    PostgreSQL
                                </TabsTrigger>
                                <TabsTrigger value="supabase" className="rounded-lg text-xs font-medium data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400">
                                    Supabase
                                </TabsTrigger>
                            </TabsList>
                        </div>

                        <div className="flex-1 overflow-hidden p-6 pt-4">
                            <TabsContent value="postgres" className="h-full mt-0 space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="p-2 rounded-lg bg-sky-500/10 border border-sky-500/20">
                                            <Database className="w-4 h-4 text-sky-400" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-white text-sm">PostgreSQL</h3>
                                            <p className="text-[10px] text-zinc-500">Banco de dados relacional</p>
                                        </div>
                                    </div>
                                    <Button size="sm" className="h-7 text-xs gap-1.5 bg-sky-600 hover:bg-sky-500 text-white border border-sky-400/20 shadow-lg shadow-sky-900/20" onClick={() => startCreate('postgres')}>
                                        <Plus className="w-3 h-3" />
                                        Nova Conexão
                                    </Button>
                                </div>
                                <ScrollArea className="h-[380px] -mr-4 pr-4">
                                    {pgConnections.length === 0
                                        ? renderEmptyState('postgres')
                                        : <div className="grid grid-cols-1 gap-3">{pgConnections.map(renderConnectionCard)}</div>
                                    }
                                </ScrollArea>
                            </TabsContent>

                            <TabsContent value="supabase" className="h-full mt-0 space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                                            <Zap className="w-4 h-4 text-emerald-400" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-white text-sm">Supabase</h3>
                                            <p className="text-[10px] text-zinc-500">Backend-as-a-Service</p>
                                        </div>
                                    </div>
                                    <Button size="sm" className="h-7 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-400/20 shadow-lg shadow-emerald-900/20" onClick={() => startCreate('supabase')}>
                                        <Plus className="w-3 h-3" />
                                        Nova Conexão
                                    </Button>
                                </div>
                                <ScrollArea className="h-[380px] -mr-4 pr-4">
                                    {sbConnections.length === 0
                                        ? renderEmptyState('supabase')
                                        : <div className="grid grid-cols-1 gap-3">{sbConnections.map(renderConnectionCard)}</div>
                                    }
                                </ScrollArea>
                            </TabsContent>
                        </div>
                    </Tabs>
                </DialogContent>
            </Dialog>

            {/* Create/Edit Dialog */}
            <Dialog open={isCreating} onOpenChange={(open) => { if (!open) setIsCreating(false); }}>
                <DialogContent className="neo-glass border-white/10 shadow-2xl rounded-3xl">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold">
                            {editingConnection ? 'Editar Conexão' : `Nova Conexão ${createType === 'postgres' ? 'PostgreSQL' : 'Supabase'}`}
                        </DialogTitle>
                        <DialogDescription className="text-zinc-400">
                            Preencha os dados de conexão do banco de dados.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="db-name">Nome da Conexão</Label>
                            <Input
                                id="db-name"
                                placeholder="Ex: BD Clientes, Produção..."
                                value={formData.name || ''}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                className="bg-black/20 border-white/10"
                            />
                        </div>

                        {createType === 'postgres' && (
                            <>
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="col-span-2 space-y-2">
                                        <Label htmlFor="db-host">Host</Label>
                                        <Input id="db-host" placeholder="localhost" value={formData.host || ''} onChange={(e) => setFormData({ ...formData, host: e.target.value })} className="bg-black/20 border-white/10" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="db-port">Porta</Label>
                                        <Input id="db-port" type="number" placeholder="5432" value={formData.port || ''} onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value) || 5432 })} className="bg-black/20 border-white/10" />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="db-database">Database</Label>
                                    <Input id="db-database" placeholder="postgres" value={formData.database || ''} onChange={(e) => setFormData({ ...formData, database: e.target.value })} className="bg-black/20 border-white/10" />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-2">
                                        <Label htmlFor="db-user">Usuário</Label>
                                        <Input id="db-user" placeholder="postgres" value={formData.username || ''} onChange={(e) => setFormData({ ...formData, username: e.target.value })} className="bg-black/20 border-white/10" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="db-pass">Senha</Label>
                                        <Input id="db-pass" type="password" placeholder="••••••" value={formData.password || ''} onChange={(e) => setFormData({ ...formData, password: e.target.value })} className="bg-black/20 border-white/10" />
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 pt-1">
                                    <Switch id="db-ssl" checked={formData.ssl || false} onCheckedChange={(checked) => setFormData({ ...formData, ssl: checked })} />
                                    <Label htmlFor="db-ssl" className="text-sm text-zinc-300">Usar SSL</Label>
                                </div>
                            </>
                        )}

                        {createType === 'supabase' && (
                            <>
                                <div className="space-y-2">
                                    <Label htmlFor="sb-url">Supabase URL</Label>
                                    <Input id="sb-url" placeholder="https://xxxxx.supabase.co" value={formData.supabaseUrl || ''} onChange={(e) => setFormData({ ...formData, supabaseUrl: e.target.value })} className="bg-black/20 border-white/10" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="sb-key">Supabase Key (anon ou service_role)</Label>
                                    <Input id="sb-key" type="password" placeholder="eyJ..." value={formData.supabaseKey || ''} onChange={(e) => setFormData({ ...formData, supabaseKey: e.target.value })} className="bg-black/20 border-white/10" />
                                </div>
                            </>
                        )}

                        {testResult && (
                            <div className={cn(
                                "flex items-center gap-2 p-3 rounded-xl border text-xs font-medium",
                                testResult.success
                                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                                    : "bg-red-500/10 border-red-500/20 text-red-400"
                            )}>
                                {testResult.success
                                    ? <><CheckCircle2 className="w-4 h-4" /> Conexão bem-sucedida!</>
                                    : <><XCircle className="w-4 h-4" /> Erro: {testResult.error}</>
                                }
                            </div>
                        )}
                    </div>

                    <DialogFooter className="pt-0 gap-2">
                        <Button
                            variant="outline"
                            className="rounded-xl border-white/10 text-xs"
                            onClick={handleTestConnection}
                            disabled={isTesting}
                        >
                            {isTesting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Zap className="w-4 h-4 mr-2" />}
                            Testar Conexão
                        </Button>
                        <div className="flex-1" />
                        <Button variant="ghost" className="rounded-xl text-xs" onClick={() => setIsCreating(false)}>Cancelar</Button>
                        <Button className="bg-primary hover:bg-primary/80 rounded-xl font-bold text-xs" onClick={handleSave} disabled={isSaving || !formData.name?.trim()}>
                            {isSaving ? <Sparkles className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                            {editingConnection ? 'Salvar Alterações' : 'Criar Conexão'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
};
