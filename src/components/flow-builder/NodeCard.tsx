

"use client";

import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import type {
  NodeData,
  ApiHeader,
  ApiQueryParam,
  ApiFormDataEntry,
  StartNodeTrigger,
  WebhookVariableMapping,
  WorkspaceData,
  EvolutionInstance,
  SwitchCase,
  ChatwootInstance,
  DialogyInstance,
  NodeType,
  ApiResponseMapping,
  FlowLog,
} from '@/lib/types';
import { motion } from 'framer-motion';
import { v4 as uuidv4 } from 'uuid';
import { getProperty } from 'dot-prop';
import {
  MessageSquareText, Type as InputIcon, ListChecks, Trash2, BotMessageSquare,
  ImageUp, UserPlus2, GitFork, Variable, Webhook, Timer, Settings2, Copy,
  CalendarDays, ExternalLink, MoreHorizontal, FileImage,
  TerminalSquare, Code2, Shuffle, UploadCloud, Star, Sparkles, Mail, Sheet, Headset, Hash,
  Database, Rows, Search, Edit3, PlayCircle, PlusCircle, GripVertical, TestTube2, Braces, Loader2, KeyRound, StopCircle, MousePointerClick, Hourglass, GitCommitHorizontal, MessageCircle, Rocket, AlertCircle, FileText, History, Target, Bold, Italic, Strikethrough, Code, List, Baseline, BrainCircuit as BrainIcon,
} from 'lucide-react';
import { cn } from "@/lib/utils";

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import {
  START_NODE_TRIGGER_INITIAL_Y_OFFSET, START_NODE_TRIGGER_SPACING_Y,
  OPTION_NODE_HANDLE_INITIAL_Y_OFFSET, OPTION_NODE_HANDLE_SPACING_Y,
  NODE_HEADER_HEIGHT_APPROX, NODE_HEADER_CONNECTOR_Y_OFFSET
} from '@/lib/constants';
import { fetchSupabaseTablesAction, fetchSupabaseTableColumnsAction } from '@/lib/supabase/actions';
import { checkEvolutionInstanceStatus } from '@/app/actions/evolutionApiActions';
import { checkChatwootInstanceStatus } from '@/app/actions/chatwootApiActions';
import { checkDialogyInstanceStatus } from '@/app/actions/dialogyApiActions';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import jsonata from 'jsonata';
import WebhookLogsViewer from './logs/WebhookLogsViewer';
import ApiCallLogsViewer from './logs/ApiCallLogsViewer';

interface NodeCardProps {
  node: NodeData;
  onUpdate: (id: string, changes: Partial<NodeData>) => void;
  onStartConnection: (event: React.MouseEvent, fromNodeData: NodeData, sourceHandleId: string) => void;
  onDeleteNode: (id: string) => void;
  availableVariables: string[];
  isSessionHighlighted?: boolean;
  activeWorkspace: WorkspaceData | undefined | null;
}

const JsonTreeView = ({ data, onSelectPath, currentPath = [] }: { data: any, onSelectPath: (path: string) => void, currentPath?: string[] }) => {
  if (typeof data !== 'object' || data === null) {
    return <span className="text-blue-500">{JSON.stringify(data)}</span>;
  }

  return (
    <div className="pl-4">
      {Array.isArray(data) ? (
        data.map((item, index) => (
          <div key={index}>
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onSelectPath([...currentPath, String(index)].join('.'));
              }}
              className="text-amber-500 hover:underline cursor-pointer focus:outline-none text-left text-xs"
              title={`Clique para selecionar o caminho: ${[...currentPath, String(index)].join('.')}`}
            >
              [{index}]
            </button>
            <span className="text-gray-500 ml-1">-</span>
            <JsonTreeView data={item} onSelectPath={onSelectPath} currentPath={[...currentPath, String(index)]} />
          </div>
        ))
      ) : (
        Object.entries(data).map(([key, value]) => (
          <div key={key}>
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onSelectPath([...currentPath, key].join('.'));
              }}
              className="text-red-500 hover:underline cursor-pointer focus:outline-none text-left"
              title={`Clique para selecionar o caminho: ${[...currentPath, key].join('.')}`}
            >
              "{key}":
            </button>
            <span className="ml-1">
              {typeof value === 'object' && value !== null ? (
                <JsonTreeView data={value} onSelectPath={onSelectPath} currentPath={[...currentPath, key]} />
              ) : (
                <span className="text-green-600">{JSON.stringify(value)}</span>
              )}
            </span>
          </div>
        ))
      )}
    </div>
  );
};

type PreviewResult =
  | { type: 'empty'; message: string }
  | { type: 'no-sample'; message: string }
  | { type: 'not-found'; message: string }
  | { type: 'error'; message: string }
  | { type: 'pending'; message: string }
  | { type: 'success'; value: any };

const convertPayloadToEditorState = (payload: any) => {
  if (payload === null || payload === undefined) {
    return { text: '', data: null, error: 'Payload vazio. Dispare o webhook novamente para gerar dados.' };
  }
  if (typeof payload === 'string') {
    try {
      const parsed = JSON.parse(payload);
      return { text: JSON.stringify(parsed, null, 2), data: parsed, error: null };
    } catch {
      return {
        text: payload,
        data: null,
        error: 'O payload carregado está em texto plano. Cole/ajuste um JSON válido para habilitar a pré-visualização.',
      };
    }
  }
  try {
    return { text: JSON.stringify(payload, null, 2), data: payload, error: null };
  } catch {
    return {
      text: String(payload),
      data: null,
      error: 'Não foi possível serializar o payload carregado.',
    };
  }
};

const describePreviewValue = (value: any) => {
  if (Array.isArray(value)) return 'lista';
  if (value === null) return 'nulo';
  return typeof value;
};

const formatPreviewValue = (value: any) => {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'object') {
    try {
      const serialized = JSON.stringify(value, null, 2);
      return serialized.length > 600 ? `${serialized.slice(0, 600)}…` : serialized;
    } catch {
      return String(value);
    }
  }
  const stringified = String(value);
  return stringified.length > 600 ? `${stringified.slice(0, 600)}…` : stringified;
};

const convertIndicesToBracketNotation = (path: string) => path.replace(/\.(\d+)/g, '[$1]');

const buildVariableNameFromPath = (path: string) => {
  if (!path) return '';
  const cleaned = path
    .replace(/\[(\d+)\]/g, '_$1')
    .split(/[.$]/)
    .filter(Boolean)
    .pop();
  if (!cleaned) return '';
  return cleaned.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').toLowerCase();
};

const getWebhookMappingPreview = (path: string, sample: any): PreviewResult => {
  if (!path || path.trim() === '') {
    return { type: 'empty', message: 'Informe o caminho do dado para visualizar o resultado.' };
  }
  if (!sample) {
    return { type: 'no-sample', message: 'Cole ou importe um JSON de exemplo para testar este caminho.' };
  }
  try {
    const value = getProperty(sample, path);
    if (value === undefined) {
      return { type: 'not-found', message: 'Nenhum valor localizado nesse caminho no JSON de exemplo.' };
    }
    return { type: 'success', value };
  } catch (error: any) {
    return { type: 'error', message: error?.message || 'Caminho inválido.' };
  }
};

const API_PREVIEW_KEY_PRIMARY = '__primary__';

const TextFormatToolbar = ({ fieldName, textAreaRef, onUpdate, nodeId }: { fieldName: keyof NodeData, textAreaRef: React.RefObject<HTMLTextAreaElement | HTMLInputElement>, onUpdate: Function, nodeId: string }) => {
    const handleFormat = (formatChar: string) => {
        const textarea = textAreaRef.current;
        if (!textarea) return;

        const start = textarea.selectionStart ?? 0;
        const end = textarea.selectionEnd ?? 0;
        const selectedText = textarea.value.substring(start, end);
        const newText = `${textarea.value.substring(0, start)}${formatChar}${selectedText}${formatChar}${textarea.value.substring(end)}`;

        onUpdate(nodeId, { [fieldName]: newText });

        // Restore focus and selection
        setTimeout(() => {
            textarea.focus();
            if (selectedText) {
                textarea.setSelectionRange(start + formatChar.length, end + formatChar.length);
            } else {
                textarea.setSelectionRange(start + formatChar.length, start + formatChar.length);
            }
        }, 0);
    };

    return (
        <div className="flex items-center gap-1 mt-1.5 bg-muted p-1 rounded-md" data-no-drag="true">
            <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleFormat('*')} title="Negrito">
                <Bold className="w-4 h-4" />
            </Button>
            <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleFormat('_')} title="Itálico">
                <Italic className="w-4 h-4" />
            </Button>
            <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleFormat('~')} title="Riscado">
                <Strikethrough className="w-4 h-4" />
            </Button>
             <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleFormat('```')} title="Monoespaçado">
                <Code className="w-4 h-4" />
            </Button>
        </div>
    );
};

const NodeCard: React.FC<NodeCardProps> = React.memo(({
  node,
  onUpdate,
  onStartConnection,
  onDeleteNode,
  availableVariables,
  isSessionHighlighted,
  activeWorkspace
}) => {
  const { toast } = useToast();
  const isDraggingNode = useRef(false);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);


  const [isTestResponseModalOpen, setIsTestResponseModalOpen] = useState(false);
  const [testResponseData, setTestResponseData] = useState<any | null>(null);
  const [testResponseError, setTestResponseError] = useState<string | null>(null);
  const [isTestingApi, setIsTestingApi] = useState(false);

  const [isWebhookHistoryDialogOpen, setIsWebhookHistoryDialogOpen] = useState(false);
  const [isWebhookMappingDialogOpen, setIsWebhookMappingDialogOpen] = useState(false);
  const [activeWebhookTriggerId, setActiveWebhookTriggerId] = useState<string | null>(null);
  const [isApiHistoryDialogOpen, setIsApiHistoryDialogOpen] = useState(false);
  const [isApiMappingDialogOpen, setIsApiMappingDialogOpen] = useState(false);

  const [webhookSampleInput, setWebhookSampleInput] = useState('');
  const [webhookSampleData, setWebhookSampleData] = useState<any | null>(null);
  const [webhookSampleError, setWebhookSampleError] = useState<string | null>(null);
  const [isLoadingWebhookSample, setIsLoadingWebhookSample] = useState(false);
  const [focusedWebhookMapping, setFocusedWebhookMapping] = useState<{ triggerId: string; mappingId: string } | null>(null);

  const [apiSampleInput, setApiSampleInput] = useState('');
  const [apiSampleData, setApiSampleData] = useState<any | null>(null);
  const [apiSampleError, setApiSampleError] = useState<string | null>(null);
  const [isLoadingApiSample, setIsLoadingApiSample] = useState(false);
  const [focusedApiMappingId, setFocusedApiMappingId] = useState<string | null>(null);
  const [apiPreviewResults, setApiPreviewResults] = useState<Record<string, PreviewResult>>({});

  const selectedWebhookTriggerForBuilder = useMemo(() => {
    if (!activeWebhookTriggerId) return null;
    return (node.triggers || []).find(t => t.id === activeWebhookTriggerId) || null;
  }, [activeWebhookTriggerId, node.triggers]);

  const apiMappingsSignature = useMemo(() => {
    return (node.apiResponseMappings || [])
      .map(mapping => `${mapping.id}:${mapping.jsonPath || ''}:${mapping.extractAs || 'single'}:${mapping.itemField || ''}`)
      .join('|');
  }, [node.apiResponseMappings]);


  const [supabaseTables, setSupabaseTables] = useState<{ name: string }[]>([]);
  const [supabaseColumns, setSupabaseColumns] = useState<{ name: string }[]>([]);
  const [isLoadingSupabaseTables, setIsLoadingSupabaseTables] = useState(false);
  const [isLoadingSupabaseColumns, setIsLoadingSupabaseColumns] = useState(false);
  const [supabaseSchemaError, setSupabaseSchemaError] = useState<string | null>(null);

  const [isIntegrationsPopoverOpen, setIsIntegrationsPopoverOpen] = useState(false);
  const [evolutionInstances, setEvolutionInstances] = useState<EvolutionInstance[]>([]);
  const [isLoadingEvolutionInstances, setIsLoadingEvolutionInstances] = useState(false);
  const [chatwootInstances, setChatwootInstances] = useState<ChatwootInstance[]>([]);
  const [isLoadingChatwootInstances, setIsLoadingChatwootInstances] = useState(false);
  const [dialogyInstances, setDialogyInstances] = useState<DialogyInstance[]>([]);
  const [isLoadingDialogyInstances, setIsLoadingDialogyInstances] = useState(false);

  useEffect(() => {
    if (node.type === 'start') {
      const hasManual = (node.triggers || []).some(t => t.type === 'manual');
      const hasWebhook = (node.triggers || []).some(t => t.type === 'webhook');

      if (!hasManual || !hasWebhook) {
        const defaultTriggers: StartNodeTrigger[] = [
          { id: uuidv4(), name: 'Manual', type: 'manual', enabled: true, keyword: '' },
          {
            id: uuidv4(),
            name: 'Webhook',
            type: 'webhook',
            enabled: false,
            keyword: '',
            variableMappings: [],
            sessionTimeoutSeconds: 0
          },
        ];

        let finalTriggers = [...(node.triggers || [])];
        if (!hasManual) {
          finalTriggers.push(defaultTriggers.find(t => t.type === 'manual')!);
        }
        if (!hasWebhook) {
          finalTriggers.push(defaultTriggers.find(t => t.type === 'webhook')!);
        }

        onUpdate(node.id, { triggers: finalTriggers });
      }
    }
  }, [node.id, node.type, node.triggers, onUpdate]);

  useEffect(() => {
    if (node.type.startsWith('supabase-')) {
      const savedSupabaseUrl = localStorage.getItem('supabaseUrl');
      const savedSupabaseServiceKey = localStorage.getItem('supabaseServiceKey');
      const isSupabaseConfigured = localStorage.getItem('isSupabaseEnabled') === 'true' && savedSupabaseUrl && savedSupabaseServiceKey;

      if (isSupabaseConfigured) {
        setIsLoadingSupabaseTables(true);
        setSupabaseSchemaError(null);
        setSupabaseTables([]);
        setSupabaseColumns([]);

        fetchSupabaseTablesAction(savedSupabaseUrl as string, savedSupabaseServiceKey as string)
          .then(result => {
            if (result.error) {
              setSupabaseSchemaError(result.error);
              setSupabaseTables([]);
            } else if (result.data) {
              setSupabaseTables(result.data);
              if (node.supabaseTableName && !result.data.some(t => t.name === node.supabaseTableName)) {
                onUpdate(node.id, { supabaseTableName: '', supabaseIdentifierColumn: '', supabaseColumnsToSelect: '*' });
              }
            } else {
              setSupabaseTables([]);
            }
          })
          .catch(() => {
            setSupabaseSchemaError('Falha ao comunicar com o servidor para buscar tabelas.');
            setSupabaseTables([]);
          })
          .finally(() => {
            setIsLoadingSupabaseTables(false);
          });
      } else {
        setSupabaseSchemaError('Supabase não configurado ou desabilitado. Verifique as Configurações Globais.');
        setSupabaseTables([]);
        setSupabaseColumns([]);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node.type, node.id]);

  useEffect(() => {
    if (node.type.startsWith('supabase-') && node.supabaseTableName) {
      const savedSupabaseUrl = localStorage.getItem('supabaseUrl');
      const savedSupabaseServiceKey = localStorage.getItem('supabaseServiceKey');
      const isSupabaseConfigured = localStorage.getItem('isSupabaseEnabled') === 'true' && savedSupabaseUrl && savedSupabaseServiceKey;

      if (isSupabaseConfigured) {
        setIsLoadingSupabaseColumns(true);
        setSupabaseSchemaError(null);
        setSupabaseColumns([]);

        fetchSupabaseTableColumnsAction(savedSupabaseUrl as string, savedSupabaseServiceKey as string, node.supabaseTableName)
          .then(result => {
            if (result.error) {
              setSupabaseSchemaError(result.error);
              setSupabaseColumns([]);
            } else if (result.data) {
              setSupabaseColumns(result.data);
              if (node.supabaseIdentifierColumn && !result.data.some(c => c.name === node.supabaseIdentifierColumn)) {
                onUpdate(node.id, { supabaseIdentifierColumn: '' });
              }
            } else {
              setSupabaseColumns([]);
            }
          })
          .catch(() => {
            setSupabaseSchemaError(`Falha ao comunicar com o servidor para buscar colunas da tabela ${node.supabaseTableName}.`);
            setSupabaseColumns([]);
          })
          .finally(() => {
            setIsLoadingSupabaseColumns(false);
          });

      } else {
        setSupabaseColumns([]);
        setSupabaseSchemaError('Supabase não configurado para buscar colunas.');
      }
    } else if (node.type.startsWith('supabase-')) {
      setSupabaseColumns([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node.id, node.supabaseTableName]);

  const handleCheckEvolutionInstanceStatus = useCallback(async (instance: EvolutionInstance) => {
    setEvolutionInstances(prev => prev.map(i => i.id === instance.id ? { ...i, status: 'connecting' } : i));
    const result = await checkEvolutionInstanceStatus(instance.baseUrl, instance.name, instance.apiKey);
    setEvolutionInstances(prev => prev.map(i => i.id === instance.id ? { ...i, status: result.status } : i));
  }, []);

  const handleCheckChatwootInstanceStatus = useCallback(async (instance: ChatwootInstance) => {
    setChatwootInstances(prev => prev.map(i => i.id === instance.id ? { ...i, status: 'connecting' } : i));
    const result = await checkChatwootInstanceStatus(instance.baseUrl, instance.apiAccessToken);
    setChatwootInstances(prev => prev.map(i => i.id === instance.id ? { ...i, status: result.status } : i));
  }, []);

   const handleCheckDialogyInstanceStatus = useCallback(async (instance: DialogyInstance) => {
    setDialogyInstances(prev => prev.map(i => i.id === instance.id ? { ...i, status: 'connecting' } : i));
    const result = await checkDialogyInstanceStatus(instance.baseUrl, instance.apiKey);
    setDialogyInstances(prev => prev.map(i => i.id === instance.id ? { ...i, status: result.status } : i));
  }, []);

  const loadInstancesAndCheckStatus = useCallback(async () => {
    setIsLoadingEvolutionInstances(true);
    setIsLoadingChatwootInstances(true);
    setIsLoadingDialogyInstances(true);

    try {
      const evoResponse = await fetch('/api/instances/evolution');
      if (!evoResponse.ok) throw new Error('Falha ao buscar instâncias Evolution.');
      const evoData: EvolutionInstance[] = await evoResponse.json();
      const evoInstancesWithStatus = evoData.map(d => ({ ...d, status: 'unconfigured' as const }));
      setEvolutionInstances(evoInstancesWithStatus);
      evoInstancesWithStatus.forEach(instance => handleCheckEvolutionInstanceStatus(instance));
    } catch (error: any) {
      toast({ title: "Erro ao Carregar Instâncias Evolution", description: error.message, variant: "destructive" });
      setEvolutionInstances([]);
    } finally {
      setIsLoadingEvolutionInstances(false);
    }

    try {
      const cwResponse = await fetch('/api/instances/chatwoot');
      if (!cwResponse.ok) throw new Error('Falha ao buscar instâncias Chatwoot.');
      const cwData: ChatwootInstance[] = await cwResponse.json();
      const cwInstancesWithStatus = cwData.map(d => ({ ...d, status: 'unconfigured' as const }));
      setChatwootInstances(cwInstancesWithStatus);
      cwInstancesWithStatus.forEach(instance => handleCheckChatwootInstanceStatus(instance));
    } catch (error: any) {
      toast({ title: "Erro ao Carregar Instâncias Chatwoot", description: error.message, variant: "destructive" });
      setChatwootInstances([]);
    } finally {
      setIsLoadingChatwootInstances(false);
    }
    
    try {
      const dialogyResponse = await fetch('/api/instances/dialogy');
      if (!dialogyResponse.ok) throw new Error('Falha ao buscar instâncias Dialogy.');
      const dialogyData: DialogyInstance[] = await dialogyResponse.json();
      const dialogyInstancesWithStatus = dialogyData.map(d => ({ ...d, status: 'unconfigured' as const }));
      setDialogyInstances(dialogyInstancesWithStatus);
      dialogyInstancesWithStatus.forEach(instance => handleCheckDialogyInstanceStatus(instance));
    } catch (error: any) {
      toast({ title: "Erro ao Carregar Instâncias Dialogy", description: error.message, variant: "destructive" });
      setDialogyInstances([]);
    } finally {
      setIsLoadingDialogyInstances(false);
    }

  }, [toast, handleCheckEvolutionInstanceStatus, handleCheckChatwootInstanceStatus, handleCheckDialogyInstanceStatus]);

  const handleIntegrationsPopoverOpen = (open: boolean) => {
    if (open) {
      loadInstancesAndCheckStatus();
    }
    setIsIntegrationsPopoverOpen(open);
  };

  const handleNodeMouseDown = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (
      target.dataset.connector === 'true' ||
      target.closest('[data-action="delete-node"]') ||
      target.closest('[data-no-drag="true"]') ||
      target.closest('[role="dialog"]') ||
      target.closest('[data-radix-popover-content]') ||
      target.closest('[data-radix-scroll-area-viewport]') ||
      (target.closest('input, textarea, select, button:not([data-drag-handle="true"])') && !target.closest('div[data-drag-handle="true"]')?.contains(target))
    ) {
      return;
    }

    isDraggingNode.current = true;
    const startX = e.clientX;
    const startY = e.clientY;
    const initialModelX = node.x;
    const initialModelY = node.y;

    const handleNodeMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingNode.current) return;
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      onUpdate(node.id, { x: initialModelX + dx, y: initialModelY + dy });
    };

    const handleNodeMouseUp = () => {
      isDraggingNode.current = false;
      document.removeEventListener('mousemove', handleNodeMouseMove);
      document.removeEventListener('mouseup', handleNodeMouseUp);
    };

    document.addEventListener('mousemove', handleNodeMouseMove);
    document.addEventListener('mouseup', handleNodeMouseUp);
  }, [node.x, node.y, node.id, onUpdate]);

  const handleDeleteClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onDeleteNode(node.id);
  }, [node.id, onDeleteNode]);

  const handleTriggerChange = (triggerId: string, field: keyof StartNodeTrigger, value: any) => {
    const updatedTriggers = (node.triggers || []).map(t =>
      t.id === triggerId ? { ...t, [field]: value } : t
    );
    onUpdate(node.id, { triggers: updatedTriggers });
  };
  
  const handleKeywordsChange = (triggerId: string, value: string) => {
    // Permite vírgulas, mas limpa espaços extras e remove duplicados
    const keywords = value.split(',').map(kw => kw.trim()).filter(Boolean);
    const uniqueKeywords = Array.from(new Set(keywords));
    handleTriggerChange(triggerId, 'keyword', uniqueKeywords.join(', '));
  };


  const handleAddVariableMapping = (triggerId: string) => {
    const updatedTriggers = (node.triggers || []).map(trigger => {
      if (trigger.id === triggerId) {
        const newMapping: WebhookVariableMapping = { id: uuidv4(), jsonPath: '', flowVariable: '' };
        const updatedMappings = [...(trigger.variableMappings || []), newMapping];
        return { ...trigger, variableMappings: updatedMappings };
      }
      return trigger;
    });
    onUpdate(node.id, { triggers: updatedTriggers });
  };

  const handleRemoveVariableMapping = (triggerId: string, mappingId: string) => {
    const updatedTriggers = (node.triggers || []).map(trigger => {
      if (trigger.id === triggerId) {
        const updatedMappings = (trigger.variableMappings || []).filter(m => m.id !== mappingId);
        return { ...trigger, variableMappings: updatedMappings };
      }
      return trigger;
    });
    onUpdate(node.id, { triggers: updatedTriggers });
  };

  const handleVariableMappingChange = (triggerId: string, mappingId: string, field: 'jsonPath' | 'flowVariable', value: string) => {
    const updatedTriggers = (node.triggers || []).map(trigger => {
      if (trigger.id === triggerId) {
        const updatedMappings = (trigger.variableMappings || []).map(m =>
          m.id === mappingId ? { ...m, [field]: value } : m
        );
        return { ...trigger, variableMappings: updatedMappings };
      }
      return trigger;
    });
    onUpdate(node.id, { triggers: updatedTriggers });
  };

  const handleAddListItem = (listName: 'apiHeadersList' | 'apiQueryParamsList' | 'apiBodyFormDataList' | 'apiResponseMappings') => {
    const currentList = (node[listName] as any[] || []);
    let newItem;
    if(listName === 'apiResponseMappings') {
        newItem = { id: uuidv4(), jsonPath: '', flowVariable: '', extractAs: 'single' };
    } else {
        newItem = { id: uuidv4(), key: '', value: '' };
    }
    onUpdate(node.id, { [listName]: [...currentList, newItem] });
  };

  const handleRemoveListItem = (listName: 'apiHeadersList' | 'apiQueryParamsList' | 'apiBodyFormDataList' | 'apiResponseMappings', itemId: string) => {
    const currentList = (node[listName] as any[] || []);
    onUpdate(node.id, { [listName]: currentList.filter(item => item.id !== itemId) });
  };
  
  const handleApiResponseMappingChange = (mappingId: string, field: 'jsonPath' | 'flowVariable' | 'extractAs' | 'itemField', value: string) => {
    const currentMappings = (node.apiResponseMappings || []);
    onUpdate(node.id, {
        apiResponseMappings: currentMappings.map(mapping => 
            mapping.id === mappingId ? { ...mapping, [field]: value } : mapping
        )
    });
  };

  const handleListItemChange = (
    listName: 'apiHeadersList' | 'apiQueryParamsList' | 'apiBodyFormDataList',
    itemId: string,
    field: 'key' | 'value',
    newValue: string
  ) => {
    const currentList = (node[listName] as any[] || []);
    onUpdate(node.id, {
      [listName]: currentList.map(item =>
        item.id === itemId ? { ...item, [field]: newValue } : item
      )
    });
  };

  const handleTestApiCall = async () => {
    if (!node.apiUrl || node.apiUrl.trim() === '' || !node.apiUrl.trim().startsWith('http')) {
      toast({
        title: "URL da API ausente ou inválida",
        description: "Por favor, insira uma URL da API válida (ex: https://api.example.com) para testar.",
        variant: "destructive",
      });
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

      if (!response.ok) {
        throw new Error(result.error || `Erro da API: ${response.status}`);
      }

      setTestResponseData(result.data);
      setIsTestResponseModalOpen(true);
      toast({
        title: "API Testada com Sucesso!",
        description: `Status: ${result.status}`,
      });

      if (activeWorkspace?.id) {
          const logData = {
              workspaceId: activeWorkspace.id,
              type: 'api-call',
              nodeId: node.id,
              nodeTitle: node.title,
              requestUrl: node.apiUrl,
              response: result.data,
              error: null,
              sessionId: null
          };
          // Não aguardamos isso para não bloquear a UI
          fetch('/api/evolution/webhook-logs', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(logData),
          }).catch(e => console.error("Falha ao postar o log do teste de API:", e));
      }

    } catch (error: any) {
      setTestResponseError(error.message);
      setIsTestResponseModalOpen(true);
      toast({
        title: "Erro no Teste",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsTestingApi(false);
    }
  };
  
  const handleOpenApiHistory = () => {
    setIsApiHistoryDialogOpen(true);
  };

  const handleOpenWebhookHistory = () => {
    setIsWebhookHistoryDialogOpen(true);
  };

  const handleAddSwitchCase = () => {
    const newCase: SwitchCase = { id: uuidv4(), value: '' };
    const updatedCases = [...(node.switchCases || []), newCase];
    onUpdate(node.id, { switchCases: updatedCases });
  };

  const handleRemoveSwitchCase = (caseId: string) => {
    const updatedCases = (node.switchCases || []).filter(c => c.id !== caseId);
    onUpdate(node.id, { switchCases: updatedCases });
  };

  const handleSwitchCaseChange = (caseId: string, value: string) => {
    const updatedCases = (node.switchCases || []).map(c =>
      c.id === caseId ? { ...c, value } : c
    );
    onUpdate(node.id, { switchCases: updatedCases });
  };

  const handleVariableInsert = (
    fieldName: keyof NodeData,
    variableName: string,
    _isTextarea: boolean = false,
    isListItem: boolean = false,
    itemId?: string,
    itemKeyOrValue?: 'key' | 'value'
  ) => {
    if (isListItem && itemId && itemKeyOrValue && (fieldName === 'apiHeadersList' || fieldName === 'apiQueryParamsList' || fieldName === 'apiBodyFormDataList')) {
      const currentList = (node[fieldName] as any[] || []);
      const updatedList = currentList.map(item => {
        if (item.id === itemId) {
          return { ...item, [itemKeyOrValue]: (item[itemKeyOrValue] || '') + `{{${variableName}}}` };
        }
        return item;
      });
      onUpdate(node.id, { [fieldName]: updatedList } as Partial<NodeData>);
    } else if (!isListItem) {
      const currentValue = (node[fieldName] as string | undefined) || '';
      onUpdate(node.id, { [fieldName]: currentValue + `{{${variableName}}}` } as Partial<NodeData>);
    }
  };

  const renderVariableInserter = (
    fieldName: keyof NodeData,
    isTextarea: boolean = false,
    isListItem: boolean = false,
    itemId?: string,
    itemKeyOrValue?: 'key' | 'value'
  ) => {
    const allVars = availableVariables;
    if (allVars.length === 0) return null;

    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn("absolute h-7 w-7 z-10", isTextarea ? 'top-1.5 right-1.5' : 'top-1/2 right-1 -translate-y-1/2')}
            data-no-drag="true"
            aria-label="Inserir Variável"
          >
            <Braces className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[200px] p-0" data-no-drag="true" align="end">
          <ScrollArea className="h-auto max-h-[150px]">
            <div className="p-1 text-xs">
              {allVars.map((varName) => (
                <Button
                  key={varName}
                  variant="ghost"
                  className="w-full justify-start h-7 px-2 text-xs"
                  onClick={() => handleVariableInsert(fieldName, varName, isTextarea, isListItem, itemId, itemKeyOrValue)}
                >
                  {varName}
                </Button>
              ))}
            </div>
          </ScrollArea>
        </PopoverContent>
      </Popover>
    );
  };

  const handleWebhookSampleInputChange = (value: string) => {
    setWebhookSampleInput(value);
    if (!value || value.trim() === '') {
      setWebhookSampleData(null);
      setWebhookSampleError(null);
      return;
    }
    try {
      const parsed = JSON.parse(value);
      setWebhookSampleData(parsed);
      setWebhookSampleError(null);
    } catch {
      setWebhookSampleData(null);
      setWebhookSampleError('JSON inválido. Verifique se o conteúdo está bem formatado.');
    }
  };

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
      setApiSampleError('JSON inválido. Verifique se o conteúdo está bem formatado.');
    }
  };

  const clearSampleEditor = (scope: 'webhook' | 'api') => {
    if (scope === 'webhook') {
      setWebhookSampleInput('');
      setWebhookSampleData(null);
      setWebhookSampleError(null);
    } else {
      setApiSampleInput('');
      setApiSampleData(null);
      setApiSampleError(null);
    }
  };

  const applySamplePayloadFromSource = useCallback((payload: any, scope: 'webhook' | 'api') => {
    const prepared = convertPayloadToEditorState(payload);
    if (scope === 'webhook') {
      setWebhookSampleInput(prepared.text);
      setWebhookSampleData(prepared.data);
      setWebhookSampleError(prepared.error);
    } else {
      setApiSampleInput(prepared.text);
      setApiSampleData(prepared.data);
      setApiSampleError(prepared.error);
    }
    return prepared.error;
  }, []);

  const handleLoadLatestWebhookSample = useCallback(async () => {
    if (!activeWorkspace?.id) {
      toast({
        title: "Salve o fluxo primeiro",
        description: "Precisamos do ID do workspace para localizar o histórico do webhook.",
        variant: "destructive",
      });
      return;
    }
    setIsLoadingWebhookSample(true);
    try {
      const params = new URLSearchParams({
        workspaceId: activeWorkspace.id,
        type: 'webhook',
        limit: '1',
      });
      const response = await fetch(`/api/evolution/webhook-logs?${params.toString()}`, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error('Não foi possível buscar o último webhook.');
      }
      const data = await response.json();
      const latest = Array.isArray(data) ? data[0] : null;
      if (!latest?.payload) {
        toast({
          title: "Nenhum payload disponível",
          description: "Dispare o webhook novamente para gerar logs recentes.",
        });
        return;
      }
      const errorMessage = applySamplePayloadFromSource(latest.payload, 'webhook');
      toast({
        title: "Payload importado",
        description: errorMessage
          ? "Importamos o corpo bruto, mas ele não pôde ser convertido automaticamente em JSON."
          : "Usando o último webhook recebido para sugerir mapeamentos.",
        variant: errorMessage ? 'destructive' : 'default',
      });
    } catch (error: any) {
      toast({
        title: "Falha ao carregar o histórico",
        description: error?.message || 'Erro desconhecido ao buscar os logs.',
        variant: "destructive",
      });
    } finally {
      setIsLoadingWebhookSample(false);
    }
  }, [activeWorkspace?.id, toast, applySamplePayloadFromSource]);

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
      const errorMessage = applySamplePayloadFromSource(latest.response, 'api');
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
        description: "Execute o teste da API para capturar uma resposta e montar os mapeamentos.",
        variant: "destructive",
      });
      return;
    }
    const errorMessage = applySamplePayloadFromSource(testResponseData, 'api');
    toast({
      title: "Resposta de teste aplicada",
      description: errorMessage
        ? "Usamos o corpo bruto do teste, mas não foi possível convertê-lo em JSON automaticamente."
        : "Agora você pode clicar nos campos para preencher automaticamente os caminhos.",
      variant: errorMessage ? 'destructive' : 'default',
    });
  };

  const handleJsonTreeSelection = (scope: 'webhook' | 'api', rawPath: string) => {
    const path = scope === 'api' ? convertIndicesToBracketNotation(rawPath) : rawPath;
    if (scope === 'webhook' && focusedWebhookMapping) {
      handleVariableMappingChange(focusedWebhookMapping.triggerId, focusedWebhookMapping.mappingId, 'jsonPath', path);
      toast({
        title: "Caminho aplicado",
        description: `Atualizamos o mapeamento para "${path}".`,
      });
      return;
    }
    if (scope === 'api') {
      if (focusedApiMappingId === '__primary__') {
        onUpdate(node.id, { apiResponsePath: path });
        toast({
          title: "Caminho principal atualizado",
          description: `Usaremos "${path}" para preencher a variável principal.`,
        });
        return;
      }
      if (focusedApiMappingId) {
        handleApiResponseMappingChange(focusedApiMappingId, 'jsonPath', path);
        toast({
          title: "Expressão preenchida",
          description: `Atualizamos a expressão JSONata para "${path}".`,
        });
        return;
      }
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(path)
        .then(() => toast({ title: "Caminho copiado!", description: `Use "${path}" no mapeamento desejado.` }))
        .catch(() => toast({ title: "Use este caminho", description: path }));
    } else {
      toast({ title: "Use este caminho", description: path });
    }
  };

  useEffect(() => {
    let isCancelled = false;

    const evaluateExpressionAsync = async (expression: string | undefined): Promise<PreviewResult> => {
      if (!expression || expression.trim() === '') {
        return { type: 'empty', message: 'Defina a expressão JSONata para visualizar o resultado.' };
      }
      if (!apiSampleData) {
        return { type: 'no-sample', message: 'Cole/importe a resposta JSON para testar esta expressão.' };
      }
      try {
        const value = await jsonata(expression).evaluate(apiSampleData);
        if (value === undefined) {
          return { type: 'not-found', message: 'A expressão não retornou nenhum valor com o JSON atual.' };
        }
        return { type: 'success', value };
      } catch (error: any) {
        return { type: 'error', message: error?.message || 'Expressão JSONata inválida.' };
      }
    };

    const run = async () => {
      const nextResults: Record<string, PreviewResult> = {};
      nextResults[API_PREVIEW_KEY_PRIMARY] = await evaluateExpressionAsync(node.apiResponsePath);
      for (const mapping of node.apiResponseMappings || []) {
        nextResults[mapping.id] = await evaluateExpressionAsync(mapping.jsonPath);
      }
      if (!isCancelled) {
        setApiPreviewResults(nextResults);
      }
    };

    run();
    return () => {
      isCancelled = true;
    };
  }, [apiSampleData, node.apiResponsePath, apiMappingsSignature]);

  const getApiPreviewResult = (expression: string | undefined, key: string): PreviewResult => {
    if (!expression || expression.trim() === '') {
      return { type: 'empty', message: 'Defina a expressão JSONata para visualizar o resultado.' };
    }
    if (!apiSampleData) {
      return { type: 'no-sample', message: 'Cole/importe a resposta JSON para testar esta expressão.' };
    }
    return apiPreviewResults[key] || { type: 'pending', message: 'Calculando pré-visualização...' };
  };

  const renderWebhookMappingBuilder = (targetTrigger: StartNodeTrigger | null) => {
    if (!targetTrigger) {
      return (
        <div className="py-4 text-sm text-muted-foreground">
          Selecione um disparador do tipo webhook para configurar os mapeamentos.
        </div>
      );
    }

    return (
      <div className="space-y-3">
        <div className="rounded-md border bg-muted/20 p-3 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold">Laboratório de Payload</p>
              <p className="text-[11px] text-muted-foreground">Cole o body recebido ou importe o último log.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleLoadLatestWebhookSample}
                disabled={isLoadingWebhookSample}
              >
                {isLoadingWebhookSample ? (
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
              <Button variant="outline" size="sm" onClick={() => clearSampleEditor('webhook')}>
                Limpar
              </Button>
            </div>
          </div>
          <Textarea
            value={webhookSampleInput}
            onChange={(e) => handleWebhookSampleInputChange(e.target.value)}
            rows={4}
            placeholder={`{
  "data": {
    "message": {
      "text": "Oi, gostaria de um orçamento"
    }
  }
}`}
            className="font-mono text-xs"
          />
          {webhookSampleError ? (
            <p className="text-xs text-destructive">{webhookSampleError}</p>
          ) : (
            <p className="text-[11px] text-muted-foreground">Clique em qualquer chave do JSON abaixo para preencher o campo selecionado.</p>
          )}
          <div className="border rounded-md bg-background/60">
            {webhookSampleData ? (
              <ScrollArea className="h-40 pr-3">
                <JsonTreeView data={webhookSampleData} onSelectPath={(path) => handleJsonTreeSelection('webhook', path)} />
              </ScrollArea>
            ) : (
              <div className="flex h-32 items-center justify-center px-4 text-center text-xs text-muted-foreground">
                Cole um JSON real do seu webhook para habilitar o assistente de mapeamento.
              </div>
            )}
          </div>
        </div>

        <div className="space-y-3">
          {(targetTrigger.variableMappings || []).map((mapping, index) => {
            const preview = getWebhookMappingPreview(mapping.jsonPath, webhookSampleData);
            const suggestion = buildVariableNameFromPath(mapping.jsonPath);
            const previewClass = preview.type === 'success'
              ? 'border-emerald-500/60 text-foreground bg-emerald-50/30 dark:bg-emerald-500/5'
              : preview.type === 'error'
                ? 'border-destructive/70 text-destructive bg-destructive/5'
                : 'text-muted-foreground bg-muted/50';

            return (
              <div key={mapping.id} className="rounded-lg border bg-background/40 p-3 shadow-inner space-y-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="font-medium">Mapeamento #{index + 1}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveVariableMapping(targetTrigger.id, mapping.id)}
                    className="text-destructive hover:text-destructive/80 w-7 h-7"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
                <div className="space-y-2">
                  <div>
                    <Label className="text-[11px] uppercase font-semibold">Caminho do dado</Label>
                    <div className="flex items-center gap-1.5 mt-1">
                      <Input
                        placeholder="Ex: data.message.text"
                        value={mapping.jsonPath}
                        onFocus={() => setFocusedWebhookMapping({ triggerId: targetTrigger.id, mappingId: mapping.id })}
                        onChange={(e) => handleVariableMappingChange(targetTrigger.id, mapping.id, 'jsonPath', e.target.value)}
                        className="text-xs h-8"
                      />
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" size="icon" className="h-8 w-8" disabled={!webhookSampleData}>
                            <MousePointerClick className="w-4 h-4" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[260px] p-2" align="end" data-no-drag="true">
                          {webhookSampleData ? (
                            <ScrollArea className="h-48 pr-2">
                              <JsonTreeView
                                data={webhookSampleData}
                                onSelectPath={(path) => {
                                  handleVariableMappingChange(targetTrigger.id, mapping.id, 'jsonPath', path);
                                  setFocusedWebhookMapping({ triggerId: targetTrigger.id, mappingId: mapping.id });
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
                    <Label className="text-[11px] uppercase font-semibold">Variável</Label>
                    <div className="flex items-center gap-1.5 mt-1">
                      <Input
                        placeholder="Ex: mensagem_usuario"
                        value={mapping.flowVariable}
                        onChange={(e) => handleVariableMappingChange(targetTrigger.id, mapping.id, 'flowVariable', e.target.value)}
                        className="text-xs h-8"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={!suggestion || !!(mapping.flowVariable && mapping.flowVariable.trim())}
                        onClick={() => suggestion && handleVariableMappingChange(targetTrigger.id, mapping.id, 'flowVariable', suggestion)}
                      >
                        <Sparkles className="w-3.5 h-3.5 mr-1" />
                        Sugerir
                      </Button>
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-[11px] uppercase text-muted-foreground">
                      <span>Pré-visualização</span>
                      {webhookSampleData && <span>Baseado no JSON acima</span>}
                    </div>
                    <div className={cn("mt-1 rounded-md border px-2.5 py-2 text-xs font-mono whitespace-pre-wrap break-all", previewClass)}>
                      {preview.type === 'success' ? (
                        <>
                          <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                            Valor encontrado ({describePreviewValue(preview.value)})
                          </p>
                          <pre className="mt-1 whitespace-pre-wrap break-all text-[11px] font-mono">
                            {formatPreviewValue(preview.value)}
                          </pre>
                        </>
                      ) : (
                        <span>{preview.message}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <Button onClick={() => handleAddVariableMapping(targetTrigger.id)} variant="outline" size="sm" className="text-xs h-8">
          <PlusCircle className="w-3 h-3 mr-1" /> Adicionar Mapeamento
        </Button>
      </div>
    );
  };

  const renderApiMappingBuilder = () => (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor={`${node.id}-apiResponsePath`}>Caminho do Dado Principal (JSONata ou caminho simples)</Label>
          <div className="flex items-center gap-1.5 mt-1">
            <Input
              id={`${node.id}-apiResponsePath`}
              placeholder="Ex: data.user.name"
              value={node.apiResponsePath || ''}
              onFocus={() => setFocusedApiMappingId('__primary__')}
              onChange={(e) => onUpdate(node.id, { apiResponsePath: e.target.value })}
              className="pr-8 text-sm"
            />
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  disabled={!apiSampleData}
                  title={apiSampleData ? 'Clique em um campo do JSON' : 'Cole uma resposta de exemplo'}
                >
                  <MousePointerClick className="w-4 h-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[260px] p-2" align="end" data-no-drag="true">
                {apiSampleData ? (
                  <ScrollArea className="h-48 pr-2">
                    <JsonTreeView data={apiSampleData} onSelectPath={(path) => handleJsonTreeSelection('api', path)} />
                  </ScrollArea>
                ) : (
                  <p className="text-xs text-muted-foreground">Cole ou importe uma resposta para habilitar esta seleção.</p>
                )}
              </PopoverContent>
            </Popover>
          </div>
          <p className="text-xs text-muted-foreground mt-1">Defina qual valor será salvo em <em>Salvar Resultado Principal</em>.</p>
                    <div className="mt-2 rounded-md border bg-muted/30 px-2.5 py-2 text-xs font-mono whitespace-pre-wrap break-all min-h-[48px]">
                      {(() => {
                        const preview = getApiPreviewResult(node.apiResponsePath || '', API_PREVIEW_KEY_PRIMARY);
                        if (preview.type === 'success') {
                          return (
                            <>
                              <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">Valor de exemplo ({describePreviewValue(preview.value)})</p>
                              <pre className="mt-1">{formatPreviewValue(preview.value)}</pre>
                            </>
                          );
                        }
                        return <span className="text-[11px] text-muted-foreground">{preview.message}</span>;
                      })()}
                    </div>
                  </div>
        <div>
          <Label htmlFor={`${node.id}-apioutputvar`}>Salvar Resultado Principal na Variável</Label>
          <div className="flex items-center gap-1.5 mt-1">
            <Input
              id={`${node.id}-apioutputvar`}
              placeholder="resposta_api"
              value={node.apiOutputVariable || ''}
              onChange={(e) => onUpdate(node.id, { apiOutputVariable: e.target.value })}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!buildVariableNameFromPath(node.apiResponsePath || '') || !!(node.apiOutputVariable && node.apiOutputVariable.trim())}
              onClick={() => {
                const suggestion = buildVariableNameFromPath(node.apiResponsePath || '');
                if (suggestion) onUpdate(node.id, { apiOutputVariable: suggestion });
              }}
            >
              <Sparkles className="w-3.5 h-3.5 mr-1" />
              Sugerir
            </Button>
          </div>
        </div>
      </div>

      <div className="rounded-md border bg-muted/10 p-3 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-semibold">Laboratório de Resposta</p>
            <p className="text-[11px] text-muted-foreground">Cole a resposta da API, use o último log ou reaproveite o último teste.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleLoadLatestApiSample}
              disabled={isLoadingApiSample}
            >
              {isLoadingApiSample ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Buscando
                </>
              ) : (
                <>
                  <History className="mr-1.5 h-3.5 w-3.5" />
                  Usar log
                </>
              )}
            </Button>
            <Button variant="outline" size="sm" onClick={handleUseLastTestResponseAsSample}>
              <TestTube2 className="mr-1.5 h-3.5 w-3.5" /> Resposta do teste
            </Button>
            <Button variant="outline" size="sm" onClick={() => clearSampleEditor('api')}>
              Limpar
            </Button>
          </div>
        </div>
        <Textarea
          value={apiSampleInput}
          onChange={(e) => handleApiSampleInputChange(e.target.value)}
          rows={4}
          placeholder={`{
  "data": {
    "id": 123,
    "user": { "name": "Ana" }
  }
}`}
          className="font-mono text-xs"
        />
        {apiSampleError ? (
          <p className="text-xs text-destructive">{apiSampleError}</p>
        ) : (
          <p className="text-[11px] text-muted-foreground">Clique no JSON abaixo para preencher qualquer campo selecionado.</p>
        )}
        <div className="border rounded-md bg-background/60">
          {apiSampleData ? (
            <ScrollArea className="h-40 pr-3">
              <JsonTreeView data={apiSampleData} onSelectPath={(path) => handleJsonTreeSelection('api', path)} />
            </ScrollArea>
          ) : (
            <div className="flex h-32 items-center justify-center px-4 text-center text-xs text-muted-foreground">
              Cole/importe um JSON para liberar o construtor avançado de caminhos.
            </div>
          )}
        </div>
      </div>

      <div className="pt-2 space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-medium">Mapeamento de Múltiplas Variáveis</Label>
          <p className="text-[11px] text-muted-foreground">Extraia quantos campos precisar com expressões JSONata.</p>
        </div>
        <div className="space-y-3">
          {(node.apiResponseMappings || []).map((mapping, index) => {
            const preview = getApiPreviewResult(mapping.jsonPath, mapping.id);
            const suggestion = buildVariableNameFromPath(mapping.jsonPath);
            const previewClass = preview.type === 'success'
              ? 'border-emerald-500/60 text-foreground bg-emerald-50/30 dark:bg-emerald-500/5'
              : preview.type === 'error'
                ? 'border-destructive/70 text-destructive bg-destructive/5'
                : 'text-muted-foreground bg-muted/50';

            return (
              <div key={mapping.id} className="rounded-lg border bg-background/40 p-3 shadow-inner space-y-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="font-medium">Mapeamento #{index + 1}</span>
                  <Button variant="ghost" size="icon" onClick={() => handleRemoveListItem('apiResponseMappings', mapping.id)} className="text-destructive hover:text-destructive/80 w-7 h-7">
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
                <div className="space-y-2">
                  <div>
                    <Label className="text-[11px] uppercase font-semibold">Expressão JSONata</Label>
                    <div className="flex items-center gap-1.5 mt-1">
                      <Input
                        placeholder="Ex: data.items[0].id"
                        value={mapping.jsonPath}
                        onFocus={() => setFocusedApiMappingId(mapping.id)}
                        onChange={(e) => handleApiResponseMappingChange(mapping.id, 'jsonPath', e.target.value)}
                        className="text-xs h-8"
                      />
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" size="icon" className="h-8 w-8" disabled={!apiSampleData}>
                            <MousePointerClick className="w-4 h-4" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[260px] p-2" align="end" data-no-drag="true">
                          {apiSampleData ? (
                            <ScrollArea className="h-48 pr-2">
                              <JsonTreeView
                                data={apiSampleData}
                                onSelectPath={(path) => {
                                  handleApiResponseMappingChange(mapping.id, 'jsonPath', convertIndicesToBracketNotation(path));
                                  setFocusedApiMappingId(mapping.id);
                                }}
                              />
                            </ScrollArea>
                          ) : (
                            <p className="text-xs text-muted-foreground">Cole uma resposta para usar o seletor visual.</p>
                          )}
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                  <div>
                    <Label className="text-[11px] uppercase font-semibold">Variável</Label>
                    <div className="flex items-center gap-1.5 mt-1">
                      <Input
                        placeholder="Ex: id_usuario"
                        value={mapping.flowVariable}
                        onChange={(e) => handleApiResponseMappingChange(mapping.id, 'flowVariable', e.target.value)}
                        className="text-xs h-8"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={!suggestion || !!(mapping.flowVariable && mapping.flowVariable.trim())}
                        onClick={() => suggestion && handleApiResponseMappingChange(mapping.id, 'flowVariable', suggestion)}
                      >
                        <Sparkles className="w-3.5 h-3.5 mr-1" />
                        Sugerir
                      </Button>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div>
                      <Label className="text-[11px] uppercase font-semibold">Extrair como</Label>
                      <Select value={mapping.extractAs || 'single'} onValueChange={(value) => handleApiResponseMappingChange(mapping.id, 'extractAs', value)}>
                        <SelectTrigger className="h-8 w-[110px] text-xs mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="single"><div className="flex items-center gap-1.5"><Baseline className="w-3.5 h-3.5" /><span>Valor</span></div></SelectItem>
                          <SelectItem value="list"><div className="flex items-center gap-1.5"><List className="w-3.5 h-3.5" /><span>Lista</span></div></SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {mapping.extractAs === 'list' && (
                      <div className="flex-1">
                        <Label className="text-[11px] uppercase font-semibold">Campo do Item (opcional)</Label>
                        <Input
                          placeholder="Ex: name"
                          value={mapping.itemField || ''}
                          onChange={(e) => handleApiResponseMappingChange(mapping.id, 'itemField', e.target.value)}
                          className="text-xs h-8 mt-1"
                        />
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-[11px] uppercase text-muted-foreground">
                      <span>Pré-visualização</span>
                      {apiSampleData && <span>Baseado no JSON acima</span>}
                    </div>
                    <div className={cn("mt-1 rounded-md border px-2.5 py-2 text-xs font-mono whitespace-pre-wrap break-all", previewClass)}>
                      {preview.type === 'success' ? (
                        <>
                          <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">Valor encontrado ({describePreviewValue(preview.value)})</p>
                          <pre className="mt-1 whitespace-pre-wrap break-all text-[11px] font-mono">{formatPreviewValue(preview.value)}</pre>
                        </>
                      ) : (
                        <span>{preview.message}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <Button onClick={() => handleAddListItem('apiResponseMappings')} variant="outline" size="sm" className="text-xs h-8">
          <PlusCircle className="w-3 h-3 mr-1" /> Adicionar Mapeamento
        </Button>
      </div>
    </div>
  );

  const renderKeyValueList = (
    listName: 'apiHeadersList' | 'apiQueryParamsList' | 'apiBodyFormDataList',
    list: ApiHeader[] | ApiQueryParam[] | ApiFormDataEntry[] | undefined,
    keyPlaceholder: string,
    valuePlaceholder: string,
    addButtonLabel: string
  ) => {
    return (
      <div className="space-y-2">
        {(list || []).map((item) => (
          <div key={`${listName}-item-${item.id}`} className="flex items-center space-x-2">
            <div className="relative flex-1">
              <Input
                placeholder={keyPlaceholder}
                value={item.key}
                onChange={(e) => handleListItemChange(listName, item.id, 'key', e.target.value)}
                className="text-xs h-8 pr-8"
              />
              {renderVariableInserter(listName, false, true, item.id, 'key')}
            </div>
            <div className="relative flex-1">
              <Input
                placeholder={valuePlaceholder}
                value={item.value}
                onChange={(e) => handleListItemChange(listName, item.id, 'value', e.target.value)}
                className="text-xs h-8 pr-8"
              />
              {renderVariableInserter(listName, false, true, item.id, 'value')}
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleRemoveListItem(listName, item.id)}
              className="text-destructive hover:text-destructive/80 w-7 h-7"
              aria-label={`Remover ${listName.replace('List', '')} item`}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        ))}
        <Button onClick={() => handleAddListItem(listName)} variant="outline" size="sm" className="text-xs h-8">
          <PlusCircle className="w-3.5 h-3.5 mr-1" /> {addButtonLabel}
        </Button>
      </div>
    );
  };

  const renderApiResponseSettings = () => (
    <div className="space-y-3 pt-3 border-t">
      <div className="flex items-center space-x-2">
        <Switch
          id={`${node.id}-apiResponseAsInput`}
          checked={node.apiResponseAsInput || false}
          onCheckedChange={(checked) => onUpdate(node.id, { apiResponseAsInput: checked })}
        />
        <Label htmlFor={`${node.id}-apiResponseAsInput`}>Aceitar Resposta via API</Label>
      </div>
      {node.apiResponseAsInput && (
        <div>
          <Label htmlFor={`${node.id}-apiResponsePathForValue`}>Caminho do Valor no JSON da API</Label>
          <div className="relative">
            <Input
              id={`${node.id}-apiResponsePathForValue`}
              placeholder="Ex: data.choice"
              value={node.apiResponsePathForValue || ''}
              onChange={(e) => onUpdate(node.id, { apiResponsePathForValue: e.target.value })}
              className="pr-8"
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1">O fluxo usará o valor deste caminho como se fosse a resposta do usuário.</p>
        </div>
      )}
    </div>
  );

  const renderNodeIcon = (): React.ReactNode => {
    const iconProps = { className: "w-5 h-5" };
    const icons: Record<NodeType | 'default', React.ReactNode> = {
      'start': <PlayCircle {...iconProps} color="hsl(var(--primary))" />,
      'message': <MessageSquareText {...iconProps} color="hsl(var(--accent))" />,
      'input': <InputIcon {...iconProps} className="text-green-500" />,
      'option': <ListChecks {...iconProps} className="text-purple-500" />,
      'whatsapp-text': <BotMessageSquare {...iconProps} className="text-teal-500" />,
      'whatsapp-media': <ImageUp {...iconProps} className="text-indigo-500" />,
      'whatsapp-group': <UserPlus2 {...iconProps} className="text-pink-500" />,
      'condition': <GitFork {...iconProps} className="text-orange-500" />,
      'switch': <GitCommitHorizontal {...iconProps} className="text-indigo-500" />,
      'set-variable': <Variable {...iconProps} className="text-cyan-500" />,
      'api-call': <Webhook {...iconProps} className="text-red-500" />,
      'delay': <Timer {...iconProps} className="text-yellow-500" />,
      'date-input': <CalendarDays {...iconProps} className="text-sky-500" />,
      'redirect': <ExternalLink {...iconProps} className="text-lime-600" />,
      'typing-emulation': <MoreHorizontal {...iconProps} className="text-gray-500" />,
      'media-display': <FileImage {...iconProps} className="text-blue-500" />,
      'log-console': <TerminalSquare {...iconProps} className="text-slate-500" />,
      'code-execution': <Code2 {...iconProps} className="text-amber-500" />,
      'json-transform': <Shuffle {...iconProps} className="text-violet-500" />,
      'file-upload': <UploadCloud {...iconProps} className="text-fuchsia-500" />,
      'rating-input': <Star {...iconProps} className="text-yellow-400" />,
      'ai-text-generation': <Sparkles {...iconProps} className="text-rose-500" />,
      'send-email': <Mail {...iconProps} className="text-blue-600" />,
      'google-sheets-append': <Sheet {...iconProps} className="text-emerald-500" />,
      'intelligent-agent': <Headset {...iconProps} className="text-sky-500" />,
      'supabase-create-row': <Rows {...iconProps} className="text-green-500" />,
      'supabase-read-row': <Search {...iconProps} className="text-blue-500" />,
      'supabase-update-row': <Edit3 {...iconProps} className="text-yellow-500" />,
      'supabase-delete-row': <Trash2 {...iconProps} className="text-red-500" />,
      'dialogy-send-message': <Rocket {...iconProps} className="text-orange-500" />,
      'time-of-day': <Hourglass {...iconProps} className="text-teal-500" />,
      'end-flow': <StopCircle {...iconProps} className="text-destructive" />,
      default: <Settings2 {...iconProps} className="text-gray-500" />,
    };
    return icons[node.type] || icons.default;
  };

  const renderOutputConnectors = (): React.ReactNode => {
    if (node.type === 'end-flow') return null;

    if (node.type === 'start') {
        let yOffset = START_NODE_TRIGGER_INITIAL_Y_OFFSET;
        
        return (node.triggers || [])
            .filter(t => t.enabled)
            .flatMap((trigger) => {
                const triggerY = yOffset;
                const keywords = (trigger.keyword || '').split(',').map(k => k.trim()).filter(Boolean);
                const triggerBlockHeight = 40 + (keywords.length * START_NODE_TRIGGER_SPACING_Y);
                yOffset += triggerBlockHeight + 10; // Add some padding

                const triggerOutput = (
                     <div
                        key={trigger.id} // Chave única para o gatilho principal
                        className="absolute -right-2.5 z-10 flex items-center"
                        style={{ top: `${triggerY}px`, transform: 'translateY(-50%)' }}
                        title={`Gatilho: ${trigger.name}`}
                    >
                        <span className="text-xs text-muted-foreground mr-2 whitespace-nowrap overflow-hidden text-ellipsis max-w-[100px]">{trigger.name}</span>
                        <div
                            className="w-5 h-5 bg-accent hover:opacity-80 rounded-full flex items-center justify-center cursor-crosshair shadow-md"
                            onMouseDown={(e) => { e.stopPropagation(); onStartConnection(e, node, trigger.name); }}
                            data-connector="true" data-handle-type="source" data-handle-id={trigger.name}
                        >
                            <Hash className="w-3 h-3 text-accent-foreground" />
                        </div>
                    </div>
                );
                
                const keywordOutputs = keywords.map((kw, kwIndex) => (
                    <div
                        key={`${trigger.id}-${kw}`} // Chave única para cada palavra-chave
                        className="absolute -right-2.5 z-10 flex items-center"
                        style={{ top: `${triggerY + 25 + (kwIndex * START_NODE_TRIGGER_SPACING_Y)}px`, transform: 'translateY(-50%)' }}
                        title={`Palavra-chave: ${kw}`}
                    >
                        <span className="text-xs text-muted-foreground mr-2 whitespace-nowrap overflow-hidden text-ellipsis max-w-[100px]">{kw}</span>
                        <div
                            className="w-5 h-5 bg-purple-500 hover:bg-purple-600 rounded-full flex items-center justify-center cursor-crosshair shadow-md"
                            onMouseDown={(e) => { e.stopPropagation(); onStartConnection(e, node, kw); }}
                            data-connector="true" data-handle-type="source" data-handle-id={kw}
                        >
                            <KeyRound className="w-3 h-3 text-white" />
                        </div>
                    </div>
                ));
                
                return [triggerOutput, ...keywordOutputs];
            });
    }

    if (node.type === 'option') {
      const options = (node.optionsList || '').split('\n').map(opt => opt.trim()).filter(opt => opt !== '');
      return options.map((optionText, index) => {
        const key = `option-connector-${node.id}-${index}`;
        return (
          <div
            key={key}
            className="absolute -right-2.5 z-10 flex items-center"
            style={{ top: `${OPTION_NODE_HANDLE_INITIAL_Y_OFFSET + index * OPTION_NODE_HANDLE_SPACING_Y - 10}px` }}
            title={`Opção: ${optionText}`}
          >
            <span className="text-xs text-muted-foreground mr-2 whitespace-nowrap overflow-hidden text-ellipsis max-w-[100px]">{optionText}</span>
            <div
              className="w-5 h-5 bg-accent hover:opacity-80 rounded-full flex items-center justify-center cursor-crosshair shadow-md"
              onMouseDown={(e) => { e.stopPropagation(); onStartConnection(e, node, optionText); }}
              data-connector="true"
              data-handle-type="source"
              data-handle-id={optionText}
            >
              <Hash className="w-3 h-3 text-accent-foreground" />
            </div>
          </div>
        );
      });
    }

    if (node.type === 'condition' || node.type === 'time-of-day') {
      return (
        <>
          <div className="absolute -right-2.5 z-10 flex items-center" style={{ top: `${NODE_HEADER_HEIGHT_APPROX * (1 / 3) + 6 - 10}px` }}>
            <span className="text-xs text-muted-foreground mr-2">{node.type === 'time-of-day' ? 'Dentro do Horário' : 'Verdadeiro'}</span>
            <div
              title={node.type === 'time-of-day' ? 'Saída para "Dentro do Horário"' : 'Saída Verdadeiro'}
              className="w-5 h-5 bg-green-500 hover:bg-green-600 rounded-full flex items-center justify-center cursor-crosshair shadow-md"
              onMouseDown={(e) => { e.stopPropagation(); onStartConnection(e, node, 'true'); }}
              data-connector="true" data-handle-type="source" data-handle-id="true"
            >
              <Hash className="w-3 h-3 text-white" />
            </div>
          </div>
          <div className="absolute -right-2.5 z-10 flex items-center" style={{ top: `${NODE_HEADER_HEIGHT_APPROX * (2 / 3) + 6 - 10}px` }}>
            <span className="text-xs text-muted-foreground mr-2">{node.type === 'time-of-day' ? 'Fora do Horário' : 'Falso'}</span>
            <div
              title={node.type === 'time-of-day' ? 'Saída para "Fora do Horário"' : 'Saída Falso'}
              className="w-5 h-5 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center cursor-crosshair shadow-md"
              onMouseDown={(e) => { e.stopPropagation(); onStartConnection(e, node, 'false'); }}
              data-connector="true" data-handle-type="source" data-handle-id="false"
            >
              <Hash className="w-3 h-3 text-white" />
            </div>
          </div>
        </>
      );
    }

    if (node.type === 'switch') {
      const switchCases = node.switchCases || [];
      const initialY = 65;
      const spacingY = 30;

      return (
        <>
          {switchCases.map((caseItem, index) => (
            <div
              key={caseItem.id}
              className="absolute -right-2.5 z-10 flex items-center"
              style={{ top: `${initialY + index * spacingY - 10}px` }}
              title={`Caso: ${caseItem.value}`}
            >
              <span className="text-xs text-muted-foreground mr-2 whitespace-nowrap overflow-hidden text-ellipsis max-w-[100px]">
                {caseItem.value || 'vazio'}
              </span>
              <div
                className="w-5 h-5 bg-accent hover:opacity-80 rounded-full flex items-center justify-center cursor-crosshair shadow-md"
                onMouseDown={(e) => { e.stopPropagation(); onStartConnection(e, node, caseItem.id); }}
                data-connector="true" data-handle-type="source" data-handle-id={caseItem.id}
              >
                <Hash className="w-3 h-3 text-accent-foreground" />
              </div>
            </div>
          ))}
          <div
            className="absolute -right-2.5 z-10 flex items-center"
            style={{ top: `${initialY + switchCases.length * spacingY - 10}px` }}
            title="Caso Contrário"
          >
            <span className="text-xs text-muted-foreground mr-2">Caso Contrário</span>
            <div
              className="w-5 h-5 bg-gray-500 hover:bg-gray-600 rounded-full flex items-center justify-center cursor-crosshair shadow-md"
              onMouseDown={(e) => { e.stopPropagation(); onStartConnection(e, node, 'otherwise'); }}
              data-connector="true" data-handle-type="source" data-handle-id="otherwise"
            >
              <Hash className="w-3 h-3 text-white" />
            </div>
          </div>
        </>
      );
    }

    if (node.type !== 'start' && node.type !== 'option' && node.type !== 'condition' && node.type !== 'end-flow' && node.type !== 'switch' && node.type !== 'time-of-day') {
      return (
        <div
          className="absolute -right-2.5 z-10 flex items-center justify-center"
          style={{
            top: `${NODE_HEADER_CONNECTOR_Y_OFFSET}px`,
            transform: 'translateY(-50%)',
          }}
        >
          <div
            className="w-5 h-5 bg-accent hover:opacity-80 rounded-full flex items-center justify-center cursor-crosshair shadow-md"
            onMouseDown={(e) => { e.stopPropagation(); onStartConnection(e, node, 'default'); }}
            data-connector="true" data-handle-type="source" data-handle-id="default"
            title="Arraste para conectar"
          >
            <Hash className="w-3 h-3 text-accent-foreground" />
          </div>
        </div>
      );
    }
    return null;
  };

  const renderNodeContent = (): React.ReactNode => {
    switch (node.type) {
      case 'start': {
        const webhookUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/api/evolution/trigger/${activeWorkspace?.id || '[ID_DO_FLUXO]'}`;

        return (
          <div className="space-y-3" data-no-drag="true">
            <p className="text-xs text-muted-foreground">Configure os gatilhos que iniciam este fluxo. A ordem aqui define a prioridade de verificação.</p>
            {(node.triggers || []).map(trigger => (
              <div key={trigger.id} className="p-3 border rounded-md bg-muted/30">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id={`trigger-enabled-${trigger.id}`}
                      checked={trigger.enabled}
                      onCheckedChange={(checked) => handleTriggerChange(trigger.id, 'enabled', checked)}
                    />
                    <Label htmlFor={`trigger-enabled-${trigger.id}`} className="font-medium">{trigger.name}</Label>
                    {trigger.type === 'webhook' && <Webhook className="w-4 h-4 text-muted-foreground" />}
                    {trigger.type === 'manual' && <MousePointerClick className="w-4 h-4 text-muted-foreground" />}
                  </div>
                </div>

                <div className={cn("space-y-3", !trigger.enabled && "opacity-50 pointer-events-none")}>
                  <div>
                    <Label htmlFor={`trigger-keyword-${trigger.id}`} className="text-xs font-medium">Palavras-chave de Ativação (separadas por vírgula)</Label>
                    <Input
                      id={`trigger-keyword-${trigger.id}`}
                      value={trigger.keyword || ''}
                      onChange={(e) => handleKeywordsChange(trigger.id, e.target.value)}
                      placeholder="Ex: ajuda, cardapio, saldo"
                      className="h-8 text-xs mt-1"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Se preenchido, cria saídas separadas para cada palavra-chave.</p>
                  </div>

                  {trigger.type === 'webhook' && (
                    <div className="space-y-3 pt-2 border-t">
                      <div>
                        <Label htmlFor={`${node.id}-${trigger.id}-timeout`} className="text-xs font-medium">Tempo limite da sessão (segundos)</Label>
                        <Input
                          id={`${node.id}-${trigger.id}-timeout`}
                          type="number"
                          value={trigger.sessionTimeoutSeconds || 0}
                          onChange={(e) => handleTriggerChange(trigger.id, 'sessionTimeoutSeconds', parseInt(e.target.value, 10) || 0)}
                          placeholder="0 (sem limite)"
                          className="h-8 text-xs mt-1"
                        />
                        <p className="text-xs text-muted-foreground mt-1">Tempo de inatividade para encerrar a sessão. 0 para desabilitar.</p>
                      </div>

                      <div>
                        <Label htmlFor="webhook-url" className="text-xs font-medium">URL do Webhook (POST)</Label>
                        <div className="flex items-center space-x-1.5 mt-1">
                          <Input id="webhook-url" type="text" readOnly value={webhookUrl} className="bg-input/50 h-7 text-xs" />
                          <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => {
                            if (navigator.clipboard && navigator.clipboard.writeText) {
                              navigator.clipboard.writeText(webhookUrl).then(() => toast({ title: "URL Copiada!" })).catch(() => toast({ title: "Erro ao copiar", variant: "destructive" }));
                            } else {
                              toast({ title: "Não foi possível copiar", description: "Seu navegador não suporta esta ação ou a página não é segura (HTTPS).", variant: "destructive" });
                            }
                          }} title="Copiar URL">
                            <Copy className="w-3 h-3" />
                          </Button>
                        </div>
                         <Button variant="link" size="sm" className="text-xs h-auto p-0 mt-1.5 text-accent" onClick={handleOpenWebhookHistory}>
                          <History className="w-3.5 h-3.5 mr-1" /> Ver Histórico de Webhooks
                        </Button>
                      </div>

﻿                      <div className="pt-2 space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs font-medium">Mapeamento de Variáveis do Webhook</Label>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setActiveWebhookTriggerId(trigger.id);
                              setIsWebhookMappingDialogOpen(true);
                            }}
                          >
                            <Sparkles className="w-3.5 h-3.5 mr-1" /> Abrir Construtor
                          </Button>
                        </div>
                        <div className="rounded-md border bg-muted/10 p-3 space-y-2">
                          {(trigger.variableMappings || []).length === 0 ? (
                            <p className="text-[12px] text-muted-foreground">Nenhum mapeamento configurado ainda.</p>
                          ) : (
                            <div className="space-y-2 text-xs">
                              {(trigger.variableMappings || []).map((mapping) => (
                                <div key={mapping.id} className="flex items-center justify-between gap-2 rounded-md border border-border/60 bg-background px-2 py-1.5">
                                  <div>
                                    <p className="font-semibold text-sm">{mapping.flowVariable || 'Sem nome'}</p>
                                    <p className="text-[11px] text-muted-foreground">{mapping.jsonPath || 'Sem caminho definido'}</p>
                                  </div>
                                  <Button variant="ghost" size="icon" onClick={() => handleRemoveVariableMapping(trigger.id, mapping.id)} className="text-destructive hover:text-destructive/80 w-6 h-6">
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          )}
                          <div className="flex flex-wrap items-center gap-2 pt-1">
                            <Button onClick={() => handleAddVariableMapping(trigger.id)} variant="outline" size="sm" className="text-xs h-8">
                              <PlusCircle className="w-3 h-3 mr-1" /> Adicionar rápido
                            </Button>
                            <Button variant="ghost" size="sm" className="text-xs h-8" onClick={() => {
                              setActiveWebhookTriggerId(trigger.id);
                              setIsWebhookMappingDialogOpen(true);
                            }}>
                              Detalhar no construtor
                            </Button>
                          </div>
                        </div>
                      </div>


                    </div>
                  )}

                </div>
              </div>
            ))}
          </div>
        );
      }
      case 'message':
        return (
          <div data-no-drag="true">
            <div className="relative">
              <Textarea ref={textAreaRef} placeholder="Mensagem do bot..." value={node.text || ''} onChange={(e) => onUpdate(node.id, { text: e.target.value })} className="resize-none text-sm pr-8" rows={3} />
              {renderVariableInserter('text', true)}
            </div>
             <TextFormatToolbar fieldName="text" textAreaRef={textAreaRef as React.RefObject<HTMLTextAreaElement>} onUpdate={onUpdate} nodeId={node.id} />
          </div>
        );
      case 'input':
      case 'option': {
        const isOptionNode = node.type === 'option';
        const fieldName = isOptionNode ? 'questionText' : 'promptText';
        const ref = isOptionNode ? textAreaRef : textAreaRef;

        return (
          <div className="space-y-3" data-no-drag="true">
            <div>
              <Label htmlFor={`${node.id}-prompttext`}>{isOptionNode ? 'Texto da Pergunta' : 'Texto da Pergunta'}</Label>
              <div className="relative">
                <Textarea ref={textAreaRef} id={`${node.id}-prompttext`} placeholder="Digite sua pergunta aqui..." value={node.promptText || node.questionText || ''} onChange={(e) => onUpdate(node.id, { [fieldName]: e.target.value })} rows={2} className="pr-8" />
                {renderVariableInserter(fieldName, true)}
              </div>
               <TextFormatToolbar fieldName={fieldName} textAreaRef={textAreaRef as React.RefObject<HTMLTextAreaElement>} onUpdate={onUpdate} nodeId={node.id} />
            </div>

            {!isOptionNode && (
              <div>
                <Label htmlFor={`${node.id}-inputtype`}>Tipo de Entrada</Label>
                <Select value={node.inputType || 'text'} onValueChange={(value) => onUpdate(node.id, { inputType: value as NodeData['inputType'] })}>
                  <SelectTrigger id={`${node.id}-inputtype`}><SelectValue placeholder="Selecione o tipo" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Texto</SelectItem><SelectItem value="email">E-mail</SelectItem>
                    <SelectItem value="phone">Telefone</SelectItem><SelectItem value="number">Número</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {isOptionNode && (
              <>
                <div>
                  <Label htmlFor={`${node.id}-optionslist`}>Opções (uma por linha)</Label>
                  <Textarea id={`${node.id}-optionslist`} placeholder="Opção 1\nOpção 2" value={node.optionsList || ''} onChange={(e) => onUpdate(node.id, { optionsList: e.target.value })} rows={3} />
                </div>
                 <div className="space-y-2 pt-2 border-t">
                    <div className="flex items-center space-x-2">
                        <Switch
                        id={`${node.id}-aiEnabled`}
                        checked={node.aiEnabled || false}
                        onCheckedChange={(checked) => onUpdate(node.id, { aiEnabled: checked })}
                        />
                        <Label htmlFor={`${node.id}-aiEnabled`} className="flex items-center gap-1.5">
                          <BrainIcon className="w-4 h-4 text-primary" />
                          Usar IA para entender a resposta
                        </Label>
                    </div>
                    <p className="text-xs text-muted-foreground">Se ativado, a IA tentará corresponder a resposta do usuário à opção mais provável, em vez de exigir uma correspondência exata.</p>
                </div>
              </>
            )}

            <div>
              <Label htmlFor={`${node.id}-varsave`}>Salvar Resposta na Variável</Label>
              <Input id={`${node.id}-varsave`} placeholder="nome_da_variavel" value={node.variableToSaveResponse || node.variableToSaveChoice || ''} onChange={(e) => onUpdate(node.id, isOptionNode ? { variableToSaveChoice: e.target.value } : { variableToSaveResponse: e.target.value })} />
            </div>

            {renderApiResponseSettings()}

            {isOptionNode && <p className="text-xs text-muted-foreground italic pt-1">Cada opção na lista acima terá um conector de saída dedicado.</p>}
          </div>
        );
      }
      case 'whatsapp-text':
        return (
            <div className="space-y-3" data-no-drag="true">
                 <div>
                    <Label htmlFor={`${node.id}-watext`}>Mensagem</Label>
                    <div className="relative">
                        <Textarea ref={textAreaRef} id={`${node.id}-watext`} value={node.textMessage || ''} onChange={(e) => onUpdate(node.id, { textMessage: e.target.value })} rows={2} className="pr-8" />
                        {renderVariableInserter('textMessage', true)}
                    </div>
                     <TextFormatToolbar fieldName="textMessage" textAreaRef={textAreaRef as React.RefObject<HTMLTextAreaElement>} onUpdate={onUpdate} nodeId={node.id} />
                </div>
                <div>
                  <Label htmlFor={`${node.id}-instance`}>Instância</Label>
                  {isLoadingEvolutionInstances ? (
                    <div className="flex items-center text-sm text-muted-foreground h-10"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Carregando...</div>
                  ) : (
                    <Select onValueChange={(value) => onUpdate(node.id, { instanceName: value })} value={node.instanceName || ''}>
                      <SelectTrigger id={`${node.id}-instance`}>
                        <SelectValue placeholder="Selecione uma instância..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Usar Padrão do Fluxo</SelectItem>
                        {evolutionInstances.map(instance => (
                          <SelectItem key={instance.id} value={instance.name}>
                            {instance.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                 <div>
                    <Label htmlFor={`${node.id}-phone`}>Telefone (Ex: 55119... ou {"{{whatsapp_sender_jid}}"})</Label>
                    <div className="relative">
                      <Input id={`${node.id}-phone`} placeholder="55119... ou {{whatsapp_sender_jid}}" value={node.phoneNumber || ''} onChange={(e) => onUpdate(node.id, { phoneNumber: e.target.value })} className="pr-8" />
                      {renderVariableInserter('phoneNumber')}
                    </div>
                </div>
               
            </div>
        );
      case 'whatsapp-media':
      case 'whatsapp-group':
        return (
          <div className="space-y-3" data-no-drag="true">
            <div>
              <Label htmlFor={`${node.id}-instance`}>Instância</Label>
              {isLoadingEvolutionInstances ? (
                <div className="flex items-center text-sm text-muted-foreground h-10"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Carregando...</div>
              ) : (
                <Select onValueChange={(value) => onUpdate(node.id, { instanceName: value })} value={node.instanceName || ''}>
                  <SelectTrigger id={`${node.id}-instance`}>
                    <SelectValue placeholder="Selecione uma instância..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Usar Padrão do Fluxo</SelectItem>
                    {evolutionInstances.map(instance => (
                      <SelectItem key={instance.id} value={instance.name}>
                        {instance.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            {node.type !== 'whatsapp-group' && (
              <div>
                <Label htmlFor={`${node.id}-phone`}>Telefone (Ex: 55119... ou {"{{whatsapp_sender_jid}}"})</Label>
                <div className="relative">
                  <Input id={`${node.id}-phone`} placeholder="55119... ou {{whatsapp_sender_jid}}" value={node.phoneNumber || ''} onChange={(e) => onUpdate(node.id, { phoneNumber: e.target.value })} className="pr-8" />
                  {renderVariableInserter('phoneNumber')}
                </div>
              </div>
            )}
            {node.type === 'whatsapp-media' && (
              <>
                <div>
                  <Label htmlFor={`${node.id}-mediaurl`}>URL da Mídia (Ex: https://... ou {"{{url_midia}}"})</Label>
                  <div className="relative">
                    <Input id={`${node.id}-mediaurl`} placeholder="https://... ou {{url_midia}}" value={node.mediaUrl || ''} onChange={(e) => onUpdate(node.id, { mediaUrl: e.target.value })} className="pr-8" />
                    {renderVariableInserter('mediaUrl')}
                  </div>
                </div>
                <div><Label htmlFor={`${node.id}-mediatype`}>Tipo</Label>
                  <Select value={node.mediaType || 'image'} onValueChange={(value) => onUpdate(node.id, { mediaType: value as NodeData['mediaType'] })}>
                    <SelectTrigger id={`${node.id}-mediatype`}><SelectValue placeholder="Selecione o tipo de mídia" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="image">Imagem</SelectItem><SelectItem value="video">Vídeo</SelectItem>
                      <SelectItem value="document">Documento</SelectItem><SelectItem value="audio">Áudio</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor={`${node.id}-caption`}>Legenda/Nome do Arquivo (Opcional)</Label>
                  <div className="relative">
                    <Input ref={inputRef} id={`${node.id}-caption`} value={node.caption || ''} onChange={(e) => onUpdate(node.id, { caption: e.target.value })} className="pr-8" />
                    {renderVariableInserter('caption')}
                  </div>
                  <TextFormatToolbar fieldName="caption" textAreaRef={inputRef as React.RefObject<HTMLInputElement>} onUpdate={onUpdate} nodeId={node.id} />
                </div>
              </>
            )}
            {node.type === 'whatsapp-group' && (
              <>
                <div>
                  <Label htmlFor={`${node.id}-groupname`}>Nome do Grupo</Label>
                  <div className="relative">
                    <Input id={`${node.id}-groupname`} value={node.groupName || ''} onChange={(e) => onUpdate(node.id, { groupName: e.target.value })} className="pr-8" />
                    {renderVariableInserter('groupName')}
                  </div>
                </div>
                <div>
                  <Label htmlFor={`${node.id}-participants`}>Participantes (IDs separados por vírgula, ex: 5511...,5521...)</Label>
                  <div className="relative">
                    <Textarea id={`${node.id}-participants`} value={node.participants || ''} onChange={(e) => onUpdate(node.id, { participants: e.target.value })} rows={2} className="pr-8" />
                    {renderVariableInserter('participants', true)}
                  </div>
                </div>
              </>
            )}
          </div>
        );
      case 'condition':
        return (
          <div className="space-y-3" data-no-drag="true">
            <div className="grid grid-cols-2 gap-2">
                <div>
                    <Label htmlFor={`${node.id}-condtype`}>Tipo de Dado</Label>
                    <Select
                        value={node.conditionDataType || 'string'}
                        onValueChange={(value) => onUpdate(node.id, { conditionDataType: value as NodeData['conditionDataType'] })}
                    >
                        <SelectTrigger id={`${node.id}-condtype`}><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="string">Texto</SelectItem>
                            <SelectItem value="number">Número</SelectItem>
                            <SelectItem value="boolean">Booleano</SelectItem>
                            <SelectItem value="date">Data/Hora</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div>
                    <Label htmlFor={`${node.id}-condop`}>Operador</Label>
                    <Select
                        value={node.conditionOperator || '=='}
                        onValueChange={(value) => onUpdate(node.id, { conditionOperator: value as NodeData['conditionOperator'] })}
                    >
                        <SelectTrigger id={`${node.id}-condop`}><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {node.conditionDataType === 'date' ? (
                                <>
                                    <SelectItem value="isDateAfter">É depois de</SelectItem>
                                    <SelectItem value="isDateBefore">É antes de</SelectItem>
                                </>
                            ) : node.conditionDataType === 'boolean' ? (
                                <>
                                    <SelectItem value="isTrue">É verdadeiro</SelectItem>
                                    <SelectItem value="isFalse">É falso</SelectItem>
                                </>
                            ) : (
                                <>
                                    <SelectItem value="==">Igual a</SelectItem>
                                    <SelectItem value="!=">Diferente de</SelectItem>
                                    {node.conditionDataType === 'number' && <>
                                        <SelectItem value=">">Maior que</SelectItem>
                                        <SelectItem value="<">Menor que</SelectItem>
                                        <SelectItem value=">=">Maior ou igual a</SelectItem>
                                        <SelectItem value="<=">Menor ou igual a</SelectItem>
                                    </>}
                                    {node.conditionDataType === 'string' && <>
                                        <SelectItem value="contains">Contém</SelectItem>
                                        <SelectItem value="startsWith">Começa com</SelectItem>
                                        <SelectItem value="endsWith">Termina com</SelectItem>
                                    </>}
                                </>
                            )}
                            <SelectItem value="isEmpty">É vazio/nulo</SelectItem>
                            <SelectItem value="isNotEmpty">Não é vazio/nulo</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>
            <div>
              <Label htmlFor={`${node.id}-condvar`}>Variável (ex: {"{{variavel}}"})</Label>
              <div className="relative">
                <Input id={`${node.id}-condvar`} placeholder="{{variavel_a_verificar}}" value={node.conditionVariable || ''} onChange={(e) => onUpdate(node.id, { conditionVariable: e.target.value })} className="pr-8" />
                {renderVariableInserter('conditionVariable')}
              </div>
            </div>
            {node.conditionOperator !== 'isEmpty' && node.conditionOperator !== 'isNotEmpty' && node.conditionOperator !== 'isTrue' && node.conditionOperator !== 'isFalse' && (
                <div>
                    <Label htmlFor={`${node.id}-condval`}>Valor para Comparar</Label>
                    <div className="relative">
                        <Input
                            id={`${node.id}-condval`}
                            placeholder="Valor, {{outra_var}} ou {{now}}"
                            value={node.conditionValue || ''}
                            onChange={(e) => onUpdate(node.id, { conditionValue: e.target.value })}
                            className="pr-8"
                        />
                        {renderVariableInserter('conditionValue')}
                    </div>
                     {node.conditionDataType === 'date' && <p className="text-xs text-muted-foreground mt-1">Use `HH:mm` para horas ou `{"{{now}}"}` para a hora atual.</p>}
                </div>
            )}
          </div>
        );
      case 'switch':
        return (
          <div className="space-y-3" data-no-drag="true">
            <div>
              <Label htmlFor={`${node.id}-switchvar`}>Variável de Entrada (ex: {"{{status}}"})</Label>
              <div className="relative">
                <Input
                  id={`${node.id}-switchvar`}
                  placeholder="{{status_pagamento}}"
                  value={node.switchVariable || ''}
                  onChange={(e) => onUpdate(node.id, { switchVariable: e.target.value })}
                  className="pr-8"
                />
                {renderVariableInserter('switchVariable')}
              </div>
            </div>
            <div>
              <Label>Casos de Saída</Label>
              <div className="space-y-2">
                {(node.switchCases || []).map((caseItem, index) => (
                  <div key={caseItem.id} className="flex items-center space-x-2">
                    <Input
                      placeholder={`Valor do Caso ${index + 1}`}
                      value={caseItem.value}
                      onChange={(e) => handleSwitchCaseChange(caseItem.id, e.target.value)}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveSwitchCase(caseItem.id)}
                      className="text-destructive hover:text-destructive/80 w-8 h-8"
                      aria-label="Remover caso"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <Button onClick={handleAddSwitchCase} variant="outline" size="sm" className="mt-2 text-xs h-8">
                <PlusCircle className="w-3.5 h-3.5 mr-1" /> Adicionar Caso
              </Button>
            </div>
            <p className="text-xs text-muted-foreground italic pt-1">Cada caso terá um conector de saída. O fluxo seguirá para "Caso Contrário" se nenhum valor corresponder.</p>
          </div>
        );
      case 'set-variable':
        return (
          <div className="space-y-3" data-no-drag="true">
            <div>
              <Label htmlFor={`${node.id}-varname`}>Nome da Variável</Label>
              <Input id={`${node.id}-varname`} placeholder="minhaVariavel" value={node.variableName || ''} onChange={(e) => onUpdate(node.id, { variableName: e.target.value })} />
            </div>
            <div>
              <Label htmlFor={`${node.id}-varval`}>Valor (pode usar {"{{outra_var}}"})</Label>
              <div className="relative">
                <Input id={`${node.id}-varval`} placeholder="Valor ou {{outra_var}}" value={node.variableValue || ''} onChange={(e) => onUpdate(node.id, { variableValue: e.target.value })} className="pr-8" />
                {renderVariableInserter('variableValue')}
              </div>
            </div>
          </div>
        );
      case 'api-call':
        return (
          <div className="space-y-4" data-no-drag="true">
            <div>
              <Label htmlFor={`${node.id}-apiurl`}>URL da Requisição</Label>
              <div className="relative">
                <Input id={`${node.id}-apiurl`} placeholder="https://api.example.com/data" value={node.apiUrl || ''} onChange={(e) => onUpdate(node.id, { apiUrl: e.target.value })} className="pr-8" />
                {renderVariableInserter('apiUrl')}
              </div>
            </div>
            <div>
              <Label htmlFor={`${node.id}-apimethod`}>Método HTTP</Label>
              <Select value={node.apiMethod || 'GET'} onValueChange={(value) => onUpdate(node.id, { apiMethod: value as NodeData['apiMethod'] })}>
                <SelectTrigger id={`${node.id}-apimethod`}><SelectValue placeholder="Selecione o método" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="GET">GET</SelectItem><SelectItem value="POST">POST</SelectItem>
                  <SelectItem value="PUT">PUT</SelectItem><SelectItem value="DELETE">DELETE</SelectItem>
                  <SelectItem value="PATCH">PATCH</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Tabs defaultValue="auth" className="w-full">
              <TabsList className="grid w-full grid-cols-5 text-xs h-auto">
                  <TabsTrigger value="auth">Auth</TabsTrigger>
                  <TabsTrigger value="headers">Headers</TabsTrigger>
                  <TabsTrigger value="params">Query</TabsTrigger>
                  <TabsTrigger value="body">Corpo</TabsTrigger>
                  <TabsTrigger value="mapping">Mapeamento</TabsTrigger>
              </TabsList>
              <TabsContent value="auth" className="mt-4 space-y-3">
                <div>
                  <Label htmlFor={`${node.id}-apiauthtype`}>Tipo de Autenticação</Label>
                  <Select value={node.apiAuthType || 'none'} onValueChange={(value) => onUpdate(node.id, { apiAuthType: value as NodeData['apiAuthType'] })}>
                    <SelectTrigger id={`${node.id}-apiauthtype`}><SelectValue placeholder="Selecione o tipo" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhuma</SelectItem>
                      <SelectItem value="bearer">Bearer Token</SelectItem>
                      <SelectItem value="basic">Básica (Usuário/Senha)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {node.apiAuthType === 'bearer' && (
                  <div>
                    <Label htmlFor={`${node.id}-apiauthbearertoken`}>Bearer Token</Label>
                    <div className="relative">
                      <Input id={`${node.id}-apiauthbearertoken`} placeholder="Seu token aqui..." value={node.apiAuthBearerToken || ''} onChange={(e) => onUpdate(node.id, { apiAuthBearerToken: e.target.value })} className="pr-8" />
                      {renderVariableInserter('apiAuthBearerToken')}
                    </div>
                  </div>
                )}
                {node.apiAuthType === 'basic' && (
                  <>
                    <div>
                      <Label htmlFor={`${node.id}-apiauthbasicuser`}>Usuário</Label>
                      <div className="relative">
                        <Input id={`${node.id}-apiauthbasicuser`} placeholder="Nome de usuário" value={node.apiAuthBasicUser || ''} onChange={(e) => onUpdate(node.id, { apiAuthBasicUser: e.target.value })} className="pr-8" />
                        {renderVariableInserter('apiAuthBasicUser')}
                      </div>
                    </div>
                    <div>
                      <Label htmlFor={`${node.id}-apiauthbasicpassword`}>Senha</Label>
                      <div className="relative">
                        <Input id={`${node.id}-apiauthbasicpassword`} type="password" placeholder="Senha" value={node.apiAuthBasicPassword || ''} onChange={e => onUpdate(node.id, { apiAuthBasicPassword: e.target.value })} className="pr-8" />
                        {renderVariableInserter('apiAuthBasicPassword')}
                      </div>
                    </div>
                  </>
                )}
              </TabsContent>
              <TabsContent value="headers" className="mt-4">
                <Label>Headers da Requisição</Label>
                {renderKeyValueList('apiHeadersList', node.apiHeadersList, 'Nome do Header (Ex: Content-Type)', 'Valor do Header (Ex: application/json)', 'Adicionar Header')}
              </TabsContent>
              <TabsContent value="params" className="mt-4">
                <Label>Parâmetros de Query (URL)</Label>
                {renderKeyValueList('apiQueryParamsList', node.apiQueryParamsList, 'Nome do Parâmetro', 'Valor do Parâmetro', 'Adicionar Parâmetro')}
              </TabsContent>
              <TabsContent value="body" className="mt-4 space-y-3">
                <div>
                  <Label htmlFor={`${node.id}-apibodytype`}>Tipo de Corpo da Requisição</Label>
                  <Select value={node.apiBodyType || 'none'} onValueChange={(value) => onUpdate(node.id, { apiBodyType: value as NodeData['apiBodyType'] })}>
                    <SelectTrigger id={`${node.id}-apibodytype`}><SelectValue placeholder="Selecione o tipo" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum</SelectItem>
                      <SelectItem value="json">JSON</SelectItem>
                      <SelectItem value="form-data">Form-Data</SelectItem>
                      <SelectItem value="raw">Raw (Texto)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {node.apiBodyType === 'json' && (
                  <div>
                    <Label htmlFor={`${node.id}-apibodyjson`}>Corpo JSON</Label>
                    <div className="relative">
                      <Textarea id={`${node.id}-apibodyjson`} placeholder='{ "chave": "valor" }' value={node.apiBodyJson || ''} onChange={(e) => onUpdate(node.id, { apiBodyJson: e.target.value })} rows={4} className="pr-8" />
                      {renderVariableInserter('apiBodyJson', true)}
                    </div>
                  </div>
                )}
                {node.apiBodyType === 'form-data' && (
                  <div>
                    <Label>Campos Form-Data</Label>
                    {renderKeyValueList('apiBodyFormDataList', node.apiBodyFormDataList, 'Nome do Campo', 'Valor do Campo', 'Adicionar Campo Form-Data')}
                  </div>
                )}
                {node.apiBodyType === 'raw' && (
                  <div>
                    <Label htmlFor={`${node.id}-apibodyraw`}>Corpo Raw (Texto)</Label>
                    <div className="relative">
                      <Textarea id={`${node.id}-apibodyraw`} placeholder="Conteúdo do corpo em texto puro..." value={node.apiBodyRaw || ''} onChange={(e) => onUpdate(node.id, { apiBodyRaw: e.target.value })} rows={4} className="pr-8" />
                      {renderVariableInserter('apiBodyRaw', true)}
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="mapping" className="mt-4 space-y-3">
                <div className="rounded-md border bg-muted/10 p-3 space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-sm">Resumo do Mapeamento</p>
                      <p className="text-[11px] text-muted-foreground">Use o construtor em tela cheia para configurar com precisão.</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setIsApiMappingDialogOpen(true)}>
                      <Sparkles className="w-3.5 h-3.5 mr-1" /> Abrir Construtor
                    </Button>
                  </div>
                  <div className="grid gap-2 text-[12px]">
                    <div className="rounded border border-dashed px-2 py-1.5">
                      <p className="font-semibold text-xs uppercase text-muted-foreground">Resultado Principal</p>
                      <p>
                        Caminho: <span className="font-mono">{node.apiResponsePath || '—'}</span>
                      </p>
                      <p>Variável: <span className="font-semibold">{node.apiOutputVariable || '—'}</span></p>
                    </div>
                    <div className="rounded border border-dashed px-2 py-1.5">
                      <p className="font-semibold text-xs uppercase text-muted-foreground">Mapeamentos Extras</p>
                      {(node.apiResponseMappings || []).length === 0 ? (
                        <p className="text-muted-foreground">Nenhum mapeamento adicional configurado.</p>
                      ) : (
                        <div className="space-y-1.5">
                          {(node.apiResponseMappings || []).map((mapping) => (
                            <div key={mapping.id} className="flex items-center justify-between gap-2 rounded border bg-background px-2 py-1">
                              <div>
                                <p className="font-medium text-sm">{mapping.flowVariable || 'Sem variável'}</p>
                                <p className="text-[11px] text-muted-foreground">{mapping.jsonPath || 'Sem expressão'}</p>
                              </div>
                              <Button variant="ghost" size="icon" onClick={() => handleRemoveListItem('apiResponseMappings', mapping.id)} className="text-destructive hover:text-destructive/80 w-6 h-6">
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button variant="outline" size="sm" className="text-xs h-8" onClick={() => setIsApiMappingDialogOpen(true)}>
                      Configurar agora
                    </Button>
                    <Button variant="ghost" size="sm" className="text-xs h-8" onClick={() => handleAddListItem('apiResponseMappings')}>
                      <PlusCircle className="w-3 h-3 mr-1" /> Adicionar rápido
                    </Button>
                  </div>
                </div>
              </TabsContent>


            </Tabs>
             <div className="flex gap-2 w-full mt-3">
                <Button variant="outline" className="w-full" onClick={handleTestApiCall} disabled={isTestingApi}>
                  <TestTube2 className="mr-2 h-4 w-4" /> {isTestingApi ? "Testando..." : "Testar Requisição"}
                </Button>
                 <Button variant="outline" className="w-full" onClick={handleOpenApiHistory}>
                    <History className="mr-2 h-4 w-4" /> Histórico
                </Button>
            </div>
          </div>
        );
      case 'delay':
        return (
          <div data-no-drag="true">
            <Label htmlFor={`${node.id}-delay`}>Duração do Atraso (em milissegundos)</Label>
            <Input id={`${node.id}-delay`} type="number" placeholder="1000" value={node.delayDuration ?? ''} onChange={(e) => onUpdate(node.id, { delayDuration: parseInt(e.target.value, 10) || 0 })} />
          </div>
        );
      case 'date-input':
        return (
          <div className="space-y-3" data-no-drag="true">
            <div>
              <Label htmlFor={`${node.id}-datelabel`}>Texto da Pergunta</Label>
              <div className="relative">
                <Input ref={inputRef} id={`${node.id}-datelabel`} placeholder="Ex: Qual sua data de nascimento?" value={node.dateInputLabel || ''} onChange={(e) => onUpdate(node.id, { dateInputLabel: e.target.value })} className="pr-8" />
                {renderVariableInserter('dateInputLabel')}
              </div>
            </div>
            <div>
              <Label htmlFor={`${node.id}-varsavedate`}>Salvar Data na Variável</Label>
              <Input id={`${node.id}-varsavedate`} placeholder="data_nascimento" value={node.variableToSaveDate || ''} onChange={(e) => onUpdate(node.id, { variableToSaveDate: e.target.value })} />
            </div>
            {renderApiResponseSettings()}
          </div>
        );
      case 'redirect':
        return (
          <div data-no-drag="true">
            <Label htmlFor={`${node.id}-redirecturl`}>URL para Redirecionamento</Label>
            <div className="relative">
              <Input id={`${node.id}-redirecturl`} placeholder="https://exemplo.com/{{id_usuario}}" value={node.redirectUrl || ''} onChange={(e) => onUpdate(node.id, { redirectUrl: e.target.value })} className="pr-8" />
              {renderVariableInserter('redirectUrl')}
            </div>
          </div>
        );
      case 'typing-emulation':
        return (
          <div data-no-drag="true">
            <Label htmlFor={`${node.id}-typingduration`}>Duração da Simulação de Digitação (ms)</Label>
            <Input id={`${node.id}-typingduration`} type="number" placeholder="1500" value={node.typingDuration ?? ''} onChange={(e) => onUpdate(node.id, { typingDuration: parseInt(e.target.value, 10) || 0 })} />
          </div>
        );
      case 'media-display':
        return (
          <div data-no-drag="true">
            <div className="space-y-3">
              <div><Label htmlFor={`${node.id}-mediadisplaytype`}>Tipo de Mídia</Label>
                <Select value={node.mediaDisplayType || 'image'} onValueChange={(value) => onUpdate(node.id, { mediaDisplayType: value as NodeData['mediaDisplayType'] })}>
                  <SelectTrigger id={`${node.id}-mediadisplaytype`}><SelectValue placeholder="Selecione o tipo" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="image">Imagem</SelectItem><SelectItem value="video">Vídeo</SelectItem><SelectItem value="audio">Áudio</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor={`${node.id}-mediadisplayurl`}>URL da Mídia</Label>
                <div className="relative">
                  <Input id={`${node.id}-mediadisplayurl`} placeholder="https://... ou {{url_da_imagem}}" value={node.mediaDisplayUrl || ''} onChange={(e) => onUpdate(node.id, { mediaDisplayUrl: e.target.value })} className="pr-8" />
                  {renderVariableInserter('mediaDisplayUrl')}
                </div>
              </div>
              <div>
                <Label htmlFor={`${node.id}-mediadisplaytext`}>Texto Alternativo/Legenda</Label>
                <div className="relative">
                  <Input ref={inputRef} id={`${node.id}-mediadisplaytext`} placeholder="Descrição da mídia" value={node.mediaDisplayText || ''} onChange={(e) => onUpdate(node.id, { mediaDisplayText: e.target.value })} className="pr-8" />
                  {renderVariableInserter('mediaDisplayText')}
                </div>
                <TextFormatToolbar fieldName="mediaDisplayText" textAreaRef={inputRef as React.RefObject<HTMLInputElement>} onUpdate={onUpdate} nodeId={node.id} />
              </div>
            </div>
          </div>
        );
      case 'log-console':
        return (
          <div data-no-drag="true">
            <Label htmlFor={`${node.id}-logmsg`}>Mensagem para Log</Label>
            <div className="relative">
              <Textarea id={`${node.id}-logmsg`} placeholder="Ex: Status: {{input.status}}, Usuário: {{user.id}}" value={node.logMessage || ''} onChange={(e) => onUpdate(node.id, { logMessage: e.target.value })} rows={2} className="pr-8" />
              {renderVariableInserter('logMessage', true)}
            </div>
          </div>
        );
      case 'code-execution':
        return (
          <div className="space-y-3" data-no-drag="true">
            <div>
              <Label htmlFor={`${node.id}-codesnippet`}>Trecho de Código (JavaScript)</Label>
              <div className="relative">
                <Textarea id={`${node.id}-codesnippet`} placeholder="function minhaFuncao(variaveis) {&#10;  // Use variaveis.nome_da_variavel para acessar&#10;  return { resultado: 'sucesso' };&#10;}&#10;minhaFuncao(variables);" value={node.codeSnippet || ''} onChange={(e) => onUpdate(node.id, { codeSnippet: e.target.value })} rows={6} className="pr-8 font-mono text-xs" />
                {renderVariableInserter('codeSnippet', true)}
              </div>
            </div>
            <div>
              <Label htmlFor={`${node.id}-codeoutputvar`}>Salvar Saída (objeto) na Variável</Label>
              <Input id={`${node.id}-codeoutputvar`} placeholder="resultado_codigo (ex: resultado_codigo.resultado)" value={node.codeOutputVariable || ''} onChange={(e) => onUpdate(node.id, { codeOutputVariable: e.target.value })} />
            </div>
            <p className="text-xs text-muted-foreground">Nota: O código é executado em um ambiente sandbox no servidor.</p>
          </div>
        );
      case 'json-transform':
        return (
          <div className="space-y-3" data-no-drag="true">
            <div>
              <Label htmlFor={`${node.id}-inputjson`}>JSON de Entrada (objeto ou {"{{variavel}}"})</Label>
              <div className="relative">
                <Textarea id={`${node.id}-inputjson`} placeholder='{ "chave": "valor" } ou {{dados_api}}' value={node.inputJson || ''} onChange={(e) => onUpdate(node.id, { inputJson: e.target.value })} rows={3} className="pr-8" />
                {renderVariableInserter('inputJson', true)}
              </div>
            </div>
            <div>
              <Label htmlFor={`${node.id}-jsonata`}>Expressão JSONata</Label>
              <div className="relative">
                <Input id={`${node.id}-jsonata`} placeholder="$.chave.outraChave[0]" value={node.jsonataExpression || ''} onChange={(e) => onUpdate(node.id, { jsonataExpression: e.target.value })} className="pr-8" />
                {renderVariableInserter('jsonataExpression')}
              </div>
            </div>
            <div>
              <Label htmlFor={`${node.id}-jsonoutputvar`}>Salvar JSON Transformado na Variável</Label>
              <Input id={`${node.id}-jsonoutputvar`} placeholder="json_transformado" value={node.jsonOutputVariable || ''} onChange={(e) => onUpdate(node.id, { jsonOutputVariable: e.target.value })} />
            </div>
          </div>
        );
      case 'file-upload':
        return (
          <div className="space-y-3" data-no-drag="true">
            <div>
              <Label htmlFor={`${node.id}-uploadprompt`}>Texto do Prompt de Upload</Label>
              <div className="relative">
                <Input ref={inputRef} id={`${node.id}-uploadprompt`} placeholder="Por favor, envie seu documento." value={node.uploadPromptText || ''} onChange={(e) => onUpdate(node.id, { uploadPromptText: e.target.value })} className="pr-8" />
                {renderVariableInserter('uploadPromptText')}
              </div>
               <TextFormatToolbar fieldName="uploadPromptText" textAreaRef={inputRef as React.RefObject<HTMLInputElement>} onUpdate={onUpdate} nodeId={node.id} />
            </div>
            <div>
              <Label htmlFor={`${node.id}-filefilter`}>Filtro de Tipo de Arquivo (ex: image/*, .pdf)</Label>
              <Input id={`${node.id}-filefilter`} placeholder="image/*, .pdf, .docx" value={node.fileTypeFilter || ''} onChange={(e) => onUpdate(node.id, { fileTypeFilter: e.target.value })} />
            </div>
            <div>
              <Label htmlFor={`${node.id}-maxsize`}>Tam. Máx. Arquivo (MB)</Label>
              <Input id={`${node.id}-maxsize`} type="number" placeholder="5" value={node.maxFileSizeMB ?? ''} onChange={(e) => onUpdate(node.id, { maxFileSizeMB: e.target.value ? parseInt(e.target.value, 10) : undefined })} />
            </div>
            <div>
              <Label htmlFor={`${node.id}-fileurlvar`}>Salvar URL do Arquivo na Variável</Label>
              <Input id={`${node.id}-fileurlvar`} placeholder="url_do_arquivo" value={node.fileUrlVariable || ''} onChange={(e) => onUpdate(node.id, { fileUrlVariable: e.target.value })} />
            </div>
            {renderApiResponseSettings()}
          </div>
        );
      case 'rating-input':
        return (
          <div className="space-y-3" data-no-drag="true">
            <div>
              <Label htmlFor={`${node.id}-ratingq`}>Pergunta da Avaliação</Label>
              <div className="relative">
                <Input ref={inputRef} id={`${node.id}-ratingq`} placeholder="Como você nos avalia?" value={node.ratingQuestionText || ''} onChange={(e) => onUpdate(node.id, { ratingQuestionText: e.target.value })} className="pr-8" />
                {renderVariableInserter('ratingQuestionText')}
              </div>
              <TextFormatToolbar fieldName="ratingQuestionText" textAreaRef={inputRef as React.RefObject<HTMLInputElement>} onUpdate={onUpdate} nodeId={node.id} />
            </div>
            <div>
              <Label htmlFor={`${node.id}-maxrating`}>Avaliação Máxima</Label>
              <Input id={`${node.id}-maxrating`} type="number" placeholder="5" value={node.maxRatingValue ?? ''} onChange={(e) => onUpdate(node.id, { maxRatingValue: parseInt(e.target.value, 10) || 5 })} />
            </div>
            <div><Label htmlFor={`${node.id}-ratingicon`}>Ícone de Avaliação</Label>
              <Select value={node.ratingIconType || 'star'} onValueChange={(value) => onUpdate(node.id, { ratingIconType: value as NodeData['ratingIconType'] })}>
                <SelectTrigger id={`${node.id}-ratingicon`}><SelectValue placeholder="Selecione o ícone" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="star">Estrela</SelectItem><SelectItem value="heart">Coração</SelectItem><SelectItem value="number">Número</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor={`${node.id}-ratingoutputvar`}>Salvar Avaliação na Variável</Label>
              <Input id={`${node.id}-ratingoutputvar`} placeholder="avaliacao_usuario" value={node.ratingOutputVariable || ''} onChange={(e) => onUpdate(node.id, { ratingOutputVariable: e.target.value })} />
            </div>
            {renderApiResponseSettings()}
          </div>
        );
      case 'ai-text-generation':
        return (
          <div className="space-y-3" data-no-drag="true">
            <div>
              <Label htmlFor={`${node.id}-aiprompt`}>Prompt para IA</Label>
              <div className="relative">
                <Textarea ref={textAreaRef} id={`${node.id}-aiprompt`} placeholder="Gere uma descrição para um produto chamado {{input.nome_produto}}." value={node.aiPromptText || ''} onChange={(e) => onUpdate(node.id, { aiPromptText: e.target.value })} rows={4} className="pr-8" />
                {renderVariableInserter('aiPromptText', true)}
              </div>
               <TextFormatToolbar fieldName="aiPromptText" textAreaRef={textAreaRef as React.RefObject<HTMLTextAreaElement>} onUpdate={onUpdate} nodeId={node.id} />
            </div>
            <div>
              <Label htmlFor={`${node.id}-aimodel`}>Modelo de IA (opcional)</Label>
              <div className="relative">
                <Input id={`${node.id}-aimodel`} placeholder="gemini-1.5-flash (padrão)" value={node.aiModelName || ''} onChange={(e) => onUpdate(node.id, { aiModelName: e.target.value })} className="pr-8" />
                {renderVariableInserter('aiModelName')}
              </div>
            </div>
            <div>
              <Label htmlFor={`${node.id}-aioutputvar`}>Salvar Resposta da IA na Variável</Label>
              <Input id={`${node.id}-aioutputvar`} placeholder="resposta_ia" value={node.aiOutputVariable || ''} onChange={(e) => onUpdate(node.id, { aiOutputVariable: e.target.value })} />
            </div>
            <p className="text-xs text-muted-foreground">Esta integração usa Genkit. Configure seu modelo em `src/ai/genkit.ts`.</p>
          </div>
        );
      case 'send-email':
        return (
          <div className="space-y-3" data-no-drag="true">
            <div>
              <Label htmlFor={`${node.id}-emailto`}>Para (E-mail ou {"{{variavel}}"})</Label>
              <div className="relative">
                <Input id={`${node.id}-emailto`} type="email" placeholder="destinatario@exemplo.com ou {{email_cliente}}" value={node.emailTo || ''} onChange={(e) => onUpdate(node.id, { emailTo: e.target.value })} className="pr-8" />
                {renderVariableInserter('emailTo')}
              </div>
            </div>
            <div>
              <Label htmlFor={`${node.id}-emailsubject`}>Assunto</Label>
              <div className="relative">
                <Input ref={inputRef} id={`${node.id}-emailsubject`} placeholder="Assunto do seu e-mail" value={node.emailSubject || ''} onChange={(e) => onUpdate(node.id, { emailSubject: e.target.value })} className="pr-8" />
                {renderVariableInserter('emailSubject')}
              </div>
              <TextFormatToolbar fieldName="emailSubject" textAreaRef={inputRef as React.RefObject<HTMLInputElement>} onUpdate={onUpdate} nodeId={node.id} />
            </div>
            <div>
              <Label htmlFor={`${node.id}-emailbody`}>Corpo do E-mail (HTML ou Texto)</Label>
              <div className="relative">
                <Textarea ref={textAreaRef} id={`${node.id}-emailbody`} placeholder="Olá {{input.nome_cliente}},\n\nSua mensagem aqui." value={node.emailBody || ''} onChange={(e) => onUpdate(node.id, { emailBody: e.target.value })} rows={4} className="pr-8" />
                {renderVariableInserter('emailBody', true)}
              </div>
              <TextFormatToolbar fieldName="emailBody" textAreaRef={textAreaRef as React.RefObject<HTMLTextAreaElement>} onUpdate={onUpdate} nodeId={node.id} />
            </div>
            <div>
              <Label htmlFor={`${node.id}-emailfrom`}>De (E-mail - opcional)</Label>
              <div className="relative">
                <Input id={`${node.id}-emailfrom`} type="email" placeholder="remetente@exemplo.com" value={node.emailFrom || ''} onChange={(e) => onUpdate(node.id, { emailFrom: e.target.value })} className="pr-8" />
                {renderVariableInserter('emailFrom')}
              </div>
            </div>
          </div>
        );
      case 'google-sheets-append':
        return (
          <div className="space-y-3" data-no-drag="true">
            <div>
              <Label htmlFor={`${node.id}-gsheetid`}>ID da Planilha Google</Label>
              <div className="relative">
                <Input id={`${node.id}-gsheetid`} placeholder="abc123xyz789" value={node.googleSheetId || ''} onChange={(e) => onUpdate(node.id, { googleSheetId: e.target.value })} className="pr-8" />
                {renderVariableInserter('googleSheetId')}
              </div>
            </div>
            <div>
              <Label htmlFor={`${node.id}-gsheetname`}>Nome da Aba (Planilha)</Label>
              <div className="relative">
                <Input id={`${node.id}-gsheetname`} placeholder="Página1" value={node.googleSheetName || ''} onChange={(e) => onUpdate(node.id, { googleSheetName: e.target.value })} className="pr-8" />
                {renderVariableInserter('googleSheetName')}
              </div>
            </div>
            <div>
              <Label htmlFor={`${node.id}-gsheetdata`}>Dados da Linha (JSON array de strings)</Label>
              <div className="relative">
                <Textarea id={`${node.id}-gsheetdata`} placeholder='["{{input.valor1}}", "{{input.valor2}}", "texto fixo"]' value={node.googleSheetRowData || ''} onChange={(e) => onUpdate(node.id, { googleSheetRowData: e.target.value })} rows={2} className="pr-8" />
                {renderVariableInserter('googleSheetRowData', true)}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Certifique-se que a API do Google Sheets está habilitada e as credenciais configuradas no servidor.</p>
          </div>
        );
      case 'intelligent-agent':
        return (
          <div className="space-y-3" data-no-drag="true">
            <div>
              <Label htmlFor={`${node.id}-agentname`}>Nome do Agente</Label>
              <div className="relative">
                <Input id={`${node.id}-agentname`} placeholder="Agente de Suporte N1" value={node.agentName || ''} onChange={(e) => onUpdate(node.id, { agentName: e.target.value })} className="pr-8" />
                {renderVariableInserter('agentName')}
              </div>
            </div>
            <div>
              <Label htmlFor={`${node.id}-agentsystemprompt`}>Prompt do Sistema / Instruções</Label>
              <div className="relative">
                <Textarea id={`${node.id}-agentsystemprompt`} placeholder="Você é um assistente virtual especializado em {{area_especializacao}}." value={node.agentSystemPrompt || ''} onChange={(e) => onUpdate(node.id, { agentSystemPrompt: e.target.value })} rows={4} className="pr-8" />
                {renderVariableInserter('agentSystemPrompt', true)}
              </div>
            </div>
            <div>
              <Label htmlFor={`${node.id}-userinputvar`}>Variável com Entrada do Usuário (ex: {"{{pergunta_usuario}}"})</Label>
              <div className="relative">
                <Input id={`${node.id}-userinputvar`} placeholder="{{pergunta_usuario}}" value={node.userInputVariable || ''} onChange={(e) => onUpdate(node.id, { userInputVariable: e.target.value })} className="pr-8" />
                {renderVariableInserter('userInputVariable')}
              </div>
            </div>
            <div>
              <Label htmlFor={`${node.id}-agentresponsevar`}>Salvar Resposta na Variável</Label>
              <Input id={`${node.id}-agentresponsevar`} placeholder="resposta_agente" value={node.agentResponseVariable || ''} onChange={(e) => onUpdate(node.id, { agentResponseVariable: e.target.value })} />
            </div>
            <div>
              <Label htmlFor={`${node.id}-aimodel`}>Modelo de IA (opcional, ex: gemini-1.5-flash)</Label>
              <div className="relative">
                <Input id={`${node.id}-aimodel`} placeholder="gemini-1.5-flash (padrão Genkit)" value={node.aiModelName || ''} onChange={(e) => onUpdate(node.id, { aiModelName: e.target.value })} className="pr-8" />
                {renderVariableInserter('aiModelName')}
              </div>
            </div>
            <div>
              <Label htmlFor={`${node.id}-maxturns`}>Máx. Turnos de Conversa (opcional)</Label>
              <Input id={`${node.id}-maxturns`} type="number" placeholder="5" value={node.maxConversationTurns ?? ''} onChange={(e) => onUpdate(node.id, { maxConversationTurns: e.target.value ? parseInt(e.target.value, 10) : undefined })} />
            </div>
            <div>
              <Label htmlFor={`${node.id}-temperature`}>Temperatura (0-1, opcional)</Label>
              <div className="flex items-center space-x-2">
                <Slider
                  id={`${node.id}-temperature`}
                  min={0} max={1} step={0.01}
                  defaultValue={[node.temperature ?? 0.7]}
                  onValueChange={(value) => onUpdate(node.id, { temperature: value[0] })}
                  className="flex-1"
                />
                <Input
                  type="number" min={0} max={1} step={0.01}
                  value={node.temperature ?? 0.7}
                  onChange={(e) => onUpdate(node.id, { temperature: e.target.value ? parseFloat(e.target.value) : undefined })}
                  className="w-20"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Este nó simula uma conversa com um agente de IA. A lógica real usa Genkit.</p>
          </div>
        );
      case 'supabase-create-row':
      case 'supabase-read-row':
      case 'supabase-update-row':
      case 'supabase-delete-row': {
        const isReadOp = node.type === 'supabase-read-row';
        const isCreateOp = node.type === 'supabase-create-row';
        const needsIdentifier = isReadOp || node.type === 'supabase-update-row' || node.type === 'supabase-delete-row';
        const needsDataJson = isCreateOp || node.type === 'supabase-update-row';

        return (
          <div className="space-y-3" data-no-drag="true">
            <div>
              <Label htmlFor={`${node.id}-tableName`}>Nome da Tabela Supabase</Label>
              {isLoadingSupabaseTables && <div className="flex items-center text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando tabelas...</div>}
              {!isLoadingSupabaseTables && supabaseSchemaError && <p className="text-xs text-destructive">{supabaseSchemaError}</p>}
              {!isLoadingSupabaseTables && !supabaseSchemaError && supabaseTables.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma tabela encontrada ou Supabase não configurado/habilitado.</p>}
              {!isLoadingSupabaseTables && !supabaseSchemaError && supabaseTables.length > 0 && (
                <Select
                  value={node.supabaseTableName || ''}
                  onValueChange={(value) => {
                    onUpdate(node.id, {
                      supabaseTableName: value,
                      supabaseIdentifierColumn: '',
                      supabaseColumnsToSelect: '*'
                    });
                  }}
                >
                  <SelectTrigger id={`${node.id}-tableName`}><SelectValue placeholder="Selecione a Tabela" /></SelectTrigger>
                  <SelectContent>
                    {supabaseTables.map(table => <SelectItem key={table.name} value={table.name}>{table.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </div>

            {needsIdentifier && (
              <>
                <div>
                  <Label htmlFor={`${node.id}-identifierCol`}>Coluna Identificadora (Filtro)</Label>
                  {isLoadingSupabaseColumns && <div className="flex items-center text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando colunas...</div>}
                  {!isLoadingSupabaseColumns && !node.supabaseTableName && <p className="text-xs text-muted-foreground">Selecione uma tabela para ver as colunas.</p>}
                  {!isLoadingSupabaseColumns && node.supabaseTableName && supabaseColumns.length === 0 && !supabaseSchemaError && <p className="text-xs text-muted-foreground">Nenhuma coluna encontrada para a tabela selecionada.</p>}
                  {!isLoadingSupabaseColumns && supabaseColumns.length > 0 && (
                    <Select
                      value={node.supabaseIdentifierColumn || ''}
                      onValueChange={(value) => onUpdate(node.id, { supabaseIdentifierColumn: value })}
                      disabled={!node.supabaseTableName || supabaseColumns.length === 0}
                    >
                      <SelectTrigger id={`${node.id}-identifierCol`}>
                        <SelectValue placeholder="Selecione a Coluna para filtrar" />
                      </SelectTrigger>
                      <SelectContent>
                        {supabaseColumns.map(col => <SelectItem key={col.name} value={col.name}>{col.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                  {!isLoadingSupabaseColumns && supabaseSchemaError && node.supabaseTableName && <p className="text-xs text-destructive">{supabaseSchemaError}</p>}
                </div>
                <div>
                  <Label htmlFor={`${node.id}-identifierVal`}>Valor do Identificador (Filtro)</Label>
                  <div className="relative">
                    <Input id={`${node.id}-identifierVal`} placeholder="123 ou {{variavel_id}}" value={node.supabaseIdentifierValue || ''} onChange={(e) => onUpdate(node.id, { supabaseIdentifierValue: e.target.value })} className="pr-8" />
                    {renderVariableInserter('supabaseIdentifierValue')}
                  </div>
                </div>
              </>
            )}

            {isReadOp && (
              <div>
                <Label htmlFor={`${node.id}-columnsToSelectRead`}>Colunas a Selecionar (ex: *, nome, email)</Label>
                <div className="relative">
                  <Input id={`${node.id}-columnsToSelectRead`} placeholder="*, nome, email_principal" value={node.supabaseColumnsToSelect || '*'} onChange={(e) => onUpdate(node.id, { supabaseColumnsToSelect: e.target.value })} className="pr-8" />
                  {renderVariableInserter('supabaseColumnsToSelect')}
                </div>
              </div>
            )}

            {needsDataJson && (
              <div>
                <Label htmlFor={`${node.id}-dataJson`}>{isCreateOp ? 'Dados da Nova Linha (JSON)' : 'Dados para Atualizar (JSON)'}</Label>
                <div className="relative">
                  <Textarea id={`${node.id}-dataJson`} placeholder='{ "coluna1": "valor1", "coluna2": "{{variavel_col2}}" }' value={node.supabaseDataJson || ''} onChange={(e) => onUpdate(node.id, { supabaseDataJson: e.target.value })} rows={3} className="pr-8" />
                  {renderVariableInserter('supabaseDataJson', true)}
                </div>
              </div>
            )}

            {(isReadOp || isCreateOp) && (
              <div>
                <Label htmlFor={`${node.id}-resultVar`}>Salvar Resultado na Variável</Label>
                <Input
                  id={`${node.id}-resultVar`}
                  placeholder={isReadOp ? (node.supabaseResultVariable || "dados_supabase") : (node.supabaseResultVariable || "id_linha_criada_supabase")}
                  value={node.supabaseResultVariable || ''}
                  onChange={(e) => onUpdate(node.id, { supabaseResultVariable: e.target.value })}
                />
              </div>
            )}
            <p className="text-xs text-muted-foreground">Requer Supabase habilitado e configurado nas Configurações Globais, e que as funções SQL `get_public_tables` e `get_table_columns` existam no seu banco.</p>
          </div>
        );
      }
      case 'dialogy-send-message':
        return (
          <div className="space-y-3" data-no-drag="true">
            <div>
              <Label htmlFor={`${node.id}-dialogychatid`}>Chat ID</Label>
              <div className="relative">
                <Input
                  id={`${node.id}-dialogychatid`}
                  placeholder="{{dialogy_conversation_id}}"
                  value={node.dialogyChatId || ''}
                  onChange={(e) => onUpdate(node.id, { dialogyChatId: e.target.value })}
                  className="pr-8"
                />
                {renderVariableInserter('dialogyChatId')}
              </div>
            </div>
            <div>
              <Label htmlFor={`${node.id}-dialogycontent`}>Conteúdo da Mensagem</Label>
              <div className="relative">
                <Textarea
                  ref={textAreaRef}
                  id={`${node.id}-dialogycontent`}
                  placeholder="Olá, {{contact_name}}!"
                  value={node.dialogyMessageContent || ''}
                  onChange={(e) => onUpdate(node.id, { dialogyMessageContent: e.target.value })}
                  rows={3}
                  className="pr-8"
                />
                {renderVariableInserter('dialogyMessageContent', true)}
              </div>
              <TextFormatToolbar fieldName="dialogyMessageContent" textAreaRef={textAreaRef as React.RefObject<HTMLTextAreaElement>} onUpdate={onUpdate} nodeId={node.id} />
            </div>
            <p className="text-xs text-muted-foreground">
              A instância da Dialogy a ser usada é definida nas Configurações do Fluxo.
            </p>
          </div>
        );
      case 'time-of-day':
        return (
          <div className="space-y-3" data-no-drag="true">
            <p className="text-xs text-muted-foreground">Verifica se a hora atual está dentro do intervalo definido (inclusive).</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor={`${node.id}-starttime`}>Horário de Início</Label>
                <Input
                  id={`${node.id}-starttime`}
                  type="time"
                  value={node.startTime || ''}
                  onChange={(e) => onUpdate(node.id, { startTime: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor={`${node.id}-endtime`}>Horário de Fim</Label>
                <Input
                  id={`${node.id}-endtime`}
                  type="time"
                  value={node.endTime || ''}
                  onChange={(e) => onUpdate(node.id, { endTime: e.target.value })}
                />
              </div>
            </div>
          </div>
        );
      case 'end-flow':
        return <p className="text-sm text-muted-foreground italic">Este nó encerra o fluxo.</p>;
      default:
        return <p className="text-xs text-muted-foreground italic">Nenhuma configuração para este tipo de nó.</p>;
    }
  };

  return (
    <>
      <motion.div
        className={cn(
          "w-full cursor-default bg-card rounded-lg shadow-xl border border-border relative",
          isSessionHighlighted && "ring-2 ring-accent ring-offset-2 ring-offset-background"
        )}
        whileHover={{ scale: 1.01, boxShadow: "0px 5px 25px rgba(0,0,0,0.1)" }}
        transition={{ type: 'spring', stiffness: 400, damping: 17 }}
        data-node-id={node.id}
        aria-labelledby={`${node.id}-title`}
        onMouseDown={(e) => {
          const target = e.target as HTMLElement;
          if (target.dataset.connector === 'true' ||
            target.closest('[data-action="delete-node"]') ||
            target.closest('[data-no-drag="true"]') ||
            target.closest('[role="dialog"]') ||
            target.closest('[data-radix-popover-content]') ||
            target.closest('[data-radix-scroll-area-viewport]') ||
            (target.closest('input, textarea, select, button:not([data-drag-handle="true"])') && !target.closest('div[data-drag-handle="true"]')?.contains(target)) ||
            target.closest('[role="tablist"]') ||
            target.closest('[role="tabpanel"]') ||
            target.closest('.rc-select-dropdown')
          ) {
            return;
          }
          handleNodeMouseDown(e);
        }}
      >
        <Card className="shadow-none border-none bg-transparent">
          <CardHeader
            onMouseDown={handleNodeMouseDown}
            data-drag-handle="true"
            className="py-2.5 px-3.5 bg-secondary/50 rounded-t-lg flex items-center justify-between cursor-grab active:cursor-grabbing"
          >
            <div className="flex items-center min-w-0 pointer-events-none">
              {renderNodeIcon()}
              <CardTitle id={`${node.id}-title`} className="ml-2 text-sm font-medium text-secondary-foreground truncate" title={node.title}>
                {node.title}
              </CardTitle>
            </div>
            <div className="flex items-center gap-1">
              {node.type === 'start' && (
                <Popover open={isIntegrationsPopoverOpen} onOpenChange={handleIntegrationsPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="icon" className="p-0.5 text-muted-foreground hover:text-foreground w-6 h-6" aria-label="Status das Integrações">
                      <BotMessageSquare className="w-4 h-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80" align="end" data-no-drag="true">
                    <div className="grid gap-4">
                      <div className="space-y-2">
                        <h4 className="font-medium leading-none">Status das Integrações</h4>
                        <p className="text-sm text-muted-foreground">
                          Status das suas instâncias configuradas.
                        </p>
                      </div>
                      <ScrollArea className="h-auto max-h-[200px]">
                        <div className="grid gap-4">
                          <div>
                            <h5 className="text-sm font-semibold mb-2 flex items-center gap-2"><BotMessageSquare className="w-4 h-4 text-teal-500" /> API Evolution</h5>
                            {isLoadingEvolutionInstances ? (
                              <div className="flex items-center justify-center p-4 text-sm text-muted-foreground">
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando...
                              </div>
                            ) : evolutionInstances.length > 0 ? evolutionInstances.map((instance) => (
                              <div key={instance.id} className="grid grid-cols-[auto,1fr,auto] items-center gap-x-2 text-sm p-2 rounded-md border bg-muted/50">
                                <div
                                  className={cn("w-2.5 h-2.5 rounded-full", instance.status === 'online' ? 'bg-green-500' : instance.status === 'offline' ? 'bg-red-500' : instance.status === 'connecting' ? 'bg-yellow-500 animate-pulse' : 'bg-gray-400')}
                                  title={instance.status}
                                />
                                <div className="font-medium truncate" title={instance.name}>{instance.name}</div>
                                <div className="text-xs text-muted-foreground capitalize">{instance.status}</div>
                              </div>
                            )) : (
                              <p className="text-xs text-muted-foreground text-center py-2">Nenhuma instância configurada.</p>
                            )}
                          </div>
                          <div>
                            <h5 className="text-sm font-semibold mb-2 flex items-center gap-2"><MessageCircle className="w-4 h-4 text-blue-500" /> Chatwoot</h5>
                            {isLoadingChatwootInstances ? (
                              <div className="flex items-center justify-center p-4 text-sm text-muted-foreground">
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando...
                              </div>
                            ) : chatwootInstances.length > 0 ? chatwootInstances.map((instance) => (
                              <div key={instance.id} className="grid grid-cols-[auto,1fr,auto] items-center gap-x-2 text-sm p-2 rounded-md border bg-muted/50">
                                <div
                                  className={cn("w-2.5 h-2.5 rounded-full", instance.status === 'online' ? 'bg-green-500' : instance.status === 'offline' ? 'bg-red-500' : instance.status === 'connecting' ? 'bg-yellow-500 animate-pulse' : 'bg-gray-400')}
                                  title={instance.status}
                                />
                                <div className="font-medium truncate" title={instance.name}>{instance.name}</div>
                                <div className="text-xs text-muted-foreground capitalize">{instance.status}</div>
                              </div>
                            )) : (
                              <p className="text-xs text-muted-foreground text-center py-2">Nenhuma instância configurada.</p>
                            )}
                          </div>
                           <div>
                            <h5 className="text-sm font-semibold mb-2 flex items-center gap-2"><Rocket className="w-4 h-4 text-orange-500" /> Dialogy</h5>
                            {isLoadingDialogyInstances ? (
                              <div className="flex items-center justify-center p-4 text-sm text-muted-foreground">
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando...
                              </div>
                            ) : dialogyInstances.length > 0 ? dialogyInstances.map((instance) => (
                              <div key={instance.id} className="grid grid-cols-[auto,1fr,auto] items-center gap-x-2 text-sm p-2 rounded-md border bg-muted/50">
                                <div
                                  className={cn("w-2.5 h-2.5 rounded-full", instance.status === 'online' ? 'bg-green-500' : instance.status === 'offline' ? 'bg-red-500' : instance.status === 'connecting' ? 'bg-yellow-500 animate-pulse' : 'bg-gray-400')}
                                  title={instance.status}
                                />
                                <div className="font-medium truncate" title={instance.name}>{instance.name}</div>
                                <div className="text-xs text-muted-foreground capitalize">{instance.status}</div>
                              </div>
                            )) : (
                              <p className="text-xs text-muted-foreground text-center py-2">Nenhuma instância configurada.</p>
                            )}
                          </div>
                        </div>
                      </ScrollArea>
                    </div>
                  </PopoverContent>
                </Popover>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={handleDeleteClick}
                className="p-0.5 text-muted-foreground hover:text-destructive w-6 h-6"
                aria-label="Excluir nó" data-action="delete-node"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-3.5 text-sm">
            {renderNodeContent()}
          </CardContent>
        </Card>

        {node.type !== 'start' && node.type !== 'end-flow' && (
          <div
            className="absolute -left-2.5 z-10 flex items-center justify-center"
            style={{
              top: `${NODE_HEADER_CONNECTOR_Y_OFFSET}px`,
              transform: 'translateY(-50%)',
              height: '20px',
              width: '20px'
            }}
          >
            <div
              title="Conecte aqui"
              className="w-5 h-5 bg-muted hover:bg-muted-foreground/50 rounded-full flex items-center justify-center cursor-crosshair shadow-md"
              data-connector="true" data-handle-type="target"
            />
          </div>
        )}

        {renderOutputConnectors()}
      </motion.div>

      {/* Webhook History Dialog */}
      <Dialog open={isWebhookHistoryDialogOpen} onOpenChange={setIsWebhookHistoryDialogOpen}>
        <WebhookLogsViewer 
          isOpen={isWebhookHistoryDialogOpen} 
          onClose={() => setIsWebhookHistoryDialogOpen(false)}
          workspaceId={activeWorkspace?.id || ''}
        />
      </Dialog>

      {/* Webhook Mapping Builder */}
      <Dialog open={isWebhookMappingDialogOpen} onOpenChange={(open) => {
        setIsWebhookMappingDialogOpen(open);
        if (!open) setActiveWebhookTriggerId(null);
      }}>
        <DialogContent className="sm:max-w-4xl" data-no-drag="true">
          <DialogHeader>
            <DialogTitle>Construtor de Mapeamento do Webhook</DialogTitle>
            <DialogDescription>
              Use o laboratório completo para mapear e visualizar os dados recebidos.
            </DialogDescription>
          </DialogHeader>
          {renderWebhookMappingBuilder(selectedWebhookTriggerForBuilder)}
        </DialogContent>
      </Dialog>
      
      {/* API Call History Dialog */}
      <Dialog open={isApiHistoryDialogOpen} onOpenChange={setIsApiHistoryDialogOpen}>
        <ApiCallLogsViewer
            isOpen={isApiHistoryDialogOpen}
            onClose={() => setIsApiHistoryDialogOpen(false)}
            workspaceId={activeWorkspace?.id || ''}
            nodeId={node.id}
            nodeTitle={node.title}
        />
      </Dialog>

      {/* API Mapping Builder */}
      <Dialog open={isApiMappingDialogOpen} onOpenChange={setIsApiMappingDialogOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[85vh] overflow-y-auto" data-no-drag="true">
          <DialogHeader>
            <DialogTitle>Construtor de Mapeamento da Resposta da API</DialogTitle>
            <DialogDescription>Importe um JSON, clique nos campos e defina todas as variáveis em um único lugar.</DialogDescription>
          </DialogHeader>
          {renderApiMappingBuilder()}
        </DialogContent>
      </Dialog>


      {/* API Test Response Dialog */}
      {node.type === 'api-call' && (
        <Dialog open={isTestResponseModalOpen} onOpenChange={setIsTestResponseModalOpen}>
          <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col" data-no-drag="true">
            <DialogHeader>
              <DialogTitle>Resposta do Teste da API</DialogTitle>
              <DialogDescription>Clique em uma chave do JSON para preencher o campo "Caminho do Dado".</DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto space-y-4 py-4">
              {testResponseError && (
                <div className="p-3 bg-destructive/10 border border-destructive text-destructive rounded-md">
                  <h4 className="font-semibold mb-1">Erro:</h4>
                  <pre className="text-xs whitespace-pre-wrap break-all">{testResponseError}</pre>
                </div>
              )}
              {testResponseData && (
                <div>
                  <Label className="font-semibold">Corpo da Resposta:</Label>
                  <ScrollArea className="h-64 mt-1 border rounded-md p-2 bg-muted/30">
                    <pre className="text-xs whitespace-pre-wrap break-all">
                      <JsonTreeView data={testResponseData} onSelectPath={(path) => {
                        onUpdate(node.id, { apiResponsePath: path });
                        toast({ title: "Caminho Preenchido!", description: `O caminho "${path}" foi inserido no campo.` });
                      }} />
                    </pre>
                  </ScrollArea>
                </div>
              )}
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Fechar</Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
});
NodeCard.displayName = 'NodeCard';
export default NodeCard;
