

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
 * Agora é mais estrito, só adiciona se o campo existir e não for uma string vazia.
 */
const sanitizeVariableName = (value: string | undefined): string | null => {
  if (!value || typeof value !== 'string') return null;
  const cleaned = value.replace(/\{\{/g, '').replace(/\}\}/g, '').trim();
  return cleaned || null;
};

function getVariablesFromNode(node: NodeData): string[] {
  const variables: string[] = [];

  for (const field of VARIABLE_DEFINING_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(node, field)) {
      const varName = sanitizeVariableName(node[field] as string | undefined);
      if (varName) {
        variables.push(varName);
      }
    }
  }

  if (node.type === 'start' && Array.isArray(node.triggers)) {
    for (const trigger of node.triggers) {
      if (trigger.type === 'webhook' && Array.isArray(trigger.variableMappings)) {
        for (const mapping of trigger.variableMappings) {
          const varName = sanitizeVariableName(mapping.flowVariable);
          if (varName) {
            variables.push(varName);
          }
        }
      }
    }
  }

  if (node.type === 'api-call' && Array.isArray(node.apiResponseMappings)) {
    for (const mapping of node.apiResponseMappings) {
      const varName = sanitizeVariableName(mapping.flowVariable);
      if (varName) {
        variables.push(varName);
      }
    }
  }
  return variables;
}

const computeBaseVariables = (workspace?: WorkspaceData | null): string[] => {
  const vars = ['session_id', 'mensagem_whatsapp', 'webhook_payload'];
  if (workspace?.chatwoot_enabled) {
    vars.push(...CHATWOOT_PREFILLED_VARIABLES);
  }
  return vars;
};

const computeVariablesScope = (workspace: WorkspaceData, baseVars: string[]): Record<string, string[]> => {
  const scoped: Record<string, string[]> = {};
  if (!workspace?.nodes || !workspace.connections) return scoped;
  const ancestorMemo = new Map<string, NodeData[]>();

  for (const node of workspace.nodes) {
    const ancestors = getAncestorsForNode(node.id, workspace.nodes, workspace.connections, ancestorMemo);
    const ancestorVars = ancestors.flatMap(getVariablesFromNode);
    const nodeVars = getVariablesFromNode(node);
    const uniqueVars = Array.from(new Set([...baseVars, ...ancestorVars, ...nodeVars])).sort();
    scoped[node.id] = uniqueVars;
  }

  return scoped;
};

/**
 * Encontra todos os nós ancestrais para um nó específico, navegando para trás no fluxo.
 * Utiliza busca em largura (BFS) para evitar recursão infinita em loops.
 * A versão corrigida garante que a travessia seja mais eficiente e precisa.
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
  const queue: string[] = [nodeId];
  const visited = new Set<string>(); // Visitados agora controla o que já foi totalmente processado

  // O nó inicial não tem ancestrais dentro do fluxo, então podemos parar se chegarmos nele na busca.
  const startNodes = new Set(nodes.filter(n => n.type === 'start').map(n => n.id));


  while (queue.length > 0) {
    const currentId = queue.shift()!;

    if (visited.has(currentId) || startNodes.has(currentId)) {
      continue;
    }
    visited.add(currentId);

    const incomingConnections = connections.filter(c => c.to === currentId);

    for (const conn of incomingConnections) {
      const parentId = conn.from;
      const parentNode = nodesMap.get(parentId);

      if (parentNode) {
        if (!ancestors.has(parentId)) {
          ancestors.set(parentId, parentNode);
        }
        queue.push(parentId);
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

// **NOVA FUNÇÃO** para limpar dados de nós de fluxos antigos
function cleanLoadedWorkspace(workspace: WorkspaceData): WorkspaceData {
  const cleanedNodes = workspace.nodes.map(node => {
    const newNode = { ...node };
    for (const field of VARIABLE_DEFINING_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(newNode, field)) {
        const value = newNode[field];
        if (value === '' || value === null || value === undefined) {
          delete newNode[field];
        }
      }
    }
    return newNode;
  });

  return { ...workspace, nodes: cleanedNodes };
}


interface FlowBuilderClientProps {
  workspaceId: string;
  user: User;
  initialWorkspace: WorkspaceData | null;
}

export default function FlowBuilderClient({ workspaceId, user, initialWorkspace }: FlowBuilderClientProps) {
  const { toast } = useToast();
  const router = useRouter();

  // Limpa o workspace inicial antes de colocá-lo no estado
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceData | null>(
    initialWorkspace ? cleanLoadedWorkspace(initialWorkspace) : null
  );
  const [isLoading, setIsLoading] = useState(!initialWorkspace);

  const [drawingLine, setDrawingLine] = useState<DrawingLineData | null>(null);
  const drawingLineRef = useRef(drawingLine);

  const [highlightedConnectionId, setHighlightedConnectionId] = useState<string | null>(null);
  const [highlightedNodeIdBySession, setHighlightedNodeIdBySession] = useState<string | null>(null);

  // Selection State
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);

  const [canvasOffset, setCanvasOffset] = useState<CanvasOffset>({ x: GRID_SIZE * 2, y: GRID_SIZE * 2 });
  const [zoomLevel, setZoomLevel] = useState(1);

  const isPanning = useRef(false);
  const isDraggingNode = useRef(false);
  const draggedNodeId = useRef<string | null>(null);
  const dragStartMousePosition = useRef({ x: 0, y: 0 });
  const initialNodePosition = useRef({ x: 0, y: 0 });

  const panStartMousePosition = useRef({ x: 0, y: 0 });
  const initialCanvasOffsetOnPanStart = useRef<CanvasOffset>({ x: 0, y: 0 });

  const canvasRef = useRef<HTMLDivElement>(null);

  const canvasOffsetCbRef = useRef(canvasOffset);
  const zoomLevelCbRef = useRef(zoomLevel);

  const [isChatPanelOpen, setIsChatPanelOpen] = useState(true);
  const [hasMounted, setHasMounted] = useState(false);

  const [availableVariablesByNode, setAvailableVariablesByNode] = useState<Record<string, string[]>>(() => {
    if (initialWorkspace) {
      const cleaned = cleanLoadedWorkspace(initialWorkspace);
      const base = computeBaseVariables(cleaned);
      return computeVariablesScope(cleaned, base);
    }
    return {};
  });

  useEffect(() => {
    drawingLineRef.current = drawingLine;
  }, [drawingLine]);

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

  // Removed redundant useEffect to prevent double variable scope calculation
  // Variable scope is now managed by updateActiveWorkspace and loadWorkspace



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
        // Limpa os dados do workspace carregado antes de setar no estado
        const cleanedWs = cleanLoadedWorkspace(dbWorkspace);
        setActiveWorkspace(cleanedWs);

        // Initial variable calculation
        const baseVars = computeBaseVariables(cleanedWs);
        const scopedVars = computeVariablesScope(cleanedWs, baseVars);
        setAvailableVariablesByNode(scopedVars);
      } else {
        toast({ title: "Erro de Carregamento", description: "O fluxo solicitado não foi encontrado.", variant: "destructive" });
        router.push('/');
      }
    } catch (error: any) {
      console.error(`[FlowBuilderClient] Failed to load workspace ${workspaceId} from DB:`, error);
      toast({ title: "Erro de Carregamento", description: "Não foi possível carregar o fluxo do banco de dados.", variant: "destructive" });
      router.push('/');
    }
    setIsLoading(false);
  }, [user, workspaceId, toast, router]);


  useEffect(() => {
    if (workspaceId && hasMounted) {
      // O workspace inicial já foi limpo ao setar o estado inicial.
      // Apenas carregamos se o estado inicial for nulo.
      if (!activeWorkspace) {
        loadWorkspace();
      }
    }
  }, [workspaceId, hasMounted, loadWorkspace, activeWorkspace]);

  const handleSaveWorkspace = useCallback(async (versionDescription?: string | null) => {
    if (!activeWorkspace || !user) {
      console.warn("[FlowBuilderClient] No active workspace or user to save.");
      toast({ title: "Aviso", description: "Nenhum fluxo ativo ou usuário para salvar.", variant: "default" });
      return;
    }
    console.log(`[FlowBuilderClient] Saving workspace ${activeWorkspace.id} to DB...`);
    const result = await saveWorkspaceToDB(activeWorkspace, user.id, versionDescription);
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
  }, [activeWorkspace, user, toast]);


  const handleDiscardChanges = useCallback(async () => {
    toast({
      title: "Descartando Alterações...",
      description: "Recarregando fluxo do banco de dados.",
    });
    await loadWorkspace();
    setHighlightedNodeIdBySession(null);
  }, [loadWorkspace, toast]);

  const updateActiveWorkspace = useCallback((updater: (workspace: WorkspaceData) => WorkspaceData, skipVarRecalc: boolean = false) => {
    setActiveWorkspace(prevWorkspace => {
      if (!prevWorkspace) {
        console.warn('[FlowBuilderClient] updateActiveWorkspace called but no activeWorkspace.');
        return null;
      }
      const nextWorkspace = updater(prevWorkspace);

      if (!skipVarRecalc) {
        const baseVars = computeBaseVariables(nextWorkspace);
        const newVarsByNode = computeVariablesScope(nextWorkspace, baseVars);
        setAvailableVariablesByNode(newVarsByNode);
      }

      return nextWorkspace;
    });
  }, []);

  const handleDropNode = useCallback((item: DraggableBlockItemData, logicalDropCoords: { x: number, y: number }) => {
    let tempExistingVars: string[] = [];
    if (activeWorkspace?.nodes) {
      const baseVars = computeBaseVariables(activeWorkspace);
      tempExistingVars = Array.from(
        new Set([
          ...baseVars,
          ...activeWorkspace.nodes.flatMap(n => getVariablesFromNode(n)),
        ])
      );
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
              const baseName = mapping.flowVariable.replace(/\{\{/g, '').replace(/\}\}/g, '').trim();
              const uniqueWebhookVarName = generateUniqueVariableName(baseName, tempExistingVars);
              if (uniqueWebhookVarName !== baseName) {
                tempExistingVars.push(uniqueWebhookVarName);
              }
              return { ...mapping, flowVariable: uniqueWebhookVarName };
            }
            return mapping;
          });
        }
        return trigger;
      });
    }

    const newNode: NodeData = {
      id: uuidv4(),
      type: item.type as NodeData['type'],
      title: item.label,
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
    const isPositionOnly = Object.keys(changes).every(key => key === 'x' || key === 'y');
    updateActiveWorkspace(ws => ({
      ...ws,
      nodes: (ws.nodes || []).map(n => (n.id === id ? { ...n, ...changes } : n)),
    }), isPositionOnly);
  }, [updateActiveWorkspace]);

  const deleteNode = useCallback((nodeIdToDelete: string) => {
    updateActiveWorkspace(ws => ({
      ...ws,
      nodes: (ws.nodes || []).filter(node => node.id !== nodeIdToDelete),
      connections: (ws.connections || []).filter(conn => conn.from !== nodeIdToDelete && conn.to !== nodeIdToDelete),
    }));
  }, [updateActiveWorkspace]);

  const duplicateNode = useCallback((nodeIdToDuplicate: string) => {
    updateActiveWorkspace(ws => {
      const nodes = ws.nodes || [];
      const nodeToCopy = nodes.find(node => node.id === nodeIdToDuplicate);
      if (!nodeToCopy) return ws;

      const clonedNode: NodeData = JSON.parse(JSON.stringify(nodeToCopy));
      clonedNode.id = uuidv4();
      const offset = GRID_SIZE * 2;
      const baseX = typeof clonedNode.x === 'number' ? clonedNode.x : 0;
      const baseY = typeof clonedNode.y === 'number' ? clonedNode.y : 0;
      clonedNode.x = baseX + offset;
      clonedNode.y = baseY + offset;

      return {
        ...ws,
        nodes: [...nodes, clonedNode],
      };
    });
  }, [updateActiveWorkspace]);

  const handleStartConnection = useCallback(
    (event: React.MouseEvent, fromNodeData: NodeData, sourceHandleId?: string) => {
      if (!canvasRef.current) return;

      const connectorElement = event.currentTarget as HTMLElement;
      const connectorRect = connectorElement.getBoundingClientRect();
      const canvasRect = canvasRef.current.getBoundingClientRect();

      const currentZoom = zoomLevelCbRef.current;
      const currentOffset = canvasOffsetCbRef.current;

      // Calculate the connector's center relative to the canvas viewport
      const startXVisual = connectorRect.left - canvasRect.left + connectorRect.width / 2;
      const startYVisual = connectorRect.top - canvasRect.top + connectorRect.height / 2;

      // Convert visual canvas coordinates to logical flow coordinates
      const logicalStartX = (startXVisual - currentOffset.x) / currentZoom;
      const logicalStartY = (startYVisual - currentOffset.y) / currentZoom;

      // The current mouse position is already in visual coordinates relative to the viewport
      const mouseXVisual = event.clientX - canvasRect.left;
      const mouseYVisual = event.clientY - canvasRect.top;

      // Convert mouse position to logical coordinates for the end of the line
      const logicalCurrentX = (mouseXVisual - currentOffset.x) / currentZoom;
      const logicalCurrentY = (mouseYVisual - currentOffset.y) / currentZoom;

      setDrawingLine({
        fromId: fromNodeData.id,
        sourceHandleId: sourceHandleId || '',
        startX: logicalStartX,
        startY: logicalStartY,
        currentX: logicalCurrentX,
        currentY: logicalCurrentY,
      });
    },
    []
  );

  const handleCanvasMouseDownForPanning = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    // Only pan if clicking strictly on the canvas background/wrapper, not on nodes
    if (canvasRef.current && (e.target === canvasRef.current || (e.target as HTMLElement).id === 'flow-content-wrapper')) {
      isPanning.current = true;
      panStartMousePosition.current = { x: e.clientX, y: e.clientY };
      initialCanvasOffsetOnPanStart.current = { ...canvasOffsetCbRef.current };
      if (canvasRef.current) canvasRef.current.style.cursor = 'grabbing';
      setHighlightedNodeIdBySession(null);
      // Clear selection when clicking canvas
      setSelectedNodeIds([]);
    }
  }, []);

  const handleNodeDragStart = useCallback((e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    isDraggingNode.current = true;
    draggedNodeId.current = nodeId;
    dragStartMousePosition.current = { x: e.clientX, y: e.clientY };

    // Find initial position
    const node = activeWorkspace?.nodes.find(n => n.id === nodeId);
    if (node) {
      initialNodePosition.current = { x: node.x, y: node.y };
    }
  }, [activeWorkspace]);

  const handleSelectNode = useCallback((id: string, shiftKey: boolean) => {
    setSelectedNodeIds(prev => {
      if (shiftKey) {
        return prev.includes(id) ? prev.filter(nid => nid !== id) : [...prev, id];
      }
      return [id];
    });
  }, []);

  const handleUpdateNodePosition = useCallback((id: string, x: number, y: number) => {
    updateNode(id, { x, y });
  }, [updateNode]);

  const handleGlobalMouseMove = useCallback((e: MouseEvent) => {
    if (isPanning.current) {
      const dx = e.clientX - panStartMousePosition.current.x;
      const dy = e.clientY - panStartMousePosition.current.y;
      setCanvasOffset({
        x: initialCanvasOffsetOnPanStart.current.x + dx,
        y: initialCanvasOffsetOnPanStart.current.y + dy,
      });
    } else if (isDraggingNode.current && draggedNodeId.current) {
      const dx = (e.clientX - dragStartMousePosition.current.x) / zoomLevelCbRef.current;
      const dy = (e.clientY - dragStartMousePosition.current.y) / zoomLevelCbRef.current;

      const newX = Math.round((initialNodePosition.current.x + dx) / GRID_SIZE) * GRID_SIZE;
      const newY = Math.round((initialNodePosition.current.y + dy) / GRID_SIZE) * GRID_SIZE;

      updateNode(draggedNodeId.current, { x: newX, y: newY });

    } else if (drawingLineRef.current && canvasRef.current) {
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
  }, [updateNode]);

  const handleGlobalMouseUp = useCallback((e: MouseEvent) => {
    if (isPanning.current) {
      isPanning.current = false;
      if (canvasRef.current) canvasRef.current.style.cursor = 'grab';
    } else if (isDraggingNode.current) {
      isDraggingNode.current = false;
      draggedNodeId.current = null;
    } else if (drawingLineRef.current) {
      const targetElement = document.elementFromPoint(e.clientX, e.clientY);
      const targetHandleElement = targetElement?.closest('[data-handle-type="target"]');
      const targetNodeElement = targetElement?.closest('[data-node-id]');

      let toId = null;
      if (targetHandleElement) {
        toId = targetHandleElement.closest('[data-node-id]')?.getAttribute('data-node-id');
      } else if (targetNodeElement && !targetNodeElement.closest('[data-connector="true"]')) {
        toId = targetNodeElement.getAttribute('data-node-id');
      }

      if (toId && drawingLineRef.current.fromId !== toId) {
        updateActiveWorkspace(ws => {
          let newConnectionsArray = [...(ws.connections || [])];
          const newConnection: Connection = {
            id: uuidv4(),
            from: drawingLineRef.current!.fromId,
            to: toId as string,
            sourceHandle: drawingLineRef.current!.sourceHandleId,
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
  }, [updateActiveWorkspace]);

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
      if (drawingLineRef.current) {
        setDrawingLine(null);
      }
    };
    document.body.addEventListener('mouseleave', handleMouseLeaveWindow);

    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
      document.body.removeEventListener('mouseleave', handleMouseLeaveWindow);
    };
  }, [handleGlobalMouseMove, handleGlobalMouseUp, hasMounted]);


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

  }, []);

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
              onDuplicateNode={duplicateNode}
              onDeleteConnection={deleteConnection}
              onCanvasMouseDown={handleCanvasMouseDownForPanning}
              highlightedConnectionId={highlightedConnectionId}
              setHighlightedConnectionId={setHighlightedConnectionId}
              availableVariablesByNode={availableVariablesByNode}
              highlightedNodeIdBySession={highlightedNodeIdBySession}
              activeWorkspace={activeWorkspace}
              selectedNodeIds={selectedNodeIds}
              onSelectNode={handleSelectNode}
              onNodeDragStart={handleNodeDragStart}
              onUpdatePosition={handleUpdateNodePosition}
              onEndConnection={(e: React.MouseEvent, node: NodeData) => { /* Handle connection end if needed logic here, mostly handled by mouseUp global */ }}
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
