
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

// Campos nos nós que definem uma variável que pode ser usada em outros lugares
const VARIABLE_DEFINING_FIELDS: (keyof NodeData)[] = [
  'variableToSaveResponse', 'variableToSaveChoice', 'variableName', 
  'apiOutputVariable', 'variableToSaveDate', 'codeOutputVariable', 
  'jsonOutputVariable', 'fileUrlVariable', 'ratingOutputVariable', 
  'aiOutputVariable', 'agentResponseVariable', 'supabaseResultVariable',
];

// Função para gerar nomes de variáveis únicos
function generateUniqueVariableName(baseName: string, existingNames: string[]): string {
  if (!baseName || baseName.trim() === '') return ''; // Retorna vazio se o nome base for inválido
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

  const [canvasOffset, setCanvasOffset] = useState<CanvasOffset>({ x: GRID_SIZE * 2, y: GRID_SIZE * 2 });
  const [zoomLevel, setZoomLevel] = useState(1);
  
  const isPanning = useRef(false);
  const panStartMousePosition = useRef({ x: 0, y: 0 });
  const initialCanvasOffsetOnPanStart = useRef({ x: 0, y: 0 });
  
  const canvasRef = useRef<HTMLDivElement>(null);
  
  // Refs para valores que mudam frequentemente e são usados em callbacks estáveis
  const canvasOffsetCbRef = useRef(canvasOffset);
  const zoomLevelCbRef = useRef(zoomLevel);

  const [isChatPanelOpen, setIsChatPanelOpen] = useState(true); // Default to true
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
        setIsChatPanelOpen(true); // Fallback
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
      const variables: Set<string> = new Set();
      activeWorkspace.nodes.forEach(n => {
        VARIABLE_DEFINING_FIELDS.forEach(field => {
          const varName = n[field] as string | undefined;
          if (varName && varName.trim() !== '') {
            variables.add(varName.trim().replace(/\{\{/g, '').replace(/\}\}/g, ''));
          }
        });
        // Adicionar variáveis de gatilhos de webhook do nó 'start'
         if (n.type === 'start' && n.triggers) {
          n.triggers.forEach(trigger => {
            if (trigger.type === 'webhook' && trigger.webhookPayloadVariable) {
              variables.add(trigger.webhookPayloadVariable.replace(/\{\{/g, '').replace(/\}\}/g, ''));
            }
          });
        }
      });
      
      // Apenas atualiza se o array realmente mudou para evitar re-renders desnecessários
      setDefinedVariablesInFlow(prevDefinedVars => {
        const newVarsArray = Array.from(variables).sort();
        if (JSON.stringify(prevDefinedVars) === JSON.stringify(newVarsArray)) {
          return prevDefinedVars; // Retorna a mesma referência se não houver mudanças
        }
        return newVarsArray; // Retorna o novo array
      });

    } else {
       // Garante que limpa se não houver nós ou workspace
       setDefinedVariablesInFlow(prevDefinedVars => {
        if (prevDefinedVars.length === 0) return prevDefinedVars;
        return [];
      });
    }
  }, [activeWorkspace?.nodes]);

  const toggleChatPanel = useCallback(() => {
    setIsChatPanelOpen(prev => {
      const newState = !prev;
      if (hasMounted) { // Garante que localStorage só seja acessado no cliente
        localStorage.setItem(LOCAL_STORAGE_KEY_CHAT_PANEL_OPEN, JSON.stringify(newState));
      }
      return newState;
    });
  }, [hasMounted]);

  // Carregar dados do DB
  useEffect(() => {
    if (!hasMounted) return; // Só executa no cliente
    console.log("[FlowBuilderClient] Initializing: Attempting to load workspaces from DB.");
    setIsLoading(true);
    
    async function loadData() {
      try {
        const loadedWorkspacesFromDB = await clientSideLoadWorkspacesAction();
        console.log("[FlowBuilderClient] Workspaces loaded from DB count:", loadedWorkspacesFromDB.length);

        if (loadedWorkspacesFromDB && loadedWorkspacesFromDB.length > 0) {
          setWorkspaces(loadedWorkspacesFromDB);
          
          // Default para o mais recente do DB (já ordenado pela action)
          let newActiveId = loadedWorkspacesFromDB[0].id; 
          const lastActiveIdFromStorage = localStorage.getItem(LOCAL_STORAGE_KEY_ACTIVE_WORKSPACE_UI);

          if (lastActiveIdFromStorage && loadedWorkspacesFromDB.some(ws => ws.id === lastActiveIdFromStorage)) {
            newActiveId = lastActiveIdFromStorage;
            console.log("[FlowBuilderClient] Active workspace ID set from localStorage (and exists in DB):", newActiveId);
          } else {
            console.log("[FlowBuilderClient] Active workspace ID set to most recent from DB (or last UI active not found/valid):", newActiveId);
          }
          setActiveWorkspaceId(newActiveId);
          // Salva o ID ativo determinado (seja do localStorage ou o padrão do DB) de volta no localStorage
          localStorage.setItem(LOCAL_STORAGE_KEY_ACTIVE_WORKSPACE_UI, newActiveId);

        } else {
          console.log("[FlowBuilderClient] No workspaces in DB, creating initial one.");
          const initialId = uuidv4();
          const initialWorkspace: WorkspaceData = {
            id: initialId,
            name: 'Meu Primeiro Fluxo (DB)',
            nodes: [], // Começa com zero nós
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
            const errorMsg = saveResult.errors && saveResult.errors.length > 0 
              ? `ID: ${saveResult.errors[0].workspaceId}, Erro: ${typeof saveResult.errors[0].error === 'string' ? saveResult.errors[0].error : JSON.stringify(saveResult.errors[0].error)}`
              : "Erro desconhecido ao salvar.";
            toast({ 
              title: "Erro ao Salvar Fluxo Inicial", 
              description: `Falha ao salvar no banco de dados. Detalhe: ${errorMsg}`, 
              variant: "destructive",
              duration: 9000
            });
            // Fallback para um workspace em memória para não quebrar a UI completamente
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
  }, [hasMounted, toast]); // `toast` é estável
  

  // Salvar activeWorkspaceId no localStorage quando mudar
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
      const errorDetail = result.errors && result.errors.length > 0 
        ? result.errors.map(err => `ID: ${err.workspaceId}, Erro: ${typeof err.error === 'string' ? err.error : JSON.stringify(err.error)}`).join('; ')
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
        
        let newActiveId = loadedWorkspacesFromDB[0].id; // Default ao mais recente do DB
        const lastActiveIdFromStorage = localStorage.getItem(LOCAL_STORAGE_KEY_ACTIVE_WORKSPACE_UI);
        if (lastActiveIdFromStorage && loadedWorkspacesFromDB.some(ws => ws.id === lastActiveIdFromStorage)) {
            newActiveId = lastActiveIdFromStorage;
        }
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
            const errorMsg = saveResult.errors && saveResult.errors.length > 0
              ? `ID: ${saveResult.errors[0].workspaceId}, Erro: ${typeof saveResult.errors[0].error === 'string' ? saveResult.errors[0].error : JSON.stringify(saveResult.errors[0].error)}`
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
    
    // Atualiza o estado local primeiro para feedback rápido na UI
    const updatedWorkspaces = [...workspaces, newWorkspace];
    setWorkspaces(updatedWorkspaces);
    setActiveWorkspaceId(newWorkspaceId); 
    localStorage.setItem(LOCAL_STORAGE_KEY_ACTIVE_WORKSPACE_UI, newWorkspaceId); // Salva o novo ID ativo

    console.log("[FlowBuilderClient] New workspace created locally, attempting to save all workspaces to DB.");
    const saveResult = await clientSideSaveWorkspacesAction(updatedWorkspaces); 
    console.log('[FlowBuilderClient] Result from saving new workspace (and others) to DB:', saveResult);

    if (saveResult.success) {
        toast({
          title: "Novo Fluxo Criado",
          description: `${newWorkspace.name} foi adicionado e salvo no DB.`,
        });
      } else {
          console.error("[FlowBuilderClient] Failed to save new workspace to DB", saveResult.errors);
          const errorMsg = saveResult.errors && saveResult.errors.length > 0
            ? `ID: ${saveResult.errors[0].workspaceId}, Erro: ${typeof saveResult.errors[0].error === 'string' ? saveResult.errors[0].error : JSON.stringify(saveResult.errors[0].error)}`
            : "Erro desconhecido ao salvar.";
          toast({
            title: "Erro ao Salvar Novo Fluxo",
            description: `Não foi possível salvar o novo fluxo no banco de dados. Detalhe: ${errorMsg}`,
            variant: "destructive",
            duration: 9000
          });
          // Reverter a adição local se o salvamento no DB falhar
          setWorkspaces(prev => prev.filter(ws => ws.id !== newWorkspaceId));
          // Define o workspace ativo para o anterior ou nulo se não houver mais workspaces
          if(workspaces.length > 0) setActiveWorkspaceId(workspaces[0].id); else setActiveWorkspaceId(null);
      }
  }, [workspaces, toast, hasMounted]);

  const switchWorkspace = useCallback((workspaceId: string) => {
    if (workspaces.find(ws => ws.id === workspaceId)) {
        setActiveWorkspaceId(workspaceId); 
        // activeWorkspaceId já é salvo no localStorage por seu próprio useEffect
    } else {
        console.warn(`[FlowBuilderClient] Attempted to switch to non-existent workspace ID: ${workspaceId}`);
        if (workspaces.length > 0) {
            const firstId = workspaces[0].id;
            setActiveWorkspaceId(firstId);
        } else {
            setActiveWorkspaceId(null); 
        }
    }
  }, [workspaces]); // `workspaces` é uma dependência necessária aqui
  
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
  }, [activeWorkspaceId]); // `setWorkspaces` é estável, `activeWorkspaceId` é a dependência chave

  const handleDropNode = useCallback((item: DraggableBlockItemData, logicalDropCoords: { x: number, y: number }) => {
    if (!activeWorkspaceId) {
      console.error('[FlowBuilderClient] No activeWorkspaceId, cannot add node.');
      return;
    }
    
    // Recalcula as variáveis existentes com base no estado ATUAL de `workspaces` e `activeWorkspaceId`
    // para garantir que os nomes únicos sejam gerados corretamente.
    const currentActiveWkspForVars = workspaces.find(ws => ws.id === activeWorkspaceId);
    const existingVariableNames: string[] = [];
    if (currentActiveWkspForVars?.nodes) { 
      currentActiveWkspForVars.nodes.forEach(node => {
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
    
    const itemDefaultDataCopy = item.defaultData ? JSON.parse(JSON.stringify(item.defaultData)) : {};

    // Gera nomes de variáveis únicos para o novo nó
    VARIABLE_DEFINING_FIELDS.forEach(field => {
      if (itemDefaultDataCopy.hasOwnProperty(field)) {
        const baseVarName = itemDefaultDataCopy[field] as string | undefined;
        if (baseVarName && baseVarName.trim() !== '') {
          const uniqueName = generateUniqueVariableName(baseVarName, existingVariableNames);
          (itemDefaultDataCopy as any)[field] = uniqueName;
          // Adiciona o novo nome único à lista de existentes para a próxima verificação no mesmo drop (se houver múltiplos campos de var)
          if (uniqueName !== baseVarName.replace(/\{\{/g, '').replace(/\}\}/g, '').trim()) { 
            existingVariableNames.push(uniqueName); // Adiciona apenas se realmente mudou
          }
        }
      }
    });
    
    const baseNodeData: Omit<NodeData, 'id' | 'type' | 'title' | 'x' | 'y' | 'triggers'> = {
      text: '', promptText: '', inputType: 'text', variableToSaveResponse: '',
      questionText: '', optionsList: '', variableToSaveChoice: '',
      mediaDisplayType: 'image', mediaDisplayUrl: '', mediaDisplayText: '', dataAiHint: '',
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
      // sendViaWhatsApp: false, whatsappTargetPhoneNumber: '', // Removido
    };

    const newNode: NodeData = {
      id: uuidv4(),
      type: item.type as NodeData['type'],
      title: item.label,
      ...baseNodeData, 
      ...(item.type === 'start' && { triggers: [{ id: uuidv4(), name: 'Gatilho Inicial', type: 'manual', webhookPayloadVariable: 'webhook_payload' }] }),
      ...itemDefaultDataCopy, 
      x: Math.round((logicalDropCoords.x - NODE_WIDTH / 2) / GRID_SIZE) * GRID_SIZE, 
      y: Math.round((logicalDropCoords.y - NODE_HEADER_HEIGHT_APPROX / 2) / GRID_SIZE) * GRID_SIZE, 
    };
    
    console.log("[FlowBuilderClient] New node created:", JSON.parse(JSON.stringify(newNode)));
    updateActiveWorkspace(ws => {
      // CORREÇÃO APLICADA AQUI: Garante que estamos adicionando ao array de nós existente.
      const updatedNodes = [...(ws.nodes || []), newNode]; 
      console.log("[FlowBuilderClient] Nodes after adding new node. New count:", updatedNodes.length); // Removido log do array inteiro para performance
      return { ...ws, nodes: updatedNodes };
    });
  }, [activeWorkspaceId, updateActiveWorkspace, workspaces]); // `workspaces` é necessário para obter currentActiveWkspForVars

  const updateNode = useCallback((id: string, changes: Partial<NodeData>) => {
    console.log("[FlowBuilderClient] Node updated:", {id, changes });
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
      if (!canvasRef.current) {
        console.warn('[FlowBuilderClient] handleStartConnection: canvasRef.current is null.');
        return;
      }
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

      // Coordenadas lógicas do ponto de início da linha
      const logicalStartX = fromNodeData.x + NODE_WIDTH; 
      const logicalStartY = fromNodeData.y + startYOffset; 
      
      // Coordenadas visuais do mouse relativas ao canvas (para a ponta da linha que segue o mouse)
      const mouseXOnCanvasVisual = event.clientX - canvasRect.left;
      const mouseYOnCanvasVisual = event.clientY - canvasRect.top;

      setDrawingLine({
        fromId: fromNodeData.id,
        sourceHandleId,
        startX: logicalStartX,       // Lógico
        startY: logicalStartY,       // Lógico
        currentX: mouseXOnCanvasVisual, // Visual, relativo ao canvasElementRef
        currentY: mouseYOnCanvasVisual,  // Visual, relativo ao canvasElementRef
      });
    },
    [canvasRef, setDrawingLine] // canvasOffsetCbRef e zoomLevelCbRef são usados via ref, não precisam ser deps diretas
  ); 


  const handleCanvasMouseDownForPanning = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (canvasRef.current && (e.target === canvasRef.current || (e.target as HTMLElement).id === 'flow-content-wrapper')) { 
      isPanning.current = true;
      panStartMousePosition.current = { x: e.clientX, y: e.clientY };
      initialCanvasOffsetOnPanStart.current = { ...canvasOffsetCbRef.current };
      if (canvasRef.current) canvasRef.current.style.cursor = 'grabbing';
    }
  }, [canvasRef]); // canvasOffsetCbRef é uma ref, não precisa ser dep

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
      
      // Coordenadas visuais do mouse relativas ao canvas (elemento que tem a grade)
      const mouseXOnCanvasVisual = e.clientX - canvasRect.left;
      const mouseYOnCanvasVisual = e.clientY - canvasRect.top;

      // As coordenadas currentX/Y na drawingLine são visuais em relação ao canvasElementRef
      setDrawingLine((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          currentX: mouseXOnCanvasVisual, 
          currentY: mouseYOnCanvasVisual,
        };
      });
    }
  }, [drawingLine, setDrawingLine, setCanvasOffset, canvasRef]); // canvasOffsetCbRef e zoomLevelCbRef são usados via ref

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
          // Permite conectar ao corpo do nó se não for um conector de saída
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

            // Permite apenas uma conexão saindo de um sourceHandle específico.
            // Se uma nova conexão for feita do mesmo sourceHandle, a anterior é removida.
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
  }, [drawingLine, activeWorkspaceId, updateActiveWorkspace, setDrawingLine, canvasRef]); // canvasRef é estável

  const deleteConnection = useCallback((connectionIdToDelete: string) => {
    updateActiveWorkspace(ws => ({
        ...ws,
        connections: (ws.connections || []).filter(conn => conn.id !== connectionIdToDelete)
    }));
    setHighlightedConnectionId(null); // Limpa o destaque
  }, [updateActiveWorkspace, setHighlightedConnectionId]); // setHighlightedConnectionId é estável

  // Efeito para listeners globais
  useEffect(() => {
    if (!hasMounted) return;
    // Não precisamos de canvasRef.current aqui, pois as funções de callback já o usam.
    
    document.addEventListener('mousemove', handleGlobalMouseMove);
    document.addEventListener('mouseup', handleGlobalMouseUp);
    
    // Cleanup para mouseleave (quando o mouse sai da janela do navegador)
    const handleMouseLeaveWindow = () => {
      if (isPanning.current) {
        isPanning.current = false;
        // Não precisa mudar o cursor aqui, pois o mouseup faria isso.
        // Mas é bom resetar o estado de panning.
      }
      if (drawingLine) { // Se estava desenhando uma linha e o mouse saiu da janela
        setDrawingLine(null);
      }
    };
    document.body.addEventListener('mouseleave', handleMouseLeaveWindow);

    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
      document.body.removeEventListener('mouseleave', handleMouseLeaveWindow);
    };
  }, [handleGlobalMouseMove, handleGlobalMouseUp, drawingLine, hasMounted, setDrawingLine]); // drawingLine e setDrawingLine são importantes aqui
  

  const handleZoom = useCallback((direction: 'in' | 'out' | 'reset') => {
    if (!canvasRef.current) {
        console.warn("[FlowBuilderClient] handleZoom: canvasRef.current is null.");
        return; 
    }

    const currentZoom = zoomLevelCbRef.current;
    const currentOffset = canvasOffsetCbRef.current;
    const canvasRect = canvasRef.current.getBoundingClientRect(); 
    
    // Ponto de zoom: centro da viewport do canvas
    const viewportCenterX = canvasRect.width / 2;
    const viewportCenterY = canvasRect.height / 2;

    let newZoomLevel: number;

    if (direction === 'reset') {
      newZoomLevel = 1;
    } else {
      const zoomFactor = direction === 'in' ? 1 + ZOOM_STEP : 1 - ZOOM_STEP;
      newZoomLevel = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, currentZoom * zoomFactor));
    }

    if (newZoomLevel === currentZoom && direction !== 'reset') return; // Sem mudança no zoom

    // Calcular o ponto lógico no centro da viewport ANTES do zoom
    const logicalCenterXBeforeZoom = (viewportCenterX - currentOffset.x) / currentZoom;
    const logicalCenterYBeforeZoom = (viewportCenterY - currentOffset.y) / currentZoom;

    // Calcular a nova posição visual desse ponto lógico DEPOIS do zoom
    const visualXOfLogicalCenterAfterZoom = logicalCenterXBeforeZoom * newZoomLevel;
    const visualYOfLogicalCenterAfterZoom = logicalCenterYBeforeZoom * newZoomLevel;
    
    // Ajustar o canvasOffset para que o ponto lógico central permaneça no centro visual
    const newOffsetX = viewportCenterX - visualXOfLogicalCenterAfterZoom;
    const newOffsetY = viewportCenterY - visualYOfLogicalCenterAfterZoom;
    
    setZoomLevel(newZoomLevel);
    setCanvasOffset({ x: newOffsetX, y: newOffsetY });

  }, [setZoomLevel, setCanvasOffset, canvasRef]); // zoomLevelCbRef e canvasOffsetCbRef são refs, canvasRef é estável


  if (isLoading && hasMounted) { // Garante que só mostra loading no cliente após tentar carregar
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
        <div className="flex-1 flex relative overflow-hidden"> {/* Flex row para sidebar e conteúdo principal */}
          <FlowSidebar />
          <div className="flex-1 flex relative overflow-hidden" > {/* Container para o Canvas se expandir */}
            <Canvas
              ref={canvasRef} // Passa a ref para o Canvas poder ser acessado
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
          {/* Renderiza TestChatPanel apenas no cliente e se estiver aberto */}
          {hasMounted && isChatPanelOpen && (
            <TestChatPanel
              activeWorkspace={activeWorkspace} // Passa o workspace ativo para o chat
            />
          )}
        </div>
      </div>
    </DndProvider>
  );
}


