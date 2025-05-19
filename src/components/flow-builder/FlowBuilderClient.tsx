
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
import { 
  clientSideLoadWorkspacesAction, 
  clientSideSaveWorkspacesAction,
} from '@/app/actions/databaseActions';

const LOCAL_STORAGE_KEY_ACTIVE_WORKSPACE_UI = 'flowiseLiteActiveWorkspaceUI';
const LOCAL_STORAGE_KEY_CHAT_PANEL_OPEN = 'flowiseLiteChatPanelOpen';


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
  'variableToSaveResponse', 'variableToSaveChoice', 'variableName', 
  'apiOutputVariable', 'variableToSaveDate', 'codeOutputVariable', 
  'jsonOutputVariable', 'fileUrlVariable', 'ratingOutputVariable', 
  'aiOutputVariable', 'agentResponseVariable', 'supabaseResultVariable',
];


export default function FlowBuilderClient() {
  const { toast } = useToast();
  const [workspaces, setWorkspaces] = useState<WorkspaceData[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true); 
  
  const [drawingLine, setDrawingLine] = useState<DrawingLineData | null>(null);
  const [highlightedConnectionId, setHighlightedConnectionId] = useState<string | null>(null);

  const [canvasOffset, setCanvasOffset] = useState<CanvasOffset>({ x: GRID_SIZE * 2, y: GRID_SIZE * 2 });
  const [zoomLevel, setZoomLevel] = useState(1);
  
  const isPanning = useRef(false);
  const panStartMousePosition = useRef({ x: 0, y: 0 });
  const initialCanvasOffsetOnPanStart = useRef({ x: 0, y: 0 });
  
  const canvasRef = useRef<HTMLDivElement>(null);
  const canvasOffsetCbRef = useRef(canvasOffset);
  const zoomLevelCbRef = useRef(zoomLevel);

  const [isChatPanelOpen, setIsChatPanelOpen] = useState(true);
  const [hasMounted, setHasMounted] = useState(false);
  const [definedVariablesInFlow, setDefinedVariablesInFlow] = useState<string[]>([]);

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
        // console.log("[FlowBuilderClient] Defined variables updated:", newVarsArray);
        return newVarsArray; 
      });

    } else {
       setDefinedVariablesInFlow(prevDefinedVars => {
        if (prevDefinedVars.length === 0) return prevDefinedVars;
        // console.log("[FlowBuilderClient] No active workspace nodes, clearing defined variables.");
        return [];
      });
    }
  }, [activeWorkspace?.nodes]);

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
    console.log("[FlowBuilderClient] Initializing: Attempting to load workspaces from DB.");
    setIsLoading(true);
    
    async function loadData() {
      try {
        const loadedWorkspacesFromDB = await clientSideLoadWorkspacesAction();
        console.log("[FlowBuilderClient] Workspaces loaded from DB count:", loadedWorkspacesFromDB.length);

        if (loadedWorkspacesFromDB && loadedWorkspacesFromDB.length > 0) {
          setWorkspaces(loadedWorkspacesFromDB);
          const savedActiveIdUI = localStorage.getItem(LOCAL_STORAGE_KEY_ACTIVE_WORKSPACE_UI);
          if (savedActiveIdUI && loadedWorkspacesFromDB.some(ws => ws.id === savedActiveIdUI)) {
            setActiveWorkspaceId(savedActiveIdUI);
             console.log("[FlowBuilderClient] Active workspace ID set from localStorage (and exists in DB):", savedActiveIdUI);
          } else {
            setActiveWorkspaceId(loadedWorkspacesFromDB[0].id);
            console.log("[FlowBuilderClient] Active workspace ID set to first loaded from DB:", loadedWorkspacesFromDB[0].id);
            localStorage.setItem(LOCAL_STORAGE_KEY_ACTIVE_WORKSPACE_UI, loadedWorkspacesFromDB[0].id);
          }
        } else {
          console.log("[FlowBuilderClient] No workspaces in DB, creating initial one.");
          const initialId = uuidv4();
          const initialWorkspace: WorkspaceData = {
            id: initialId,
            name: 'Meu Primeiro Fluxo (DB)',
            nodes: [],
            connections: [],
          };
          setWorkspaces([initialWorkspace]);
          setActiveWorkspaceId(initialId);
          const saveResult = await clientSideSaveWorkspacesAction([initialWorkspace]);
          console.log('[FlowBuilderClient] Result from saving initial workspace to DB:', saveResult);
          if (saveResult.success) {
            console.log("[FlowBuilderClient] Initial workspace saved to DB.");
            localStorage.setItem(LOCAL_STORAGE_KEY_ACTIVE_WORKSPACE_UI, initialId);
          } else {
            console.error("[FlowBuilderClient] Failed to save initial workspace to DB:", saveResult.errors);
            const errorDetail = saveResult.errors && saveResult.errors.length > 0 
              ? saveResult.errors.map(err => `ID: ${err.workspaceId}, Erro: ${err.error}`).join('; ')
              : "Detalhes do erro não disponíveis.";
            toast({ 
              title: "Erro ao Salvar Fluxo Inicial", 
              description: `Falha ao salvar no banco de dados. Detalhe: ${errorDetail}`, 
              variant: "destructive",
              duration: 9000
            });
          }
        }
      } catch (error: any) {
        console.error("[FlowBuilderClient] Error in loadData:", error);
        toast({ 
            title: "Erro Crítico ao Carregar Fluxos", 
            description: `Não foi possível carregar os fluxos do banco de dados: ${error.message}`, 
            variant: "destructive",
            duration: 9000
        });
        // Fallback to a local workspace if DB load fails critically
        const fallbackId = uuidv4();
        const fallbackWorkspace = { id: fallbackId, name: 'Fluxo de Fallback (Erro DB)', nodes: [], connections: [] };
        setWorkspaces([fallbackWorkspace]);
        setActiveWorkspaceId(fallbackId);
        localStorage.setItem(LOCAL_STORAGE_KEY_ACTIVE_WORKSPACE_UI, fallbackId);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [hasMounted, toast]);

  useEffect(() => {
    if (!hasMounted || !activeWorkspaceId || isLoading) return;
    try {
        localStorage.setItem(LOCAL_STORAGE_KEY_ACTIVE_WORKSPACE_UI, activeWorkspaceId);
        console.log("[FlowBuilderClient] Active workspace UI ID saved to localStorage:", activeWorkspaceId);
    } catch (e) {
        console.error("[FlowBuilderClient] Failed to save active workspace UI ID to localStorage", e);
    }
  }, [activeWorkspaceId, hasMounted, isLoading]);

  const handleSaveWorkspaces = useCallback(async () => {
    if (!hasMounted) return;
    if (workspaces.length === 0 && !activeWorkspaceId) {
      toast({ title: "Nada para salvar", description: "Crie um fluxo primeiro.", variant: "default" });
      return;
    }
    console.log("[FlowBuilderClient] Attempting to save workspaces to DB:", workspaces.length);
    const result = await clientSideSaveWorkspacesAction(workspaces);
    console.log('[FlowBuilderClient] Result from handleSaveWorkspaces:', result);
    if (result.success) {
      toast({
        title: "Sucesso!",
        description: "Todos os fluxos foram salvos no banco de dados.",
        variant: "default",
      });
    } else {
      console.error("[FlowBuilderClient] Failed to save workspaces to DB", result.errors);
      const errorDetail = result.errors && result.errors.length > 0 
        ? result.errors.map(err => `ID: ${err.workspaceId}, Erro: ${err.error}`).join('; ')
        : "Detalhes do erro não disponíveis.";
      toast({
        title: "Erro ao Salvar Fluxos",
        description: `Não foi possível salvar os fluxos no banco de dados. Detalhe: ${errorDetail}`,
        variant: "destructive",
        duration: 9000
      });
    }
  }, [workspaces, activeWorkspaceId, toast, hasMounted]);

  const handleDiscardChanges = useCallback(async () => {
    if (!hasMounted) return;
    setIsLoading(true);
    console.log("[FlowBuilderClient] Discarding changes, reloading from DB.");
    try {
      const loadedWorkspacesFromDB = await clientSideLoadWorkspacesAction();
      if (loadedWorkspacesFromDB && loadedWorkspacesFromDB.length > 0) {
        setWorkspaces(loadedWorkspacesFromDB);
        const currentActiveIdUI = localStorage.getItem(LOCAL_STORAGE_KEY_ACTIVE_WORKSPACE_UI);
        if (currentActiveIdUI && loadedWorkspacesFromDB.some(ws => ws.id === currentActiveIdUI)) {
          setActiveWorkspaceId(currentActiveIdUI);
        } else {
          const newActiveId = loadedWorkspacesFromDB[0].id;
          setActiveWorkspaceId(newActiveId);
          localStorage.setItem(LOCAL_STORAGE_KEY_ACTIVE_WORKSPACE_UI, newActiveId);
        }
        toast({
          title: "Alterações Descartadas",
          description: "Fluxos recarregados do banco de dados.",
          variant: "default",
        });
      } else {
        console.log("[FlowBuilderClient] No workspaces in DB after discard, creating initial one.");
        const initialId = uuidv4();
        const initialWorkspace: WorkspaceData = { id: initialId, name: 'Meu Primeiro Fluxo (DB)', nodes: [], connections: [] };
        setWorkspaces([initialWorkspace]);
        setActiveWorkspaceId(initialId);
        const saveResult = await clientSideSaveWorkspacesAction([initialWorkspace]);
        console.log('[FlowBuilderClient] Result from saving initial workspace after discard (DB was empty):', saveResult);
        if(saveResult.success){
            localStorage.setItem(LOCAL_STORAGE_KEY_ACTIVE_WORKSPACE_UI, initialId);
            toast({ title: "Nenhum Fluxo no DB", description: "Um novo fluxo inicial foi criado e salvo.", variant: "default" });
        } else {
            console.error("[FlowBuilderClient] Failed to save initial workspace after discard:", saveResult.errors);
             const errorDetail = saveResult.errors && saveResult.errors.length > 0 
              ? saveResult.errors.map(err => `ID: ${err.workspaceId}, Erro: ${err.error}`).join('; ')
              : "Detalhes do erro não disponíveis.";
            toast({ 
              title: "Erro ao Salvar Fluxo Inicial Pós-Descarte", 
              description: `Falha ao salvar no banco de dados. Detalhe: ${errorDetail}`, 
              variant: "destructive",
              duration: 9000
            });
        }
      }
    } catch (error: any) {
      console.error("[FlowBuilderClient] (Discard) Error loading workspaces from DB:", error);
      toast({
        title: "Erro ao Descartar",
        description: `Não foi possível recarregar os fluxos do banco de dados: ${error.message}`,
        variant: "destructive",
        duration: 9000
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast, hasMounted]);

  const addWorkspace = useCallback(async () => {
    if (!hasMounted) return;
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
    
    console.log("[FlowBuilderClient] New workspace created, attempting to save all workspaces to DB.");
    const result = await clientSideSaveWorkspacesAction(updatedWorkspaces);
    console.log('[FlowBuilderClient] Result from saving new workspace (and others) to DB:', result);

    if (result.success) {
        toast({
          title: "Novo Fluxo Criado",
          description: `${newWorkspace.name} foi adicionado e todos os fluxos foram salvos no DB.`,
        });
      } else {
          console.error("[FlowBuilderClient] Failed to save new workspace (and others) to DB", result.errors);
          const errorDetail = result.errors && result.errors.length > 0 
            ? result.errors.map(err => `ID: ${err.workspaceId}, Erro: ${err.error}`).join('; ')
            : "Detalhes do erro não disponíveis.";
          toast({
            title: "Erro ao Salvar Novo Fluxo",
            description: `Não foi possível salvar o novo fluxo no banco de dados. Detalhe: ${errorDetail}`,
            variant: "destructive",
            duration: 9000
          });
      }
  }, [workspaces, toast, hasMounted]);

  const switchWorkspace = useCallback((workspaceId: string) => {
    if (workspaces.find(ws => ws.id === workspaceId)) {
        setActiveWorkspaceId(workspaceId);
    } else {
        console.warn(`[FlowBuilderClient] Attempted to switch to non-existent workspace ID: ${workspaceId}`);
        if (workspaces.length > 0) {
            const firstId = workspaces[0].id;
            setActiveWorkspaceId(firstId);
            if(hasMounted) localStorage.setItem(LOCAL_STORAGE_KEY_ACTIVE_WORKSPACE_UI, firstId);
        } else {
            setActiveWorkspaceId(null); 
            if(hasMounted) localStorage.removeItem(LOCAL_STORAGE_KEY_ACTIVE_WORKSPACE_UI);
        }
    }
  }, [workspaces, hasMounted]);
  
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
    
    const currentWksp = workspaces.find(ws => ws.id === activeWorkspaceId); 
    const existingVariableNames: string[] = [];
    if (currentWksp) { 
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
    
    const baseNodeData: Omit<NodeData, 'id' | 'type' | 'title' | 'x' | 'y' | 'triggers'> = {
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
      instanceName: '', phoneNumber: '', textMessage: '', mediaUrl: '', mediaType: 'image', caption: '', groupName: '', participants: '',
      aiPromptText: '', aiModelName: '', aiOutputVariable: '',
      agentName: 'Agente Inteligente Padrão', agentSystemPrompt: 'Você é um assistente IA. Responda às perguntas do usuário de forma concisa e prestativa.',
      userInputVariable: '{{entrada_usuario}}', agentResponseVariable: 'resposta_do_agente', maxConversationTurns: 5, temperature: 0.7,
      supabaseTableName: '', supabaseIdentifierColumn: '', supabaseIdentifierValue: '', supabaseDataJson: '', supabaseColumnsToSelect: '*', supabaseResultVariable: '',
    };

    const newNode: NodeData = {
      id: uuidv4(),
      type: item.type as NodeData['type'],
      title: item.label,
      ...baseNodeData, 
      ...(item.type === 'start' && { triggers: [{ id: uuidv4(), name: 'Gatilho Inicial', type: 'manual', webhookPayloadVariable: 'webhook_payload' }] }),
      ...itemDefaultDataCopy, 
      x: logicalDropCoords.x - NODE_WIDTH / 2, 
      y: logicalDropCoords.y - NODE_HEADER_HEIGHT_APPROX / 2, 
    };
    
    // console.log("[FlowBuilderClient] New node created:", JSON.parse(JSON.stringify(newNode)));
    updateActiveWorkspace(ws => {
      const updatedNodes = [...ws.nodes, newNode];
      // console.log(`[FlowBuilderClient] Nodes after adding new node. New count: ${updatedNodes.length}. Nodes:`, JSON.parse(JSON.stringify(updatedNodes)));
      return { ...ws, nodes: updatedNodes };
    });
  }, [activeWorkspaceId, updateActiveWorkspace, workspaces]); 

  const updateNode = useCallback((id: string, changes: Partial<NodeData>) => {
    // console.log("[FlowBuilderClient] Node updated:", { id, changes: JSON.parse(JSON.stringify(changes)) });
    updateActiveWorkspace(ws => ({
      ...ws,
      nodes: ws.nodes.map(n => (n.id === id ? { ...n, ...changes } : n)),
    }));
  }, [updateActiveWorkspace]);

  const deleteNode = useCallback((nodeIdToDelete: string) => {
    // console.log("[FlowBuilderClient] Node deleted:", nodeIdToDelete);
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
      const currentCanvasOffset = canvasOffsetCbRef.current; 
      const currentZoomLevel = zoomLevelCbRef.current;     
      const canvasRect = canvasRef.current.getBoundingClientRect();

      let startYOffset = NODE_HEADER_CONNECTOR_Y_OFFSET; 
      if (fromNode.type === 'start' && Array.isArray(fromNode.triggers) && sourceHandleId) {
          const triggerIndex = fromNode.triggers.findIndex(t => t.name === sourceHandleId);
          if (triggerIndex !== -1) {
              startYOffset = START_NODE_TRIGGER_INITIAL_Y_OFFSET + (triggerIndex * START_NODE_TRIGGER_SPACING_Y);
          }
      } else if (fromNode.type === 'option' && typeof fromNode.optionsList === 'string' && sourceHandleId) {
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
      
      // As coordenadas do mouse já vêm relativas ao viewport
      // Precisamos convertê-las para coordenadas visuais relativas ao canvasRef
      // E então para coordenadas lógicas
      const mouseXOnCanvas = event.clientX - canvasRect.left;
      const mouseYOnCanvas = event.clientY - canvasRect.top;
      const lineCurrentX = (mouseXOnCanvas - currentCanvasOffset.x) / currentZoomLevel; 
      const lineCurrentY = (mouseYOnCanvas - currentCanvasOffset.y) / currentZoomLevel; 

      setDrawingLine({
        fromId: fromNode.id,
        sourceHandleId,
        startX: lineStartX, 
        startY: lineStartY, 
        currentX: lineCurrentX, 
        currentY: lineCurrentY, 
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
    }
  }, [canvasRef, canvasOffsetCbRef]); // Corrigido para usar canvasRef e canvasOffsetCbRef

  const handleGlobalMouseMove = useCallback((e: MouseEvent) => {
    if (isPanning.current) {
      const dx = e.clientX - panStartMousePosition.current.x;
      const dy = e.clientY - panStartMousePosition.current.y;
      setCanvasOffset({
        x: initialCanvasOffsetOnPanStart.current.x + dx,
        y: initialCanvasOffsetOnPanStart.current.y + dy,
      });
    } else if (drawingLine && canvasRef.current) {
      const currentCanvasOffset = canvasOffsetCbRef.current; 
      const currentZoomLevel = zoomLevelCbRef.current;     
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
  }, [drawingLine, canvasRef, setDrawingLine, setCanvasOffset, canvasOffsetCbRef, zoomLevelCbRef]); 

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
                // console.log("[FlowBuilderClient] Duplicate connection prevented (same from, to, and handle).");
            } else if (existingConnectionFromThisSourceHandle) {
                // console.log("[FlowBuilderClient] Replacing existing connection from same source handle.");
                newConnectionsArray = newConnectionsArray.filter(c => c.id !== existingConnectionFromThisSourceHandle.id);
                newConnectionsArray.push(newConnection);
            } else {
                // console.log("[FlowBuilderClient] Adding new connection:", newConnection);
                newConnectionsArray.push(newConnection);
            }
            return { ...ws, connections: newConnectionsArray };
        });
      }
      setDrawingLine(null);
    }
  }, [drawingLine, activeWorkspaceId, updateActiveWorkspace, setDrawingLine, canvasRef]);

  const deleteConnection = useCallback((connectionIdToDelete: string) => {
    updateActiveWorkspace(ws => ({
        ...ws,
        connections: ws.connections.filter(conn => conn.id !== connectionIdToDelete)
    }));
    setHighlightedConnectionId(null); 
  }, [updateActiveWorkspace, setHighlightedConnectionId]); 

  useEffect(() => {
    if (!hasMounted) return; // Só adiciona listeners após a montagem no cliente

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
    // Adicionar ao body pode ser mais confiável para mouseleave do que document
    document.body.addEventListener('mouseleave', handleMouseLeaveWindow);

    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
      document.body.removeEventListener('mouseleave', handleMouseLeaveWindow);
    };
  }, [handleGlobalMouseMove, handleGlobalMouseUp, drawingLine, canvasRef, hasMounted, setDrawingLine]); // Adicionado hasMounted
  

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

  }, [setZoomLevel, setCanvasOffset, canvasRef, zoomLevelCbRef, canvasOffsetCbRef]);


  if (isLoading && hasMounted) {
    return <div className="flex items-center justify-center h-screen">Carregando fluxos do banco de dados...</div>;
  }

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
        <div className="flex flex-1 overflow-hidden relative"> 
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

