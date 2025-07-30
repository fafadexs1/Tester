
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
import ErrorBoundary from '@/components/ErrorBoundary';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { v4 as uuidv4 } from 'uuid';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/components/auth/AuthProvider';
import { 
    clientSideLoadWorkspacesAction,
    saveWorkspaceToDB,
    deleteWorkspaceFromDB,
    loadActiveWorkspaceFromDB,
} from '@/app/actions/databaseActions';


const LOCAL_STORAGE_KEY_CHAT_PANEL_OPEN = 'nexusflowChatPanelOpen';

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
  const { user } = useAuth();
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
  const initialCanvasOffsetOnPanStart = useRef<CanvasOffset>({ x: 0, y: 0 });
  
  const canvasRef = useRef<HTMLDivElement>(null);
  
  const canvasOffsetCbRef = useRef(canvasOffset);
  const zoomLevelCbRef = useRef(zoomLevel);

  const [isChatPanelOpen, setIsChatPanelOpen] = useState(true);
  const [hasMounted, setHasMounted] = useState(false);
  const [definedVariablesInFlow, setDefinedVariablesInFlow] = useState<string[]>([]);

  const getActiveWorkspaceKey = useCallback(() => `activeWorkspaceId_${user?.username}`, [user]);

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
            if (trigger.type === 'webhook' && Array.isArray(trigger.variableMappings)) {
              trigger.variableMappings.forEach(mapping => {
                if(mapping.flowVariable) variablesSet.add(mapping.flowVariable.trim().replace(/\{\{/g, '').replace(/\}\}/g, ''));
              })
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
  
  const loadWorkspaces = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    console.log("[FlowBuilderClient] Loading workspaces from DB...");
    try {
        const dbWorkspaces = await clientSideLoadWorkspacesAction();
        const activeIdFromStorage = localStorage.getItem(getActiveWorkspaceKey());
        
        if (dbWorkspaces.length > 0) {
            setWorkspaces(dbWorkspaces);
            const activeExistsInDB = dbWorkspaces.some(ws => ws.id === activeIdFromStorage);
            if (activeIdFromStorage && activeExistsInDB) {
                setActiveWorkspaceId(activeIdFromStorage);
            } else {
                // If stored active ID is invalid, or doesn't exist, set to most recently updated
                const mostRecent = await loadActiveWorkspaceFromDB();
                setActiveWorkspaceId(mostRecent ? mostRecent.id : dbWorkspaces[0].id);
            }
        } else {
            console.log("[FlowBuilderClient] No workspaces in DB. Creating a new one.");
            const newId = uuidv4();
            const newWorkspace: WorkspaceData = { id: newId, name: 'Meu Primeiro Fluxo', nodes: [], connections: [], owner: user.username };
            const saveResult = await saveWorkspaceToDB(newWorkspace);
            if(saveResult.success) {
                setWorkspaces([newWorkspace]);
                setActiveWorkspaceId(newId);
            } else {
                 toast({ title: "Erro", description: `Não foi possível criar o primeiro fluxo: ${saveResult.error}`, variant: "destructive" });
            }
        }
    } catch(error: any) {
        console.error("[FlowBuilderClient] Failed to load workspaces from DB:", error);
        toast({ title: "Erro de Carregamento", description: "Não foi possível carregar os fluxos do banco de dados.", variant: "destructive" });
        setWorkspaces([]);
        setActiveWorkspaceId(null);
    } finally {
        setIsLoading(false);
    }
  }, [user, getActiveWorkspaceKey, toast]);


  useEffect(() => {
    if (user && hasMounted) {
      loadWorkspaces();
    }
  }, [user, hasMounted, loadWorkspaces]);
  

  useEffect(() => {
    if (hasMounted && activeWorkspaceId && user) {
      localStorage.setItem(getActiveWorkspaceKey(), activeWorkspaceId);
    }
  }, [activeWorkspaceId, hasMounted, user, getActiveWorkspaceKey]);

  const handleSaveWorkspaces = useCallback(async () => {
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
        description: `O fluxo "${activeWorkspace.name}" foi salvo no banco de dados.`,
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
    if (!hasMounted || !user) return;
    toast({
      title: "Descartando Alterações...",
      description: "Recarregando fluxos do banco de dados.",
    });
    await loadWorkspaces(); // Reload all from DB
    setHighlightedNodeIdBySession(null); 
  }, [hasMounted, user, loadWorkspaces, toast]);

  const addWorkspace = useCallback(async () => {
    if (!hasMounted || !user) return;
    const newWorkspaceId = uuidv4();
    const newWorkspace: WorkspaceData = {
      id: newWorkspaceId,
      name: `Novo Fluxo ${workspaces.length + 1}`,
      nodes: [],
      connections: [],
      owner: user.username,
    };
    
    setWorkspaces(prev => [...prev, newWorkspace]);
    setActiveWorkspaceId(newWorkspaceId);
    
    // Save the new workspace to DB immediately
    const result = await saveWorkspaceToDB(newWorkspace);
     if (result.success) {
      toast({
        title: "Novo Fluxo Criado",
        description: `O fluxo "${newWorkspace.name}" foi criado e salvo.`,
      });
    } else {
      toast({
        title: "Erro ao Criar",
        description: `Não foi possível salvar o novo fluxo: ${result.error}`,
        variant: "destructive",
      });
      // Rollback UI change if save fails
      setWorkspaces(workspaces);
      setActiveWorkspaceId(activeWorkspaceId);
    }
  }, [workspaces, hasMounted, user, activeWorkspaceId, toast]);

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
    
    let tempExistingVars: string[] = [];
    const currentWsForVars = workspaces.find(ws => ws.id === activeWorkspaceId);
    if (currentWsForVars?.nodes) {
        currentWsForVars.nodes.forEach(n => {
            VARIABLE_DEFINING_FIELDS.forEach(field => {
                const varName = n[field] as string | undefined;
                if (varName && varName.trim() !== '') {
                    tempExistingVars.push(varName.trim().replace(/\{\{/g, '').replace(/\}\}/g, ''));
                }
            });
            if (n.type === 'start' && Array.isArray(n.triggers)) {
              n.triggers.forEach(trigger => {
                if (trigger.type === 'webhook' && Array.isArray(trigger.variableMappings)) {
                  trigger.variableMappings.forEach(mapping => {
                    if(mapping.flowVariable) tempExistingVars.push(mapping.flowVariable.trim().replace(/\{\{/g, '').replace(/\}\}/g, ''));
                  })
                }
              });
            }
        });
        tempExistingVars = Array.from(new Set(tempExistingVars));
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
      ...(item.type === 'start' && !itemDefaultDataCopy.triggers && { triggers: [{ id: uuidv4(), name: 'Gatilho Inicial', type: 'manual', variableMappings: [] }] }),
      ...itemDefaultDataCopy, 
      x: Math.round((logicalDropCoords.x - NODE_WIDTH / 2) / GRID_SIZE) * GRID_SIZE, 
      y: Math.round((logicalDropCoords.y - NODE_HEADER_HEIGHT_APPROX / 2) / GRID_SIZE) * GRID_SIZE, 
    };
    
    updateActiveWorkspace(ws => {
      const updatedNodes = [...(ws.nodes || []), newNode]; 
      return { ...ws, nodes: updatedNodes };
    });
  }, [activeWorkspaceId, updateActiveWorkspace, workspaces]);

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
        if (!activeWorkspaceId) {
            console.warn("[FlowBuilderClient] No activeWorkspaceId, cannot add connection.");
            setDrawingLine(null);
            return;
        }
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
  }, [drawingLine, activeWorkspaceId, updateActiveWorkspace, setDrawingLine, canvasRef]); 

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


  if (isLoading && hasMounted) {
    return <div className="flex items-center justify-center h-screen">Carregando seus fluxos...</div>;
  }

  return (
    <ErrorBoundary>
      <DndProvider backend={HTML5Backend}>
        <div className="flex flex-col h-screen bg-background font-sans select-none overflow-hidden">
          <TopBar
            workspaces={workspaces}
            activeWorkspaceId={activeWorkspaceId}
            onAddWorkspace={addWorkspace}
            onSwitchWorkspace={switchWorkspace}
            onSaveWorkspaces={handleSaveWorkspaces}
            onDiscardChanges={handleDiscardChanges}
            appName="NexusFlow"
            isChatPanelOpen={isChatPanelOpen}
            onToggleChatPanel={toggleChatPanel}
            onZoom={handleZoom}
            currentZoomLevel={zoomLevel}
            onHighlightNode={handleHighlightNodeInFlow} 
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
    </ErrorBoundary>
  );
}

    