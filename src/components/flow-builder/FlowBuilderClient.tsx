
"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { NodeData, Connection, DrawingLineData, CanvasOffset, DraggableBlockItemData, WorkspaceData, StartNodeTrigger } from '@/lib/types';
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
  // deleteWorkspaceFromDB, // Adicionar se for usar
} from '@/app/actions/databaseActions';

const LOCAL_STORAGE_KEY_ACTIVE_WORKSPACE_UI = 'flowiseLiteActiveWorkspaceUI';
const LOCAL_STORAGE_KEY_CHAT_PANEL_OPEN = 'flowiseLiteChatPanelOpen';

const VARIABLE_DEFINING_FIELDS: (keyof NodeData)[] = [
  'variableToSaveResponse', 'variableToSaveChoice', 'variableName', 
  'apiOutputVariable', 'variableToSaveDate', 'codeOutputVariable', 
  'jsonOutputVariable', 'fileUrlVariable', 'ratingOutputVariable', 
  'aiOutputVariable', 'agentResponseVariable', 'supabaseResultVariable',
];

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

export default function FlowBuilderClient() {
  const { toast } = useToast();
  const [workspaces, setWorkspaces] = useState<WorkspaceData[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true); 
  
  const [drawingLine, setDrawingLine] = useState<DrawingLineData | null>(null);
  const [highlightedConnectionId, setHighlightedConnectionId] = useState<string | null>(null);
  const [highlightedNodeIdBySession, setHighlightedNodeIdBySession] = useState<string | null>(null);

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
  const currentNodes = activeWorkspace?.nodes || [];
  const currentConnections = activeWorkspace?.connections || [];

 useEffect(() => {
    if (activeWorkspace?.nodes) {
      const variablesSet: Set<string> = new Set();
      activeWorkspace.nodes.forEach(n => {
        VARIABLE_DEFINING_FIELDS.forEach(field => {
          const varName = n[field] as string | undefined;
          if (varName && varName.trim() !== '') {
            variablesSet.add(varName.trim().replace(/\{\{/g, '').replace(/\}\}/g, ''));
          }
        });
        if (n.type === 'start' && Array.isArray(n.triggers)) {
          n.triggers.forEach(trigger => {
            if (trigger.type === 'webhook' && trigger.webhookPayloadVariable) {
              variablesSet.add(trigger.webhookPayloadVariable.replace(/\{\{/g, '').replace(/\}\}/g, ''));
            }
          });
        }
      });
      const newVarsArray = Array.from(variablesSet).sort();
      setDefinedVariablesInFlow(prevDefinedVars => {
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
          
          // Prioritize o mais recente do DB para ser o ativo
          let newActiveId = loadedWorkspacesFromDB[0].id; 
          const lastActiveIdFromStorage = localStorage.getItem(LOCAL_STORAGE_KEY_ACTIVE_WORKSPACE_UI);

          // Se o último ativo do localStorage ainda existir na lista do DB, mantenha-o.
          if (lastActiveIdFromStorage && loadedWorkspacesFromDB.some(ws => ws.id === lastActiveIdFromStorage)) {
            newActiveId = lastActiveIdFromStorage;
            console.log("[FlowBuilderClient] Active workspace ID set from localStorage (and exists in DB):", newActiveId);
          } else {
             console.log("[FlowBuilderClient] Active workspace ID set to most recent from DB:", newActiveId);
          }
          setActiveWorkspaceId(newActiveId);
          localStorage.setItem(LOCAL_STORAGE_KEY_ACTIVE_WORKSPACE_UI, newActiveId); // Salva a escolha (seja do DB ou localStorage)

        } else {
          console.log("[FlowBuilderClient] No workspaces in DB, creating initial one.");
          const initialId = uuidv4();
          const initialWorkspace: WorkspaceData = {
            id: initialId,
            name: 'Meu Primeiro Fluxo (DB)',
            nodes: [],
            connections: [],
          };
          const saveResult = await clientSideSaveWorkspacesAction([initialWorkspace]);
          console.log('[FlowBuilderClient] Result from saving initial workspace to DB:', saveResult);
          
          if (saveResult.success) {
            console.log("[FlowBuilderClient] Initial workspace saved to DB.");
            setWorkspaces([initialWorkspace]);
            setActiveWorkspaceId(initialId);
            localStorage.setItem(LOCAL_STORAGE_KEY_ACTIVE_WORKSPACE_UI, initialId);
          } else {
            console.error("[FlowBuilderClient] Failed to save initial workspace to DB:", saveResult.errors);
            const errorMsg = saveResult.errors && saveResult.errors.length > 0 && saveResult.errors[0].error
              ? `${typeof saveResult.errors[0].error === 'string' ? saveResult.errors[0].error : JSON.stringify(saveResult.errors[0].error)}`
              : "Erro desconhecido ao salvar.";
            toast({ 
              title: "Erro ao Salvar Fluxo Inicial", 
              description: `Falha ao salvar no banco de dados. Detalhe: ${errorMsg}`, 
              variant: "destructive",
              duration: 9000
            });
            // Fallback para um workspace local se o DB falhar totalmente na primeira vez
             const fallbackId = uuidv4();
             setWorkspaces([{ id: fallbackId, name: 'Fluxo de Fallback (Erro DB)', nodes: [], connections: [] }]);
             setActiveWorkspaceId(fallbackId);
          }
        }
      } catch (error: any) {
        console.error("[FlowBuilderClient] Error loading or creating initial workspace from DB:", error);
        toast({
          title: "Erro ao Carregar Fluxos",
          description: `Não foi possível carregar os fluxos do banco de dados: ${error.message}`,
          variant: "destructive",
          duration: 9000
        });
        const fallbackId = uuidv4();
        setWorkspaces([{ id: fallbackId, name: 'Fluxo de Fallback (Erro DB)', nodes: [], connections: [] }]);
        setActiveWorkspaceId(fallbackId);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [hasMounted, toast]);
  

  useEffect(() => {
    if (hasMounted && activeWorkspaceId) {
      localStorage.setItem(LOCAL_STORAGE_KEY_ACTIVE_WORKSPACE_UI, activeWorkspaceId);
      console.log("[FlowBuilderClient] Active workspace UI ID saved to localStorage:", activeWorkspaceId);
    }
  }, [activeWorkspaceId, hasMounted]);

  const handleSaveWorkspaces = useCallback(async () => {
    if (!hasMounted || !workspaces || workspaces.length === 0) {
      console.warn("[FlowBuilderClient] No workspaces to save or component not mounted.");
      return;
    }
    console.log("[FlowBuilderClient] Attempting to save workspaces to DB:", workspaces.length);
    
    const result = await clientSideSaveWorkspacesAction(workspaces); 
    console.log('[FlowBuilderClient] Result from handleSaveWorkspaces:', result);

    if (result.success) {
      toast({
        title: "Fluxos Salvos!",
        description: "Seus fluxos foram salvos no banco de dados.",
      });
    } else {
      console.error("[FlowBuilderClient] Failed to save some workspaces to DB", result.errors);
      const errorDetail = result.errors && result.errors.length > 0 && result.errors[0].error
        ? `${typeof result.errors[0].error === 'string' ? result.errors[0].error : JSON.stringify(result.errors[0].error)}`
        : "Erro desconhecido ao salvar.";
      toast({
        title: "Erro ao Salvar Alguns Fluxos",
        description: `Nem todos os fluxos foram salvos. Detalhe: ${errorDetail}`,
        variant: "destructive",
        duration: 9000
      });
    }
  }, [workspaces, toast, hasMounted]);


  const handleDiscardChanges = useCallback(async () => {
    if (!hasMounted) return;
    setIsLoading(true);
    console.log("[FlowBuilderClient] (Discard) Attempting to reload workspaces from DB.");
    try {
      const loadedWorkspacesFromDB = await clientSideLoadWorkspacesAction();
      if (loadedWorkspacesFromDB && loadedWorkspacesFromDB.length > 0) {
        setWorkspaces(loadedWorkspacesFromDB);
        
        // Define o ativo como o primeiro da lista (mais recente do DB) após descartar
        const newActiveId = loadedWorkspacesFromDB[0].id;
        setActiveWorkspaceId(newActiveId);
        localStorage.setItem(LOCAL_STORAGE_KEY_ACTIVE_WORKSPACE_UI, newActiveId);

        toast({
          title: "Alterações Descartadas",
          description: "Fluxos recarregados do banco de dados.",
          variant: "default",
        });
      } else {
        console.log("[FlowBuilderClient] No workspaces in DB after discard, creating initial one.");
        const initialId = uuidv4();
        const initialWorkspace: WorkspaceData = { id: initialId, name: 'Meu Primeiro Fluxo (DB)', nodes: [], connections: [] };
        const saveResult = await clientSideSaveWorkspacesAction([initialWorkspace]);
        console.log('[FlowBuilderClient] Result from saving initial workspace after discard (DB was empty):', saveResult);
        if(saveResult.success){
            setWorkspaces([initialWorkspace]);
            setActiveWorkspaceId(initialId);
            localStorage.setItem(LOCAL_STORAGE_KEY_ACTIVE_WORKSPACE_UI, initialId);
            toast({ title: "Nenhum Fluxo no DB", description: "Um novo fluxo inicial foi criado e salvo.", variant: "default" });
        } else {
            console.error("[FlowBuilderClient] Failed to save initial workspace after discard:", saveResult.errors);
            const errorMsg = saveResult.errors && saveResult.errors.length > 0 && saveResult.errors[0].error
              ? `${typeof saveResult.errors[0].error === 'string' ? saveResult.errors[0].error : JSON.stringify(saveResult.errors[0].error)}`
              : "Erro desconhecido ao salvar.";
            toast({ 
              title: "Erro ao Salvar Fluxo Inicial Pós-Descarte", 
              description: `Falha ao salvar no banco de dados. Detalhe: ${errorMsg}`, 
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
      setHighlightedNodeIdBySession(null); 
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
    
    console.log("[FlowBuilderClient] New workspace created, attempting to save all workspaces to DB.");
    const saveResult = await clientSideSaveWorkspacesAction(updatedWorkspaces); 
    console.log('[FlowBuilderClient] Result from saving new workspace (and others) to DB:', saveResult);

    if (saveResult.success) {
        setWorkspaces(updatedWorkspaces); 
        setActiveWorkspaceId(newWorkspaceId);
        localStorage.setItem(LOCAL_STORAGE_KEY_ACTIVE_WORKSPACE_UI, newWorkspaceId);
        toast({
          title: "Novo Fluxo Criado",
          description: `${newWorkspace.name} foi adicionado e salvo no DB.`,
        });
      } else {
          console.error("[FlowBuilderClient] Failed to save new workspace to DB", saveResult.errors);
          const errorMsg = saveResult.errors && saveResult.errors.length > 0 && saveResult.errors[0].error
            ? `${typeof saveResult.errors[0].error === 'string' ? saveResult.errors[0].error : JSON.stringify(saveResult.errors[0].error)}`
            : "Erro desconhecido ao salvar.";
          toast({
            title: "Erro ao Salvar Novo Fluxo",
            description: `Não foi possível salvar o novo fluxo no banco de dados. Detalhe: ${errorMsg}`,
            variant: "destructive",
            duration: 9000
          });
      }
  }, [workspaces, toast, hasMounted]);

  const switchWorkspace = useCallback((workspaceId: string) => {
    if (workspaces.find(ws => ws.id === workspaceId)) {
        setActiveWorkspaceId(workspaceId); 
        setHighlightedNodeIdBySession(null);
    } else {
        console.warn(`[FlowBuilderClient] Attempted to switch to non-existent workspace ID: ${workspaceId}`);
        if (workspaces.length > 0) {
            const firstId = workspaces[0].id;
            setActiveWorkspaceId(firstId);
        } else {
            setActiveWorkspaceId(null); 
        }
         setHighlightedNodeIdBySession(null);
    }
  }, [workspaces]);
  
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
    
    // Use definedVariablesInFlow que já é um estado estável e reflete o fluxo ativo
    let tempExistingVars = [...definedVariablesInFlow]; 
    
    const itemDefaultDataCopy = item.defaultData ? JSON.parse(JSON.stringify(item.defaultData)) : {};
    
    VARIABLE_DEFINING_FIELDS.forEach(field => {
      if (itemDefaultDataCopy.hasOwnProperty(field)) {
        const baseVarName = itemDefaultDataCopy[field] as string | undefined;
        if (baseVarName && baseVarName.trim() !== '') {
          const uniqueName = generateUniqueVariableName(baseVarName, tempExistingVars);
          (itemDefaultDataCopy as any)[field] = uniqueName;
          if (uniqueName !== baseVarName.replace(/\{\{|\}\}/g, '').trim()) { 
            tempExistingVars.push(uniqueName); 
          }
        }
      }
    });
    
    if (item.type === 'start' && itemDefaultDataCopy.triggers) {
      itemDefaultDataCopy.triggers = (itemDefaultDataCopy.triggers as StartNodeTrigger[]).map(trigger => {
        if (trigger.type === 'webhook' && trigger.webhookPayloadVariable) {
          const uniqueWebhookVarName = generateUniqueVariableName(trigger.webhookPayloadVariable, tempExistingVars);
          if (uniqueWebhookVarName !== trigger.webhookPayloadVariable.replace(/\{\{|\}\}/g, '').trim()) {
            tempExistingVars.push(uniqueWebhookVarName);
          }
          return { ...trigger, webhookPayloadVariable: uniqueWebhookVarName };
        }
        return trigger;
      });
    }
    
    const baseNodeData: Omit<NodeData, 'id' | 'type' | 'title' | 'x' | 'y'> = {
      text: '', promptText: '', inputType: 'text', variableToSaveResponse: '',
      questionText: '', optionsList: '', variableToSaveChoice: '',
      mediaDisplayType: 'image', mediaDisplayUrl: 'https://placehold.co/300x200.png', mediaDisplayText: 'Imagem de exemplo', dataAiHint: 'placeholder abstract',
      conditionVariable: '', conditionOperator: '==', conditionValue: '',
      variableName: '', variableValue: '', delayDuration: 1000, typingDuration: 1500,
      logMessage: '', codeSnippet: "return { resultado: 'sucesso' };", codeOutputVariable: 'resultado_codigo', 
      inputJson: '{ "nome": "Exemplo" }', jsonataExpression: '$.nome', jsonOutputVariable: 'nome_transformado',
      uploadPromptText: '', fileTypeFilter: '', maxFileSizeMB: 5, fileUrlVariable: '',
      ratingQuestionText: '', maxRatingValue: 5, ratingIconType: 'star', ratingOutputVariable: '',
      apiUrl: 'https://', apiMethod: 'GET', apiAuthType: 'none',
      apiAuthBearerToken: '', apiAuthBasicUser: '', apiAuthBasicPassword: '',
      apiHeadersList: [], apiQueryParamsList: [],
      apiBodyType: 'none', apiBodyJson: '{}', apiBodyFormDataList: [], apiBodyRaw: '',
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
      ...(item.type === 'start' && !itemDefaultDataCopy.triggers && { triggers: [{ id: uuidv4(), name: 'Gatilho Inicial', type: 'manual', webhookPayloadVariable: 'webhook_payload' }] }),
      ...itemDefaultDataCopy, 
      x: Math.round((logicalDropCoords.x - NODE_WIDTH / 2) / GRID_SIZE) * GRID_SIZE, 
      y: Math.round((logicalDropCoords.y - NODE_HEADER_HEIGHT_APPROX / 2) / GRID_SIZE) * GRID_SIZE, 
    };
    
    console.log("[FlowBuilderClient] New node created:", JSON.parse(JSON.stringify(newNode)));
    updateActiveWorkspace(ws => {
      const updatedNodes = [...(ws.nodes || []), newNode]; 
      console.log("[FlowBuilderClient] Nodes after adding new node. New count:", updatedNodes.length);
      return { ...ws, nodes: updatedNodes };
    });
  }, [activeWorkspaceId, updateActiveWorkspace, definedVariablesInFlow]);

  const updateNode = useCallback((id: string, changes: Partial<NodeData>) => {
    console.log("[FlowBuilderClient] Node updated:", {id, changes});
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

      // Converter para coordenadas lógicas para currentX/Y
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
    [canvasRef, setDrawingLine] 
  ); 

  const handleCanvasMouseDownForPanning = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (canvasRef.current && (e.target === canvasRef.current || (e.target as HTMLElement).id === 'flow-content-wrapper')) { 
      isPanning.current = true;
      panStartMousePosition.current = { x: e.clientX, y: e.clientY };
      initialCanvasOffsetOnPanStart.current = { ...canvasOffsetCbRef.current };
      if (canvasRef.current) canvasRef.current.style.cursor = 'grabbing';
      setHighlightedNodeIdBySession(null); 
    }
  }, [canvasRef]); 

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

      // Converter para coordenadas lógicas
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
  }, [drawingLine, setDrawingLine, setCanvasOffset, canvasRef]); 

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
            console.warn("[FlowBuilderClient] No activeWorkspaceId, cannot add connection.");
            setDrawingLine(null);
            return;
        }
        console.log("[FlowBuilderClient] Attempting to add connection:", {id: uuidv4(), from: drawingLine.fromId, to: toId as string, sourceHandle: drawingLine.sourceHandleId});
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
                console.log("[FlowBuilderClient] Duplicate connection prevented (same from, to, and handle).");
            } else if (existingConnectionFromThisSourceHandle) {
                console.log("[FlowBuilderClient] Replacing existing connection from same source handle.");
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
  }, [drawingLine, activeWorkspaceId, updateActiveWorkspace, setDrawingLine, canvasRef]); 

  const deleteConnection = useCallback((connectionId: string) => {
    updateActiveWorkspace(ws => ({
      ...ws,
      connections: (ws.connections || []).filter(conn => conn.id !== connectionId)
    }));
  }, [updateActiveWorkspace]);

  useEffect(() => {
    if (!hasMounted) return;
    
    const currentCanvasForListeners = canvasRef.current; 
    document.addEventListener('mousemove', handleGlobalMouseMove);
    document.addEventListener('mouseup', handleGlobalMouseUp);
    
    const handleMouseLeaveWindow = () => {
      if (isPanning.current) {
        isPanning.current = false;
        if (currentCanvasForListeners) currentCanvasForListeners.style.cursor = 'grab';
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

  }, [setZoomLevel, setCanvasOffset, canvasRef]); 

  const handleHighlightNodeInFlow = useCallback((nodeId: string | null) => {
    setHighlightedNodeIdBySession(nodeId);
  }, []);


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
          onHighlightNode={handleHighlightNodeInFlow} 
        />
        <div className="flex-1 flex relative overflow-hidden"> {/* Era flex-col aqui, removido para testar pan */}
          <FlowSidebar />
          <div className="flex-1 flex relative overflow-hidden" >  {/* Container para o Canvas */}
            <Canvas
              ref={canvasRef} // Passando a ref para o componente Canvas
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
              highlightedNodeIdBySession={highlightedNodeIdBySession}
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

