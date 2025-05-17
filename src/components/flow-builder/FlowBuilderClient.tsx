
"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { NodeData, Connection, DrawingLineData, CanvasOffset, DraggableBlockItemData, WorkspaceData } from '@/lib/types';
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

const LOCAL_STORAGE_KEY_WORKSPACES = 'flowiseLiteWorkspaces';
const LOCAL_STORAGE_KEY_ACTIVE_WORKSPACE = 'flowiseLiteActiveWorkspace';
const LOCAL_STORAGE_KEY_CHAT_PANEL_OPEN = 'flowiseLiteChatPanelOpen';

// Helper function to generate unique variable names
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

const VARIABLE_DEFINING_FIELDS: (keyof NodeData)[] = [
  'variableToSaveResponse',
  'variableToSaveChoice',
  'variableName',
  'apiOutputVariable',
  'variableToSaveDate',
  'codeOutputVariable',
  'jsonOutputVariable',
  'fileUrlVariable',
  'ratingOutputVariable',
  'aiOutputVariable',
  'agentResponseVariable',
  'supabaseResultVariable',
];


export default function FlowBuilderClient() {
  const { toast } = useToast();
  const [workspaces, setWorkspaces] = useState<WorkspaceData[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  
  const [drawingLine, setDrawingLine] = useState<DrawingLineData | null>(null);
  const [highlightedConnectionId, setHighlightedConnectionId] = useState<string | null>(null);

  const [canvasOffset, setCanvasOffset] = useState<CanvasOffset>({ x: GRID_SIZE * 2, y: GRID_SIZE * 2 });
  const [zoomLevel, setZoomLevel] = useState(1);
  
  const isPanning = useRef(false);
  const panStartMousePosition = useRef({ x: 0, y: 0 });
  const initialCanvasOffsetOnPanStart = useRef({ x: 0, y: 0 });
  
  const canvasRef = useRef<HTMLDivElement>(null);

  const [isChatPanelOpen, setIsChatPanelOpen] = useState(true);
  const [hasMounted, setHasMounted] = useState(false);
  const [definedVariablesInFlow, setDefinedVariablesInFlow] = useState<string[]>([]);

  // Refs for stable callbacks that depend on canvasOffset or zoomLevel
  const canvasOffsetCbRef = useRef(canvasOffset);
  const zoomLevelCbRef = useRef(zoomLevel);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    canvasOffsetCbRef.current = canvasOffset;
  }, [canvasOffset]);

  useEffect(() => {
    zoomLevelCbRef.current = zoomLevel;
  }, [zoomLevel]);

  const activeWorkspace = workspaces.find(ws => ws.id === activeWorkspaceId);
  const currentNodes = activeWorkspace ? activeWorkspace.nodes : [];
  const currentConnections = activeWorkspace ? activeWorkspace.connections : [];

  useEffect(() => {
    if (activeWorkspace?.nodes) {
      const variables: Set<string> = new Set();
      activeWorkspace.nodes.forEach(n => {
        VARIABLE_DEFINING_FIELDS.forEach(field => {
          const varName = n[field] as string | undefined;
          if (varName && varName.trim() !== '') {
            variables.add(varName.trim().replace(/\{\{/g, '').replace(/\}\}/g, ''));
          }
        });
         if (n.type === 'start' && n.triggers) {
          n.triggers.forEach(trigger => {
            if (trigger.type === 'webhook' && trigger.webhookPayloadVariable) {
              variables.add(trigger.webhookPayloadVariable.replace(/\{\{/g, '').replace(/\}\}/g, ''));
            }
          });
        }
      });
      
      setDefinedVariablesInFlow(prevDefinedVars => {
        const newVarsArray = Array.from(variables).sort();
        if (JSON.stringify(prevDefinedVars) === JSON.stringify(newVarsArray)) {
          return prevDefinedVars; 
        }
        return newVarsArray; 
      });

    } else {
       setDefinedVariablesInFlow(prevDefinedVars => {
        if (prevDefinedVars.length === 0) return prevDefinedVars;
        return [];
      });
    }
  }, [activeWorkspace?.nodes]);


  useEffect(() => {
    if (!hasMounted) return; 

    const savedIsChatPanelOpen = localStorage.getItem(LOCAL_STORAGE_KEY_CHAT_PANEL_OPEN);
    if (savedIsChatPanelOpen !== null) {
      try {
        setIsChatPanelOpen(JSON.parse(savedIsChatPanelOpen));
      } catch (e) {
        console.warn("[FlowBuilderClient] Failed to parse chat panel state from localStorage.", e);
        setIsChatPanelOpen(true); 
      }
    }
  }, [hasMounted]);

  const toggleChatPanel = useCallback(() => {
    setIsChatPanelOpen(prev => {
      const newState = !prev;
      if (hasMounted) { 
        localStorage.setItem(LOCAL_STORAGE_KEY_CHAT_PANEL_OPEN, JSON.stringify(newState));
      }
      return newState;
    });
  }, [hasMounted]);


  useEffect(() => {
    if (!hasMounted) return;
    const savedWorkspacesStr = localStorage.getItem(LOCAL_STORAGE_KEY_WORKSPACES);
    let loadedWorkspaces: WorkspaceData[] = [];

    if (savedWorkspacesStr) {
      try {
        const parsedData = JSON.parse(savedWorkspacesStr);
        if (Array.isArray(parsedData) && 
            parsedData.every(ws => 
              typeof ws === 'object' && ws !== null &&
              typeof ws.id === 'string' &&
              typeof ws.name === 'string' &&
              Array.isArray(ws.nodes) && 
              Array.isArray(ws.connections)
            )
        ) {
          loadedWorkspaces = parsedData;
        } else {
          console.warn("[FlowBuilderClient] Loaded workspaces from localStorage is not a valid WorkspaceData[] array or has invalid structure. Resetting.");
          loadedWorkspaces = [];
          localStorage.removeItem(LOCAL_STORAGE_KEY_WORKSPACES);
          localStorage.removeItem(LOCAL_STORAGE_KEY_ACTIVE_WORKSPACE);
        }
      } catch (e) {
        console.error("[FlowBuilderClient] Failed to parse workspaces from localStorage. Resetting.", e);
        loadedWorkspaces = [];
        localStorage.removeItem(LOCAL_STORAGE_KEY_WORKSPACES);
        localStorage.removeItem(LOCAL_STORAGE_KEY_ACTIVE_WORKSPACE);
      }
    }

    if (loadedWorkspaces.length > 0) {
      setWorkspaces(loadedWorkspaces);
      const savedActiveId = localStorage.getItem(LOCAL_STORAGE_KEY_ACTIVE_WORKSPACE);
      if (savedActiveId && loadedWorkspaces.some(ws => ws.id === savedActiveId)) {
        setActiveWorkspaceId(savedActiveId);
      } else {
        setActiveWorkspaceId(loadedWorkspaces[0].id);
      }
    } else {
      const initialId = uuidv4();
      const initialWorkspace: WorkspaceData = {
        id: initialId,
        name: 'Meu Primeiro Fluxo',
        nodes: [],
        connections: [],
      };
      setWorkspaces([initialWorkspace]);
      setActiveWorkspaceId(initialId);
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY_WORKSPACES, JSON.stringify([initialWorkspace]));
        localStorage.setItem(LOCAL_STORAGE_KEY_ACTIVE_WORKSPACE, initialId);
      } catch (e) {
        console.error("[FlowBuilderClient] Failed to save initial workspace to localStorage", e);
      }
    }
  }, [hasMounted]);

  useEffect(() => {
    if (!hasMounted || !activeWorkspaceId) return;
    try {
        localStorage.setItem(LOCAL_STORAGE_KEY_ACTIVE_WORKSPACE, activeWorkspaceId);
    } catch (e) {
        console.error("[FlowBuilderClient] Failed to save active workspace ID to localStorage", e);
    }
  }, [activeWorkspaceId, hasMounted]);

  const handleSaveWorkspaces = useCallback(() => {
    if (!hasMounted) return;
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_WORKSPACES, JSON.stringify(workspaces));
      toast({
        title: "Sucesso!",
        description: "Todos os fluxos foram salvos.",
        variant: "default",
      });
    } catch (e) {
      console.error("[FlowBuilderClient] Failed to save workspaces to localStorage during explicit save", e);
      toast({
        title: "Erro ao Salvar!",
        description: "Não foi possível salvar os fluxos. Verifique o console para mais detalhes.",
        variant: "destructive",
      });
    }
  }, [workspaces, toast, hasMounted]);

  const handleDiscardChanges = useCallback(() => {
    if (!hasMounted) return;
    const savedWorkspacesStr = localStorage.getItem(LOCAL_STORAGE_KEY_WORKSPACES);
    if (savedWorkspacesStr) {
      try {
        const parsedData = JSON.parse(savedWorkspacesStr);
        if (Array.isArray(parsedData) && 
            parsedData.every(ws => 
              typeof ws === 'object' && ws !== null &&
              typeof ws.id === 'string' &&
              typeof ws.name === 'string' &&
              Array.isArray(ws.nodes) && 
              Array.isArray(ws.connections)
            )
        ) {
          setWorkspaces(parsedData);
          toast({
            title: "Alterações Descartadas",
            description: "Fluxos recarregados a partir do último salvamento.",
            variant: "default",
          });
          const currentActiveId = localStorage.getItem(LOCAL_STORAGE_KEY_ACTIVE_WORKSPACE);
          if (currentActiveId && parsedData.some(ws => ws.id === currentActiveId)) {
            setActiveWorkspaceId(currentActiveId);
          } else if (parsedData.length > 0) {
            setActiveWorkspaceId(parsedData[0].id);
          } else {
            setActiveWorkspaceId(null);
          }
        } else {
          console.warn("[FlowBuilderClient] (Discard) Loaded workspaces from localStorage is not valid. No changes made.");
          toast({
            title: "Atenção",
            description: "Não foi possível recarregar os fluxos do localStorage (dados inválidos).",
            variant: "destructive",
          });
        }
      } catch (e) {
        console.error("[FlowBuilderClient] (Discard) Failed to parse workspaces from localStorage.", e);
        toast({
          title: "Erro ao Descartar",
          description: "Não foi possível recarregar os fluxos. Verifique o console.",
          variant: "destructive",
        });
      }
    } else {
      toast({
        title: "Nenhum Dado Salvo",
        description: "Não há dados salvos no localStorage para reverter.",
        variant: "default",
      });
    }
  }, [toast, hasMounted]);


  const addWorkspace = useCallback(() => {
    const newWorkspaceId = uuidv4();
    const newWorkspace: WorkspaceData = {
      id: newWorkspaceId,
      name: `Novo Fluxo ${workspaces.length + 1}`,
      nodes: [],
      connections: [],
    };
    const updatedWorkspaces = [...workspaces, newWorkspace];
    setWorkspaces(updatedWorkspaces);
    setActiveWorkspaceId(newWorkspaceId);
    
    if (hasMounted) { 
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY_WORKSPACES, JSON.stringify(updatedWorkspaces));
        localStorage.setItem(LOCAL_STORAGE_KEY_ACTIVE_WORKSPACE, newWorkspaceId);
        toast({
          title: "Novo Fluxo Criado",
          description: `${newWorkspace.name} foi criado e salvo.`,
        });
      } catch (e) {
          console.error("[FlowBuilderClient] Failed to save new workspace to localStorage", e);
          toast({
            title: "Erro ao Salvar Novo Fluxo",
            description: "Não foi possível salvar o novo fluxo. Verifique o console.",
            variant: "destructive",
          });
      }
    }
  }, [workspaces, toast, hasMounted]);

  const switchWorkspace = useCallback((workspaceId: string) => {
    setActiveWorkspaceId(workspaceId);
  }, []);
  
  const updateActiveWorkspace = useCallback((updater: (workspace: WorkspaceData) => WorkspaceData) => {
    if (!activeWorkspaceId) {
        console.warn('[FlowBuilderClient] updateActiveWorkspace called but no activeWorkspaceId.');
        return;
    }
    setWorkspaces(prevWorkspaces =>
      prevWorkspaces.map(ws =>
        ws.id === activeWorkspaceId ? updater(ws) : ws
      )
    );
  }, [activeWorkspaceId]);

  const handleDropNode = useCallback((item: DraggableBlockItemData, logicalDropCoords: { x: number, y: number }) => {
    if (!activeWorkspaceId) {
      console.error('[FlowBuilderClient] No activeWorkspaceId, cannot add node.');
      return;
    }

    const currentWksp = workspaces.find(ws => ws.id === activeWorkspaceId); // Renomeado para evitar conflito
    const existingVariableNames: string[] = [];
    if (currentWksp) { // Usar a variável renomeada
      currentWksp.nodes.forEach(node => {
        VARIABLE_DEFINING_FIELDS.forEach(field => {
          const varName = node[field] as string | undefined;
          if (varName && varName.trim() !== '') {
            existingVariableNames.push(varName.trim().replace(/\{\{/g, '').replace(/\}\}/g, ''));
          }
        });
         if (node.type === 'start' && node.triggers) {
          node.triggers.forEach(trigger => {
            if (trigger.type === 'webhook' && trigger.webhookPayloadVariable) {
              existingVariableNames.push(trigger.webhookPayloadVariable.replace(/\{\{/g, '').replace(/\}\}/g, ''));
            }
          });
        }
      });
    }
    
    const itemDefaultDataCopy = item.defaultData ? { ...item.defaultData } : {};

    VARIABLE_DEFINING_FIELDS.forEach(field => {
      if (itemDefaultDataCopy.hasOwnProperty(field)) {
        const baseVarName = itemDefaultDataCopy[field] as string | undefined;
        if (baseVarName && baseVarName.trim() !== '') {
          const uniqueName = generateUniqueVariableName(baseVarName, existingVariableNames);
          (itemDefaultDataCopy as any)[field] = uniqueName;
          if (uniqueName !== baseVarName.replace(/\{\{/g, '').replace(/\}\}/g, '').trim()) { 
            existingVariableNames.push(uniqueName);
          }
        }
      }
    });

    const baseNodeData: Omit<NodeData, 'id' | 'type' | 'title' | 'x' | 'y'> = {
      text: '', promptText: '', inputType: 'text', variableToSaveResponse: '',
      questionText: '', optionsList: '', variableToSaveChoice: '',
      mediaDisplayType: 'image', mediaDisplayUrl: '', mediaDisplayText: '',
      conditionVariable: '', conditionOperator: '==', conditionValue: '',
      variableName: '', variableValue: '', delayDuration: 1000, typingDuration: 1500,
      logMessage: '', codeSnippet: '', codeOutputVariable: '', inputJson: '', jsonataExpression: '', jsonOutputVariable: '',
      uploadPromptText: '', fileTypeFilter: '', maxFileSizeMB: 5, fileUrlVariable: '',
      ratingQuestionText: '', maxRatingValue: 5, ratingIconType: 'star', ratingOutputVariable: '',
      apiUrl: '', 
      apiMethod: 'GET', 
      apiAuthType: 'none',
      apiAuthBearerToken: '',
      apiAuthBasicUser: '',
      apiAuthBasicPassword: '',
      apiHeadersList: [],
      apiQueryParamsList: [],
      apiBodyType: 'none',
      apiBodyJson: '{}',
      apiBodyFormDataList: [],
      apiBodyRaw: '',
      apiOutputVariable: '',
      redirectUrl: '', dateInputLabel: '', variableToSaveDate: '',
      emailTo: '', emailSubject: '', emailBody: '', emailFrom: '',
      googleSheetId: '', googleSheetName: '', googleSheetRowData: '',
      instanceName: 'evolution_instance', phoneNumber: '', textMessage: '', mediaUrl: '', mediaType: 'image', caption: '', groupName: '', participants: '',
      sendViaWhatsApp: false, whatsappTargetPhoneNumber: '',
      aiPromptText: '', aiModelName: '', aiOutputVariable: '',
      agentName: 'Agente Inteligente Padrão', agentSystemPrompt: 'Você é um assistente IA. Responda às perguntas do usuário de forma concisa e prestativa.',
      userInputVariable: '{{entrada_usuario}}', agentResponseVariable: 'resposta_do_agente', maxConversationTurns: 5, temperature: 0.7,
      triggers: [], 
      supabaseTableName: '', supabaseIdentifierColumn: '', supabaseIdentifierValue: '', supabaseDataJson: '', supabaseColumnsToSelect: '*', supabaseResultVariable: '',
    };

    const newNode: NodeData = {
      id: uuidv4(),
      type: item.type as NodeData['type'],
      title: item.label,
      ...baseNodeData, 
      ...itemDefaultDataCopy, 
      x: logicalDropCoords.x - NODE_WIDTH / 2, 
      y: logicalDropCoords.y - NODE_HEADER_HEIGHT_APPROX / 2, 
    };
    
    updateActiveWorkspace(ws => {
      const updatedNodes = [...ws.nodes, newNode];
      return { ...ws, nodes: updatedNodes };
    });
  }, [activeWorkspaceId, updateActiveWorkspace, workspaces]); // workspaces é necessário para existingVariableNames

  const updateNode = useCallback((id: string, changes: Partial<NodeData>) => {
    updateActiveWorkspace(ws => ({
      ...ws,
      nodes: ws.nodes.map(n => (n.id === id ? { ...n, ...changes } : n)),
    }));
  }, [updateActiveWorkspace]);

  const deleteNode = useCallback((nodeIdToDelete: string) => {
    updateActiveWorkspace(ws => ({
      ...ws,
      nodes: ws.nodes.filter(node => node.id !== nodeIdToDelete),
      connections: ws.connections.filter(conn => conn.from !== nodeIdToDelete && conn.to !== nodeIdToDelete),
    }));
  }, [updateActiveWorkspace]);

  const handleStartConnection = useCallback(
    (event: React.MouseEvent, fromNode: NodeData, sourceHandleId = 'default') => {
      if (!canvasRef.current) {
        console.warn('[FlowBuilderClient] handleStartConnection: canvasRef.current is null.');
        return;
      }
      const currentCanvasOffset = canvasOffsetCbRef.current; // Usa a ref
      const currentZoomLevel = zoomLevelCbRef.current;     // Usa a ref
      const canvasRect = canvasRef.current.getBoundingClientRect();

      let startYOffset = NODE_HEADER_CONNECTOR_Y_OFFSET; 
      if (fromNode.type === 'start' && fromNode.triggers && sourceHandleId) {
          const triggerIndex = fromNode.triggers.findIndex(t => t.name === sourceHandleId);
          if (triggerIndex !== -1) {
              startYOffset = START_NODE_TRIGGER_INITIAL_Y_OFFSET + (triggerIndex * START_NODE_TRIGGER_SPACING_Y);
          }
      } else if (fromNode.type === 'option' && fromNode.optionsList && sourceHandleId) {
          const options = (fromNode.optionsList || '').split('\n').map(opt => opt.trim()).filter(opt => opt !== '');
          const optionIndex = options.indexOf(sourceHandleId);
          if (optionIndex !== -1) {
              startYOffset = OPTION_NODE_HANDLE_INITIAL_Y_OFFSET + (optionIndex * OPTION_NODE_HANDLE_SPACING_Y);
          }
      } else if (fromNode.type === 'condition') {
          if (sourceHandleId === 'true') startYOffset = NODE_HEADER_HEIGHT_APPROX * (1/3) + 6;
          else if (sourceHandleId === 'false') startYOffset = NODE_HEADER_HEIGHT_APPROX * (2/3) + 6;
      }

      const logicalNodeX = fromNode.x;
      const logicalNodeY = fromNode.y;
      
      const lineStartX = logicalNodeX + NODE_WIDTH; 
      const lineStartY = logicalNodeY + startYOffset; 
      
      const mouseXOnCanvas = event.clientX - canvasRect.left;
      const mouseYOnCanvas = event.clientY - canvasRect.top;
      const lineCurrentX = (mouseXOnCanvas - currentCanvasOffset.x) / currentZoomLevel; // Convertido para lógico
      const lineCurrentY = (mouseYOnCanvas - currentCanvasOffset.y) / currentZoomLevel; // Convertido para lógico

      setDrawingLine({
        fromId: fromNode.id,
        sourceHandleId,
        startX: lineStartX, 
        startY: lineStartY, 
        currentX: lineCurrentX, 
        currentY: lineCurrentY, 
      });
    },
    [canvasRef] // setDrawingLine é estável, refs são usadas para offset/zoom.
  ); 

  const handleCanvasMouseDownForPanning = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget || (e.target as HTMLElement).id === 'flow-content-wrapper') { 
      isPanning.current = true;
      panStartMousePosition.current = { x: e.clientX, y: e.clientY };
      initialCanvasOffsetOnPanStart.current = { ...canvasOffsetCbRef.current };
      if (e.currentTarget) e.currentTarget.style.cursor = 'grabbing';
    }
  }, []); // Não depende de canvasOffset diretamente, usa ref

  const handleGlobalMouseMove = useCallback((e: MouseEvent) => {
    if (isPanning.current) {
      const dx = e.clientX - panStartMousePosition.current.x;
      const dy = e.clientY - panStartMousePosition.current.y;
      setCanvasOffset({
        x: initialCanvasOffsetOnPanStart.current.x + dx,
        y: initialCanvasOffsetOnPanStart.current.y + dy,
      });
    } else if (drawingLine) {
      if (!canvasRef.current) {
        return;
      }
      const currentCanvasOffset = canvasOffsetCbRef.current; // Usa ref
      const currentZoomLevel = zoomLevelCbRef.current;     // Usa ref
      const canvasRect = canvasRef.current.getBoundingClientRect();
      
      const mouseXOnCanvas = e.clientX - canvasRect.left;
      const mouseYOnCanvas = e.clientY - canvasRect.top;

      setDrawingLine((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          currentX: (mouseXOnCanvas - currentCanvasOffset.x) / currentZoomLevel,
          currentY: (mouseYOnCanvas - currentCanvasOffset.y) / currentZoomLevel,
        };
      });
    }
  }, [drawingLine]); // setCanvasOffset, setDrawingLine são estáveis. drawingLine é a dependência que muda.

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
        if (!activeWorkspaceId) {
            console.warn("[FlowBuilderClient] Cannot add connection, no active workspace ID.");
            setDrawingLine(null);
            return;
        }
        updateActiveWorkspace(ws => {
            let newConnectionsArray = [...ws.connections];
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
                // No action
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
  }, [drawingLine, activeWorkspaceId, updateActiveWorkspace]); // setDrawingLine é estável

  const deleteConnection = useCallback((connectionIdToDelete: string) => {
    updateActiveWorkspace(ws => ({
        ...ws,
        connections: ws.connections.filter(conn => conn.id !== connectionIdToDelete)
    }));
    setHighlightedConnectionId(null);
  }, [updateActiveWorkspace]); // setHighlightedConnectionId é estável

  useEffect(() => {
    document.addEventListener('mousemove', handleGlobalMouseMove);
    document.addEventListener('mouseup', handleGlobalMouseUp);
    
    const currentDrawingLineRef = React.createRef<DrawingLineData | null>(); 
    currentDrawingLineRef.current = drawingLine;

    const handleMouseLeaveWindow = () => {
      if (isPanning.current) {
        isPanning.current = false;
        if (canvasRef.current) canvasRef.current.style.cursor = 'grab';
      }
      if (currentDrawingLineRef.current) { 
        setDrawingLine(null);
      }
    };
    document.body.addEventListener('mouseleave', handleMouseLeaveWindow);

    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
      document.body.removeEventListener('mouseleave', handleMouseLeaveWindow);
    };
  }, [handleGlobalMouseMove, handleGlobalMouseUp, drawingLine]); // drawingLine e setDrawingLine são as deps relevantes
  

  const handleZoom = useCallback((direction: 'in' | 'out' | 'reset') => {
    if (!canvasRef.current) return;

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

  }, [setZoomLevel, setCanvasOffset]); // setZoomLevel, setCanvasOffset são estáveis

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="flex flex-col h-screen bg-background font-sans select-none overflow-hidden">
        <TopBar
          workspaces={workspaces}
          activeWorkspaceId={activeWorkspaceId}
          onAddWorkspace={addWorkspace}
          onSwitchWorkspace={switchWorkspace}
          onSaveWorkspaces={handleSaveWorkspaces}
          onDiscardChanges={handleDiscardChanges}
          appName="Flowise Lite"
          isChatPanelOpen={isChatPanelOpen}
          onToggleChatPanel={toggleChatPanel}
          onZoom={handleZoom}
          currentZoomLevel={zoomLevel}
        />
        <div className="flex flex-1 overflow-hidden relative" >
          <FlowSidebar />
          <div className="flex-1 flex relative overflow-hidden">
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
              definedVariablesInFlow={definedVariablesInFlow}
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
