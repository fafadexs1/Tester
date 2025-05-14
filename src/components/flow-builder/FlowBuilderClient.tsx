
"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { NodeData, Connection, DrawingLineData, CanvasOffset, DraggableBlockItemData, WorkspaceData } from '@/lib/types';
import { NODE_WIDTH, NODE_HEADER_CONNECTOR_Y_OFFSET, NODE_HEADER_HEIGHT_APPROX, GRID_SIZE } from '@/lib/constants';
import FlowSidebar from './FlowSidebar';
import Canvas from './Canvas';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { v4 as uuidv4 } from 'uuid';

const LOCAL_STORAGE_KEY_WORKSPACES = 'flowiseLiteWorkspaces';
const LOCAL_STORAGE_KEY_ACTIVE_WORKSPACE = 'flowiseLiteActiveWorkspace';

export default function FlowBuilderClient() {
  const [workspaces, setWorkspaces] = useState<WorkspaceData[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  
  const [drawingLine, setDrawingLine] = useState<DrawingLineData | null>(null);
  const [highlightedConnectionId, setHighlightedConnectionId] = useState<string | null>(null);

  const [canvasOffset, setCanvasOffset] = useState<CanvasOffset>({ x: GRID_SIZE * 2, y: GRID_SIZE * 2 });
  const isPanning = useRef(false);
  const panStartMousePosition = useRef({ x: 0, y: 0 });
  const initialCanvasOffsetOnPanStart = useRef({ x: 0, y: 0 });
  const canvasWrapperRef = useRef<HTMLDivElement>(null); 

  // Load workspaces from localStorage on initial mount
  useEffect(() => {
    const savedWorkspacesStr = localStorage.getItem(LOCAL_STORAGE_KEY_WORKSPACES);
    let loadedWorkspaces: WorkspaceData[] = [];
    if (savedWorkspacesStr) {
      try {
        loadedWorkspaces = JSON.parse(savedWorkspacesStr);
      } catch (e) {
        console.error("Failed to parse workspaces from localStorage", e);
        loadedWorkspaces = [];
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
      // Create an initial workspace if none are loaded
      const initialId = uuidv4();
      const initialWorkspace: WorkspaceData = {
        id: initialId,
        name: 'Meu Primeiro Fluxo',
        nodes: [],
        connections: [],
      };
      setWorkspaces([initialWorkspace]);
      setActiveWorkspaceId(initialId);
    }
  }, []);

  // Save workspaces to localStorage whenever they change
  useEffect(() => {
    if (workspaces.length > 0) { // Only save if there's something to save
        localStorage.setItem(LOCAL_STORAGE_KEY_WORKSPACES, JSON.stringify(workspaces));
    }
    if (activeWorkspaceId) {
        localStorage.setItem(LOCAL_STORAGE_KEY_ACTIVE_WORKSPACE, activeWorkspaceId);
    }
  }, [workspaces, activeWorkspaceId]);


  const activeWorkspace = workspaces.find(ws => ws.id === activeWorkspaceId);
  const currentNodes = activeWorkspace ? activeWorkspace.nodes : [];
  const currentConnections = activeWorkspace ? activeWorkspace.connections : [];

  const addWorkspace = useCallback(() => {
    const newWorkspaceId = uuidv4();
    const newWorkspace: WorkspaceData = {
      id: newWorkspaceId,
      name: `Novo Fluxo ${workspaces.length + 1}`,
      nodes: [],
      connections: [],
    };
    setWorkspaces(prev => [...prev, newWorkspace]);
    setActiveWorkspaceId(newWorkspaceId);
  }, [workspaces.length]);

  const switchWorkspace = useCallback((workspaceId: string) => {
    setActiveWorkspaceId(workspaceId);
  }, []);
  
  // Helper function to update the active workspace's data
  const updateActiveWorkspace = useCallback((updater: (workspace: WorkspaceData) => WorkspaceData) => {
    if (!activeWorkspaceId) return;
    setWorkspaces(prevWorkspaces =>
      prevWorkspaces.map(ws =>
        ws.id === activeWorkspaceId ? updater(ws) : ws
      )
    );
  }, [activeWorkspaceId]);


  const handleDropNode = useCallback((item: DraggableBlockItemData, viewportOffset: { x: number, y: number }) => {
    if (!activeWorkspaceId) return;

    const baseNodeData: Omit<NodeData, 'id' | 'type' | 'title' | 'x' | 'y'> = {
      text: '', promptText: '', inputType: 'text', variableToSaveResponse: '',
      questionText: '', optionsList: '', variableToSaveChoice: '',
      mediaDisplayType: 'image', mediaDisplayUrl: '', mediaDisplayText: '',
      conditionVariable: '', conditionOperator: '==', conditionValue: '',
      variableName: '', variableValue: '', delayDuration: 1000, typingDuration: 1500,
      logMessage: '', codeSnippet: '', codeOutputVariable: '', inputJson: '', jsonataExpression: '', jsonOutputVariable: '',
      uploadPromptText: '', fileTypeFilter: '', maxFileSizeMB: 5, fileUrlVariable: '',
      ratingQuestionText: '', maxRatingValue: 5, ratingIconType: 'star', ratingOutputVariable: '',
      apiUrl: '', apiMethod: 'GET', apiHeaders: '{ "Content-Type": "application/json" }', apiBody: '{}',
      redirectUrl: '', dateInputLabel: '', variableToSaveDate: '',
      emailTo: '', emailSubject: '', emailBody: '', emailFrom: '',
      googleSheetId: '', googleSheetName: '', googleSheetRowData: '',
      instanceName: 'evolution_instance', phoneNumber: '', textMessage: '', mediaUrl: '', mediaType: 'image', caption: '', groupName: '', participants: '',
      sendViaWhatsApp: false, whatsappTargetPhoneNumber: '',
      aiPromptText: '', aiModelName: '', aiOutputVariable: '',
      agentName: 'Agente Inteligente Padrão', agentSystemPrompt: 'Você é um assistente IA. Responda às perguntas do usuário de forma concisa e prestativa.',
      userInputVariable: '{{entrada_usuario}}', agentResponseVariable: 'resposta_do_agente', maxConversationTurns: 5, temperature: 0.7,
    };

    const newNode: NodeData = {
      id: uuidv4(),
      type: item.type as NodeData['type'],
      title: item.label,
      ...baseNodeData, 
      ...(item.defaultData || {}), 
      x: viewportOffset.x - NODE_WIDTH / 2, 
      y: viewportOffset.y - NODE_HEADER_HEIGHT_APPROX / 2, 
    };
    
    updateActiveWorkspace(ws => ({ ...ws, nodes: [...ws.nodes, newNode] }));
  }, [activeWorkspaceId, updateActiveWorkspace]);

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

  const handleStartConnection = useCallback((e: React.MouseEvent, fromId: string, sourceHandleId = 'default') => {
    const fromNode = currentNodes.find(n => n.id === fromId); // Use currentNodes from active workspace
    if (!fromNode || !canvasWrapperRef.current) return;
    
    const canvasElement = canvasWrapperRef.current?.querySelector('.relative.flex-1.bg-background'); 
    if (!canvasElement) return;
    const canvasRect = canvasElement.getBoundingClientRect();

    let startYOffset = NODE_HEADER_CONNECTOR_Y_OFFSET;
    if (fromNode.type === 'condition') {
        if (sourceHandleId === 'true') startYOffset = NODE_HEADER_HEIGHT_APPROX * (1/3) + 6;
        else if (sourceHandleId === 'false') startYOffset = NODE_HEADER_HEIGHT_APPROX * (2/3) + 6;
    }

    const lineStartX = fromNode.x + NODE_WIDTH; 
    const lineStartY = fromNode.y + startYOffset; 
    
    const lineCurrentX = (e.clientX - canvasRect.left);
    const lineCurrentY = (e.clientY - canvasRect.top);

    setDrawingLine({
      fromId,
      sourceHandleId,
      startX: lineStartX, 
      startY: lineStartY, 
      currentX: lineCurrentX, 
      currentY: lineCurrentY, 
    });
  }, [currentNodes]); 

  const handleCanvasMouseDownForPanning = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) { 
      e.preventDefault();
      isPanning.current = true;
      panStartMousePosition.current = { x: e.clientX, y: e.clientY };
      initialCanvasOffsetOnPanStart.current = { ...canvasOffset };
      if (e.currentTarget) e.currentTarget.style.cursor = 'grabbing';
    }
  }, [canvasOffset]);

  const handleGlobalMouseMove = useCallback((e: MouseEvent) => {
    if (isPanning.current) {
      const dx = e.clientX - panStartMousePosition.current.x;
      const dy = e.clientY - panStartMousePosition.current.y;
      setCanvasOffset({
        x: initialCanvasOffsetOnPanStart.current.x + dx,
        y: initialCanvasOffsetOnPanStart.current.y + dy,
      });
    } else if (drawingLine) {
      const canvasElement = canvasWrapperRef.current?.querySelector('.relative.flex-1.bg-background');
      if (!canvasElement) return;
      const canvasRect = canvasElement.getBoundingClientRect();
      setDrawingLine((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          currentX: (e.clientX - canvasRect.left),
          currentY: (e.clientY - canvasRect.top),
        };
      });
    }
  }, [drawingLine, canvasOffset]);

  const handleGlobalMouseUp = useCallback((e: MouseEvent) => {
    if (isPanning.current) {
      isPanning.current = false;
       const canvasElement = canvasWrapperRef.current?.querySelector('.relative.flex-1.bg-background') as HTMLElement | null;
      if (canvasElement) canvasElement.style.cursor = 'grab';
    } else if (drawingLine) {
      const targetElement = document.elementFromPoint(e.clientX, e.clientY);
      const targetHandleElement = targetElement?.closest('[data-handle-type="target"]');
      const targetNodeElement = targetElement?.closest('[data-node-id]');
      
      let toId = null;
      if (targetHandleElement) {
          toId = targetHandleElement.closest('[data-node-id]')?.getAttribute('data-node-id');
      } else if (targetNodeElement) { 
          toId = targetNodeElement.getAttribute('data-node-id');
      }

      if (toId && drawingLine.fromId !== toId) {
        if (!activeWorkspaceId) {
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
                c => c.from === newConnection.from && c.to === newConnection.to && c.sourceHandle === newConnection.sourceHandle
            );

            if (!isDuplicate) {
                const sourceNode = ws.nodes.find(n => n.id === drawingLine.fromId);
                if (sourceNode?.type === 'condition') {
                    const existingConnectionFromHandle = newConnectionsArray.find(
                        c => c.from === drawingLine.fromId && c.sourceHandle === drawingLine.sourceHandleId
                    );
                    if (existingConnectionFromHandle) {
                        newConnectionsArray = [...newConnectionsArray.filter(c => c.id !== existingConnectionFromHandle.id), newConnection];
                    } else {
                        newConnectionsArray.push(newConnection);
                    }
                } else { 
                    const existingConnectionFromDefaultHandle = newConnectionsArray.find(
                        c => c.from === drawingLine.fromId && c.sourceHandle === 'default'
                    );
                    if (existingConnectionFromDefaultHandle) {
                        newConnectionsArray = [...newConnectionsArray.filter(c => c.id !== existingConnectionFromDefaultHandle.id), newConnection];
                    } else {
                        newConnectionsArray.push(newConnection);
                    }
                }
            }
            return { ...ws, connections: newConnectionsArray };
        });
      }
      setDrawingLine(null);
    }
  }, [drawingLine, activeWorkspaceId, updateActiveWorkspace]);

  const deleteConnection = useCallback((connectionIdToDelete: string) => {
    updateActiveWorkspace(ws => ({
        ...ws,
        connections: ws.connections.filter(conn => conn.id !== connectionIdToDelete)
    }));
    setHighlightedConnectionId(null);
  }, [updateActiveWorkspace]);

  useEffect(() => {
    document.addEventListener('mousemove', handleGlobalMouseMove);
    document.addEventListener('mouseup', handleGlobalMouseUp);
    
    const drawingLineRef = React.createRef<DrawingLineData | null>();
    drawingLineRef.current = drawingLine;

    const handleMouseLeaveWindow = () => {
      if (isPanning.current) {
        isPanning.current = false;
        const canvasElement = canvasWrapperRef.current?.querySelector('.relative.flex-1.bg-background') as HTMLElement | null;
        if (canvasElement) canvasElement.style.cursor = 'grab';
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
  }, [handleGlobalMouseMove, handleGlobalMouseUp, drawingLine]); 
  
  return (
    <DndProvider backend={HTML5Backend}>
      <div ref={canvasWrapperRef} className="flex h-screen bg-background font-sans select-none overflow-hidden">
        <FlowSidebar 
          workspaces={workspaces}
          activeWorkspaceId={activeWorkspaceId}
          onAddWorkspace={addWorkspace}
          onSwitchWorkspace={switchWorkspace}
        />
        <Canvas
          nodes={currentNodes}
          connections={currentConnections}
          drawingLine={drawingLine}
          canvasOffset={canvasOffset}
          onDropNode={handleDropNode}
          onUpdateNode={updateNode}
          onStartConnection={handleStartConnection}
          onDeleteNode={deleteNode}
          onDeleteConnection={deleteConnection}
          onCanvasMouseDown={handleCanvasMouseDownForPanning}
          highlightedConnectionId={highlightedConnectionId}
          setHighlightedConnectionId={setHighlightedConnectionId}
        />
      </div>
    </DndProvider>
  );
}
