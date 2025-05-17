
"use client";

import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import type { NodeData, ApiHeader, ApiQueryParam, ApiFormDataEntry, StartNodeTrigger } from '@/lib/types';
import { motion } from 'framer-motion';
import { v4 as uuidv4 } from 'uuid';
import {
  MessageSquareText, Type as InputIcon, ListChecks, Trash2, BotMessageSquare,
  ImageUp, UserPlus2, GitFork, Variable, Webhook, Timer, Settings2, Copy,
  CalendarDays, ExternalLink, MoreHorizontal, FileImage, 
  TerminalSquare, Code2, Shuffle, UploadCloud, Star, Sparkles, Mail, Sheet, Headset, Hash, 
  Database, Rows, Search, Edit3, PlayCircle, PlusCircle, GripVertical, TestTube2, Braces, Loader2, KeyRound, StopCircle
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { 
  START_NODE_TRIGGER_INITIAL_Y_OFFSET, START_NODE_TRIGGER_SPACING_Y, 
  OPTION_NODE_HANDLE_INITIAL_Y_OFFSET, OPTION_NODE_HANDLE_SPACING_Y, 
  NODE_HEADER_HEIGHT_APPROX, NODE_HEADER_CONNECTOR_Y_OFFSET 
} from '@/lib/constants';
import { fetchSupabaseTablesAction, fetchSupabaseTableColumnsAction } from '@/lib/supabase/actions';


interface NodeCardProps {
  node: NodeData;
  onUpdate: (id: string, changes: Partial<NodeData>) => void;
  onStartConnection: (event: React.MouseEvent, fromNodeData: NodeData, sourceHandleId?: string) => void;
  onDeleteNode: (id: string) => void;
  definedVariablesInFlow: string[];
}

const NodeCard: React.FC<NodeCardProps> = React.memo(({ node, onUpdate, onStartConnection, onDeleteNode, definedVariablesInFlow }) => {
  const { toast } = useToast();
  const isDraggingNode = useRef(false);
  
  const [newTriggerName, setNewTriggerName] = useState('');
  const [newTriggerType, setNewTriggerType] = useState<StartNodeTrigger['type']>('manual');


  const [isTestResponseModalOpen, setIsTestResponseModalOpen] = useState(false);
  const [testResponseData, setTestResponseData] = useState<{ status: number; headers: Record<string, string>; body: any } | null>(null);
  const [testResponseError, setTestResponseError] = useState<string | null>(null);
  const [isTestingApi, setIsTestingApi] = useState(false);

  const [supabaseTables, setSupabaseTables] = useState<{name: string}[]>([]);
  const [supabaseColumns, setSupabaseColumns] = useState<{name: string}[]>([]);
  const [isLoadingSupabaseTables, setIsLoadingSupabaseTables] = useState(false);
  const [isLoadingSupabaseColumns, setIsLoadingSupabaseColumns] = useState(false);
  const [supabaseSchemaError, setSupabaseSchemaError] = useState<string | null>(null);

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
              console.error(`[NodeCard - ${node.id}] Supabase error fetching columns for ${node.supabaseTableName}:`, result.error);
              setSupabaseColumns([]);
            } else if (result.data) {
              console.log(`[NodeCard - ${node.id}] Columns for ${node.supabaseTableName} fetched:`, result.data);
              setSupabaseColumns(result.data);
              if (node.supabaseIdentifierColumn && !result.data.some(c => c.name === node.supabaseIdentifierColumn)) {
                onUpdate(node.id, { supabaseIdentifierColumn: '' });
              }
              // Manter supabaseColumnsToSelect não deve ser resetado aqui, apenas o supabaseIdentifierColumn
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
  }, [node.id, node.supabaseTableName]); 


  const handleNodeMouseDown = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (
        target.dataset.connector === 'true' || 
        target.closest('[data-action="delete-node"]') ||
        target.closest('[data-no-drag="true"]') || 
        target.closest('[role="dialog"]') || 
        target.closest('[data-radix-popover-content]') || 
        target.closest('[data-radix-scroll-area-viewport]') || // Evitar drag ao usar scrollbars internas
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

  const handleAddStartTrigger = () => {
    if (newTriggerName.trim() === '') {
      toast({ title: "Erro", description: "O nome do gatilho não pode ser vazio.", variant: "destructive" });
      return;
    }
    const currentTriggers = node.triggers || [];
    if (currentTriggers.some(t => t.name === newTriggerName.trim())) {
        toast({ title: "Erro", description: "Nome do gatilho já existe.", variant: "destructive" });
        return;
    }
    const newTrigger: StartNodeTrigger = {
      id: uuidv4(),
      name: newTriggerName.trim(),
      type: newTriggerType,
      webhookPayloadVariable: 'webhook_payload', 
    };
    if (newTriggerType === 'webhook') {
      newTrigger.webhookId = uuidv4();
    }
    onUpdate(node.id, { triggers: [...currentTriggers, newTrigger] });
    setNewTriggerName('');
    setNewTriggerType('manual');
  };

  const handleRemoveStartTrigger = (triggerIdToRemove: string) => {
    const currentTriggers = node.triggers || [];
    onUpdate(node.id, { triggers: currentTriggers.filter(t => t.id !== triggerIdToRemove) });
  };

  const handleStartTriggerChange = (triggerIdToChange: string, field: keyof StartNodeTrigger, value: string | boolean) => {
    const currentTriggers = [...(node.triggers || [])];
    const triggerIndex = currentTriggers.findIndex(t => t.id === triggerIdToChange);
    if (triggerIndex !== -1) {
      (currentTriggers[triggerIndex] as any)[field] = value;
      if (field === 'type' && value === 'webhook' && !currentTriggers[triggerIndex].webhookId) {
        currentTriggers[triggerIndex].webhookId = uuidv4();
      }
      if (field === 'type' && value === 'manual') {
         delete currentTriggers[triggerIndex].webhookId;
      }
      onUpdate(node.id, { triggers: currentTriggers });
    }
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
    if (node.apiMethod !== 'GET' && node.apiMethod !== 'DELETE') { 
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
        responseBodyContent = await response.json();
      } else {
        responseBodyContent = await response.text();
      }

      setTestResponseData({ status: response.status, headers: responseHeadersObj, body: responseBodyContent });
      setIsTestResponseModalOpen(true);

      if (!response.ok) {
        toast({
          title: `Erro na API: ${response.status}`,
          description: typeof responseBodyContent === 'string' ? responseBodyContent : JSON.stringify(responseBodyContent, null, 2),
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

  const handleVariableInsert = (
    currentValue: string | undefined,
    variableName: string,
    updateCallback: (newText: string) => void,
  ) => {
    const newText = `${currentValue || ''}{{${variableName}}}`;
    updateCallback(newText);
  };


  const renderVariableInserter = (
    currentValue: string | undefined,
    updateCallback: (newText: string) => void,
    isTextarea: boolean = false
  ) => {
    if (!definedVariablesInFlow || definedVariablesInFlow.length === 0) return null;
    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={`absolute ${isTextarea ? 'top-1 right-1' : 'top-1/2 right-1 -translate-y-1/2'} h-7 w-7 z-10`}
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
                onClick={() => handleVariableInsert(currentValue, varName, updateCallback)}
              >
                {varName}
              </Button>
            ))}
          </ScrollArea>
        </PopoverContent>
      </Popover>
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
      return (node.triggers || []).map((trigger, index) => (
        <div
          key={trigger.id} 
          className="absolute -right-2.5 z-10 flex items-center"
          style={{ top: `${START_NODE_TRIGGER_INITIAL_Y_OFFSET + index * START_NODE_TRIGGER_SPACING_Y - 10}px` }} 
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
      ));
    }
    if (node.type === 'option') {
      const options = (node.optionsList || '').split('\n').map(opt => opt.trim()).filter(opt => opt !== '');
      return options.map((optionText, index) => (
        <div
          key={`option-${node.id}-${optionText.replace(/\s+/g, '-')}-${index}`}
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
      ));
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
      case 'start':
        return (
          <div className="space-y-3" data-no-drag="true">
            <Label className="text-sm font-medium">Gatilhos de Início</Label>
            <div className="max-h-40 overflow-y-auto space-y-2 pr-1">
              {(node.triggers || []).map((trigger) => (
                <div key={trigger.id} className="p-2.5 border rounded-md bg-muted/30 space-y-2">
                  <div className="flex items-center space-x-2">
                    <Input
                      type="text"
                      value={trigger.name}
                      onChange={(e) => handleStartTriggerChange(trigger.id, 'name', e.target.value)}
                      placeholder="Nome do Gatilho"
                      className="flex-grow h-8 text-xs"
                    />
                    <Button variant="ghost" size="icon" onClick={() => handleRemoveStartTrigger(trigger.id)} className="text-destructive hover:text-destructive/80 w-7 h-7" aria-label={`Remover gatilho ${trigger.name}`}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                  <Select value={trigger.type} onValueChange={(value) => handleStartTriggerChange(trigger.id, 'type', value as StartNodeTrigger['type'])}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Tipo de Gatilho" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manual">Manual (Teste)</SelectItem>
                      <SelectItem value="webhook">Webhook</SelectItem>
                    </SelectContent>
                  </Select>
                  {trigger.type === 'webhook' && (
                    <div className='space-y-1.5 text-xs'>
                      <Label htmlFor={`${node.id}-${trigger.id}-webhookUrl`} className="text-xs">URL do Webhook:</Label>
                      <div className="flex items-center space-x-1.5">
                        <Input 
                          id={`${node.id}-${trigger.id}-webhookUrl`} 
                          type="text" 
                          readOnly 
                          value={`${typeof window !== 'undefined' ? window.location.origin : ''}/api/webhook/${trigger.webhookId || ''}`} 
                          className="bg-input/50 h-7 text-xs"
                        />
                        <Button 
                          variant="outline" 
                          size="icon" 
                          className="h-7 w-7"
                          onClick={() => {
                            if (typeof window !== 'undefined') {
                              navigator.clipboard.writeText(`${window.location.origin}/api/webhook/${trigger.webhookId || ''}`)
                                .then(() => toast({ title: "URL Copiada!", description: "URL do Webhook copiada para a área de transferência."}))
                                .catch(() => toast({ title: "Erro", description: "Não foi possível copiar a URL.", variant: "destructive"}));
                            }
                          }}
                          title="Copiar URL"
                        >
                          <Copy className="w-3 h-3"/>
                        </Button>
                      </div>
                      <Label htmlFor={`${node.id}-${trigger.id}-webhookPayloadVar`} className="text-xs">Salvar Payload em:</Label>
                       <div className="relative">
                        <Input 
                          id={`${node.id}-${trigger.id}-webhookPayloadVar`}
                          placeholder="webhook_payload"
                          value={trigger.webhookPayloadVariable || 'webhook_payload'}
                          onChange={(e) => handleStartTriggerChange(trigger.id, 'webhookPayloadVariable', e.target.value)}
                          className="h-7 text-xs pr-8"
                        />
                         {renderVariableInserter(trigger.webhookPayloadVariable, (newText) => handleStartTriggerChange(trigger.id, 'webhookPayloadVariable', newText))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="flex items-end space-x-2 pt-2 border-t mt-2">
              <div className="flex-grow space-y-1">
                <Label htmlFor={`${node.id}-newTriggerName`} className="text-xs">Novo Nome</Label>
                <Input
                  id={`${node.id}-newTriggerName`}
                  type="text"
                  value={newTriggerName}
                  onChange={(e) => setNewTriggerName(e.target.value)}
                  placeholder="Nome do gatilho"
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`${node.id}-newTriggerType`} className="text-xs">Tipo</Label>
                <Select value={newTriggerType} onValueChange={(value) => setNewTriggerType(value as StartNodeTrigger['type'])}>
                    <SelectTrigger id={`${node.id}-newTriggerType`} className="h-8 text-xs w-[100px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manual">Manual</SelectItem>
                      <SelectItem value="webhook">Webhook</SelectItem>
                    </SelectContent>
                  </Select>
              </div>
              <Button onClick={handleAddStartTrigger} size="sm" variant="outline" className="h-8">
                <PlusCircle className="w-3.5 h-3.5 mr-1" /> Adicionar
              </Button>
            </div>
          </div>
        );
      case 'message':
        return (
          <div data-no-drag="true">
            <div className="relative">
              <Textarea placeholder="Mensagem do bot..." value={node.text || ''} onChange={(e) => onUpdate(node.id, { text: e.target.value })} className="resize-none text-sm pr-8" rows={3} />
              {renderVariableInserter(node.text, (newText) => onUpdate(node.id, { text: newText }), true)}
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
                {renderVariableInserter(node.promptText, (newText) => onUpdate(node.id, { promptText: newText }), true)}
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
                {renderVariableInserter(node.questionText, (newText) => onUpdate(node.id, { questionText: newText }), true)}
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
        return (
          <div className="space-y-3" data-no-drag="true">
            <div>
              <Label htmlFor={`${node.id}-instance`}>Instância (Opcional - usa padrão global)</Label>
              <div className="relative">
                <Input id={`${node.id}-instance`} placeholder="ex: evolution_instance" value={node.instanceName || ''} onChange={(e) => onUpdate(node.id, { instanceName: e.target.value })} className="pr-8"/>
                {renderVariableInserter(node.instanceName, (newText) => onUpdate(node.id, { instanceName: newText }))}
              </div>
            </div>
            <div>
                <Label htmlFor={`${node.id}-phone`}>Telefone (Ex: 55119... ou {"{{var_tel}}"})</Label>
                <div className="relative">
                    <Input id={`${node.id}-phone`} placeholder="55119... ou {{variavel_tel}}" value={node.phoneNumber || ''} onChange={(e) => onUpdate(node.id, { phoneNumber: e.target.value })} className="pr-8"/>
                     {renderVariableInserter(node.phoneNumber, (newText) => onUpdate(node.id, { phoneNumber: newText }))}
                </div>
            </div>
            <div>
                <Label htmlFor={`${node.id}-watext`}>Mensagem</Label>
                <div className="relative">
                    <Textarea id={`${node.id}-watext`} value={node.textMessage || ''} onChange={(e) => onUpdate(node.id, { textMessage: e.target.value })} rows={2} className="pr-8"/>
                    {renderVariableInserter(node.textMessage, (newText) => onUpdate(node.id, { textMessage: newText }), true)}
                </div>
            </div>
          </div>
        );
      case 'whatsapp-media':
        return (
          <div className="space-y-3" data-no-drag="true">
            <div>
              <Label htmlFor={`${node.id}-instance`}>Instância (Opcional - usa padrão global)</Label>
              <div className="relative">
                <Input id={`${node.id}-instance`} placeholder="ex: evolution_instance" value={node.instanceName || ''} onChange={(e) => onUpdate(node.id, { instanceName: e.target.value })} className="pr-8"/>
                {renderVariableInserter(node.instanceName, (newText) => onUpdate(node.id, { instanceName: newText }))}
              </div>
            </div>
             <div>
                <Label htmlFor={`${node.id}-phone`}>Telefone (Ex: 55119... ou {"{{var_tel}}"})</Label>
                <div className="relative">
                    <Input id={`${node.id}-phone`} placeholder="55119... ou {{variavel_tel}}" value={node.phoneNumber || ''} onChange={(e) => onUpdate(node.id, { phoneNumber: e.target.value })} className="pr-8"/>
                     {renderVariableInserter(node.phoneNumber, (newText) => onUpdate(node.id, { phoneNumber: newText }))}
                </div>
            </div>
            <div>
                <Label htmlFor={`${node.id}-mediaurl`}>URL da Mídia (Ex: https://... ou {"{{url_midia}}"})</Label>
                <div className="relative">
                    <Input id={`${node.id}-mediaurl`} placeholder="https://... ou {{url_midia}}" value={node.mediaUrl || ''} onChange={(e) => onUpdate(node.id, { mediaUrl: e.target.value })} className="pr-8"/>
                    {renderVariableInserter(node.mediaUrl, (newText) => onUpdate(node.id, { mediaUrl: newText }))}
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
                    {renderVariableInserter(node.caption, (newText) => onUpdate(node.id, { caption: newText }))}
                </div>
            </div>
          </div>
        );
      case 'whatsapp-group':
         return (
          <div className="space-y-3" data-no-drag="true">
            <div>
              <Label htmlFor={`${node.id}-instance`}>Instância (Opcional - usa padrão global)</Label>
              <div className="relative">
                <Input id={`${node.id}-instance`} placeholder="ex: evolution_instance" value={node.instanceName || ''} onChange={(e) => onUpdate(node.id, { instanceName: e.target.value })} className="pr-8"/>
                {renderVariableInserter(node.instanceName, (newText) => onUpdate(node.id, { instanceName: newText }))}
              </div>
            </div>
            <div>
                <Label htmlFor={`${node.id}-groupname`}>Nome do Grupo</Label>
                <div className="relative">
                    <Input id={`${node.id}-groupname`} value={node.groupName || ''} onChange={(e) => onUpdate(node.id, { groupName: e.target.value })} className="pr-8"/>
                    {renderVariableInserter(node.groupName, (newText) => onUpdate(node.id, { groupName: newText }))}
                </div>
            </div>
            <div>
                <Label htmlFor={`${node.id}-participants`}>Participantes (IDs separados por vírgula, ex: 5511...,5521...)</Label>
                <div className="relative">
                    <Textarea id={`${node.id}-participants`} value={node.participants || ''} onChange={(e) => onUpdate(node.id, { participants: e.target.value })} rows={2} className="pr-8"/>
                    {renderVariableInserter(node.participants, (newText) => onUpdate(node.id, { participants: newText }), true)}
                </div>
            </div>
          </div>
        );
      case 'condition':
        return (
          <div className="space-y-3" data-no-drag="true">
            <div>
                <Label htmlFor={`${node.id}-condvar`}>Variável (ex: {"{{variavel}}"})</Label>
                <div className="relative">
                    <Input id={`${node.id}-condvar`} placeholder="{{variavel}}" value={node.conditionVariable || ''} onChange={(e) => onUpdate(node.id, { conditionVariable: e.target.value })} className="pr-8"/>
                    {renderVariableInserter(node.conditionVariable, (newText) => onUpdate(node.id, { conditionVariable: newText }))}
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
                    {renderVariableInserter(node.conditionValue, (newText) => onUpdate(node.id, { conditionValue: newText }))}
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
                    {renderVariableInserter(node.variableValue, (newText) => onUpdate(node.id, { variableValue: newText }))}
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
                {renderVariableInserter(node.apiUrl, (newText) => onUpdate(node.id, { apiUrl: newText }))}
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
                        {renderVariableInserter(node.apiAuthBearerToken, (newText) => onUpdate(node.id, { apiAuthBearerToken: newText }))}
                    </div>
                  </div>
                )}
                {node.apiAuthType === 'basic' && (
                  <>
                    <div>
                      <Label htmlFor={`${node.id}-apiauthbasicuser`}>Usuário</Label>
                       <div className="relative">
                            <Input id={`${node.id}-apiauthbasicuser`} placeholder="Nome de usuário" value={node.apiAuthBasicUser || ''} onChange={(e) => onUpdate(node.id, { apiAuthBasicUser: e.target.value })} className="pr-8"/>
                            {renderVariableInserter(node.apiAuthBasicUser, (newText) => onUpdate(node.id, { apiAuthBasicUser: newText }))}
                        </div>
                    </div>
                    <div>
                      <Label htmlFor={`${node.id}-apiauthbasicpassword`}>Senha</Label>
                       <div className="relative">
                            <Input id={`${node.id}-apiauthbasicpassword`} type="password" placeholder="Senha" value={node.apiAuthBasicPassword || ''} onChange={(e) => onUpdate(node.id, { apiAuthBasicPassword: e.target.value })} className="pr-8"/>
                            {renderVariableInserter(node.apiAuthBasicPassword, (newText) => onUpdate(node.id, { apiAuthBasicPassword: newText }))}
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
                        {renderVariableInserter(node.apiBodyJson, (newText) => onUpdate(node.id, { apiBodyJson: newText }), true)}
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
                        {renderVariableInserter(node.apiBodyRaw, (newText) => onUpdate(node.id, { apiBodyRaw: newText }), true)}
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
                    {renderVariableInserter(node.dateInputLabel, (newText) => onUpdate(node.id, { dateInputLabel: newText }))}
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
                {renderVariableInserter(node.redirectUrl, (newText) => onUpdate(node.id, { redirectUrl: newText }))}
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
                    {renderVariableInserter(node.mediaDisplayUrl, (newText) => onUpdate(node.id, { mediaDisplayUrl: newText }))}
                </div>
              </div>
              <div>
                <Label htmlFor={`${node.id}-mediadisplaytext`}>Texto Alternativo/Legenda</Label>
                <div className="relative">
                    <Input id={`${node.id}-mediadisplaytext`} placeholder="Descrição da mídia" value={node.mediaDisplayText || ''} onChange={(e) => onUpdate(node.id, { mediaDisplayText: e.target.value })} className="pr-8"/>
                    {renderVariableInserter(node.mediaDisplayText, (newText) => onUpdate(node.id, { mediaDisplayText: newText }))}
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
                {renderVariableInserter(node.logMessage, (newText) => onUpdate(node.id, { logMessage: newText }), true)}
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
                {renderVariableInserter(node.codeSnippet, (newText) => onUpdate(node.id, { codeSnippet: newText }), true)}
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
                    {renderVariableInserter(node.inputJson, (newText) => onUpdate(node.id, { inputJson: newText }), true)}
                </div>
            </div>
            <div>
                <Label htmlFor={`${node.id}-jsonata`}>Expressão JSONata</Label>
                <div className="relative">
                    <Input id={`${node.id}-jsonata`} placeholder="$.chave.outraChave[0]" value={node.jsonataExpression || ''} onChange={(e) => onUpdate(node.id, { jsonataExpression: e.target.value })} className="pr-8"/>
                    {renderVariableInserter(node.jsonataExpression, (newText) => onUpdate(node.id, { jsonataExpression: newText }))}
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
                    {renderVariableInserter(node.uploadPromptText, (newText) => onUpdate(node.id, { uploadPromptText: newText }))}
                </div>
            </div>
            <div>
                <Label htmlFor={`${node.id}-filefilter`}>Filtro de Tipo de Arquivo (ex: image/*, .pdf)</Label>
                <Input id={`${node.id}-filefilter`} placeholder="image/*, .pdf, .docx" value={node.fileTypeFilter || ''} onChange={(e) => onUpdate(node.id, { fileTypeFilter: e.target.value })} />
            </div>
            <div>
                <Label htmlFor={`${node.id}-maxsize`}>Tam. Máx. Arquivo (MB)</Label>
                <Input id={`${node.id}-maxsize`} type="number" placeholder="5" value={node.maxFileSizeMB ?? ''} onChange={(e) => onUpdate(node.id, { maxFileSizeMB: parseInt(e.target.value, 10) || undefined })} />
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
                    {renderVariableInserter(node.ratingQuestionText, (newText) => onUpdate(node.id, { ratingQuestionText: newText }))}
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
                    {renderVariableInserter(node.aiPromptText, (newText) => onUpdate(node.id, { aiPromptText: newText }), true)}
                </div>
            </div>
            <div>
                <Label htmlFor={`${node.id}-aimodel`}>Modelo de IA (opcional)</Label>
                <div className="relative">
                    <Input id={`${node.id}-aimodel`} placeholder="gemini-2.0-flash (padrão)" value={node.aiModelName || ''} onChange={(e) => onUpdate(node.id, { aiModelName: e.target.value })} className="pr-8"/>
                    {renderVariableInserter(node.aiModelName, (newText) => onUpdate(node.id, { aiModelName: newText }))}
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
                    {renderVariableInserter(node.emailTo, (newText) => onUpdate(node.id, { emailTo: newText }))}
                </div>
            </div>
            <div>
                <Label htmlFor={`${node.id}-emailsubject`}>Assunto</Label>
                <div className="relative">
                    <Input id={`${node.id}-emailsubject`} placeholder="Assunto do seu e-mail" value={node.emailSubject || ''} onChange={(e) => onUpdate(node.id, { emailSubject: e.target.value })} className="pr-8"/>
                    {renderVariableInserter(node.emailSubject, (newText) => onUpdate(node.id, { emailSubject: newText }))}
                </div>
            </div>
            <div>
                <Label htmlFor={`${node.id}-emailbody`}>Corpo do E-mail (HTML ou Texto)</Label>
                <div className="relative">
                    <Textarea id={`${node.id}-emailbody`} placeholder="Olá {{input.nome_cliente}},\n\nSua mensagem aqui." value={node.emailBody || ''} onChange={(e) => onUpdate(node.id, { emailBody: e.target.value })} rows={4} className="pr-8"/>
                    {renderVariableInserter(node.emailBody, (newText) => onUpdate(node.id, { emailBody: newText }), true)}
                </div>
            </div>
            <div>
                <Label htmlFor={`${node.id}-emailfrom`}>De (E-mail - opcional)</Label>
                <div className="relative">
                    <Input id={`${node.id}-emailfrom`} type="email" placeholder="remetente@exemplo.com" value={node.emailFrom || ''} onChange={(e) => onUpdate(node.id, { emailFrom: e.target.value })} className="pr-8"/>
                    {renderVariableInserter(node.emailFrom, (newText) => onUpdate(node.id, { emailFrom: newText }))}
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
                    {renderVariableInserter(node.googleSheetId, (newText) => onUpdate(node.id, { googleSheetId: newText }))}
                </div>
            </div>
            <div>
                <Label htmlFor={`${node.id}-gsheetname`}>Nome da Aba (Planilha)</Label>
                <div className="relative">
                    <Input id={`${node.id}-gsheetname`} placeholder="Página1" value={node.googleSheetName || ''} onChange={(e) => onUpdate(node.id, { googleSheetName: e.target.value })} className="pr-8"/>
                    {renderVariableInserter(node.googleSheetName, (newText) => onUpdate(node.id, { googleSheetName: newText }))}
                </div>
            </div>
            <div>
                <Label htmlFor={`${node.id}-gsheetdata`}>Dados da Linha (JSON array de strings)</Label>
                <div className="relative">
                    <Textarea id={`${node.id}-gsheetdata`} placeholder='["{{input.valor1}}", "{{input.valor2}}", "texto fixo"]' value={node.googleSheetRowData || ''} onChange={(e) => onUpdate(node.id, { googleSheetRowData: e.target.value })} rows={2} className="pr-8"/>
                    {renderVariableInserter(node.googleSheetRowData, (newText) => onUpdate(node.id, { googleSheetRowData: newText }), true)}
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
                    {renderVariableInserter(node.agentName, (newText) => onUpdate(node.id, { agentName: newText }))}
                </div>
            </div>
            <div>
                <Label htmlFor={`${node.id}-agentsystemprompt`}>Prompt do Sistema / Instruções</Label>
                <div className="relative">
                    <Textarea id={`${node.id}-agentsystemprompt`} placeholder="Você é um assistente virtual especializado em {{area_especializacao}}." value={node.agentSystemPrompt || ''} onChange={(e) => onUpdate(node.id, { agentSystemPrompt: e.target.value })} rows={4} className="pr-8"/>
                    {renderVariableInserter(node.agentSystemPrompt, (newText) => onUpdate(node.id, { agentSystemPrompt: newText }), true)}
                </div>
            </div>
            <div>
              <Label htmlFor={`${node.id}-userinputvar`}>Variável com Entrada do Usuário (ex: {"{{pergunta_usuario}}"})</Label>
              <div className="relative">
                <Input id={`${node.id}-userinputvar`} placeholder="{{pergunta_usuario}}" value={node.userInputVariable || ''} onChange={(e) => onUpdate(node.id, { userInputVariable: e.target.value })} className="pr-8"/>
                {renderVariableInserter(node.userInputVariable, (newText) => onUpdate(node.id, { userInputVariable: newText }))}
              </div>
            </div>
            <div>
                <Label htmlFor={`${node.id}-agentresponsevar`}>Salvar Resposta na Variável</Label>
                <Input id={`${node.id}-agentresponsevar`} placeholder="resposta_agente" value={node.agentResponseVariable || ''} onChange={(e) => onUpdate(node.id, { agentResponseVariable: e.target.value })} />
            </div>
            <div>
                <Label htmlFor={`${node.id}-aimodel`}>Modelo de IA (opcional, ex: gemini-1.5-flash)</Label>
                <div className="relative">
                    <Input id={`${node.id}-aimodel`} placeholder="gemini-2.0-flash (padrão Genkit)" value={node.aiModelName || ''} onChange={(e) => onUpdate(node.id, { aiModelName: e.target.value })} className="pr-8"/>
                    {renderVariableInserter(node.aiModelName, (newText) => onUpdate(node.id, { aiModelName: newText }))}
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
                    onValueChange={(value) => onUpdate(node.id, { supabaseTableName: value, supabaseIdentifierColumn: '', supabaseColumnsToSelect: '*' })}
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
                        {renderVariableInserter(node.supabaseIdentifierValue, (newText) => onUpdate(node.id, { supabaseIdentifierValue: newText }))}
                    </div>
                </div>
              </>
            )}
            
            {isReadOp && (
                 <div>
                    <Label htmlFor={`${node.id}-columnsToSelectRead`}>Colunas a Selecionar (ex: *, nome, email)</Label>
                    <div className="relative">
                        <Input id={`${node.id}-columnsToSelectRead`} placeholder="*, nome, email_principal" value={node.supabaseColumnsToSelect || '*'} onChange={(e) => onUpdate(node.id, { supabaseColumnsToSelect: e.target.value })} className="pr-8"/>
                        {renderVariableInserter(node.supabaseColumnsToSelect, (newText) => onUpdate(node.id, { supabaseColumnsToSelect: newText }))}
                    </div>
                </div>
            )}

            {needsDataJson && (
              <div>
                  <Label htmlFor={`${node.id}-dataJson`}>{isCreateOp ? 'Dados da Nova Linha (JSON)' : 'Dados para Atualizar (JSON)'}</Label>
                  <div className="relative">
                      <Textarea id={`${node.id}-dataJson`} placeholder='{ "coluna1": "valor1", "coluna2": "{{variavel_col2}}" }' value={node.supabaseDataJson || ''} onChange={(e) => onUpdate(node.id, { supabaseDataJson: e.target.value })} rows={3} className="pr-8"/>
                      {renderVariableInserter(node.supabaseDataJson, (newText) => onUpdate(node.id, { supabaseDataJson: newText }), true)}
                  </div>
              </div>
            )}

            {(isReadOp || isCreateOp) && (
              <div>
                <Label htmlFor={`${node.id}-resultVar`}>Salvar Resultado na Variável</Label>
                <Input id={`${node.id}-resultVar`} placeholder={isReadOp ? (node.supabaseResultVariable || "dados_supabase") : (node.supabaseResultVariable || "id_linha_criada_supabase")} value={node.supabaseResultVariable || ''} onChange={(e) => onUpdate(node.id, { supabaseResultVariable: e.target.value })} />
              </div>
            )}
            <p className="text-xs text-muted-foreground">Requer Supabase habilitado e configurado nas Configurações Globais, e que as funções SQL \`get_public_tables\` e \`get_table_columns\` existam no seu banco.</p>
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
      className="w-full cursor-default bg-card rounded-lg shadow-xl border border-border relative"
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
            target.closest('input, textarea, select, button:not([data-drag-handle="true"])') && !target.closest('div[data-drag-handle="true"]')?.contains(target) ||
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
          <Button
            variant="ghost"
            size="icon"
            onClick={handleDeleteClick}
            className="p-0.5 text-muted-foreground hover:text-destructive w-6 h-6"
            aria-label="Excluir nó" data-action="delete-node"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
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
                    <Button variant="outline" onClick={() => setIsTestResponseModalOpen(false)}>Fechar</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )}
    </>
  );
});
NodeCard.displayName = 'NodeCard';
export default NodeCard;
