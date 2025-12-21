"use client";

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { NodeComponentProps } from '../NodeProps';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from '@/components/ui/switch';
import { VariableInserter } from '../components/VariableInserter';
import { KeyValueList } from '../components/KeyValueList';
import { JsonTreeView } from '../components/JsonTreeView';
import { useToast } from '@/hooks/use-toast';
import { NodeData, ApiHeader, ApiQueryParam, ApiFormDataEntry, NodeType } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';
import { cn } from "@/lib/utils";
import jsonata from 'jsonata';
import {
    TerminalSquare, History, Sparkles, TestTube2, AlertCircle,
    Loader2, Trash2, PlusCircle, MousePointerClick, List, Baseline
} from 'lucide-react';
import {
    parseCurlCommand
} from '../utils/curlUtils';
import {
    convertIndicesToBracketNotation,
    buildVariableNameFromPath,
    describePreviewValue,
    formatPreviewValue,
    convertPayloadToEditorState,
    PreviewResult
} from '../utils/nodeUtils';
import ApiCallLogsViewer from '../logs/ApiCallLogsViewer';
import { NODE_HEADER_CONNECTOR_Y_OFFSET } from '@/lib/constants';

const ConnectorDot = ({
    onMouseDown,
    handleId,
    title,
    colorClass = "bg-zinc-400 group-hover/connector:bg-primary"
}: {
    onMouseDown: (e: React.MouseEvent) => void,
    handleId: string,
    title?: string,
    colorClass?: string
}) => (
    <div
        className="w-3 h-3 rounded-full shadow-lg ring-2 ring-zinc-900 transition-all duration-300 group-hover/connector:w-4 group-hover/connector:h-4 group-hover/connector:ring-primary/30 cursor-crosshair"
        onMouseDown={onMouseDown}
        data-connector="true"
        data-handle-type="source"
        data-handle-id={handleId}
        title={title}
    >
        <div className={cn("w-full h-full rounded-full transition-colors duration-300", colorClass)} />
    </div>
);

const API_PREVIEW_KEY_PRIMARY = '__primary__';

export const ApiCallNode: React.FC<NodeComponentProps> = ({ node, onUpdate, availableVariables, onStartConnection, activeWorkspace }) => {
    const { toast } = useToast();

    const [apiSampleInput, setApiSampleInput] = useState('');
    const [apiSampleData, setApiSampleData] = useState<any | null>(null);
    const [apiSampleError, setApiSampleError] = useState<string | null>(null);
    const [isLoadingApiSample, setIsLoadingApiSample] = useState(false);
    const [focusedApiMappingId, setFocusedApiMappingId] = useState<string | null>(null);
    const [apiPreviewResults, setApiPreviewResults] = useState<Record<string, PreviewResult>>({});
    const [isCurlImportDialogOpen, setIsCurlImportDialogOpen] = useState(false);
    const [curlInput, setCurlInput] = useState('');
    const [curlImportError, setCurlImportError] = useState<string | null>(null);

    const [isTestingApi, setIsTestingApi] = useState(false);
    const [testResponseData, setTestResponseData] = useState<any | null>(null);
    const [testResponseError, setTestResponseError] = useState<string | null>(null);
    const [isTestResponseModalOpen, setIsTestResponseModalOpen] = useState(false);
    const [isApiHistoryDialogOpen, setIsApiHistoryDialogOpen] = useState(false);
    const [isApiMappingDialogOpen, setIsApiMappingDialogOpen] = useState(false);


    const apiMappingsSignature = useMemo(() => {
        return (node.apiResponseMappings || [])
            .map(mapping => `${mapping.id}:${mapping.jsonPath || ''}:${mapping.extractAs || 'single'}:${mapping.itemField || ''}`)
            .join('|');
    }, [node.apiResponseMappings]);

    const handleApiSampleInputChange = (value: string) => {
        setApiSampleInput(value);
        if (!value || value.trim() === '') {
            setApiSampleData(null);
            setApiSampleError(null);
            return;
        }
        try {
            const parsed = JSON.parse(value);
            setApiSampleData(parsed);
            setApiSampleError(null);
        } catch {
            setApiSampleData(null);
            setApiSampleError('JSON inválido.');
        }
    };

    const clearSampleEditor = () => {
        setApiSampleInput('');
        setApiSampleData(null);
        setApiSampleError(null);
    };

    const applySamplePayloadFromSource = useCallback((payload: any) => {
        const prepared = convertPayloadToEditorState(payload);
        setApiSampleInput(prepared.text);
        setApiSampleData(prepared.data);
        setApiSampleError(prepared.error);
        return prepared.error;
    }, []);

    const handleLoadLatestApiSample = useCallback(async () => {
        if (!activeWorkspace?.id) {
            toast({
                title: "Salve o fluxo primeiro",
                description: "Precisamos do ID do workspace para localizar os logs da API.",
                variant: "destructive",
            });
            return;
        }
        setIsLoadingApiSample(true);
        try {
            const params = new URLSearchParams({
                workspaceId: activeWorkspace.id,
                nodeId: node.id,
                limit: '1',
            });
            const response = await fetch(`/api/api-call-logs?${params.toString()}`, { cache: 'no-store' });
            if (!response.ok) {
                throw new Error('Não foi possível buscar o último log de API.');
            }
            const data = await response.json();
            const latest = Array.isArray(data) ? data[0] : null;
            if (!latest?.response) {
                toast({
                    title: "Nenhuma resposta encontrada",
                    description: "Execute o fluxo ou o teste para gerar logs desta chamada de API.",
                });
                return;
            }
            const errorMessage = applySamplePayloadFromSource(latest.response);
            toast({
                title: "Resposta importada",
                description: errorMessage
                    ? "Importamos o corpo bruto, mas ele não pôde ser convertido automaticamente em JSON."
                    : "Usando o último log para sugerir caminhos.",
                variant: errorMessage ? 'destructive' : 'default',
            });
        } catch (error: any) {
            toast({
                title: "Falha ao carregar o log da API",
                description: error?.message || 'Erro desconhecido ao buscar os logs.',
                variant: "destructive",
            });
        } finally {
            setIsLoadingApiSample(false);
        }
    }, [activeWorkspace?.id, node.id, toast, applySamplePayloadFromSource]);

    const handleUseLastTestResponseAsSample = () => {
        if (!testResponseData) {
            toast({
                title: "Nenhum teste disponível",
                description: "Execute o teste da API para capturar uma resposta.",
                variant: "destructive",
            });
            return;
        }
        const errorMessage = applySamplePayloadFromSource(testResponseData);
        toast({
            title: "Resposta de teste aplicada",
            description: errorMessage
                ? "Corpo bruto usado, JSON inválido."
                : "Agora você pode clicar nos campos para preencher automaticamente.",
            variant: errorMessage ? 'destructive' : 'default',
        });
    };

    const handleJsonTreeSelection = (rawPath: string) => {
        const path = convertIndicesToBracketNotation(rawPath);
        if (focusedApiMappingId === API_PREVIEW_KEY_PRIMARY) {
            onUpdate(node.id, { apiResponsePath: path });
            toast({ title: "Caminho principal atualizado", description: `Usaremos "${path}"` });
            return;
        }
        if (focusedApiMappingId) {
            // Find mapping and update it.
            const updatedMappings = (node.apiResponseMappings || []).map(m => m.id === focusedApiMappingId ? { ...m, jsonPath: path } : m);
            onUpdate(node.id, { apiResponseMappings: updatedMappings });
            toast({ title: "Expressão preenchida", description: `Atualizamos para "${path}".` });
            return;
        }
        // Copy to clipboard fallback
        if (navigator.clipboard) {
            navigator.clipboard.writeText(path).then(() => toast({ title: "Caminho copiado!", description: path }));
        }
    };

    // JSONata evaluation effect
    useEffect(() => {
        let isCancelled = false;
        const evaluateExpressionAsync = async (expression: string | undefined): Promise<PreviewResult> => {
            if (!expression || expression.trim() === '') return { type: 'empty', message: 'Defina a expressão.' };
            if (!apiSampleData) return { type: 'no-sample', message: 'Sem JSON de exemplo.' };
            try {
                const value = await jsonata(expression).evaluate(apiSampleData);
                if (value === undefined) return { type: 'not-found', message: 'Sem valor encontrado.' };
                return { type: 'success', value };
            } catch (error: any) {
                return { type: 'error', message: error?.message || 'Expressão inválida.' };
            }
        };

        const run = async () => {
            const nextResults: Record<string, PreviewResult> = {};
            nextResults[API_PREVIEW_KEY_PRIMARY] = await evaluateExpressionAsync(node.apiResponsePath);
            for (const mapping of node.apiResponseMappings || []) {
                nextResults[mapping.id] = await evaluateExpressionAsync(mapping.jsonPath);
            }
            if (!isCancelled) setApiPreviewResults(nextResults);
        };
        run();
        return () => { isCancelled = true; };
    }, [apiSampleData, node.apiResponsePath, apiMappingsSignature]);

    const getApiPreviewResult = (key: string): PreviewResult => {
        const res = apiPreviewResults[key];
        if (!res) return { type: 'pending', message: '...' };
        return res;
    };

    const handleApplyCurlImport = useCallback(() => {
        try {
            const parsed = parseCurlCommand(curlInput);
            const mappedHeaders: ApiHeader[] = parsed.headers.map(({ key, value }) => ({ id: uuidv4(), key, value }));
            const mappedQuery: ApiQueryParam[] = parsed.queryParams.map(({ key, value }) => ({ id: uuidv4(), key, value }));
            const mappedForm: ApiFormDataEntry[] = parsed.formData.map(({ key, value }) => ({ id: uuidv4(), key, value }));
            const updates: Partial<NodeData> = {
                apiUrl: parsed.url,
                apiMethod: parsed.method,
                apiHeadersList: mappedHeaders,
                apiQueryParamsList: mappedQuery,
                apiBodyType: parsed.bodyType,
                apiBodyFormDataList: parsed.bodyType === 'form-data' ? mappedForm : [],
                apiBodyJson: parsed.bodyType === 'json' ? (parsed.bodyJson || '') : '',
                apiBodyRaw: parsed.bodyType === 'raw' ? (parsed.bodyRaw || '') : '',
                apiAuthType: parsed.auth?.type ?? 'none',
                apiAuthBearerToken: parsed.auth?.type === 'bearer' ? (parsed.auth?.bearerToken || '') : '',
                apiAuthBasicUser: parsed.auth?.type === 'basic' ? (parsed.auth?.basicUser || '') : '',
                apiAuthBasicPassword: parsed.auth?.type === 'basic' ? (parsed.auth?.basicPassword || '') : '',
            };

            onUpdate(node.id, updates);
            toast({ title: 'Comando cURL importado!', description: 'URL, método, headers e corpo preenchidos.' });
            setCurlImportError(null);
            setCurlInput('');
            setIsCurlImportDialogOpen(false);
        } catch (error: any) {
            setCurlImportError(error?.message || 'Falha ao importar cURL.');
        }
    }, [curlInput, node.id, onUpdate, toast]);

    const handleTestApiCall = async () => {
        if (!node.apiUrl?.trim().startsWith('http')) {
            toast({ title: "URL inválida", description: "Insira uma URL válida (http/https).", variant: "destructive" });
            return;
        }
        setIsTestingApi(true);
        setTestResponseData(null);
        setTestResponseError(null);

        const apiDetails = {
            url: node.apiUrl,
            method: node.apiMethod,
            headers: node.apiHeadersList,
            queryParams: node.apiQueryParamsList,
            auth: {
                type: node.apiAuthType,
                bearerToken: node.apiAuthBearerToken,
                basicUser: node.apiAuthBasicUser,
                basicPassword: node.apiAuthBasicPassword,
            },
            body: {
                type: node.apiBodyType,
                json: node.apiBodyJson,
                formData: node.apiBodyFormDataList,
                raw: node.apiBodyRaw,
            },
        };

        try {
            const response = await fetch('/api/test-api-call', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(apiDetails),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || `Erro: ${response.status}`);

            setTestResponseData(result.data);
            setIsTestResponseModalOpen(true);
            toast({ title: "API Testada!", description: `Status: ${result.status}` });

            // Log for history (fire and forget)
            if (activeWorkspace?.id) {
                fetch('/api/evolution/webhook-logs', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        workspaceId: activeWorkspace.id,
                        type: 'api-call',
                        nodeId: node.id,
                        nodeTitle: node.title,
                        requestUrl: node.apiUrl,
                        response: result.data,
                        error: null,
                        sessionId: null
                    }),
                }).catch(console.error);
            }

        } catch (error: any) {
            setTestResponseError(error.message);
            setIsTestResponseModalOpen(true);
            toast({ title: "Erro no Teste", description: error.message, variant: "destructive" });
        } finally {
            setIsTestingApi(false);
        }
    };

    // Handlers for mapping list
    const handleAddMapping = () => {
        const newMapping = { id: uuidv4(), jsonPath: '', flowVariable: '', extractAs: 'single' as const };
        onUpdate(node.id, { apiResponseMappings: [...(node.apiResponseMappings || []), newMapping] });
    };
    const handleRemoveMapping = (id: string) => {
        onUpdate(node.id, { apiResponseMappings: (node.apiResponseMappings || []).filter(m => m.id !== id) });
    };
    const handleUpdateMapping = (id: string, field: string, value: any) => {
        onUpdate(node.id, { apiResponseMappings: (node.apiResponseMappings || []).map(m => m.id === id ? { ...m, [field]: value } : m) });
    };


    const renderApiMappingBuilder = () => (
        <div className="space-y-2">
            {/* Primary Result Builder */}
            <div className="grid gap-2 sm:grid-cols-2">
                <div>
                    <Label htmlFor={`${node.id}-apiResponsePath`} className="text-[10px] font-medium text-zinc-400 mb-1 block">Caminho Principal</Label>
                    <div className="flex items-center gap-1.5 mt-1">
                        <Input
                            id={`${node.id}-apiResponsePath`}
                            placeholder="Ex: data.user.id"
                            value={node.apiResponsePath || ''}
                            onFocus={() => setFocusedApiMappingId(API_PREVIEW_KEY_PRIMARY)}
                            onChange={(e) => onUpdate(node.id, { apiResponsePath: e.target.value })}
                            className="h-7 text-xs pr-7 bg-black/20 border-white/5 focus:border-primary/50"
                        />
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="outline" size="icon" className="h-7 w-7 border-white/10 hover:bg-white/5" disabled={!apiSampleData}>
                                    <MousePointerClick className="w-3.5 h-3.5" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[260px] p-2" align="end" data-no-drag="true">
                                {apiSampleData ? (
                                    <ScrollArea className="h-48 pr-2">
                                        <JsonTreeView data={apiSampleData} onSelectPath={handleJsonTreeSelection} />
                                    </ScrollArea>
                                ) : <p className="text-[10px] text-muted-foreground">Importe um JSON para usar.</p>}
                            </PopoverContent>
                        </Popover>
                    </div>
                    <div className="mt-2 rounded-md border border-white/5 bg-black/20 px-2 py-1.5 text-[10px] font-mono whitespace-pre-wrap break-all min-h-[40px]">
                        {(() => {
                            const preview = getApiPreviewResult(API_PREVIEW_KEY_PRIMARY);
                            if (preview.type === 'success') {
                                return <><span className="text-emerald-400 font-semibold">Valor ({describePreviewValue(preview.value)})</span><br />{formatPreviewValue(preview.value)}</>;
                            }
                            return <span className="text-muted-foreground">{preview.message}</span>;
                        })()}
                    </div>
                </div>
                <div>
                    <Label className="text-[10px] font-medium text-zinc-400 mb-1 block">Variável de Saída</Label>
                    <div className="flex items-center gap-1.5 mt-1">
                        <Input
                            placeholder="nome_variavel"
                            value={node.apiOutputVariable || ''}
                            onChange={(e) => onUpdate(node.id, { apiOutputVariable: e.target.value })}
                            className="h-7 text-xs bg-black/20 border-white/5"
                        />
                        <Button
                            variant="outline" size="sm" className="h-7 text-[10px] px-2 border-white/10"
                            onClick={() => {
                                const sug = buildVariableNameFromPath(node.apiResponsePath || '');
                                if (sug) onUpdate(node.id, { apiOutputVariable: sug });
                            }}
                        >
                            <Sparkles className="w-3 h-3 mr-1" /> Sugerir
                        </Button>
                    </div>
                </div>
            </div>

            {/* Sample Data Editor */}
            <div className="rounded-md border border-white/5 bg-black/10 p-2 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[10px] font-semibold text-zinc-300">Laboratório de Resposta (JSON)</p>
                    <div className="flex gap-1">
                        <Button variant="outline" size="sm" className="h-6 text-[10px]" onClick={handleLoadLatestApiSample} disabled={isLoadingApiSample}>
                            {isLoadingApiSample ? <Loader2 className="w-3 h-3 animate-spin" /> : <History className="w-3 h-3 mr-1" />} Último Log
                        </Button>
                        <Button variant="outline" size="sm" className="h-6 text-[10px]" onClick={handleUseLastTestResponseAsSample}>
                            <TestTube2 className="w-3 h-3 mr-1" /> Teste
                        </Button>
                        <Button variant="outline" size="sm" className="h-6 text-[10px]" onClick={clearSampleEditor}>Limpar</Button>
                    </div>
                </div>
                <Textarea
                    value={apiSampleInput}
                    onChange={(e) => handleApiSampleInputChange(e.target.value)}
                    rows={4}
                    className="font-mono text-[10px] bg-black/20 border-white/5 resize-none"
                    placeholder='{ "data": ... }'
                />
                {apiSampleError && <p className="text-[10px] text-destructive">{apiSampleError}</p>}
                <div className="border border-white/5 rounded-md bg-black/20 h-32 overflow-hidden">
                    {apiSampleData ? (
                        <ScrollArea className="h-full">
                            <JsonTreeView data={apiSampleData} onSelectPath={handleJsonTreeSelection} />
                        </ScrollArea>
                    ) : <div className="flex h-full items-center justify-center text-[10px] text-muted-foreground p-4">Cole um JSON para explorar.</div>}
                </div>
            </div>

            {/* Additional Mappings */}
            <div className="pt-2 space-y-2">
                <Label className="text-[10px] font-medium text-zinc-400">Mapeamentos Adicionais</Label>
                {(node.apiResponseMappings || []).map((mapping, idx) => {
                    const preview = getApiPreviewResult(mapping.id);
                    return (
                        <div key={mapping.id} className="rounded-lg border border-white/5 bg-black/20 p-2 space-y-2">
                            <div className="flex justify-between items-center">
                                <span className="text-[10px] font-medium text-zinc-500">#{idx + 1}</span>
                                <Button variant="ghost" size="icon" className="h-6 w-6 text-zinc-500 hover:text-destructive" onClick={() => handleRemoveMapping(mapping.id)}><Trash2 className="w-3 h-3" /></Button>
                            </div>
                            <div className="grid gap-2 sm:grid-cols-2">
                                <div>
                                    <Label className="text-[10px] text-zinc-500">JSONata</Label>
                                    <div className="flex gap-1 mt-1">
                                        <Input
                                            value={mapping.jsonPath}
                                            onFocus={() => setFocusedApiMappingId(mapping.id)}
                                            onChange={(e) => handleUpdateMapping(mapping.id, 'jsonPath', e.target.value)}
                                            className="h-7 text-xs bg-black/20 border-white/5"
                                        />
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button variant="outline" size="icon" className="h-7 w-7 border-white/10 hover:bg-white/5" disabled={!apiSampleData}>
                                                    <MousePointerClick className="w-3.5 h-3.5" />
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-[260px] p-2" align="end" data-no-drag="true">
                                                {apiSampleData && <ScrollArea className="h-48 pr-2"><JsonTreeView data={apiSampleData} onSelectPath={handleJsonTreeSelection} /></ScrollArea>}
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                </div>
                                <div>
                                    <Label className="text-[10px] text-zinc-500">Variável</Label>
                                    <div className="flex gap-1 mt-1">
                                        <Input
                                            value={mapping.flowVariable}
                                            onChange={(e) => handleUpdateMapping(mapping.id, 'flowVariable', e.target.value)}
                                            className="h-7 text-xs bg-black/20 border-white/5"
                                        />
                                        <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => {
                                            const sug = buildVariableNameFromPath(mapping.jsonPath);
                                            if (sug) handleUpdateMapping(mapping.id, 'flowVariable', sug);
                                        }}><Sparkles className="w-3 h-3" /></Button>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <div>
                                    <Label className="text-[10px] text-zinc-500">Extrair como</Label>
                                    <Select value={mapping.extractAs || 'single'} onValueChange={(val) => handleUpdateMapping(mapping.id, 'extractAs', val)}>
                                        <SelectTrigger className="h-7 w-[100px] text-[10px] bg-black/20 border-white/5"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="single">Valor</SelectItem>
                                            <SelectItem value="list">Lista</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                {mapping.extractAs === 'list' && (
                                    <div className="flex-1">
                                        <Label className="text-[10px] text-zinc-500">Campo do Item</Label>
                                        <Input value={mapping.itemField || ''} onChange={(e) => handleUpdateMapping(mapping.id, 'itemField', e.target.value)} className="h-7 text-xs bg-black/20 border-white/5" />
                                    </div>
                                )}
                            </div>
                            <div className="rounded border border-white/5 px-2 py-1 bg-black/30 min-h-[24px]">
                                {preview.type === 'success' ? (
                                    <span className="text-[10px] text-emerald-400 font-mono break-all">{formatPreviewValue(preview.value).slice(0, 100)}</span>
                                ) : <span className="text-[10px] text-muted-foreground">{preview.message}</span>}
                            </div>
                        </div>
                    );
                })}
                <Button onClick={handleAddMapping} variant="outline" size="sm" className="w-full text-xs border-dashed border-white/10 hover:bg-white/5 text-zinc-400">
                    <PlusCircle className="mr-1.5 w-3 h-3" /> Adicionar Mapeamento
                </Button>
            </div>
        </div>
    );

    return (
        <div className="space-y-2" data-no-drag="true">
            <div>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                    <Label htmlFor={`${node.id}-apiurl`} className="text-[10px] font-medium text-zinc-400">URL da Requisição</Label>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => { setCurlImportError(null); setIsCurlImportDialogOpen(true); }}
                        className="h-6 text-[10px] px-2 border-white/10 hover:bg-white/5"
                    >
                        <TerminalSquare className="w-3 h-3 mr-1" /> Importar cURL
                    </Button>
                </div>
                <div className="relative">
                    <Input
                        id={`${node.id}-apiurl`}
                        placeholder="https://api.example.com/data"
                        value={node.apiUrl || ''}
                        onChange={(e) => onUpdate(node.id, { apiUrl: e.target.value })}
                        className="h-7 text-xs pr-7 bg-black/20 border-white/5 focus:border-primary/50"
                    />
                    <VariableInserter fieldName="apiUrl" isIconTrigger onInsert={(v) => onUpdate(node.id, { apiUrl: (node.apiUrl || '') + v })} />
                </div>
            </div>
            <div>
                <Label htmlFor={`${node.id}-apimethod`} className="text-[10px] font-medium text-zinc-400">Método HTTP</Label>
                <Select value={node.apiMethod || 'GET'} onValueChange={(value) => onUpdate(node.id, { apiMethod: value as NodeData['apiMethod'] })}>
                    <SelectTrigger id={`${node.id}-apimethod`} className="h-7 text-xs bg-black/20 border-white/5 focus:border-primary/50"><SelectValue placeholder="Selecione o método" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="GET">GET</SelectItem><SelectItem value="POST">POST</SelectItem>
                        <SelectItem value="PUT">PUT</SelectItem><SelectItem value="DELETE">DELETE</SelectItem>
                        <SelectItem value="PATCH">PATCH</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <Tabs defaultValue="auth" className="w-full">
                <TabsList className="grid w-full grid-cols-5 h-7 p-0.5 bg-black/20">
                    <TabsTrigger value="auth" className="text-[10px] h-6 px-1 data-[state=active]:bg-white/10">Auth</TabsTrigger>
                    <TabsTrigger value="headers" className="text-[10px] h-6 px-1 data-[state=active]:bg-white/10">Headers</TabsTrigger>
                    <TabsTrigger value="params" className="text-[10px] h-6 px-1 data-[state=active]:bg-white/10">Query</TabsTrigger>
                    <TabsTrigger value="body" className="text-[10px] h-6 px-1 data-[state=active]:bg-white/10">Corpo</TabsTrigger>
                    <TabsTrigger value="mapping" className="text-[10px] h-6 px-1 data-[state=active]:bg-white/10">Map</TabsTrigger>
                </TabsList>

                <TabsContent value="auth" className="mt-2 space-y-2">
                    <div>
                        <Label className="text-[10px] font-medium text-zinc-400">Tipo de Autenticação</Label>
                        <Select value={node.apiAuthType || 'none'} onValueChange={(value) => onUpdate(node.id, { apiAuthType: value as NodeData['apiAuthType'] })}>
                            <SelectTrigger className="h-7 text-xs bg-black/20 border-white/5"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">Nenhuma</SelectItem>
                                <SelectItem value="bearer">Bearer Token</SelectItem>
                                <SelectItem value="basic">Básica (Usuário/Senha)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    {node.apiAuthType === 'bearer' && (
                        <div>
                            <Label className="text-[10px] text-zinc-400">Bearer Token</Label>
                            <div className="relative">
                                <Input value={node.apiAuthBearerToken || ''} onChange={(e) => onUpdate(node.id, { apiAuthBearerToken: e.target.value })} className="h-7 text-xs pr-7 bg-black/20 border-white/5" placeholder="Token" />
                                <VariableInserter fieldName="apiAuthBearerToken" isIconTrigger onInsert={(v) => onUpdate(node.id, { apiAuthBearerToken: (node.apiAuthBearerToken || '') + v })} />
                            </div>
                        </div>
                    )}
                    {node.apiAuthType === 'basic' && (
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <Label className="text-[10px] text-zinc-400">Usuário</Label>
                                <div className="relative">
                                    <Input value={node.apiAuthBasicUser || ''} onChange={(e) => onUpdate(node.id, { apiAuthBasicUser: e.target.value })} className="h-7 text-xs pr-7 bg-black/20 border-white/5" />
                                    <VariableInserter fieldName="apiAuthBasicUser" isIconTrigger onInsert={(v) => onUpdate(node.id, { apiAuthBasicUser: (node.apiAuthBasicUser || '') + v })} />
                                </div>
                            </div>
                            <div>
                                <Label className="text-[10px] text-zinc-400">Senha</Label>
                                <div className="relative">
                                    <Input type="password" value={node.apiAuthBasicPassword || ''} onChange={(e) => onUpdate(node.id, { apiAuthBasicPassword: e.target.value })} className="h-7 text-xs pr-7 bg-black/20 border-white/5" />
                                    <VariableInserter fieldName="apiAuthBasicPassword" isIconTrigger onInsert={(v) => onUpdate(node.id, { apiAuthBasicPassword: (node.apiAuthBasicPassword || '') + v })} />
                                </div>
                            </div>
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="headers" className="mt-2 text-[10px]">
                    <KeyValueList
                        list={node.apiHeadersList || []}
                        onUpdate={(list) => onUpdate(node.id, { apiHeadersList: list })}
                        keyPlaceholder="Header" valuePlaceholder="Valor" addButtonLabel="Add Header"
                        variableInserterId="apiHeadersList"
                    />
                </TabsContent>

                <TabsContent value="params" className="mt-2 text-[10px]">
                    <KeyValueList
                        list={node.apiQueryParamsList || []}
                        onUpdate={(list) => onUpdate(node.id, { apiQueryParamsList: list })}
                        keyPlaceholder="Param" valuePlaceholder="Valor" addButtonLabel="Add Param"
                        variableInserterId="apiQueryParamsList"
                    />
                </TabsContent>

                <TabsContent value="body" className="mt-2 space-y-2">
                    <div>
                        <Label className="text-[10px] text-zinc-400">Tipo de Corpo</Label>
                        <Select value={node.apiBodyType || 'none'} onValueChange={(val) => onUpdate(node.id, { apiBodyType: val as NodeData['apiBodyType'] })}>
                            <SelectTrigger className="h-7 text-xs bg-black/20 border-white/5"><SelectValue /></SelectTrigger>
                            <SelectContent><SelectItem value="none">Nenhum</SelectItem><SelectItem value="json">JSON</SelectItem><SelectItem value="form-data">Form-Data</SelectItem><SelectItem value="raw">Raw</SelectItem></SelectContent>
                        </Select>
                    </div>
                    {node.apiBodyType === 'json' && (
                        <div className="relative">
                            <Textarea value={node.apiBodyJson || ''} onChange={(e) => onUpdate(node.id, { apiBodyJson: e.target.value })} rows={5} className="text-xs font-mono bg-black/20 border-white/5 pr-6" placeholder="{ ... }" />
                            <VariableInserter fieldName="apiBodyJson" isIconTrigger isTextarea onInsert={(v) => onUpdate(node.id, { apiBodyJson: (node.apiBodyJson || '') + v })} />
                        </div>
                    )}
                    {node.apiBodyType === 'form-data' && (
                        <KeyValueList
                            list={node.apiBodyFormDataList || []}
                            onUpdate={(list) => onUpdate(node.id, { apiBodyFormDataList: list })}
                            keyPlaceholder="Campo" valuePlaceholder="Valor" addButtonLabel="Add Campo"
                            variableInserterId="apiBodyFormDataList"
                        />
                    )}
                    {node.apiBodyType === 'raw' && (
                        <div className="relative">
                            <Textarea value={node.apiBodyRaw || ''} onChange={(e) => onUpdate(node.id, { apiBodyRaw: e.target.value })} rows={5} className="text-xs font-mono bg-black/20 border-white/5 pr-6" />
                            <VariableInserter fieldName="apiBodyRaw" isIconTrigger isTextarea onInsert={(v) => onUpdate(node.id, { apiBodyRaw: (node.apiBodyRaw || '') + v })} />
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="mapping" className="mt-2 space-y-2">
                    <div className="rounded-md border border-white/5 bg-black/20 p-2 space-y-2">
                        <div className="flex justify-between items-center">
                            <p className="text-[10px] font-medium text-zinc-300">Resumo</p>
                            <Button variant="outline" size="sm" onClick={() => setIsApiMappingDialogOpen(true)} className="h-6 text-[10px] border-white/10 hover:bg-white/5">
                                <Sparkles className="w-3 h-3 mr-1" /> Construtor
                            </Button>
                        </div>
                        <div className="grid gap-1">
                            {node.apiResponsePath && <div className="text-[10px] text-zinc-400">Var: {node.apiOutputVariable} (de {node.apiResponsePath})</div>}
                            {((node.apiResponseMappings || []).length > 0) && <div className="text-[10px] text-zinc-500">+{node.apiResponseMappings?.length} extras mapeados</div>}
                        </div>
                    </div>
                </TabsContent>
            </Tabs>

            <div className="flex gap-2 w-full mt-2">
                <Button variant="outline" className="w-full h-7 text-xs border-white/10 hover:bg-white/5" onClick={handleTestApiCall} disabled={isTestingApi}>
                    <TestTube2 className="mr-1.5 h-3.5 w-3.5" /> {isTestingApi ? "Testando..." : "Testar"}
                </Button>
                <Button variant="outline" className="w-full h-7 text-xs border-white/10 hover:bg-white/5" onClick={() => setIsApiHistoryDialogOpen(true)}>
                    <History className="mr-1.5 h-3.5 w-3.5" /> Histórico
                </Button>
            </div>

            <Dialog open={isApiMappingDialogOpen} onOpenChange={setIsApiMappingDialogOpen}>
                <DialogContent className="sm:max-w-4xl max-h-[85vh] overflow-y-auto" data-no-drag="true">
                    <DialogHeader><DialogTitle>Construtor de Mapeamento</DialogTitle><DialogDescription>Mapeie a resposta da API para variáveis.</DialogDescription></DialogHeader>
                    {renderApiMappingBuilder()}
                </DialogContent>
            </Dialog>

            <Dialog open={isTestResponseModalOpen} onOpenChange={setIsTestResponseModalOpen}>
                <DialogContent className="sm:max-w-xl max-h-[70vh] flex flex-col" data-no-drag="true">
                    <DialogHeader><DialogTitle>Resultado do Teste</DialogTitle></DialogHeader>
                    {testResponseError && <div className="p-2 bg-destructive/10 text-destructive text-xs rounded border border-destructive/50">{testResponseError}</div>}
                    {testResponseData && (
                        <div className="flex-1 overflow-hidden border rounded bg-black/20">
                            <ScrollArea className="h-[400px]">
                                <JsonTreeView data={testResponseData} onSelectPath={(path) => {
                                    onUpdate(node.id, { apiResponsePath: convertIndicesToBracketNotation(path) });
                                    toast({ title: "Caminho copiado para o campo principal!" });
                                }} />
                            </ScrollArea>
                        </div>
                    )}
                    <DialogFooter><DialogClose asChild><Button variant="outline">Fechar</Button></DialogClose></DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isApiHistoryDialogOpen} onOpenChange={setIsApiHistoryDialogOpen}>
                <ApiCallLogsViewer
                    isOpen={isApiHistoryDialogOpen}
                    onClose={() => setIsApiHistoryDialogOpen(false)}
                    workspaceId={activeWorkspace?.id || ''}
                    nodeId={node.id}
                    nodeTitle={node.title}
                />
            </Dialog>

            <Dialog open={isCurlImportDialogOpen} onOpenChange={setIsCurlImportDialogOpen}>
                <DialogContent className="sm:max-w-lg" data-no-drag="true">
                    <DialogHeader><DialogTitle>Importar cURL</DialogTitle></DialogHeader>
                    <Textarea value={curlInput} onChange={(e) => setCurlInput(e.target.value)} rows={5} className="text-xs font-mono" placeholder="curl ..." />
                    {curlImportError && <p className="text-destructive text-xs">{curlImportError}</p>}
                    <DialogFooter><Button onClick={handleApplyCurlImport}>Importar</Button></DialogFooter>
                </DialogContent>
            </Dialog>

            <div className="absolute -right-3 z-20 flex items-center justify-center group/connector" style={{ top: `${NODE_HEADER_CONNECTOR_Y_OFFSET}px`, transform: 'translateY(-50%)' }}>
                <ConnectorDot onMouseDown={(e) => { e.stopPropagation(); onStartConnection(e, node, 'default'); }} handleId="default" title="Sucesso" colorClass="bg-green-500 group-hover/connector:bg-green-400" />
            </div>
            <div className="absolute -right-3 z-20 flex items-center justify-center group/connector" style={{ top: `${NODE_HEADER_CONNECTOR_Y_OFFSET + 25}px`, transform: 'translateY(-50%)' }}>
                <ConnectorDot onMouseDown={(e) => { e.stopPropagation(); onStartConnection(e, node, 'error'); }} handleId="error" title="Falha/Erro" colorClass="bg-red-500 group-hover/connector:bg-red-400" />
            </div>
        </div>
    );
};
