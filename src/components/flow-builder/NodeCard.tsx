
"use client";

import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import type { NodeData, ApiHeader, ApiQueryParam, ApiFormDataEntry, StartNodeTrigger, WebhookVariableMapping, WorkspaceData, EvolutionInstance } from '@/lib/types';
import { motion } from 'framer-motion';
import { v4 as uuidv4 } from 'uuid';
import {
  MessageSquareText, Type as InputIcon, ListChecks, Trash2, BotMessageSquare,
  ImageUp, UserPlus2, GitFork, Variable, Webhook, Timer, Settings2, Copy,
  CalendarDays, ExternalLink, MoreHorizontal, FileImage,
  TerminalSquare, Code2, Shuffle, UploadCloud, Star, Sparkles, Mail, Sheet, Headset, Hash,
  Database, Rows, Search, Edit3, PlayCircle, PlusCircle, GripVertical, TestTube2, Braces, Loader2, KeyRound, StopCircle, MousePointerClick, History, AlertCircle, FileText
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


interface NodeCardProps {
  node: NodeData;
  onUpdate: (id: string, changes: Partial<NodeData>) => void;
  onStartConnection: (event: React.MouseEvent, fromNodeData: NodeData, sourceHandleId?: string) => void;
  onDeleteNode: (id: string) => void;
  definedVariablesInFlow: string[];
  isSessionHighlighted?: boolean;
  activeWorkspace: WorkspaceData | undefined | null;
}

interface WebhookLogEntry {
  timestamp: string;
  method?: string;
  url?: string;
  headers?: Record<string, string>;
  payload?: any;
  ip?: string;
  extractedMessage?: string | null;
  webhook_remoteJid?: string | null;
  workspaceNameParam?: string;
}

const NodeCard: React.FC<NodeCardProps> = React.memo(({
  node,
  onUpdate,
  onStartConnection,
  onDeleteNode,
  definedVariablesInFlow,
  isSessionHighlighted,
  activeWorkspace
}) => {
  const { toast } = useToast();
  const isDraggingNode = useRef(false);

  // States for API Call testing modal
  const [isTestResponseModalOpen, setIsTestResponseModalOpen] = useState(false);
  const [testResponseData, setTestResponseData] = useState<{ status: number; headers: Record<string, string>; body: any } | null>(null);
  const [testResponseError, setTestResponseError] = useState<string | null>(null);
  const [isTestingApi, setIsTestingApi] = useState(false);
  
  // States for Webhook History modal
  const [isWebhookHistoryDialogOpen, setIsWebhookHistoryDialogOpen] = useState(false);
  const [webhookLogs, setWebhookLogs] = useState<WebhookLogEntry[]>([]);
  const [isLoadingWebhookLogs, setIsLoadingWebhookLogs] = useState(false);
  const [webhookLogsError, setWebhookLogsError] = useState<string | null>(null);

  // States for Supabase schema fetching
  const [supabaseTables, setSupabaseTables] = useState<{name: string}[]>([]);
  const [supabaseColumns, setSupabaseColumns] = useState<{name: string}[]>([]);
  const [isLoadingSupabaseTables, setIsLoadingSupabaseTables] = useState(false);
  const [isLoadingSupabaseColumns, setIsLoadingSupabaseColumns] = useState(false);
  const [supabaseSchemaError, setSupabaseSchemaError] = useState<string | null>(null);

  // States for Evolution API instance popover
  const [isEvolutionPopoverOpen, setIsEvolutionPopoverOpen] = useState(false);
  const [evolutionInstances, setEvolutionInstances] = useState<EvolutionInstance[]>([]);
  const [isLoadingEvolutionInstances, setIsLoadingEvolutionInstances] = useState(false);


  // Garantir que o nó de início tenha os gatilhos padrão se não os tiver
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
                    keyword: '', // Webhook padrão não tem palavra-chave
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
              console.error(`[NodeCard - ${node.id}] Supabase error fetching tables:`, result.error);
              setSupabaseTables([]);
            } else if (result.data) {
              console.log(`[NodeCard - ${node.id}] Supabase tables fetched:`, result.data);
              setSupabaseTables(result.data);
              if (node.supabaseTableName && !result.data.some(t => t.name === node.supabaseTableName)) {
                onUpdate(node.id, { supabaseTableName: '', supabaseIdentifierColumn: '', supabaseColumnsToSelect: '*' });
              }
            } else {
              setSupabaseTables([]);
            }
          })
           .catch(err => {
            setSupabaseSchemaError('Falha ao comunicar com o servidor para buscar tabelas.');
            console.error(`[NodeCard - ${node.id}] Supabase exception fetching tables:`, err);
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
  }, [node.type, node.id]); // Removido onUpdate da lista de dependências para evitar loops se a tabela não existir


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
              console.error(`[NodeCard - ${node.id}] Supabase error fetching columns for ${node.supabaseTableName}:`, result.error);
              setSupabaseColumns([]);
            } else if (result.data) {
              console.log(`[NodeCard - ${node.id}] Columns for ${node.supabaseTableName} fetched:`, result.data);
              setSupabaseColumns(result.data);
              if (node.supabaseIdentifierColumn && !result.data.some(c => c.name === node.supabaseIdentifierColumn)) {
                onUpdate(node.id, { supabaseIdentifierColumn: '' });
              }
            } else {
              setSupabaseColumns([]);
            }
          })
           .catch(err => {
            setSupabaseSchemaError(`Falha ao comunicar com o servidor para buscar colunas da tabela ${node.supabaseTableName}.`);
            console.error(`[NodeCard - ${node.id}] Supabase exception fetching columns for ${node.supabaseTableName}:`, err);
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
  }, [node.id, node.supabaseTableName]); // Removido onUpdate

  const handleCheckInstanceStatus = useCallback(async (instance: EvolutionInstance) => {
    setEvolutionInstances(prev => prev.map(i => i.id === instance.id ? { ...i, status: 'connecting' } : i));
    const result = await checkEvolutionInstanceStatus(instance.baseUrl, instance.name, instance.apiKey);
    setEvolutionInstances(prev => prev.map(i => i.id === instance.id ? { ...i, status: result.status } : i));
  }, []);

  const loadEvolutionInstancesAndCheckStatus = useCallback(async () => {
    setIsLoadingEvolutionInstances(true);
    try {
      const response = await fetch('/api/instances/evolution');
      if (!response.ok) {
        throw new Error('Falha ao buscar instâncias do servidor.');
      }
      const data: EvolutionInstance[] = await response.json();
      const instancesWithStatus = data.map(d => ({ ...d, status: 'unconfigured' as const }));
      setEvolutionInstances(instancesWithStatus);
      // Após carregar, dispara a verificação de status para todas
      instancesWithStatus.forEach(instance => {
          handleCheckInstanceStatus(instance);
      });
    } catch (error: any) {
      console.error("[NodeCard] Error fetching evolution instances:", error);
      toast({ title: "Erro ao Carregar Instâncias", description: error.message, variant: "destructive" });
      setEvolutionInstances([]);
    } finally {
      setIsLoadingEvolutionInstances(false);
    }
  }, [toast, handleCheckInstanceStatus]);

  const handleEvolutionPopoverOpen = (open: boolean) => {
    if(open) {
      loadEvolutionInstancesAndCheckStatus();
    }
    setIsEvolutionPopoverOpen(open);
  }

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
  
  const handleStartTriggerChange = (triggerId: string, field: keyof StartNodeTrigger, value: any) => {
    const updatedTriggers = (node.triggers || []).map(t => 
      t.id === triggerId ? { ...t, [field]: value } : t
    );
    onUpdate(node.id, { triggers: updatedTriggers });
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


  const handleAddListItem = (listName: 'apiHeadersList' | 'apiQueryParamsList' | 'apiBodyFormDataList') => {
    const currentList = (node[listName] as any[] || []);
    onUpdate(node.id, { [listName]: [...currentList, { id: uuidv4(), key: '', value: '' }] });
  };

  const handleRemoveListItem = (listName: 'apiHeadersList' | 'apiQueryParamsList' | 'apiBodyFormDataList', itemId: string) => {
    const currentList = (node[listName] as any[] || []);
    onUpdate(node.id, { [listName]: currentList.filter(item => item.id !== itemId) });
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
    console.log('[NodeCard] handleTestApiCall triggered for node:', node.id, 'with URL:', node.apiUrl);
    setIsTestingApi(true);
    setTestResponseData(null);
    setTestResponseError(null);

    let constructedUrl = node.apiUrl;
    const queryParams = new URLSearchParams();
    (node.apiQueryParamsList || []).forEach(param => {
      if (param.key) queryParams.append(param.key, param.value);
    });
    const queryString = queryParams.toString();
    if (queryString) {
      constructedUrl += (constructedUrl.includes('?') ? '&' : '?') + queryString;
    }

    const requestHeaders = new Headers();
    (node.apiHeadersList || []).forEach(header => {
      if (header.key) requestHeaders.append(header.key, header.value);
    });

    if (node.apiAuthType === 'bearer' && node.apiAuthBearerToken) {
      requestHeaders.append('Authorization', `Bearer ${node.apiAuthBearerToken}`);
    } else if (node.apiAuthType === 'basic' && node.apiAuthBasicUser && node.apiAuthBasicPassword) {
      requestHeaders.append('Authorization', `Basic ${btoa(`${node.apiAuthBasicUser}:${node.apiAuthBasicPassword}`)}`);
    }

    let requestBody: BodyInit | null = null;
    if (node.apiMethod !== 'GET' && node.apiMethod !== 'HEAD' && node.apiMethod !== 'DELETE') {
        if (node.apiBodyType === 'json' && node.apiBodyJson) {
          requestBody = node.apiBodyJson;
          if (!requestHeaders.has('Content-Type')) {
            requestHeaders.append('Content-Type', 'application/json');
          }
        } else if (node.apiBodyType === 'form-data' && node.apiBodyFormDataList && node.apiBodyFormDataList.length > 0) {
          const formData = new FormData();
          node.apiBodyFormDataList.forEach(entry => {
            if (entry.key) formData.append(entry.key, entry.value);
          });
          requestBody = formData;
        } else if (node.apiBodyType === 'raw' && node.apiBodyRaw) {
          requestBody = node.apiBodyRaw;
          if (!requestHeaders.has('Content-Type')) {
            requestHeaders.append('Content-Type', 'text/plain');
          }
        }
    }

    try {
      const response = await fetch(constructedUrl, {
        method: node.apiMethod || 'GET',
        headers: requestHeaders,
        body: requestBody,
      });

      const responseHeadersObj: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeadersObj[key] = value;
      });

      let responseBodyContent: any;
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        try {
            responseBodyContent = await response.json();
        } catch (jsonError) {
            console.warn('[NodeCard TestAPI] Failed to parse JSON, reading as text. Error:', jsonError);
            responseBodyContent = await response.text(); // Fallback to text if JSON parse fails
        }
      } else {
        responseBodyContent = await response.text();
      }

      setTestResponseData({ status: response.status, headers: responseHeadersObj, body: responseBodyContent });
      setIsTestResponseModalOpen(true);

      if (!response.ok) {
        toast({
          title: `Erro na API: ${response.status}`,
          description: typeof responseBodyContent === 'string' ? responseBodyContent.substring(0, 100) + '...' : JSON.stringify(responseBodyContent, null, 2).substring(0,100)+'...',
          variant: "destructive",
        });
      } else {
        toast({
          title: "API Testada com Sucesso!",
          description: `Status: ${response.status}`,
        });
      }
    } catch (error: any) {
      setTestResponseError(`Erro ao conectar à API: ${error.message}`);
      setIsTestResponseModalOpen(true);
      toast({
        title: "Erro de Conexão",
        description: `Não foi possível conectar à API: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setIsTestingApi(false);
    }
  };

  const fetchWebhookLogs = useCallback(async () => {
    setIsLoadingWebhookLogs(true);
    setWebhookLogsError(null);
    try {
      const response = await fetch('/api/evolution/webhook-logs');
      if (!response.ok) {
        throw new Error('Falha ao buscar logs do webhook');
      }
      const data: WebhookLogEntry[] = await response.json();
      setWebhookLogs(data);
    } catch (error: any) {
      setWebhookLogsError(error.message);
      setWebhookLogs([]);
    } finally {
      setIsLoadingWebhookLogs(false);
    }
  }, []);

  const handleOpenWebhookHistory = () => {
    fetchWebhookLogs();
    setIsWebhookHistoryDialogOpen(true);
  };

  const handleVariableInsert = (
    fieldName: keyof NodeData,
    variableName: string,
    isTextarea: boolean = false,
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
    if (!definedVariablesInFlow || definedVariablesInFlow.length === 0) return null;

    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn("absolute h-7 w-7 z-10", isTextarea ? 'top-1 right-1' : 'top-1/2 right-1 -translate-y-1/2')}
            data-no-drag="true"
            aria-label="Inserir Variável"
          >
            <Braces className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-1" data-no-drag="true" align="end">
          <ScrollArea className="h-auto max-h-[150px] text-xs">
            {definedVariablesInFlow.map((varName) => (
              <Button
                key={varName}
                variant="ghost"
                className="w-full justify-start h-7 px-2 text-xs"
                onClick={() => handleVariableInsert(fieldName, varName, isTextarea, isListItem, itemId, itemKeyOrValue)}
              >
                {varName}
              </Button>
            ))}
          </ScrollArea>
        </PopoverContent>
      </Popover>
    );
  };

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
              aria-label={`Remover ${listName.replace('List','')} item`}
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


  const renderNodeIcon = (): React.ReactNode => {
    const iconProps = { className: "w-5 h-5" };
    const icons: Record<NodeData['type'] | 'default', React.ReactNode> = {
      'start': <PlayCircle {...iconProps} color="hsl(var(--primary))" />,
      'message': <MessageSquareText {...iconProps} color="hsl(var(--accent))" />,
      'input': <InputIcon {...iconProps} className="text-green-500" />,
      'option': <ListChecks {...iconProps} className="text-purple-500" />,
      'whatsapp-text': <BotMessageSquare {...iconProps} className="text-teal-500" />,
      'whatsapp-media': <ImageUp {...iconProps} className="text-indigo-500" />,
      'whatsapp-group': <UserPlus2 {...iconProps} className="text-pink-500" />,
      'condition': <GitFork {...iconProps} className="text-orange-500" />,
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
      'end-flow': <StopCircle {...iconProps} className="text-destructive" />,
      default: <Settings2 {...iconProps} className="text-gray-500" />,
    };
    return icons[node.type] || icons.default;
  };

  const renderOutputConnectors = (): React.ReactNode => {
    if (node.type === 'end-flow') {
      return null;
    }
    if (node.type === 'start') {
        const allTriggers = node.triggers || [];
        return allTriggers.filter(t => t.enabled).map(trigger => {
        const originalIndex = allTriggers.findIndex(t => t.id === trigger.id);
        if (originalIndex === -1) return null; // Should not happen

        return (
          <div
            key={trigger.id}
            className="absolute -right-2.5 z-10 flex items-center"
            style={{ top: `${START_NODE_TRIGGER_INITIAL_Y_OFFSET + originalIndex * START_NODE_TRIGGER_SPACING_Y - 10}px` }}
            title={`Gatilho: ${trigger.name}`}
          >
            <span className="text-xs text-muted-foreground mr-2 whitespace-nowrap overflow-hidden text-ellipsis max-w-[100px]">{trigger.name}</span>
            <div
              className="w-5 h-5 bg-accent hover:opacity-80 rounded-full flex items-center justify-center cursor-crosshair shadow-md"
              onMouseDown={(e) => { e.stopPropagation(); onStartConnection(e, node, trigger.name); }}
              data-connector="true"
              data-handle-type="source"
              data-handle-id={trigger.name}
            >
              <Hash className="w-3 h-3 text-accent-foreground" />
            </div>
          </div>
        );
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
    if (node.type === 'condition') {
      return (
        <>
          <div className="absolute -right-2.5 z-10 flex items-center" style={{ top: `${NODE_HEADER_HEIGHT_APPROX * (1/3) + 6 -10}px` }}>
             <span className="text-xs text-muted-foreground mr-2">Verdadeiro</span>
            <div
              title="Saída Verdadeiro"
              className="w-5 h-5 bg-green-500 hover:bg-green-600 rounded-full flex items-center justify-center cursor-crosshair shadow-md"
              onMouseDown={(e) => { e.stopPropagation(); onStartConnection(e, node, 'true'); }}
              data-connector="true" data-handle-type="source" data-handle-id="true"
            >
              <Hash className="w-3 h-3 text-white" />
            </div>
          </div>
          <div className="absolute -right-2.5 z-10 flex items-center" style={{ top: `${NODE_HEADER_HEIGHT_APPROX * (2/3) + 6 -10}px` }}>
             <span className="text-xs text-muted-foreground mr-2">Falso</span>
            <div
              title="Saída Falso"
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

    if (node.type !== 'start' && node.type !== 'option' && node.type !== 'condition' && node.type !== 'end-flow') {
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
                      onCheckedChange={(checked) => handleStartTriggerChange(trigger.id, 'enabled', checked)}
                    />
                    <Label htmlFor={`trigger-enabled-${trigger.id}`} className="font-medium">{trigger.name}</Label>
                    {trigger.type === 'webhook' && <Webhook className="w-4 h-4 text-muted-foreground" />}
                    {trigger.type === 'manual' && <MousePointerClick className="w-4 h-4 text-muted-foreground" />}
                  </div>
                </div>

                <div className={cn("space-y-3", !trigger.enabled && "opacity-50 pointer-events-none")}>
                   <div>
                    <Label htmlFor={`trigger-keyword-${trigger.id}`} className="text-xs font-medium">Palavra-chave de Ativação (opcional)</Label>
                    <Input
                      id={`trigger-keyword-${trigger.id}`}
                      value={trigger.keyword || ''}
                      onChange={(e) => handleStartTriggerChange(trigger.id, 'keyword', e.target.value)}
                      placeholder="Ex: 'ajuda', 'cardapio'"
                      className="h-8 text-xs mt-1"
                    />
                     <p className="text-xs text-muted-foreground mt-1">Se preenchido, este caminho só será ativado se a mensagem do usuário corresponder exatamente.</p>
                  </div>
                  
                  {trigger.type === 'webhook' && (
                    <div className="space-y-3 pt-2 border-t">
                      <div>
                        <Label htmlFor={`${node.id}-${trigger.id}-timeout`} className="text-xs font-medium">Tempo limite da sessão (segundos)</Label>
                        <Input
                          id={`${node.id}-${trigger.id}-timeout`}
                          type="number"
                          value={trigger.sessionTimeoutSeconds || 0}
                          onChange={(e) => handleStartTriggerChange(trigger.id, 'sessionTimeoutSeconds', parseInt(e.target.value, 10) || 0)}
                          placeholder="0 (sem limite)"
                          className="h-8 text-xs mt-1"
                        />
                        <p className="text-xs text-muted-foreground mt-1">Tempo de inatividade para encerrar a sessão. 0 para desabilitar.</p>
                      </div>

                      <div>
                        <Label htmlFor="webhook-url" className="text-xs font-medium">URL do Webhook (POST)</Label>
                        <div className="flex items-center space-x-1.5 mt-1">
                          <Input id="webhook-url" type="text" readOnly value={webhookUrl} className="bg-input/50 h-7 text-xs"/>
                          <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => { navigator.clipboard.writeText(webhookUrl).then(() => toast({ title: "URL Copiada!" })).catch(() => toast({ title: "Erro ao copiar", variant:"destructive"})); }} title="Copiar URL">
                            <Copy className="w-3 h-3"/>
                          </Button>
                        </div>
                         <Button variant="link" size="sm" className="text-xs h-auto p-0 mt-1.5 text-accent" onClick={handleOpenWebhookHistory}>
                            <History className="w-3.5 h-3.5 mr-1" /> Ver Histórico de Webhooks
                          </Button>
                      </div>
                      
                      <div className="pt-2">
                        <Label className="text-xs font-medium">Mapeamento de Variáveis do Webhook</Label>
                        <div className="space-y-2 mt-1">
                          {(trigger.variableMappings || []).map(mapping => (
                            <div key={mapping.id} className="flex items-center space-x-2">
                              <Input placeholder="Caminho (ex: data.message.conversation)" value={mapping.jsonPath} onChange={(e) => handleVariableMappingChange(trigger.id, mapping.id, 'jsonPath', e.target.value)} className="h-7 text-xs"/>
                              <Input placeholder="Variável (ex: mensagem_usuario)" value={mapping.flowVariable} onChange={(e) => handleVariableMappingChange(trigger.id, mapping.id, 'flowVariable', e.target.value)} className="h-7 text-xs"/>
                              <Button variant="ghost" size="icon" onClick={() => handleRemoveVariableMapping(trigger.id, mapping.id)} className="text-destructive hover:text-destructive/80 w-6 h-6"><Trash2 className="w-3.5 h-3.5" /></Button>
                            </div>
                          ))}
                        </div>
                        <Button onClick={() => handleAddVariableMapping(trigger.id)} variant="outline" size="sm" className="mt-2 text-xs h-7">
                           <PlusCircle className="w-3 h-3 mr-1" /> Adicionar
                        </Button>
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
              <Textarea placeholder="Mensagem do bot..." value={node.text || ''} onChange={(e) => onUpdate(node.id, { text: e.target.value })} className="resize-none text-sm pr-8" rows={3} />
              {renderVariableInserter('text', true)}
            </div>
          </div>
        );
      case 'input':
        return (
          <div className="space-y-3" data-no-drag="true">
            <div>
              <Label htmlFor={`${node.id}-prompttext`}>Texto da Pergunta</Label>
              <div className="relative">
                <Textarea id={`${node.id}-prompttext`} placeholder="Digite sua pergunta aqui..." value={node.promptText || ''} onChange={(e) => onUpdate(node.id, { promptText: e.target.value })} rows={2} className="pr-8"/>
                {renderVariableInserter('promptText', true)}
              </div>
            </div>
            <div><Label htmlFor={`${node.id}-inputtype`}>Tipo de Entrada</Label>
              <Select value={node.inputType || 'text'} onValueChange={(value) => onUpdate(node.id, { inputType: value as NodeData['inputType'] })}>
                <SelectTrigger id={`${node.id}-inputtype`}><SelectValue placeholder="Selecione o tipo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Texto</SelectItem><SelectItem value="email">E-mail</SelectItem>
                  <SelectItem value="phone">Telefone</SelectItem><SelectItem value="number">Número</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
                <Label htmlFor={`${node.id}-varsave`}>Salvar Resposta na Variável</Label>
                <Input id={`${node.id}-varsave`} placeholder="nome_da_variavel" value={node.variableToSaveResponse || ''} onChange={(e) => onUpdate(node.id, { variableToSaveResponse: e.target.value })} />
            </div>
          </div>
        );
      case 'option':
        return (
          <div className="space-y-3" data-no-drag="true">
            <div>
              <Label htmlFor={`${node.id}-optionqtext`}>Texto da Pergunta</Label>
              <div className="relative">
                <Textarea id={`${node.id}-optionqtext`} placeholder="Qual sua escolha?" value={node.questionText || ''} onChange={(e) => onUpdate(node.id, { questionText: e.target.value })} rows={2} className="pr-8"/>
                {renderVariableInserter('questionText', true)}
              </div>
            </div>
            <div>
                <Label htmlFor={`${node.id}-optionslist`}>Opções (uma por linha)</Label>
                <Textarea id={`${node.id}-optionslist`} placeholder="Opção 1\nOpção 2" value={node.optionsList || ''} onChange={(e) => onUpdate(node.id, { optionsList: e.target.value })} rows={3}/>
            </div>
            <div>
                <Label htmlFor={`${node.id}-varsavechoice`}>Salvar Escolha na Variável (opcional)</Label>
                <Input id={`${node.id}-varsavechoice`} placeholder="variavel_escolha" value={node.variableToSaveChoice || ''} onChange={(e) => onUpdate(node.id, { variableToSaveChoice: e.target.value })} />
            </div>
            <p className="text-xs text-muted-foreground italic pt-1">Cada opção na lista acima terá um conector de saída dedicado.</p>
          </div>
        );
      case 'whatsapp-text':
      case 'whatsapp-media':
      case 'whatsapp-group':
        return (
          <div className="space-y-3" data-no-drag="true">
            <div>
              <Label htmlFor={`${node.id}-instance`}>Instância</Label>
              {isLoadingEvolutionInstances ? (
                <div className="flex items-center text-sm text-muted-foreground h-10"><Loader2 className="mr-2 h-4 w-4 animate-spin"/>Carregando...</div>
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
                      <Input id={`${node.id}-phone`} placeholder="55119... ou {{whatsapp_sender_jid}}" value={node.phoneNumber || ''} onChange={(e) => onUpdate(node.id, { phoneNumber: e.target.value })} className="pr-8"/>
                       {renderVariableInserter('phoneNumber')}
                  </div>
              </div>
            )}
            {node.type === 'whatsapp-text' && (
              <div>
                  <Label htmlFor={`${node.id}-watext`}>Mensagem</Label>
                  <div className="relative">
                      <Textarea id={`${node.id}-watext`} value={node.textMessage || ''} onChange={(e) => onUpdate(node.id, { textMessage: e.target.value })} rows={2} className="pr-8"/>
                      {renderVariableInserter('textMessage', true)}
                  </div>
              </div>
            )}
            {node.type === 'whatsapp-media' && (
              <>
                <div>
                    <Label htmlFor={`${node.id}-mediaurl`}>URL da Mídia (Ex: https://... ou {"{{url_midia}}"})</Label>
                    <div className="relative">
                        <Input id={`${node.id}-mediaurl`} placeholder="https://... ou {{url_midia}}" value={node.mediaUrl || ''} onChange={(e) => onUpdate(node.id, { mediaUrl: e.target.value })} className="pr-8"/>
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
                        <Input id={`${node.id}-caption`} value={node.caption || ''} onChange={(e) => onUpdate(node.id, { caption: e.target.value })} className="pr-8"/>
                        {renderVariableInserter('caption')}
                    </div>
                </div>
              </>
            )}
            {node.type === 'whatsapp-group' && (
              <>
                <div>
                    <Label htmlFor={`${node.id}-groupname`}>Nome do Grupo</Label>
                    <div className="relative">
                        <Input id={`${node.id}-groupname`} value={node.groupName || ''} onChange={(e) => onUpdate(node.id, { groupName: e.target.value })} className="pr-8"/>
                        {renderVariableInserter('groupName')}
                    </div>
                </div>
                <div>
                    <Label htmlFor={`${node.id}-participants`}>Participantes (IDs separados por vírgula, ex: 5511...,5521...)</Label>
                    <div className="relative">
                        <Textarea id={`${node.id}-participants`} value={node.participants || ''} onChange={(e) => onUpdate(node.id, { participants: e.target.value })} rows={2} className="pr-8"/>
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
            <div>
                <Label htmlFor={`${node.id}-condvar`}>Variável (ex: {"{{variavel}}"})</Label>
                <div className="relative">
                    <Input id={`${node.id}-condvar`} placeholder="{{variavel}}" value={node.conditionVariable || ''} onChange={(e) => onUpdate(node.id, { conditionVariable: e.target.value })} className="pr-8"/>
                    {renderVariableInserter('conditionVariable')}
                </div>
            </div>
            <div><Label htmlFor={`${node.id}-condop`}>Operador</Label>
              <Select value={node.conditionOperator || '=='} onValueChange={(value) => onUpdate(node.id, { conditionOperator: value as NodeData['conditionOperator']})}>
                <SelectTrigger id={`${node.id}-condop`}><SelectValue placeholder="Selecione o operador" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="==">Igual a</SelectItem><SelectItem value="!=">Diferente de</SelectItem>
                  <SelectItem value=">">Maior que</SelectItem><SelectItem value="<">Menor que</SelectItem>
                  <SelectItem value="contains">Contém</SelectItem><SelectItem value="startsWith">Começa com</SelectItem>
                  <SelectItem value="endsWith">Termina com</SelectItem>
                  <SelectItem value="isEmpty">É vazio</SelectItem>
                  <SelectItem value="isNotEmpty">Não é vazio</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
                <Label htmlFor={`${node.id}-condval`}>Valor para Comparar (se aplicável)</Label>
                <div className="relative">
                    <Input id={`${node.id}-condval`} placeholder="Valor ou {{outra_var}}" value={node.conditionValue || ''} onChange={(e) => onUpdate(node.id, { conditionValue: e.target.value })} className="pr-8"/>
                    {renderVariableInserter('conditionValue')}
                </div>
            </div>
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
                    <Input id={`${node.id}-varval`} placeholder="Valor ou {{outra_var}}" value={node.variableValue || ''} onChange={(e) => onUpdate(node.id, { variableValue: e.target.value })} className="pr-8"/>
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
                <Input id={`${node.id}-apiurl`} placeholder="https://api.example.com/data" value={node.apiUrl || ''} onChange={(e) => onUpdate(node.id, { apiUrl: e.target.value })} className="pr-8"/>
                {renderVariableInserter('apiUrl')}
              </div>
            </div>
            <div>
              <Label htmlFor={`${node.id}-apimethod`}>Método HTTP</Label>
              <Select value={node.apiMethod || 'GET'} onValueChange={(value) => onUpdate(node.id, { apiMethod: value as NodeData['apiMethod']})}>
                <SelectTrigger id={`${node.id}-apimethod`}><SelectValue placeholder="Selecione o método" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="GET">GET</SelectItem><SelectItem value="POST">POST</SelectItem>
                  <SelectItem value="PUT">PUT</SelectItem><SelectItem value="DELETE">DELETE</SelectItem>
                  <SelectItem value="PATCH">PATCH</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Tabs defaultValue="auth" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="auth">Autenticação</TabsTrigger>
                <TabsTrigger value="headers">Headers</TabsTrigger>
                <TabsTrigger value="params">Query Params</TabsTrigger>
                <TabsTrigger value="body">Corpo</TabsTrigger>
              </TabsList>
              <TabsContent value="auth" className="mt-4 space-y-3">
                <div>
                  <Label htmlFor={`${node.id}-apiauthtype`}>Tipo de Autenticação</Label>
                  <Select value={node.apiAuthType || 'none'} onValueChange={(value) => onUpdate(node.id, { apiAuthType: value as NodeData['apiAuthType']})}>
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
                        <Input id={`${node.id}-apiauthbearertoken`} placeholder="Seu token aqui..." value={node.apiAuthBearerToken || ''} onChange={(e) => onUpdate(node.id, { apiAuthBearerToken: e.target.value })} className="pr-8"/>
                        {renderVariableInserter('apiAuthBearerToken')}
                    </div>
                  </div>
                )}
                {node.apiAuthType === 'basic' && (
                  <>
                    <div>
                      <Label htmlFor={`${node.id}-apiauthbasicuser`}>Usuário</Label>
                       <div className="relative">
                            <Input id={`${node.id}-apiauthbasicuser`} placeholder="Nome de usuário" value={node.apiAuthBasicUser || ''} onChange={(e) => onUpdate(node.id, { apiAuthBasicUser: e.target.value })} className="pr-8"/>
                            {renderVariableInserter('apiAuthBasicUser')}
                        </div>
                    </div>
                    <div>
                      <Label htmlFor={`${node.id}-apiauthbasicpassword`}>Senha</Label>
                       <div className="relative">
                            <Input id={`${node.id}-apiauthbasicpassword`} type="password" placeholder="Senha" value={node.apiAuthBasicPassword || ''} onChange={e => onUpdate(node.id, { apiAuthBasicPassword: e.target.value })} className="pr-8"/>
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
                  <Select value={node.apiBodyType || 'none'} onValueChange={(value) => onUpdate(node.id, { apiBodyType: value as NodeData['apiBodyType']})}>
                    <SelectTrigger id={`${node.id}-apibodytype`}><SelectValue placeholder="Selecione o tipo de corpo" /></SelectTrigger>
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
                        <Textarea id={`${node.id}-apibodyjson`} placeholder='{ "chave": "valor" }' value={node.apiBodyJson || ''} onChange={(e) => onUpdate(node.id, { apiBodyJson: e.target.value })} rows={4} className="pr-8"/>
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
                        <Textarea id={`${node.id}-apibodyraw`} placeholder="Conteúdo do corpo em texto puro..." value={node.apiBodyRaw || ''} onChange={(e) => onUpdate(node.id, { apiBodyRaw: e.target.value })} rows={4} className="pr-8"/>
                        {renderVariableInserter('apiBodyRaw', true)}
                    </div>
                  </div>
                )}
              </TabsContent>
            </Tabs>

            <div className="mt-4">
              <Label htmlFor={`${node.id}-apioutputvar`}>Salvar Resposta da API na Variável</Label>
              <Input id={`${node.id}-apioutputvar`} placeholder="resposta_api" value={node.apiOutputVariable || ''} onChange={(e) => onUpdate(node.id, { apiOutputVariable: e.target.value })} />
            </div>
            <Button variant="outline" className="w-full mt-3" onClick={handleTestApiCall} disabled={isTestingApi}>
                <TestTube2 className="mr-2 h-4 w-4" /> {isTestingApi ? "Testando..." : "Testar Requisição"}
            </Button>
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
                    <Input id={`${node.id}-datelabel`} placeholder="Ex: Qual sua data de nascimento?" value={node.dateInputLabel || ''} onChange={(e) => onUpdate(node.id, {dateInputLabel: e.target.value})} className="pr-8"/>
                    {renderVariableInserter('dateInputLabel')}
                </div>
            </div>
            <div>
                <Label htmlFor={`${node.id}-varsavedate`}>Salvar Data na Variável</Label>
                <Input id={`${node.id}-varsavedate`} placeholder="data_nascimento" value={node.variableToSaveDate || ''} onChange={(e) => onUpdate(node.id, { variableToSaveDate: e.target.value })} />
            </div>
          </div>
        );
      case 'redirect':
        return (
          <div data-no-drag="true">
            <Label htmlFor={`${node.id}-redirecturl`}>URL para Redirecionamento</Label>
            <div className="relative">
                <Input id={`${node.id}-redirecturl`} placeholder="https://exemplo.com/{{id_usuario}}" value={node.redirectUrl || ''} onChange={(e) => onUpdate(node.id, { redirectUrl: e.target.value })} className="pr-8"/>
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
                    <SelectItem value="image">Imagem</SelectItem>
                    <SelectItem value="video">Vídeo</SelectItem>
                    <SelectItem value="audio">Áudio</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor={`${node.id}-mediadisplayurl`}>URL da Mídia</Label>
                <div className="relative">
                    <Input id={`${node.id}-mediadisplayurl`} placeholder="https://... ou {{url_da_imagem}}" value={node.mediaDisplayUrl || ''} onChange={(e) => onUpdate(node.id, { mediaDisplayUrl: e.target.value })} className="pr-8"/>
                    {renderVariableInserter('mediaDisplayUrl')}
                </div>
              </div>
              <div>
                <Label htmlFor={`${node.id}-mediadisplaytext`}>Texto Alternativo/Legenda</Label>
                <div className="relative">
                    <Input id={`${node.id}-mediadisplaytext`} placeholder="Descrição da mídia" value={node.mediaDisplayText || ''} onChange={(e) => onUpdate(node.id, { mediaDisplayText: e.target.value })} className="pr-8"/>
                    {renderVariableInserter('mediaDisplayText')}
                </div>
              </div>
            </div>
          </div>
        );
      case 'log-console':
        return (
          <div data-no-drag="true">
            <Label htmlFor={`${node.id}-logmsg`}>Mensagem para Log</Label>
            <div className="relative">
                <Textarea id={`${node.id}-logmsg`} placeholder="Ex: Status: {{input.status}}, Usuário: {{user.id}}" value={node.logMessage || ''} onChange={(e) => onUpdate(node.id, { logMessage: e.target.value })} rows={2} className="pr-8"/>
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
                <Textarea id={`${node.id}-codesnippet`} placeholder="async (input, variables) => {\n  // input é o valor do nó anterior, se conectado\n  // variables é um objeto com as variáveis do fluxo\n  // Ex: const nome = variables.nome_usuario;\n  // return { resultado: 1 + 1, nome_modificado: nome.toUpperCase() };\n}" value={node.codeSnippet || ''} onChange={(e) => onUpdate(node.id, { codeSnippet: e.target.value })} rows={6} className="pr-8"/>
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
                    <Textarea id={`${node.id}-inputjson`} placeholder='{ "chave": "valor" } ou {{dados_api}}' value={node.inputJson || ''} onChange={(e) => onUpdate(node.id, { inputJson: e.target.value })} rows={3} className="pr-8"/>
                    {renderVariableInserter('inputJson', true)}
                </div>
            </div>
            <div>
                <Label htmlFor={`${node.id}-jsonata`}>Expressão JSONata</Label>
                <div className="relative">
                    <Input id={`${node.id}-jsonata`} placeholder="$.chave.outraChave[0]" value={node.jsonataExpression || ''} onChange={(e) => onUpdate(node.id, { jsonataExpression: e.target.value })} className="pr-8"/>
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
                    <Input id={`${node.id}-uploadprompt`} placeholder="Por favor, envie seu documento." value={node.uploadPromptText || ''} onChange={(e) => onUpdate(node.id, { uploadPromptText: e.target.value })} className="pr-8"/>
                    {renderVariableInserter('uploadPromptText')}
                </div>
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
          </div>
        );
      case 'rating-input':
        return (
          <div className="space-y-3" data-no-drag="true">
            <div>
                <Label htmlFor={`${node.id}-ratingq`}>Pergunta da Avaliação</Label>
                <div className="relative">
                    <Input id={`${node.id}-ratingq`} placeholder="Como você nos avalia?" value={node.ratingQuestionText || ''} onChange={(e) => onUpdate(node.id, { ratingQuestionText: e.target.value })} className="pr-8"/>
                    {renderVariableInserter('ratingQuestionText')}
                </div>
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
          </div>
        );
      case 'ai-text-generation':
        return (
          <div className="space-y-3" data-no-drag="true">
            <div>
                <Label htmlFor={`${node.id}-aiprompt`}>Prompt para IA</Label>
                <div className="relative">
                    <Textarea id={`${node.id}-aiprompt`} placeholder="Gere uma descrição para um produto chamado {{input.nome_produto}}." value={node.aiPromptText || ''} onChange={(e) => onUpdate(node.id, { aiPromptText: e.target.value })} rows={4} className="pr-8"/>
                    {renderVariableInserter('aiPromptText', true)}
                </div>
            </div>
            <div>
                <Label htmlFor={`${node.id}-aimodel`}>Modelo de IA (opcional)</Label>
                <div className="relative">
                    <Input id={`${node.id}-aimodel`} placeholder="gemini-1.5-flash (padrão)" value={node.aiModelName || ''} onChange={(e) => onUpdate(node.id, { aiModelName: e.target.value })} className="pr-8"/>
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
                    <Input id={`${node.id}-emailto`} type="email" placeholder="destinatario@exemplo.com ou {{email_cliente}}" value={node.emailTo || ''} onChange={(e) => onUpdate(node.id, { emailTo: e.target.value })} className="pr-8"/>
                    {renderVariableInserter('emailTo')}
                </div>
            </div>
            <div>
                <Label htmlFor={`${node.id}-emailsubject`}>Assunto</Label>
                <div className="relative">
                    <Input id={`${node.id}-emailsubject`} placeholder="Assunto do seu e-mail" value={node.emailSubject || ''} onChange={(e) => onUpdate(node.id, { emailSubject: e.target.value })} className="pr-8"/>
                    {renderVariableInserter('emailSubject')}
                </div>
            </div>
            <div>
                <Label htmlFor={`${node.id}-emailbody`}>Corpo do E-mail (HTML ou Texto)</Label>
                <div className="relative">
                    <Textarea id={`${node.id}-emailbody`} placeholder="Olá {{input.nome_cliente}},\n\nSua mensagem aqui." value={node.emailBody || ''} onChange={(e) => onUpdate(node.id, { emailBody: e.target.value })} rows={4} className="pr-8"/>
                    {renderVariableInserter('emailBody', true)}
                </div>
            </div>
            <div>
                <Label htmlFor={`${node.id}-emailfrom`}>De (E-mail - opcional)</Label>
                <div className="relative">
                    <Input id={`${node.id}-emailfrom`} type="email" placeholder="remetente@exemplo.com" value={node.emailFrom || ''} onChange={(e) => onUpdate(node.id, { emailFrom: e.target.value })} className="pr-8"/>
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
                    <Input id={`${node.id}-gsheetid`} placeholder="abc123xyz789" value={node.googleSheetId || ''} onChange={(e) => onUpdate(node.id, { googleSheetId: e.target.value })} className="pr-8"/>
                    {renderVariableInserter('googleSheetId')}
                </div>
            </div>
            <div>
                <Label htmlFor={`${node.id}-gsheetname`}>Nome da Aba (Planilha)</Label>
                <div className="relative">
                    <Input id={`${node.id}-gsheetname`} placeholder="Página1" value={node.googleSheetName || ''} onChange={(e) => onUpdate(node.id, { googleSheetName: e.target.value })} className="pr-8"/>
                    {renderVariableInserter('googleSheetName')}
                </div>
            </div>
            <div>
                <Label htmlFor={`${node.id}-gsheetdata`}>Dados da Linha (JSON array de strings)</Label>
                <div className="relative">
                    <Textarea id={`${node.id}-gsheetdata`} placeholder='["{{input.valor1}}", "{{input.valor2}}", "texto fixo"]' value={node.googleSheetRowData || ''} onChange={(e) => onUpdate(node.id, { googleSheetRowData: e.target.value })} rows={2} className="pr-8"/>
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
                    <Input id={`${node.id}-agentname`} placeholder="Agente de Suporte N1" value={node.agentName || ''} onChange={(e) => onUpdate(node.id, { agentName: e.target.value })} className="pr-8"/>
                    {renderVariableInserter('agentName')}
                </div>
            </div>
            <div>
                <Label htmlFor={`${node.id}-agentsystemprompt`}>Prompt do Sistema / Instruções</Label>
                <div className="relative">
                    <Textarea id={`${node.id}-agentsystemprompt`} placeholder="Você é um assistente virtual especializado em {{area_especializacao}}." value={node.agentSystemPrompt || ''} onChange={(e) => onUpdate(node.id, { agentSystemPrompt: e.target.value })} rows={4} className="pr-8"/>
                    {renderVariableInserter('agentSystemPrompt', true)}
                </div>
            </div>
            <div>
              <Label htmlFor={`${node.id}-userinputvar`}>Variável com Entrada do Usuário (ex: {"{{pergunta_usuario}}"})</Label>
              <div className="relative">
                <Input id={`${node.id}-userinputvar`} placeholder="{{pergunta_usuario}}" value={node.userInputVariable || ''} onChange={(e) => onUpdate(node.id, { userInputVariable: e.target.value })} className="pr-8"/>
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
                    <Input id={`${node.id}-aimodel`} placeholder="gemini-1.5-flash (padrão Genkit)" value={node.aiModelName || ''} onChange={(e) => onUpdate(node.id, { aiModelName: e.target.value })} className="pr-8"/>
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
        const isDeleteOp = node.type === 'supabase-delete-row';
        const isCreateOp = node.type === 'supabase-create-row';
        const needsIdentifier = isReadOp || node.type === 'supabase-update-row' || isDeleteOp;
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
                        supabaseIdentifierColumn: '', // Resetar coluna ao mudar tabela
                        supabaseColumnsToSelect: '*'  // Resetar colunas a selecionar
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
                        <Input id={`${node.id}-identifierVal`} placeholder="123 ou {{variavel_id}}" value={node.supabaseIdentifierValue || ''} onChange={(e) => onUpdate(node.id, { supabaseIdentifierValue: e.target.value })} className="pr-8"/>
                        {renderVariableInserter('supabaseIdentifierValue')}
                    </div>
                </div>
              </>
            )}

            {isReadOp && (
                 <div>
                    <Label htmlFor={`${node.id}-columnsToSelectRead`}>Colunas a Selecionar (ex: *, nome, email)</Label>
                    <div className="relative">
                        <Input id={`${node.id}-columnsToSelectRead`} placeholder="*, nome, email_principal" value={node.supabaseColumnsToSelect || '*'} onChange={(e) => onUpdate(node.id, { supabaseColumnsToSelect: e.target.value })} className="pr-8"/>
                        {renderVariableInserter('supabaseColumnsToSelect')}
                    </div>
                </div>
            )}

            {needsDataJson && (
              <div>
                  <Label htmlFor={`${node.id}-dataJson`}>{isCreateOp ? 'Dados da Nova Linha (JSON)' : 'Dados para Atualizar (JSON)'}</Label>
                  <div className="relative">
                      <Textarea id={`${node.id}-dataJson`} placeholder='{ "coluna1": "valor1", "coluna2": "{{variavel_col2}}" }' value={node.supabaseDataJson || ''} onChange={(e) => onUpdate(node.id, { supabaseDataJson: e.target.value })} rows={3} className="pr-8"/>
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
              <Popover open={isEvolutionPopoverOpen} onOpenChange={handleEvolutionPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="icon" className="p-0.5 text-muted-foreground hover:text-foreground w-6 h-6" aria-label="Instâncias da API Evolution">
                    <BotMessageSquare className="w-4 h-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80" align="end" data-no-drag="true">
                  <div className="grid gap-4">
                    <div className="space-y-2">
                      <h4 className="font-medium leading-none">Instâncias da API Evolution</h4>
                      <p className="text-sm text-muted-foreground">
                        Status das suas instâncias configuradas.
                      </p>
                    </div>
                     <ScrollArea className="h-auto max-h-[200px]">
                      <div className="grid gap-2">
                         {isLoadingEvolutionInstances ? (
                            <div className="flex items-center justify-center p-4 text-sm text-muted-foreground">
                                <Loader2 className="mr-2 h-4 w-4 animate-spin"/> Carregando...
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
                    </ScrollArea>
                    <Button variant="outline" size="sm" onClick={() => { /* Lógica para abrir config global */ }}>
                        <Settings2 className="w-4 h-4 mr-2" />
                        Gerenciar Instâncias
                    </Button>
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
        <DialogContent className="sm:max-w-3xl md:max-w-4xl lg:max-w-5xl max-h-[85vh] flex flex-col" data-no-drag="true">
            <DialogHeader>
                <DialogTitle>Histórico de Webhooks Recebidos</DialogTitle>
                <DialogDescription>
                    Exibe os últimos 50 eventos de webhook recebidos pelo fluxo. Os logs são zerados quando o servidor reinicia.
                </DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-hidden flex flex-col py-4 space-y-2">
                {isLoadingWebhookLogs && <div className="flex justify-center items-center h-full"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>}
                {webhookLogsError && (
                  <div className="p-3 bg-destructive/10 border border-destructive text-destructive rounded-md text-sm">
                    <div className="flex items-center gap-2 font-medium"><AlertCircle className="h-5 w-5" /> Erro ao carregar logs:</div>
                    <p className="mt-1 text-xs">{webhookLogsError}</p>
                  </div>
                )}
                {!isLoadingWebhookLogs && !webhookLogsError && webhookLogs.length === 0 && (
                  <div className="flex-1 flex flex-col items-center justify-center text-center text-muted-foreground p-4">
                    <FileText className="w-12 h-12 mb-3" />
                    <p className="text-sm">Nenhum log de webhook encontrado.</p>
                  </div>
                )}
                {!isLoadingWebhookLogs && webhookLogs.length > 0 && (
                    <ScrollArea className="flex-1 border rounded-md bg-muted/30">
                        <div className="p-3 space-y-3">
                            {webhookLogs.map((log, index) => (
                                <details key={index} className="bg-background p-2.5 rounded shadow-sm text-xs">
                                    <summary className="cursor-pointer font-medium text-foreground/80 hover:text-foreground select-none">
                                        <span className="font-mono bg-muted px-1.5 py-0.5 rounded-sm text-primary/80 mr-2">{new Date(log.timestamp).toLocaleString()}</span>
                                        <span className="font-semibold mr-1">{log.method}</span>
                                        {log.payload?.event && <span className="text-accent font-semibold">{log.payload.event}</span>}
                                        {log.extractedMessage && <span className="ml-2 text-slate-500 italic">Msg: "{log.extractedMessage.substring(0, 30)}{log.extractedMessage.length > 30 ? '...' : ''}"</span>}
                                        {log.webhook_remoteJid && <span className="ml-2 text-blue-500 text-xs">De: {log.webhook_remoteJid}</span>}
                                    </summary>
                                    <div className="mt-2 p-2 bg-muted/20 rounded-sm overflow-auto text-xs text-foreground/70 space-y-1.5">
                                        {log.method && log.url && <div><strong>Endpoint:</strong> <span className="break-all">{log.method} {log.url}</span></div>}
                                        {log.ip && <div><strong>IP Origem:</strong> {log.ip}</div>}
                                        {log.headers && <div><strong>Headers:</strong><pre className="mt-1 p-1 bg-background/30 rounded text-xs max-h-24 overflow-y-auto">{JSON.stringify(log.headers, null, 2)}</pre></div>}
                                        <div><strong>Payload Completo:</strong>
                                            <pre className="mt-1 p-1 bg-background/30 rounded text-xs max-h-60 overflow-y-auto">{JSON.stringify(log.payload, null, 2)}</pre>
                                        </div>
                                    </div>
                                </details>
                            ))}
                        </div>
                    </ScrollArea>
                )}
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => setIsWebhookHistoryDialogOpen(false)}>Fechar</Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>


    {/* API Test Response Dialog */}
    {node.type === 'api-call' && (
        <Dialog open={isTestResponseModalOpen} onOpenChange={setIsTestResponseModalOpen}>
            <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col" data-no-drag="true">
                <DialogHeader>
                    <DialogTitle>Resposta do Teste da API</DialogTitle>
                </DialogHeader>
                <div className="flex-1 overflow-y-auto space-y-4 py-4">
                    {testResponseError && (
                        <div className="p-3 bg-destructive/10 border border-destructive text-destructive rounded-md">
                            <h4 className="font-semibold mb-1">Erro:</h4>
                            <pre className="text-xs whitespace-pre-wrap break-all">{testResponseError}</pre>
                        </div>
                    )}
                    {testResponseData && (
                        <>
                            <div>
                                <Label className="font-semibold">Status Code:</Label>
                                <p className={`text-sm ${testResponseData.status >= 400 ? 'text-destructive' : 'text-green-600'}`}>{testResponseData.status}</p>
                            </div>
                            <div>
                                <Label className="font-semibold">Headers da Resposta:</Label>
                                <ScrollArea className="h-32 mt-1 border rounded-md p-2 bg-muted/30">
                                    <pre className="text-xs whitespace-pre-wrap break-all">
                                        {Object.entries(testResponseData.headers).map(([key, value]) => `${key}: ${value}`).join('\n')}
                                    </pre>
                                </ScrollArea>
                            </div>
                            <div>
                                <Label className="font-semibold">Corpo da Resposta:</Label>
                                <ScrollArea className="h-48 mt-1 border rounded-md p-2 bg-muted/30">
                                    <pre className="text-xs whitespace-pre-wrap break-all">
                                        {typeof testResponseData.body === 'string' ? testResponseData.body : JSON.stringify(testResponseData.body, null, 2)}
                                    </pre>
                                </ScrollArea>
                            </div>
                        </>
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
