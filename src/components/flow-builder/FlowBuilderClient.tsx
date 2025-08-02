
"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import type { NodeData, Connection, DrawingLineData, CanvasOffset, DraggableBlockItemData, WorkspaceData, StartNodeTrigger, User } from '@/lib/types';
import { 
  NODE_WIDTH, NODE_HEADER_CONNECTOR_Y_OFFSET, NODE_HEADER_HEIGHT_APPROX, GRID_SIZE,
  START_NODE_TRIGGER_INITIAL_Y_OFFSET, START_NODE_TRIGGER_SPACING_Y,
  OPTION_NODE_HANDLE_INITIAL_Y_OFFSET, OPTION_NODE_HANDLE_SPACING_Y,
  MIN_ZOOM, MAX_ZOOM, ZOOM_STEP
} from '@/lib/constants';
import FlowSidebar from './FlowSidebar';
import Canvas from './Canvas';
import TopBar from './TopBar';
import TestChatPanel from './TestChatPanel';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { v4 as uuidv4 } from 'uuid';
import { useToast } from '@/hooks/use-toast';
import { 
    saveWorkspaceToDB,
    loadWorkspaceFromDB
} from '@/app/actions/databaseActions';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';


const LOCAL_STORAGE_KEY_CHAT_PANEL_OPEN = 'nexusflowChatPanelOpen';

const VARIABLE_DEFINING_FIELDS: (keyof NodeData)[] = [
  'variableToSaveResponse', 'variableToSaveChoice', 'variableName', 
  'apiOutputVariable', 'variableToSaveDate', 'codeOutputVariable', 
  'jsonOutputVariable', 'fileUrlVariable', 'ratingOutputVariable', 
  'aiOutputVariable', 'agentResponseVariable', 'supabaseResultVariable',
];

const CHATWOOT_PREFILLED_VARIABLES = [
    'chatwoot_conversation_id',
    'chatwoot_contact_id',
    'chatwoot_account_id',
    'chatwoot_inbox_id',
    'contact_name',
    'contact_phone'
];


// --- Funções de Escopo de Variáveis ---

/**
 * Extrai todas as variáveis que um nó específico define.
 */
function getVariablesFromNode(node: NodeData): string[] {
    const variables: string[] = [];
    VARIABLE_DEFINING_FIELDS.forEach(field => {
        const varName = node[field] as string | undefined;
        if (varName && varName.trim() !== '') {
            variables.push(varName.trim().replace(/\{\{/g, '').replace(/\}\}/g, ''));
        }
    });
    if (node.type === 'start' && Array.isArray(node.triggers)) {
        node.triggers.forEach(trigger => {
            if (trigger.type === 'webhook' && Array.isArray(trigger.variableMappings)) {
                trigger.variableMappings.forEach(mapping => {
                    if(mapping.flowVariable) variables.push(mapping.flowVariable.trim().replace(/\{\{/g, '').replace(/\}\}/g, ''));
                });
            }
        });
    }
    return variables;
}

/**
 * Encontra todos os nós ancestrais para um nó específico, navegando para trás no fluxo.
 */
function getAncestorsForNode(
    nodeId: string, 
    nodes: NodeData[], 
    connections: Connection[],
    memo: Map<string, NodeData[]> = new Map()
): NodeData[] {
    if (memo.has(nodeId)) {
        return memo.get(nodeId)!;
    }

    const ancestors = new Map<string, NodeData>();
    const nodesMap = new Map(nodes.map(n => [n.id, n]));

    const q: string[] = [nodeId];
    const visitedForThisRun = new Set<string>();

    while(q.length > 0) {
        const currentId = q.shift()!;
        if(visitedForThisRun.has(currentId)) continue;
        visitedForThisRun.add(currentId);

        const incomingConnections = connections.filter(c => c.to === currentId);
        for(const conn of incomingConnections) {
            const parentNode = nodesMap.get(conn.from);
            if(parentNode && !ancestors.has(parentNode.id)) {
                ancestors.set(parentNode.id, parentNode);
                q.push(parentNode.id);
            }
        }
    }
    
    const result = Array.from(ancestors.values());
    memo.set(nodeId, result);
    return result;
}


function generateUniqueVariableName(baseName: string, existingNames: string[]): string {
  if (!baseName || baseName.trim() === '') return '';
  const cleanedBaseName = baseName.replace(/\{\{/g, '').replace(/\}\}/g, '').trim();
  if (cleanedBaseName === '') return '';

  if (!existingNames.includes(cleanedBaseName)) {
    return cleanedBaseName;
  }
  let counter = 1;
  let newName = `${cleanedBaseName}_${counter}`;
  while (existingNames.includes(newName)) {
    counter++;
    newName = `${cleanedBaseName}_${counter}`;
  }
  return newName;
}

interface FlowBuilderClientProps {
  workspaceId: string;
  user: User;
  initialWorkspace: WorkspaceData | null;
}

export default function FlowBuilderClient({ workspaceId, user, initialWorkspace }: FlowBuilderClientProps) {
  const { toast } = useToast();
  const router = useRouter();
  
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceData | null>(initialWorkspace);
  const [isLoading, setIsLoading] = useState(!initialWorkspace); 
  
  const [drawingLine, setDrawingLine] = useState<DrawingLineData | null>(null);
  const [highlightedConnectionId, setHighlightedConnectionId] = useState<string | null>(null);
  const [highlightedNodeIdBySession, setHighlightedNodeIdBySession] = useState<string | null>(null);

  const [canvasOffset, setCanvasOffset] = useState<CanvasOffset>({ x: GRID_SIZE * 2, y: GRID_SIZE * 2 });
  const [zoomLevel, setZoomLevel] = useState(1);
  
  const isPanning = useRef(false);
  const panStartMousePosition = useRef({ x: 0, y: 0 });
  const initialCanvasOffsetOnPanStart = useRef<CanvasOffset>({ x: 0, y: 0 });
  
  const canvasRef = useRef<HTMLDivElement>(null);
  
  const canvasOffsetCbRef = useRef(canvasOffset);
  const zoomLevelCbRef = useRef(zoomLevel);

  const [isChatPanelOpen, setIsChatPanelOpen] = useState(true);
  const [hasMounted, setHasMounted] = useState(false);
  
  const [availableVariablesByNode, setAvailableVariablesByNode] = useState<Record<string, string[]>>({});

  useEffect(() => {
    setHasMounted(true);
    const savedIsChatPanelOpen = localStorage.getItem(LOCAL_STORAGE_KEY_CHAT_PANEL_OPEN);
    if (savedIsChatPanelOpen !== null) {
      try {
        setIsChatPanelOpen(JSON.parse(savedIsChatPanelOpen));
      } catch (e) {
        console.warn("[FlowBuilderClient] Failed to parse chat panel state from localStorage.", e);
        setIsChatPanelOpen(true);
      }
    }
  }, []);
  
  useEffect(() => {
    canvasOffsetCbRef.current = canvasOffset;
  }, [canvasOffset]);

  useEffect(() => {
    zoomLevelCbRef.current = zoomLevel;
  }, [zoomLevel]);

  const currentNodes = activeWorkspace?.nodes || [];
  const currentConnections = activeWorkspace?.connections || [];

  // Recalcula o escopo de variáveis sempre que o fluxo mudar
  useEffect(() => {
    if (!activeWorkspace || !activeWorkspace.nodes) {
        setAvailableVariablesByNode({});
        return;
    }

    const { nodes, connections, chatwoot_enabled } = activeWorkspace;
    const newVarsByNode: Record<string, string[]> = {};
    const ancestorMemo = new Map<string, NodeData[]>();
    
    // Variáveis base que estão sempre disponíveis
    const baseVars = ['session_id'];
    if (chatwoot_enabled) {
        baseVars.push(...CHATWOOT_PREFILLED_VARIABLES);
    }

    for (const node of nodes) {
        const ancestors = getAncestorsForNode(node.id, nodes, connections, ancestorMemo);
        const ancestorVars = ancestors.flatMap(getVariablesFromNode);
        const uniqueVars = Array.from(new Set([...baseVars, ...ancestorVars])).sort();
        newVarsByNode[node.id] = uniqueVars;
    }
    setAvailableVariablesByNode(newVarsByNode);
  }, [activeWorkspace]);


  const toggleChatPanel = useCallback(() => {
    setIsChatPanelOpen(prev => {
      const newState = !prev;
      if (hasMounted) {
        localStorage.setItem(LOCAL_STORAGE_KEY_CHAT_PANEL_OPEN, JSON.stringify(newState));
      }
      return newState;
    });
  }, [hasMounted]);
  
  const loadWorkspace = useCallback(async () => {
    if (!user || !workspaceId) return;
    setIsLoading(true);
    console.log(`[FlowBuilderClient] Loading workspace ${workspaceId} from DB...`);
    
    try {
        const dbWorkspace = await loadWorkspaceFromDB(workspaceId);
        if (dbWorkspace) {
            setActiveWorkspace(dbWorkspace);
        } else {
            toast({ title: "Erro de Carregamento", description: "O fluxo solicitado não foi encontrado.", variant: "destructive" });
            router.push('/');
        }
    } catch(error: any) {
        console.error(`[FlowBuilderClient] Failed to load workspace ${workspaceId} from DB:`, error);
        toast({ title: "Erro de Carregamento", description: "Não foi possível carregar o fluxo do banco de dados.", variant: "destructive" });
        router.push('/');
    }
    setIsLoading(false);
  }, [user, workspaceId, toast, router]);


  useEffect(() => {
    if (workspaceId && hasMounted) {
      loadWorkspace();
    }
  }, [workspaceId, hasMounted, loadWorkspace]);

  const handleSaveWorkspace = useCallback(async () => {
    if (!activeWorkspace) {
      console.warn("[FlowBuilderClient] No active workspace to save.");
      toast({ title: "Aviso", description: "Nenhum fluxo ativo para salvar.", variant: "default" });
      return;
    }
    console.log(`[FlowBuilderClient] Saving workspace ${activeWorkspace.id} to DB...`);
    const result = await saveWorkspaceToDB(activeWorkspace);
    if (result.success) {
      toast({
        title: "Fluxo Salvo!",
        description: `O fluxo "${activeWorkspace.name}" foi salvo com sucesso.`,
      });
    } else {
      toast({
        title: "Erro ao Salvar",
        description: result.error || "Ocorreu um erro desconhecido.",
        variant: "destructive",
      });
    }
  }, [activeWorkspace, toast]);


  const handleDiscardChanges = useCallback(async () => {
    toast({
      title: "Descartando Alterações...",
      description: "Recarregando fluxo do banco de dados.",
    });
    await loadWorkspace();
    setHighlightedNodeIdBySession(null); 
  }, [loadWorkspace, toast]);

  const updateActiveWorkspace = useCallback((updater: (workspace: WorkspaceData) => WorkspaceData) => {
    setActiveWorkspace(prevWorkspace => {
        if (!prevWorkspace) {
            console.warn('[FlowBuilderClient] updateActiveWorkspace called but no activeWorkspace.');
            return null;
        }
        return updater(prevWorkspace);
    });
  }, []);

  const handleDropNode = useCallback((item: DraggableBlockItemData, logicalDropCoords: { x: number, y: number }) => {
    let tempExistingVars: string[] = [];
    if (activeWorkspace?.nodes) {
        const allVarsInFlow = Object.values(availableVariablesByNode).flat();
        tempExistingVars = Array.from(new Set(allVarsInFlow));
    }
    
    const itemDefaultDataCopy = item.defaultData ? JSON.parse(JSON.stringify(item.defaultData)) : {};
    
    VARIABLE_DEFINING_FIELDS.forEach(field => {
      if (itemDefaultDataCopy.hasOwnProperty(field)) {
        const baseVarName = itemDefaultDataCopy[field] as string | undefined;
        if (baseVarName && baseVarName.trim() !== '') {
          const uniqueName = generateUniqueVariableName(baseVarName, tempExistingVars);
          (itemDefaultDataCopy as any)[field] = uniqueName;
          if (uniqueName !== baseVarName.replace(/\{\{/g, '').replace(/\}\}/g, '').trim()) { 
            tempExistingVars.push(uniqueName); 
          }
        }
      }
    });
    
    if (item.type === 'start' && itemDefaultDataCopy.triggers) {
      itemDefaultDataCopy.triggers = (itemDefaultDataCopy.triggers as StartNodeTrigger[]).map(trigger => {
        if (trigger.type === 'webhook' && Array.isArray(trigger.variableMappings)) {
            trigger.variableMappings = trigger.variableMappings.map(mapping => {
                 if (mapping.flowVariable) {
                    const uniqueWebhookVarName = generateUniqueVariableName(mapping.flowVariable, tempExistingVars);
                    if (uniqueWebhookVarName !== mapping.flowVariable.replace(/\{\{/g, '').replace(/\}\}/g, '').trim()) {
                        tempExistingVars.push(uniqueWebhookVarName);
                    }
                    return {...mapping, flowVariable: uniqueWebhookVarName};
                }
                return mapping;
            });
        }
        return trigger;
      });
    }
    
    const baseNodeData: Omit<NodeData, 'id' | 'type' | 'title' | 'x' | 'y'> = {
      text: '', promptText: '', inputType: 'text', variableToSaveResponse: 'entrada_usuario',
      questionText: '', optionsList: 'Opção 1\nOpção 2', variableToSaveChoice: 'escolha_usuario',
      mediaDisplayType: 'image', mediaDisplayUrl: 'https://placehold.co/300x200.png', mediaDisplayText: 'Imagem de exemplo', dataAiHint: 'placeholder abstract',
      conditionVariable: '{{variavel}}', conditionOperator: '==', conditionValue: 'valor',
      variableName: 'minha_variavel', variableValue: 'valor_padrao', delayDuration: 1000, typingDuration: 1500,
      logMessage: 'Log: {{status}}', codeSnippet: "return { resultado: 'sucesso' };", codeOutputVariable: 'resultado_codigo', 
      inputJson: '{ "nome": "Exemplo" }', jsonataExpression: '$.nome', jsonOutputVariable: 'nome_transformado',
      uploadPromptText: 'Envie seu arquivo.', fileTypeFilter: 'image/*,.pdf', maxFileSizeMB: 5, fileUrlVariable: 'url_arquivo',
      ratingQuestionText: 'Como você avalia?', maxRatingValue: 5, ratingIconType: 'star', ratingOutputVariable: 'avaliacao',
      apiUrl: 'https://', apiMethod: 'GET', apiAuthType: 'none',
      apiAuthBearerToken: '', apiAuthBasicUser: '', apiAuthBasicPassword: '',
      apiHeadersList: [], apiQueryParamsList: [],
      apiBodyType: 'none', apiBodyJson: '{}', apiBodyFormDataList: [], apiBodyRaw: '',
      apiOutputVariable: 'resposta_api',
      redirectUrl: 'https://', dateInputLabel: 'Qual a data?', variableToSaveDate: 'data_selecionada',
      emailTo: 'dest@ex.com', emailSubject: 'Assunto', emailBody: 'Corpo', emailFrom: 'remet@ex.com',
      googleSheetId: '', googleSheetName: 'Página1', googleSheetRowData: '["{{col1}}", "{{col2}}"]',
      instanceName: '', phoneNumber: '', textMessage: 'Olá de NexusFlow!', mediaUrl: '', mediaType: 'image', caption: '', groupName: 'Novo Grupo', participants: '',
      aiPromptText: 'Escreva um poema sobre {{tema}}', aiModelName: '', aiOutputVariable: 'texto_ia',
      agentName: 'Agente IA', agentSystemPrompt: 'Você é um assistente prestativo.',
      userInputVariable: '{{entrada_usuario_agente}}', agentResponseVariable: 'resposta_agente_ia', maxConversationTurns: 5, temperature: 0.7,
      supabaseTableName: '', supabaseIdentifierColumn: 'id', supabaseIdentifierValue: '{{id_registro}}', supabaseDataJson: '{ "coluna": "valor" }', supabaseColumnsToSelect: '*', supabaseResultVariable: 'dados_supabase',
    };

    const newNode: NodeData = {
      id: uuidv4(),
      type: item.type as NodeData['type'],
      title: item.label,
      ...baseNodeData, 
      ...(item.type === 'start' && !itemDefaultDataCopy.triggers && { triggers: [{ id: uuidv4(), name: 'Manual', type: 'manual', enabled: true }, { id: uuidv4(), name: 'Webhook', type: 'webhook', enabled: false, variableMappings: [], sessionTimeoutSeconds: 0 }] }),
      ...itemDefaultDataCopy, 
      x: Math.round((logicalDropCoords.x - NODE_WIDTH / 2) / GRID_SIZE) * GRID_SIZE, 
      y: Math.round((logicalDropCoords.y - NODE_HEADER_HEIGHT_APPROX / 2) / GRID_SIZE) * GRID_SIZE, 
    };
    
    updateActiveWorkspace(ws => {
      const updatedNodes = [...(ws.nodes || []), newNode]; 
      return { ...ws, nodes: updatedNodes };
    });
  }, [activeWorkspace, updateActiveWorkspace, availableVariablesByNode]);

  const updateNode = useCallback((id: string, changes: Partial<NodeData>) => {
    updateActiveWorkspace(ws => ({
      ...ws,
      nodes: (ws.nodes || []).map(n => (n.id === id ? { ...n, ...changes } : n)),
    }));
  }, [updateActiveWorkspace]);

  const deleteNode = useCallback((nodeIdToDelete: string) => {
    updateActiveWorkspace(ws => ({
      ...ws,
      nodes: (ws.nodes || []).filter(node => node.id !== nodeIdToDelete),
      connections: (ws.connections || []).filter(conn => conn.from !== nodeIdToDelete && conn.to !== nodeIdToDelete),
    }));
  }, [updateActiveWorkspace]);

  const handleStartConnection = useCallback(
    (event: React.MouseEvent, fromNodeData: NodeData, sourceHandleId = 'default') => {
      if (!canvasRef.current) return;
      
      const currentCanvasOffset = canvasOffsetCbRef.current; 
      const currentZoomLevel = zoomLevelCbRef.current;     
      const canvasRect = canvasRef.current.getBoundingClientRect();

      let startYOffset = NODE_HEADER_CONNECTOR_Y_OFFSET; 
      if (fromNodeData.type === 'start' && Array.isArray(fromNodeData.triggers) && sourceHandleId) {
          const triggerIndex = fromNodeData.triggers.findIndex(t => t.name === sourceHandleId);
          if (triggerIndex !== -1) {
              startYOffset = START_NODE_TRIGGER_INITIAL_Y_OFFSET + (triggerIndex * START_NODE_TRIGGER_SPACING_Y);
          }
      } else if (fromNodeData.type === 'option' && typeof fromNodeData.optionsList === 'string' && sourceHandleId) {
          const options = (fromNodeData.optionsList || '').split('\n').map(opt => opt.trim()).filter(opt => opt !== '');
          const optionIndex = options.indexOf(sourceHandleId);
          if (optionIndex !== -1) {
              startYOffset = OPTION_NODE_HANDLE_INITIAL_Y_OFFSET + (optionIndex * OPTION_NODE_HANDLE_SPACING_Y);
          }
      } else if (fromNodeData.type === 'condition') {
          if (sourceHandleId === 'true') startYOffset = NODE_HEADER_HEIGHT_APPROX * (1/3) + 6;
          else if (sourceHandleId === 'false') startYOffset = NODE_HEADER_HEIGHT_APPROX * (2/3) + 6;
      }

      const logicalStartX = fromNodeData.x + NODE_WIDTH; 
      const logicalStartY = fromNodeData.y + startYOffset; 
      
      const mouseXOnCanvasVisual = event.clientX - canvasRect.left;
      const mouseYOnCanvasVisual = event.clientY - canvasRect.top;

      const logicalCurrentX = (mouseXOnCanvasVisual - currentCanvasOffset.x) / currentZoomLevel;
      const logicalCurrentY = (mouseYOnCanvasVisual - currentCanvasOffset.y) / currentZoomLevel;
      
      setDrawingLine({
        fromId: fromNodeData.id,
        sourceHandleId,
        startX: logicalStartX,
        startY: logicalStartY,
        currentX: logicalCurrentX, 
        currentY: logicalCurrentY,
      });
    },
    [canvasRef, setDrawingLine, canvasOffsetCbRef, zoomLevelCbRef] 
  ); 

  const handleCanvasMouseDownForPanning = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (canvasRef.current && (e.target === canvasRef.current || (e.target as HTMLElement).id === 'flow-content-wrapper')) { 
      isPanning.current = true;
      panStartMousePosition.current = { x: e.clientX, y: e.clientY };
      initialCanvasOffsetOnPanStart.current = { ...canvasOffsetCbRef.current };
      if (canvasRef.current) canvasRef.current.style.cursor = 'grabbing';
      setHighlightedNodeIdBySession(null); 
    }
  }, [canvasRef, canvasOffsetCbRef]); 

  const handleGlobalMouseMove = useCallback((e: MouseEvent) => {
    if (isPanning.current) {
      const dx = e.clientX - panStartMousePosition.current.x;
      const dy = e.clientY - panStartMousePosition.current.y;
      setCanvasOffset({
        x: initialCanvasOffsetOnPanStart.current.x + dx,
        y: initialCanvasOffsetOnPanStart.current.y + dy,
      });
    } else if (drawingLine && canvasRef.current) {
      const canvasRect = canvasRef.current.getBoundingClientRect();
      const currentCanvasOffset = canvasOffsetCbRef.current;
      const currentZoomLevel = zoomLevelCbRef.current;
      
      const mouseXOnCanvasVisual = e.clientX - canvasRect.left;
      const mouseYOnCanvasVisual = e.clientY - canvasRect.top;

      const logicalCurrentX = (mouseXOnCanvasVisual - currentCanvasOffset.x) / currentZoomLevel;
      const logicalCurrentY = (mouseYOnCanvasVisual - currentCanvasOffset.y) / currentZoomLevel;

      setDrawingLine((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          currentX: logicalCurrentX, 
          currentY: logicalCurrentY,
        };
      });
    }
  }, [drawingLine, setDrawingLine, setCanvasOffset, canvasRef, canvasOffsetCbRef, zoomLevelCbRef]); 

  const handleGlobalMouseUp = useCallback((e: MouseEvent) => {
    if (isPanning.current) {
      isPanning.current = false;
      if (canvasRef.current) canvasRef.current.style.cursor = 'grab'; 
    } else if (drawingLine) {
      const targetElement = document.elementFromPoint(e.clientX, e.clientY);
      const targetHandleElement = targetElement?.closest('[data-handle-type="target"]');
      const targetNodeElement = targetElement?.closest('[data-node-id]');
      
      let toId = null;
      if (targetHandleElement) {
          toId = targetHandleElement.closest('[data-node-id]')?.getAttribute('data-node-id');
      } else if (targetNodeElement && !targetNodeElement.closest('[data-connector="true"]')) { 
          toId = targetNodeElement.getAttribute('data-node-id');
      }

      if (toId && drawingLine.fromId !== toId) {
        updateActiveWorkspace(ws => {
            let newConnectionsArray = [...(ws.connections || [])]; 
            const newConnection: Connection = {
                id: uuidv4(),
                from: drawingLine.fromId,
                to: toId as string,
                sourceHandle: drawingLine.sourceHandleId, 
            };

            const isDuplicate = newConnectionsArray.some(
                c => c.from === newConnection.from && 
                     c.to === newConnection.to && 
                     c.sourceHandle === newConnection.sourceHandle
            );

            const existingConnectionFromThisSourceHandle = newConnectionsArray.find(
                c => c.from === newConnection.from && c.sourceHandle === newConnection.sourceHandle
            );

            if (isDuplicate) {
                // Duplicate connection prevented
            } else if (existingConnectionFromThisSourceHandle) {
                newConnectionsArray = newConnectionsArray.filter(c => c.id !== existingConnectionFromThisSourceHandle.id);
                newConnectionsArray.push(newConnection);
            } else {
                newConnectionsArray.push(newConnection);
            }
            return { ...ws, connections: newConnectionsArray };
        });
      }
      setDrawingLine(null);
    }
  }, [drawingLine, updateActiveWorkspace, setDrawingLine, canvasRef]); 

  const deleteConnection = useCallback((connectionId: string) => {
    updateActiveWorkspace(ws => ({
      ...ws,
      connections: (ws.connections || []).filter(conn => conn.id !== connectionId)
    }));
  }, [updateActiveWorkspace]);

  useEffect(() => {
    if (!hasMounted) return;
    
    document.addEventListener('mousemove', handleGlobalMouseMove);
    document.addEventListener('mouseup', handleGlobalMouseUp);
    
    const handleMouseLeaveWindow = () => {
      if (isPanning.current) {
        isPanning.current = false;
        if (canvasRef.current) canvasRef.current.style.cursor = 'grab';
      }
      if (drawingLine) {
        setDrawingLine(null);
      }
    };
    document.body.addEventListener('mouseleave', handleMouseLeaveWindow);

    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
      document.body.removeEventListener('mouseleave', handleMouseLeaveWindow);
    };
  }, [handleGlobalMouseMove, handleGlobalMouseUp, drawingLine, hasMounted, canvasRef, setDrawingLine]);
  

  const handleZoom = useCallback((direction: 'in' | 'out' | 'reset') => {
    if (!canvasRef.current) {
        console.warn("[FlowBuilderClient] handleZoom: canvasRef.current is null.");
        return; 
    }

    const currentZoom = zoomLevelCbRef.current;
    const currentOffset = canvasOffsetCbRef.current;
    const canvasRect = canvasRef.current.getBoundingClientRect(); 
    
    const viewportCenterX = canvasRect.width / 2;
    const viewportCenterY = canvasRect.height / 2;

    let newZoomLevel: number;

    if (direction === 'reset') {
      newZoomLevel = 1;
    } else {
      const zoomFactor = direction === 'in' ? 1 + ZOOM_STEP : 1 - ZOOM_STEP;
      newZoomLevel = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, currentZoom * zoomFactor));
    }

    if (newZoomLevel === currentZoom && direction !== 'reset') return;

    const logicalCenterXBeforeZoom = (viewportCenterX - currentOffset.x) / currentZoom;
    const logicalCenterYBeforeZoom = (viewportCenterY - currentOffset.y) / currentZoom;

    const visualXOfLogicalCenterAfterZoom = logicalCenterXBeforeZoom * newZoomLevel;
    const visualYOfLogicalCenterAfterZoom = logicalCenterYBeforeZoom * newZoomLevel;
    
    const newOffsetX = viewportCenterX - visualXOfLogicalCenterAfterZoom;
    const newOffsetY = viewportCenterY - visualYOfLogicalCenterAfterZoom;
    
    setZoomLevel(newZoomLevel);
    setCanvasOffset({ x: newOffsetX, y: newOffsetY });

  }, [setZoomLevel, setCanvasOffset, canvasRef, zoomLevelCbRef, canvasOffsetCbRef]); 

  const handleHighlightNodeInFlow = useCallback((nodeId: string | null) => {
    setHighlightedNodeIdBySession(nodeId);
  }, []);

  const handleUpdateWorkspace = useCallback((newSettings: Partial<WorkspaceData>) => {
      setActiveWorkspace(prev => {
        if (!prev) return null;
        return { ...prev, ...newSettings };
      });
  }, []);


  if (isLoading) {
    return (
        <div className="flex h-screen w-full items-center justify-center bg-muted/20">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="ml-4 text-lg text-muted-foreground">Carregando seu fluxo...</p>
        </div>
    );
  }

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="flex flex-col h-screen bg-background font-sans select-none overflow-hidden">
        <TopBar
          workspaceName={activeWorkspace?.name || 'Carregando...'}
          onSaveWorkspaces={handleSaveWorkspace}
          onDiscardChanges={handleDiscardChanges}
          onUpdateWorkspace={handleUpdateWorkspace}
          isChatPanelOpen={isChatPanelOpen}
          onToggleChatPanel={toggleChatPanel}
          onZoom={handleZoom}
          currentZoomLevel={zoomLevel}
          onHighlightNode={handleHighlightNodeInFlow}
          activeWorkspace={activeWorkspace}
        />
        <div className="flex-1 flex relative overflow-hidden">
          <FlowSidebar />
          <div className="flex-1 flex relative overflow-hidden" >
            <Canvas
              ref={canvasRef} 
              nodes={currentNodes}
              connections={currentConnections}
              drawingLine={drawingLine}
              canvasOffset={canvasOffset}
              zoomLevel={zoomLevel}
              onDropNode={handleDropNode}
              onUpdateNode={updateNode}
              onStartConnection={handleStartConnection}
              onDeleteNode={deleteNode}
              onDeleteConnection={deleteConnection}
              onCanvasMouseDown={handleCanvasMouseDownForPanning}
              highlightedConnectionId={highlightedConnectionId}
              setHighlightedConnectionId={setHighlightedConnectionId}
              availableVariablesByNode={availableVariablesByNode}
              highlightedNodeIdBySession={highlightedNodeIdBySession}
              activeWorkspace={activeWorkspace}
            />
          </div>
          {hasMounted && isChatPanelOpen && (
            <TestChatPanel
              activeWorkspace={activeWorkspace}
            />
          )}
        </div>
      </div>
    </DndProvider>
  );
}
