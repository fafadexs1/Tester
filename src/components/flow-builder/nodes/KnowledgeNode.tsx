"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { NodeComponentProps } from '../NodeProps';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Edit2, Book, List, Save, Loader2, Search, FolderOpen } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";

interface KnowledgeEntry {
    id: string;
    workspaceId: string;
    category: string;
    key: string;
    title: string;
    content: string;
    metadata?: Record<string, any> | null;
    createdAt: string;
    updatedAt: string;
}

const CATEGORY_OPTIONS = [
    { value: 'plans', label: 'Planos e Preços' },
    { value: 'regions', label: 'Regiões Atendidas' },
    { value: 'faq', label: 'Perguntas Frequentes' },
    { value: 'products', label: 'Produtos' },
    { value: 'services', label: 'Serviços' },
    { value: 'policies', label: 'Políticas' },
    { value: 'general', label: 'Geral' },
];

export const KnowledgeNode: React.FC<NodeComponentProps> = ({ node, onUpdate, activeWorkspace }) => {
    const { toast } = useToast();
    const [activeTab, setActiveTab] = useState<'create' | 'list'>('create');
    const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
    const [categories, setCategories] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [editingEntry, setEditingEntry] = useState<KnowledgeEntry | null>(null);
    const [filterCategory, setFilterCategory] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');

    // Form state
    const [formData, setFormData] = useState({
        category: 'general',
        key: '',
        title: '',
        content: '',
    });

    const workspaceId = activeWorkspace?.id;

    // Find Memory Node in workspace to inherit connection string if not set
    const knowledgeBaseId = node.knowledgeBaseId || ''; // Default to empty (global/mixed) if not set, or specific behavior
    const memoryNode = activeWorkspace?.nodes?.find(n => n.type === 'ai-memory-config');
    const connectionString = node.knowledgeConnectionString || memoryNode?.memoryConnectionString;
    const embeddingsModel = node.knowledgeEmbeddingsModel || memoryNode?.memoryEmbeddingsModel || 'local-hybrid';

    // Load entries
    const loadEntries = useCallback(async () => {
        if (!workspaceId) return;
        setIsLoading(true);
        try {
            const params = new URLSearchParams({ workspaceId });
            if (connectionString) params.append('connectionString', connectionString);

            // If ID is set, ONLY show entries for that ID (strict isolation)
            if (knowledgeBaseId) {
                params.append('category', knowledgeBaseId);
            }

            const res = await fetch(`/api/knowledge?${params}`);
            const data = await res.json();

            if (data.success) {
                setEntries(data.entries || []);
                // Categories are less relevant for the filter dropdown if we are isolated, 
                // but we might want to show available semantic categories within this base.
                // The API returns distinct 'category' column values, which now are IDs.
                // So filtering by category dropdown might be weird if we don't fix API.
                // For now, let's keep it simple: Client filtering works on the returned list.
                setCategories(data.categories || []);
            } else {
                throw new Error(data.error);
            }
        } catch (error: any) {
            toast({
                title: "Erro ao carregar",
                description: error.message,
                variant: "destructive"
            });
        } finally {
            setIsLoading(false);
        }
    }, [workspaceId, connectionString, knowledgeBaseId, toast]);

    // Load on mount and when switching to list tab
    useEffect(() => {
        // Reload when ID changes too
        if (activeTab === 'list' && workspaceId) {
            loadEntries();
        }
    }, [activeTab, workspaceId, knowledgeBaseId, loadEntries]);

    // Save entry
    const handleSave = async () => {
        if (!workspaceId) {
            toast({
                title: "Erro",
                description: "Workspace não encontrado.",
                variant: "destructive"
            });
            return;
        }

        if (!knowledgeBaseId) {
            toast({
                title: "ID da Base Obrigatório",
                description: "Defina um ID para esta Base de Conhecimento antes de salvar.",
                variant: "destructive"
            });
            return;
        }

        if (!formData.key || !formData.title || !formData.content) {
            toast({
                title: "Campos obrigatórios",
                description: "Preencha Key, Título e Conteúdo.",
                variant: "destructive"
            });
            return;
        }

        setIsSaving(true);
        try {
            const res = await fetch('/api/knowledge', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    workspaceId,
                    connectionString,
                    embeddingsModel,
                    ...formData,
                    // MAGIC SWAP: 
                    // DB Category = Collection ID (Internal strict vault)
                    category: knowledgeBaseId,
                    // DB Metadata = Semantic Category (UI grouping)
                    metadata: {
                        ...(editingEntry?.metadata || {}),
                        semanticCategory: formData.category
                    }
                })
            });

            const data = await res.json();

            if (data.success) {
                toast({
                    title: editingEntry ? "Atualizado!" : "Criado!",
                    description: `Entry "${formData.title}" salva na base "${knowledgeBaseId}".`,
                });

                // Reset form
                setFormData({ category: 'general', key: '', title: '', content: '' });
                setEditingEntry(null);

                // Refresh list if visible
                if (activeTab === 'list') {
                    loadEntries();
                }
            } else {
                throw new Error(data.error);
            }
        } catch (error: any) {
            toast({
                title: "Erro ao salvar",
                description: error.message,
                variant: "destructive"
            });
        } finally {
            setIsSaving(false);
        }
    };

    // Delete entry
    const handleDelete = async (entry: KnowledgeEntry) => {
        if (!confirm(`Deletar "${entry.title}"?`)) return;

        try {
            const params = new URLSearchParams({ id: entry.id });
            if (connectionString) params.append('connectionString', connectionString);

            const res = await fetch(`/api/knowledge?${params}`, { method: 'DELETE' });
            const data = await res.json();

            if (data.success) {
                toast({ title: "Deletado!", description: `Entry "${entry.title}" removida.` });
                loadEntries();
            } else {
                throw new Error(data.error);
            }
        } catch (error: any) {
            toast({
                title: "Erro ao deletar",
                description: error.message,
                variant: "destructive"
            });
        }
    };

    // Edit entry
    const handleEdit = (entry: KnowledgeEntry) => {
        setEditingEntry(entry);
        setFormData({
            // Restore Semantic Category from metadata (or fallback to category if legacy)
            category: entry.metadata?.semanticCategory || entry.category,
            key: entry.key,
            title: entry.title,
            content: entry.content,
        });
        setActiveTab('create');
    };

    // Filter entries
    const filteredEntries = entries.filter(e => {
        const semanticCat = e.metadata?.semanticCategory || e.category;
        const matchesCategory = filterCategory === 'all' || semanticCat === filterCategory;
        const matchesSearch = !searchQuery ||
            e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            e.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
            e.key.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesCategory && matchesSearch;
    });

    // Group entries by semantic category
    const groupedEntries = filteredEntries.reduce((acc, entry) => {
        const semanticCat = entry.metadata?.semanticCategory || entry.category;
        if (!acc[semanticCat]) acc[semanticCat] = [];
        acc[semanticCat].push(entry);
        return acc;
    }, {} as Record<string, KnowledgeEntry[]>);

    return (
        <div className="space-y-4 select-none" data-no-drag="true">
            {/* Header */}
            <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center border border-amber-500/30">
                    <Book className="w-4 h-4 text-amber-400" />
                </div>
                <div>
                    <h3 className="text-sm font-bold text-zinc-200">Base de Conhecimento</h3>
                    <p className="text-[9px] text-zinc-500">Informações para o agente consultar</p>
                </div>
            </div>

            {/* Knowledge Base ID (Isolation) */}
            <div className="space-y-1">
                <Label className="text-[10px] text-zinc-400">
                    ID da Base (Ex: "1", "vendas", "suporte")
                    <span className="text-amber-400 ml-1">*</span>
                </Label>
                <Input
                    placeholder="Digite um ID para isolar esta base"
                    value={node.knowledgeBaseId || ''}
                    onChange={(e) => onUpdate(node.id, { knowledgeBaseId: e.target.value })}
                    className="h-7 text-xs bg-black/20 border-white/5 focus:border-amber-500/50 font-mono text-amber-200/80"
                />
                <p className="text-[9px] text-zinc-600">
                    Isola os conteúdos. O bot só acessará itens com este ID.
                </p>
            </div>

            <div className="h-px bg-white/5" />

            {/* Connection String (Optional - inherited from Memory Node) */}
            <div className="space-y-1">
                <Label className="text-[10px] text-zinc-400">
                    Conexão PostgreSQL
                    {memoryNode?.memoryConnectionString && !node.knowledgeConnectionString && (
                        <span className="text-emerald-400 ml-1">(herdado do Memory Node)</span>
                    )}
                </Label>
                <Input
                    placeholder={memoryNode?.memoryConnectionString
                        ? "Usando conexão do Memory Node automaticamente"
                        : "postgres://user:pass@host:5432/db"}
                    value={node.knowledgeConnectionString || ''}
                    onChange={(e) => onUpdate(node.id, { knowledgeConnectionString: e.target.value })}
                    className="h-7 text-xs bg-black/20 border-white/5 focus:border-amber-500/50"
                />
            </div>

            {/* Embeddings Model */}
            <div className="space-y-1">
                <Label className="text-[10px] text-zinc-400">Modelo de Embeddings</Label>
                <Select
                    value={node.knowledgeEmbeddingsModel || 'local-hybrid'}
                    onValueChange={(v) => onUpdate(node.id, { knowledgeEmbeddingsModel: v })}
                >
                    <SelectTrigger className="h-7 text-xs bg-black/20 border-white/5">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="local-hybrid">Local (Smart Hybrid: MiniLM + E5)</SelectItem>
                        <SelectItem value="local-minilm">Local (MiniLM)</SelectItem>
                        <SelectItem value="local-e5">Local (E5)</SelectItem>
                        <SelectItem value="openai-text-embedding-3-small">OpenAI (small)</SelectItem>
                        <SelectItem value="openai-text-embedding-3-large">OpenAI (large)</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div className="h-px bg-white/5" />

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'create' | 'list')} className="w-full">
                <TabsList className="w-full grid grid-cols-2 h-8 bg-black/40 p-0.5 gap-0.5 rounded-lg border border-white/5">
                    <TabsTrigger value="create" className="text-[10px] h-full data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-300 gap-1.5">
                        <Plus className="w-3 h-3" /> {editingEntry ? 'Editar' : 'Criar'}
                    </TabsTrigger>
                    <TabsTrigger value="list" className="text-[10px] h-full data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-300 gap-1.5">
                        <List className="w-3 h-3" /> Listar ({entries.length})
                    </TabsTrigger>
                </TabsList>

                {/* Create/Edit Tab */}
                <TabsContent value="create" className="mt-3 space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                            <Label className="text-[9px] text-zinc-500">Categoria (Semântica)</Label>
                            <Select
                                value={formData.category}
                                onValueChange={(v) => setFormData(f => ({ ...f, category: v }))}
                            >
                                <SelectTrigger className="h-7 text-xs bg-black/30 border-white/5">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {CATEGORY_OPTIONS.map(opt => (
                                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1">
                            <Label className="text-[9px] text-zinc-500">Key (único)</Label>
                            <Input
                                placeholder="ex: plano_basic"
                                value={formData.key}
                                onChange={(e) => setFormData(f => ({ ...f, key: e.target.value.toLowerCase().replace(/\s+/g, '_') }))}
                                className="h-7 text-xs bg-black/30 border-white/5 font-mono"
                            />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <Label className="text-[9px] text-zinc-500">Título</Label>
                        <Input
                            placeholder="ex: Plano Básico"
                            value={formData.title}
                            onChange={(e) => setFormData(f => ({ ...f, title: e.target.value }))}
                            className="h-8 text-xs bg-black/30 border-white/5"
                        />
                    </div>

                    <div className="space-y-1">
                        <Label className="text-[9px] text-zinc-500">Conteúdo</Label>
                        <Textarea
                            placeholder="Descreva a informação que o agente pode consultar..."
                            value={formData.content}
                            onChange={(e) => setFormData(f => ({ ...f, content: e.target.value }))}
                            className="text-xs bg-black/30 border-white/5 min-h-[100px] resize-none"
                        />
                    </div>

                    <div className="flex gap-2">
                        {editingEntry && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                    setEditingEntry(null);
                                    setFormData({ category: 'general', key: '', title: '', content: '' });
                                }}
                                className="flex-1 h-8 text-xs border-white/10"
                            >
                                Cancelar
                            </Button>
                        )}
                        <Button
                            size="sm"
                            onClick={handleSave}
                            disabled={isSaving || !formData.key || !formData.title || !formData.content}
                            className="flex-1 h-8 text-xs bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30"
                        >
                            {isSaving ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Save className="w-3 h-3 mr-1" />}
                            {editingEntry ? 'Atualizar' : 'Salvar'}
                        </Button>
                    </div>
                </TabsContent>

                {/* List Tab */}
                <TabsContent value="list" className="mt-3 space-y-3">
                    {/* Filters */}
                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-500" />
                            <Input
                                placeholder="Buscar..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="h-7 text-xs pl-7 bg-black/30 border-white/5"
                            />
                        </div>
                        <Select value={filterCategory} onValueChange={setFilterCategory}>
                            <SelectTrigger className="w-[120px] h-7 text-xs bg-black/30 border-white/5">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todas</SelectItem>
                                {Object.keys(groupedEntries).map(cat => (
                                    <SelectItem key={cat} value={cat}>
                                        {CATEGORY_OPTIONS.find(o => o.value === cat)?.label || cat}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Entries List */}
                    <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
                        {isLoading ? (
                            <div className="flex items-center justify-center py-8 text-zinc-500">
                                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                <span className="text-xs">Carregando...</span>
                            </div>
                        ) : filteredEntries.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-8 text-zinc-500 gap-2">
                                <FolderOpen className="w-8 h-8 opacity-50" />
                                <span className="text-xs">
                                    {knowledgeBaseId ? `Nenhum item em "${knowledgeBaseId}"` : 'Nenhum item encontrado'}
                                </span>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setActiveTab('create')}
                                    className="text-xs text-amber-400 hover:text-amber-300"
                                >
                                    Criar item
                                </Button>
                            </div>
                        ) : (
                            Object.entries(groupedEntries).map(([category, catEntries]) => (
                                <div key={category} className="space-y-1">
                                    <div className="text-[9px] uppercase tracking-wider text-zinc-500 font-medium px-1">
                                        {CATEGORY_OPTIONS.find(o => o.value === category)?.label || category}
                                    </div>
                                    {catEntries.map(entry => (
                                        <div
                                            key={entry.id}
                                            className="flex items-center gap-2 p-2 rounded-lg bg-black/30 border border-white/5 hover:border-amber-500/30 transition-colors group"
                                        >
                                            <div className="flex-1 min-w-0">
                                                <div className="text-xs font-medium text-zinc-200 truncate">{entry.title}</div>
                                                <div className="text-[9px] text-zinc-500 font-mono">{entry.key}</div>
                                            </div>
                                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-6 w-6 text-zinc-400 hover:text-amber-400"
                                                    onClick={() => handleEdit(entry)}
                                                >
                                                    <Edit2 className="w-3 h-3" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-6 w-6 text-zinc-400 hover:text-red-400"
                                                    onClick={() => handleDelete(entry)}
                                                >
                                                    <Trash2 className="w-3 h-3" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ))
                        )}
                    </div>

                    {/* Refresh Button */}
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={loadEntries}
                        disabled={isLoading}
                        className="w-full h-7 text-xs border-dashed border-zinc-700"
                    >
                        {isLoading ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                        Atualizar Lista
                    </Button>
                </TabsContent>
            </Tabs>

            <p className="text-[9px] text-zinc-600 text-center">
                Conecte ao handle "tools" do Agente Inteligente
            </p>
        </div>
    );
};
