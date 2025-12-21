import React, { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Settings2, PlusCircle, Trash2, MousePointerClick, Sparkles, Loader2, History } from 'lucide-react';
import { cn } from "@/lib/utils";
import { useToast } from '@/hooks/use-toast';
import { StartNodeTrigger, WebhookVariableMapping, WorkspaceData } from '@/lib/types';
import { JsonTreeView } from './JsonTreeView';
import { convertPayloadToEditorState, describePreviewValue, formatPreviewValue, buildVariableNameFromPath, getProperty } from '../utils/nodeUtils';
import { v4 as uuidv4 } from 'uuid';
import jsonata from 'jsonata';

interface WebhookMappingBuilderProps {
    trigger: StartNodeTrigger;
    activeWorkspace?: WorkspaceData | null;
    onUpdateTrigger: (triggerId: string, updates: Partial<StartNodeTrigger>) => void;
}

type PreviewResult =
    | { type: 'empty'; message: string }
    | { type: 'no-sample'; message: string }
    | { type: 'not-found'; message: string }
    | { type: 'error'; message: string }
    | { type: 'pending'; message: string }
    | { type: 'success'; value: any };

export const WebhookMappingBuilder: React.FC<WebhookMappingBuilderProps> = ({ trigger, activeWorkspace, onUpdateTrigger }) => {
    const { toast } = useToast();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [sampleInput, setSampleInput] = useState('');
    const [sampleData, setSampleData] = useState<any | null>(null);
    const [sampleError, setSampleError] = useState<string | null>(null);
    const [isLoadingSample, setIsLoadingSample] = useState(false);
    const [focusedMappingId, setFocusedMappingId] = useState<string | null>(null);

    const handleSampleInputChange = (value: string) => {
        setSampleInput(value);
        if (!value || value.trim() === '') {
            setSampleData(null);
            setSampleError(null);
            return;
        }
        try {
            const parsed = JSON.parse(value);
            setSampleData(parsed);
            setSampleError(null);
        } catch {
            setSampleData(null);
            setSampleError('JSON inválido. Verifique se o conteúdo está bem formatado.');
        }
    };

    const clearSample = () => {
        setSampleInput('');
        setSampleData(null);
        setSampleError(null);
    };

    const handleLoadLatestSample = async () => {
        if (!activeWorkspace?.id) {
            toast({
                title: "Salve o fluxo primeiro",
                description: "Precisamos do ID do workspace para localizar o histórico do webhook.",
                variant: "destructive",
            });
            return;
        }
        setIsLoadingSample(true);
        try {
            const params = new URLSearchParams({
                workspaceId: activeWorkspace.id,
                type: 'webhook',
                limit: '1',
            });
            const response = await fetch(`/api/evolution/webhook-logs?${params.toString()}`, { cache: 'no-store' });
            if (!response.ok) throw new Error('Não foi possível buscar o último webhook.');

            const data = await response.json();
            const latest = Array.isArray(data) ? data[0] : null;

            if (!latest?.payload) {
                toast({ title: "Nenhum payload disponível", description: "Dispare o webhook novamente para gerar logs recentes." });
                return;
            }

            const result = convertPayloadToEditorState(latest.payload);
            setSampleInput(result.text);
            setSampleData(result.data);
            setSampleError(result.error);

            toast({
                title: "Payload importado",
                description: result.error ? "Importamos o corpo bruto, mas ele não pôde ser convertido automaticamente em JSON." : "Usando o último webhook recebido para sugerir mapeamentos.",
                variant: result.error ? 'destructive' : 'default',
            });
        } catch (error: any) {
            toast({
                title: "Falha ao carregar o histórico",
                description: error?.message || 'Erro desconhecido ao buscar os logs.',
                variant: "destructive",
            });
        } finally {
            setIsLoadingSample(false);
        }
    };

    const handleAddMapping = () => {
        const newMapping: WebhookVariableMapping = {
            id: uuidv4(),
            jsonPath: '',
            flowVariable: ''
        };
        onUpdateTrigger(trigger.id, {
            variableMappings: [...(trigger.variableMappings || []), newMapping]
        });
    };

    const handleRemoveMapping = (mappingId: string) => {
        onUpdateTrigger(trigger.id, {
            variableMappings: (trigger.variableMappings || []).filter(m => m.id !== mappingId)
        });
    };

    const handleUpdateMapping = (mappingId: string, field: keyof WebhookVariableMapping, value: string) => {
        onUpdateTrigger(trigger.id, {
            variableMappings: (trigger.variableMappings || []).map(m =>
                m.id === mappingId ? { ...m, [field]: value } : m
            )
        });
    };

    const getMappingPreview = (path: string): PreviewResult => {
        if (!path || path.trim() === '') return { type: 'empty', message: 'Informe o caminho do dado.' };
        if (!sampleData) return { type: 'no-sample', message: 'Cole um JSON de exemplo.' };
        try {
            const value = getProperty(sampleData, path);
            if (value === undefined) return { type: 'not-found', message: 'Valor não encontrado.' };
            return { type: 'success', value };
        } catch (error: any) {
            return { type: 'error', message: error?.message || 'Caminho inválido.' };
        }
    };

    const handleJsonTreeSelection = (path: string) => {
        if (focusedMappingId) {
            handleUpdateMapping(focusedMappingId, 'jsonPath', path);
            toast({ title: "Caminho aplicado", description: `Atualizamos o mapeamento para "${path}".` });
        } else {
            if (navigator.clipboard) {
                navigator.clipboard.writeText(path).then(() => toast({ title: "Caminho copiado!", description: path }));
            }
        }
    };


    const mappingCount = (trigger.variableMappings || []).length;

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs bg-black/20 border-white/10 hover:bg-white/5"
                        onClick={() => setIsDialogOpen(true)}
                    >
                        <Settings2 className="w-3.5 h-3.5 mr-1.5" />
                        Configurar Mapeamento
                    </Button>
                    {mappingCount > 0 && (
                        <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                            {mappingCount} variáveis
                        </span>
                    )}
                </div>
            </div>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto bg-zinc-950 border-white/10">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-semibold">Mapeamento de Webhook</DialogTitle>
                        <DialogDescription className="text-sm text-muted-foreground">
                            Configure como os dados recebidos no webhook serão transformados em variáveis do fluxo.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="rounded-md border border-white/5 bg-black/20 p-3 space-y-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <div>
                                    <p className="text-xs font-semibold text-zinc-300">Laboratório de Payload</p>
                                    <p className="text-[11px] text-muted-foreground">Cole o body recebido ou importe o último log.</p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-7 text-xs border-white/10 hover:bg-white/5"
                                        onClick={handleLoadLatestSample}
                                        disabled={isLoadingSample}
                                    >
                                        {isLoadingSample ? (
                                            <>
                                                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                                Buscando
                                            </>
                                        ) : (
                                            <>
                                                <History className="mr-1.5 h-3.5 w-3.5" />
                                                Usar último log
                                            </>
                                        )}
                                    </Button>
                                    <Button variant="outline" size="sm" className="h-7 text-xs border-white/10 hover:bg-white/5" onClick={clearSample}>
                                        Limpar
                                    </Button>
                                </div>
                            </div>
                            <Textarea
                                value={sampleInput}
                                onChange={(e) => handleSampleInputChange(e.target.value)}
                                rows={6}
                                placeholder={`{\n  "data": {\n    "message": {\n      "text": "Oi, gostaria de um orçamento"\n    }\n  }\n}`}
                                className="font-mono text-xs bg-black/40 border-white/5 focus:border-primary/50"
                            />
                            {sampleError ? (
                                <p className="text-xs text-destructive">{sampleError}</p>
                            ) : (
                                <p className="text-[11px] text-muted-foreground">Clique em qualquer chave do JSON abaixo para preencher o campo selecionado.</p>
                            )}
                            <div className="border border-white/5 rounded-md bg-black/40">
                                {sampleData ? (
                                    <ScrollArea className="h-48 pr-3">
                                        <JsonTreeView data={sampleData} onSelectPath={handleJsonTreeSelection} />
                                    </ScrollArea>
                                ) : (
                                    <div className="flex h-32 items-center justify-center px-4 text-center text-xs text-muted-foreground">
                                        Cole um JSON real do seu webhook para habilitar o assistente de mapeamento.
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <h4 className="text-sm font-medium text-zinc-200">Variáveis Mapeadas</h4>
                                <Button onClick={handleAddMapping} variant="outline" size="sm" className="text-xs h-7 border-white/10 hover:bg-white/5">
                                    <PlusCircle className="w-3 h-3 mr-1" /> Adicionar Mapeamento
                                </Button>
                            </div>

                            {(trigger.variableMappings || []).length === 0 && (
                                <div className="text-center py-8 border border-dashed border-white/10 rounded-lg text-muted-foreground text-xs">
                                    Nenhuma variável mapeada ainda. Adicione um mapeamento para começar.
                                </div>
                            )}

                            {(trigger.variableMappings || []).map((mapping, index) => {
                                const preview = getMappingPreview(mapping.jsonPath);
                                const suggestion = buildVariableNameFromPath(mapping.jsonPath);
                                const previewClass = preview.type === 'success'
                                    ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/5'
                                    : preview.type === 'error'
                                        ? 'border-destructive/30 text-destructive bg-destructive/5'
                                        : 'text-muted-foreground bg-white/5';

                                return (
                                    <div key={mapping.id} className="rounded-lg border border-white/5 bg-black/20 p-3 shadow-inner space-y-3">
                                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                                            <span className="font-medium">Mapeamento #{index + 1}</span>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleRemoveMapping(mapping.id)}
                                                className="text-zinc-500 hover:text-destructive w-7 h-7"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </Button>
                                        </div>
                                        <div className="grid gap-4 sm:grid-cols-2">
                                            <div>
                                                <Label className="text-[10px] uppercase font-semibold text-zinc-500">Caminho do dado (JSON Path)</Label>
                                                <div className="flex items-center gap-1.5 mt-1">
                                                    <Input
                                                        placeholder="Ex: data.message.text"
                                                        value={mapping.jsonPath}
                                                        onFocus={() => setFocusedMappingId(mapping.id)}
                                                        onChange={(e) => handleUpdateMapping(mapping.id, 'jsonPath', e.target.value)}
                                                        className="text-xs h-8 bg-black/40 border-white/5 focus:border-primary/50"
                                                    />
                                                    <Popover>
                                                        <PopoverTrigger asChild>
                                                            <Button variant="outline" size="icon" className="h-8 w-8 border-white/10 hover:bg-white/5" disabled={!sampleData}>
                                                                <MousePointerClick className="w-4 h-4" />
                                                            </Button>
                                                        </PopoverTrigger>
                                                        <PopoverContent className="w-[260px] p-2" align="end" data-no-drag="true">
                                                            {sampleData ? (
                                                                <ScrollArea className="h-48 pr-2">
                                                                    <JsonTreeView
                                                                        data={sampleData}
                                                                        onSelectPath={(path) => {
                                                                            handleUpdateMapping(mapping.id, 'jsonPath', path);
                                                                            setFocusedMappingId(mapping.id);
                                                                        }}
                                                                    />
                                                                </ScrollArea>
                                                            ) : (
                                                                <p className="text-xs text-muted-foreground">Cole um JSON no Laboratório para habilitar esta seleção.</p>
                                                            )}
                                                        </PopoverContent>
                                                    </Popover>
                                                </div>
                                            </div>
                                            <div>
                                                <Label className="text-[10px] uppercase font-semibold text-zinc-500">Nome da Variável</Label>
                                                <div className="flex items-center gap-1.5 mt-1">
                                                    <Input
                                                        placeholder="Ex: mensagem_usuario"
                                                        value={mapping.flowVariable}
                                                        onChange={(e) => handleUpdateMapping(mapping.id, 'flowVariable', e.target.value)}
                                                        className="text-xs h-8 bg-black/40 border-white/5 focus:border-primary/50"
                                                    />
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        className="h-8 border-white/10 hover:bg-white/5"
                                                        disabled={!suggestion || !!(mapping.flowVariable && mapping.flowVariable.trim())}
                                                        onClick={() => suggestion && handleUpdateMapping(mapping.id, 'flowVariable', suggestion)}
                                                    >
                                                        <Sparkles className="w-3.5 h-3.5 mr-1" />
                                                        Sugerir
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                        <div>
                                            <div className="flex items-center justify-between text-[10px] uppercase text-zinc-500 mb-1">
                                                <span>Pré-visualização</span>
                                                {sampleData && <span>Baseado no JSON acima</span>}
                                            </div>
                                            <div className={cn("rounded-md border px-2.5 py-2 text-xs font-mono whitespace-pre-wrap break-all min-h-[38px] flex items-center", previewClass)}>
                                                {preview.type === 'success' ? (
                                                    <div className="w-full">
                                                        <p className="text-[10px] font-semibold text-emerald-400 mb-0.5">
                                                            Valor encontrado ({describePreviewValue(preview.value)})
                                                        </p>
                                                        <div className="text-[11px] font-mono opacity-90">
                                                            {formatPreviewValue(preview.value)}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <span>{preview.message}</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                    <DialogFooter>
                        <Button onClick={() => setIsDialogOpen(false)}>Concluir</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};
