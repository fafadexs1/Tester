
"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { NodeData, Connection, DrawingLineData, CanvasOffset, DraggableBlockItemData } from '@/lib/types';
import { NODE_WIDTH, NODE_HEADER_CONNECTOR_Y_OFFSET, NODE_HEADER_HEIGHT_APPROX, GRID_SIZE } from '@/lib/constants';
import FlowSidebar from './FlowSidebar';
import Canvas from './Canvas';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { v4 as uuidv4 } from 'uuid';

export default function FlowBuilderClient() {
  const [nodes, setNodes] = useState<NodeData[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [drawingLine, setDrawingLine] = useState<DrawingLineData | null>(null);
  const [highlightedConnectionId, setHighlightedConnectionId] = useState<string | null>(null);

  const [canvasOffset, setCanvasOffset] = useState<CanvasOffset>({ x: GRID_SIZE * 2, y: GRID_SIZE * 2 });
  const isPanning = useRef(false);
  const panStartMousePosition = useRef({ x: 0, y: 0 });
  const initialCanvasOffsetOnPanStart = useRef({ x: 0, y: 0 });
  const canvasWrapperRef = useRef<HTMLDivElement>(null); // Ref for the main flex container

  const handleDropNode = useCallback((item: DraggableBlockItemData, viewportOffset: { x: number, y: number }) => {
    // viewportOffset is already adjusted for canvasRect.left/top and canvasOffset
    // It represents the desired model coordinates for the center of the node
    const baseNodeData: Omit<NodeData, 'id' | 'type' | 'title' | 'x' | 'y'> = {
      instanceName: 'evolution_instance',
      phoneNumber: '', textMessage: '', mediaUrl: '', mediaType: 'image', caption: '',
      groupName: '', participants: '', conditionVariable: '', conditionOperator: '==',
      conditionValue: '', variableName: '', variableValue: '', apiUrl: '',
      apiMethod: 'GET', apiHeaders: '{ "Content-Type": "application/json" }', apiBody: '{}', delayDuration: 1000,
    };

    const newNode: NodeData = {
      id: uuidv4(),
      type: item.type as NodeData['type'],
      title: item.label,
      ...baseNodeData,
      ...(item.defaultData || {}),
      x: viewportOffset.x - NODE_WIDTH / 2, // Adjust to top-left from center
      y: viewportOffset.y - NODE_HEADER_HEIGHT_APPROX / 2, // Adjust to top-left from center
    };
    setNodes((prevNodes) => [...prevNodes, newNode]);
  }, []);

  const updateNode = useCallback((id: string, changes: Partial<NodeData>) => {
    setNodes((prevNodes) =>
      prevNodes.map((n) => (n.id === id ? { ...n, ...changes } : n))
    );
  }, []);

  const deleteNode = useCallback((nodeIdToDelete: string) => {
    setNodes((prevNodes) => prevNodes.filter(node => node.id !== nodeIdToDelete));
    setConnections((prevConnections) =>
      prevConnections.filter(conn => conn.from !== nodeIdToDelete && conn.to !== nodeIdToDelete)
    );
  }, []);

  const handleStartConnection = useCallback((e: React.MouseEvent, fromId: string, sourceHandleId = 'default') => {
    const fromNode = nodes.find(n => n.id === fromId);
    if (!fromNode || !canvasWrapperRef.current) return;
    
    const canvasElement = canvasWrapperRef.current?.querySelector('.relative.flex-1.bg-background'); // target the canvas div
    if (!canvasElement) return;
    const canvasRect = canvasElement.getBoundingClientRect();

    let startYOffset = NODE_HEADER_CONNECTOR_Y_OFFSET;
    if (fromNode.type === 'condition') {
        if (sourceHandleId === 'true') startYOffset = NODE_HEADER_HEIGHT_APPROX * (1/3) + 6;
        else if (sourceHandleId === 'false') startYOffset = NODE_HEADER_HEIGHT_APPROX * (2/3) + 6;
    }

    const lineStartX = fromNode.x + NODE_WIDTH; // Relative to node model
    const lineStartY = fromNode.y + startYOffset; // Relative to node model
    
    // currentX/Y should be relative to the canvas div, including its current pan/offset
    const lineCurrentX = (e.clientX - canvasRect.left);
    const lineCurrentY = (e.clientY - canvasRect.top);

    setDrawingLine({
      fromId,
      sourceHandleId,
      startX: lineStartX, // Model coordinate for line start
      startY: lineStartY, // Model coordinate for line start
      currentX: lineCurrentX, // Viewport coordinate for line end, relative to canvas origin
      currentY: lineCurrentY, // Viewport coordinate for line end, relative to canvas origin
    });
  }, [nodes]);

  const handleCanvasMouseDownForPanning = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    // Ensure click is directly on the canvas background, not on a node or other element
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
        setConnections((prevConnections) => {
          const newConnection = {
            id: uuidv4(),
            from: drawingLine.fromId,
            to: toId as string,
            sourceHandle: drawingLine.sourceHandleId,
          };
          const isDuplicate = prevConnections.some(
            c => c.from === newConnection.from && c.to === newConnection.to && c.sourceHandle === newConnection.sourceHandle
          );
          if (isDuplicate) return prevConnections;

          const sourceNode = nodes.find(n => n.id === drawingLine.fromId);
          if (sourceNode?.type === 'condition') {
              const existingConnectionFromHandle = prevConnections.find(
                  c => c.from === drawingLine.fromId && c.sourceHandle === drawingLine.sourceHandleId
              );
              if (existingConnectionFromHandle) {
                  return [...prevConnections.filter(c => c.id !== existingConnectionFromHandle.id), newConnection];
              }
          } else { 
              const existingConnectionFromDefaultHandle = prevConnections.find(
                  c => c.from === drawingLine.fromId && c.sourceHandle === 'default'
              );
              if (existingConnectionFromDefaultHandle) {
                   return [...prevConnections.filter(c => c.id !== existingConnectionFromDefaultHandle.id), newConnection];
              }
          }
          return [...prevConnections, newConnection];
        });
      }
      setDrawingLine(null);
    }
  }, [drawingLine, nodes]);

  const deleteConnection = useCallback((connectionIdToDelete: string) => {
    setConnections((prevConnections) => prevConnections.filter(conn => conn.id !== connectionIdToDelete));
    setHighlightedConnectionId(null);
  }, []);

  useEffect(() => {
    document.addEventListener('mousemove', handleGlobalMouseMove);
    document.addEventListener('mouseup', handleGlobalMouseUp);
    const handleMouseLeaveWindow = () => {
      if (isPanning.current) {
        isPanning.current = false;
        const canvasElement = canvasWrapperRef.current?.querySelector('.relative.flex-1.bg-background') as HTMLElement | null;
        if (canvasElement) canvasElement.style.cursor = 'grab';
      }
      if (drawingLine) { // Cancel drawing if mouse leaves window
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
        <FlowSidebar />
        <Canvas
          nodes={nodes}
          connections={connections}
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
