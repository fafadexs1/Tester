"use client";
import React, { useRef, useEffect, useMemo, useCallback, forwardRef } from 'react';
import type { DropTargetMonitor } from 'react-dnd';
import { useDrop } from 'react-dnd';
import { motion, AnimatePresence } from 'framer-motion';
import NodeCard from './NodeCard';

import type {
  NodeData, Connection, DrawingLineData, CanvasOffset, DraggableBlockItemData, WorkspaceData
} from '@/lib/types';
import {
  ITEM_TYPE_BLOCK, NODE_WIDTH, GRID_SIZE,
  NODE_HEADER_CONNECTOR_Y_OFFSET, NODE_HEADER_HEIGHT_APPROX,
  START_NODE_TRIGGER_INITIAL_Y_OFFSET, START_NODE_TRIGGER_SPACING_Y,
} from '@/lib/constants';
import { cn } from "@/lib/utils";

interface CanvasProps {
  nodes: NodeData[];
  connections: Connection[];
  drawingLine: DrawingLineData | null;
  canvasOffset: CanvasOffset;
  zoomLevel: number;
  onDropNode: (item: DraggableBlockItemData, logicalDropCoords: { x: number; y: number }) => void;
  onUpdateNode: (id: string, changes: Partial<NodeData>) => void;
  onStartConnection: (event: React.MouseEvent, fromNodeData: NodeData, sourceHandleId?: string) => void;
  onDeleteNode: (id: string) => void;
  onDuplicateNode: (id: string) => void;
  onDeleteConnection: (id: string) => void;
  onCanvasMouseDown: (event: React.MouseEvent<HTMLDivElement>) => void;
  isInteracting: boolean;
  highlightedConnectionId: string | null;
  setHighlightedConnectionId: (id: string | null) => void;
  availableVariablesByNode: Record<string, string[]>;
  highlightedNodeIdBySession: string | null;
  activeWorkspace: WorkspaceData | undefined | null;
  selectedNodeIds: string[];
  onSelectNode: (id: string, shiftKey: boolean) => void;
  onNodeDragStart: (e: React.MouseEvent, id: string) => void;
  onUpdatePosition: (id: string, x: number, y: number) => void;
  onEndConnection: (e: React.MouseEvent, node: NodeData) => void;
  onConfigureNode?: (id: string) => void;
  disableAnimations: boolean;
  tracePathConnectionIds?: Set<string> | null;
}

const SVG_CANVAS_DIMENSION = 50000;

const Canvas = forwardRef<HTMLDivElement, CanvasProps>(({
  nodes, connections, drawingLine, canvasOffset, zoomLevel,
  onDropNode, onUpdateNode, onStartConnection, onDeleteNode, onDuplicateNode, onDeleteConnection,
  onCanvasMouseDown, isInteracting, highlightedConnectionId, setHighlightedConnectionId,
  availableVariablesByNode, highlightedNodeIdBySession, activeWorkspace,
  selectedNodeIds, onSelectNode, onNodeDragStart, onUpdatePosition, onEndConnection, onConfigureNode,
  disableAnimations, tracePathConnectionIds
}, ref) => {
  const localCanvasRef = useRef<HTMLDivElement>(null);
  const canvasElementRef = (ref || localCanvasRef) as React.RefObject<HTMLDivElement>;

  const stableOnDropNode = useCallback(
    (item: DraggableBlockItemData, monitor: DropTargetMonitor) => {
      const clientOffset = monitor.getClientOffset();
      if (clientOffset && canvasElementRef.current) {
        const canvasRect = canvasElementRef.current.getBoundingClientRect();
        const logicalX = (clientOffset.x - canvasRect.left - canvasOffset.x) / zoomLevel;
        const logicalY = (clientOffset.y - canvasRect.top - canvasOffset.y) / zoomLevel;
        onDropNode(item, { x: logicalX, y: logicalY });
      }
    },
    [onDropNode, zoomLevel, canvasOffset, canvasElementRef]
  );

  const [, drop] = useDrop(() => ({
    accept: ITEM_TYPE_BLOCK,
    drop: stableOnDropNode,
  }), [stableOnDropNode]);

  useEffect(() => {
    if (canvasElementRef.current) drop(canvasElementRef.current);
    return () => { drop(null); };
  }, [drop, canvasElementRef]);

  const drawBezierPath = useCallback((x1: number, y1: number, x2: number, y2: number) => {
    const dx = Math.abs(x2 - x1) * 0.45;
    return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
  }, []);

  const getHandlePosition = useCallback((
    nodeId: string,
    handleType: 'source' | 'target' | null,
    handleId?: string | null
  ): { x: number; y: number } | null => {
    if (typeof document === 'undefined' || !canvasElementRef.current) return null;

    const selectorParts = ['[data-connector="true"]', `[data-node-id="${nodeId}"]`];
    if (handleType) selectorParts.push(`[data-handle-type="${handleType}"]`);
    if (handleId) selectorParts.push(`[data-handle-id="${handleId}"]`);
    const selector = selectorParts.join('');
    const handleEl = document.querySelector(selector) as HTMLElement | null;
    if (!handleEl) return null;

    const handleRect = handleEl.getBoundingClientRect();
    const canvasRect = canvasElementRef.current.getBoundingClientRect();
    const centerX = handleRect.left + handleRect.width / 2;
    const centerY = handleRect.top + handleRect.height / 2;
    const logicalX = (centerX - canvasRect.left - canvasOffset.x) / zoomLevel;
    const logicalY = (centerY - canvasRect.top - canvasOffset.y) / zoomLevel;
    return { x: logicalX, y: logicalY };
  }, [canvasElementRef, canvasOffset, zoomLevel]);

  const getHandleCenterOffset = useCallback((node: NodeData, handleId: string | null, type: 'source' | 'target'): number => {
    // 1. Target Handles (Inputs) are always at fixed position relative to node top
    if (type === 'target') {
      return 44; // Fixed offset for input handle (top-11 ~ 44px)
    }

    // 2. Source Handles (Outputs) logic
    if (!handleId && node.type !== 'start' && node.type !== 'option' && node.type !== 'switch') {
      // Standard single output node (Message, Api Call, etc)
      // Usually located at around header height or just below
      // Standard placement is top-11 (-right-2.5) which is same as target but on right
      return 44;
    }

    // 3. Complex Nodes Logic
    if (node.type === 'start') {
      // Logic matched with StartNode.tsx rendering
      // Header ~72px, Content padding ~20px
      let currentY = 72 + 20; // Start content y

      if (!node.triggers) return currentY;

      for (const trigger of node.triggers) {
        if (!trigger.enabled) continue;

        if (handleId === trigger.name) {
          return currentY + 15; // Middle of the main trigger block
        }

        // Calculate height of this trigger block including user keywords
        const keywords = (trigger.keyword || '').split(',').map(k => k.trim()).filter(Boolean);
        const triggerBaseHeight = 40; // Approx height of trigger header

        // Check if handle is one of the keywords
        const keywordIndex = keywords.findIndex(k => k === handleId);
        if (keywordIndex !== -1) {
          // It's a keyword handle
          return currentY + triggerBaseHeight + (keywordIndex * 32) + 12;
        }

        // Add total height of this trigger to currentY for next iteration
        currentY += triggerBaseHeight + (keywords.length * 32) + 10;
      }
      return 44; // Fallback
    }

    if (node.type === 'option') {
      // Option handles are alongside inputs.
      // Header ~72px, Content Padding ~20px
      // Prompt Area (Textarea + Toolbar) ~130px
      const startOfOptionsY = 72 + 20 + 130 + 35; // Approx start of options list
      const optionHeight = 44; // Height of each option row (input + gap)

      const index = node.options?.findIndex(o => o.id === handleId);
      if (index !== undefined && index !== -1) {
        return startOfOptionsY + (index * optionHeight) + 14;
      }
      return 44;
    }

    if (node.type === 'switch') {
      // Header ~72px + Padding ~20px
      // Variable Input area ~60px
      const startOfCasesY = 72 + 20 + 60 + 35;
      const caseHeight = 44;

      if (handleId === 'default') {
        // Default is at the bottom. 
        // logic: startOfCases + all cases height + spacing + default row
        const count = node.switchCases?.length || 0;
        return startOfCasesY + (count * caseHeight) + 40;
      }

      const index = node.switchCases?.findIndex(c => c.id === handleId);
      if (index !== undefined && index !== -1) {
        return startOfCasesY + (index * caseHeight) + 14;
      }
      return 44;
    }

    // Default fallback for any other named handle
    return 44;
  }, []);

  const resolveConnectionPoint = useCallback((
    node: NodeData,
    handleType: 'source' | 'target',
    handleId?: string | null
  ): { x: number; y: number } => {
    const handlePosition = getHandlePosition(node.id, handleType, handleId ?? null);
    if (handlePosition) return handlePosition;

    const yOffset = getHandleCenterOffset(node, handleId ?? null, handleType);
    const x = handleType === 'source' ? node.x + NODE_WIDTH : node.x;
    return { x, y: node.y + yOffset };
  }, [getHandlePosition, getHandleCenterOffset]);

  const nodeMap = useMemo(() => {
    const map = new Map<string, NodeData>();
    nodes.forEach(node => map.set(node.id, node));
    return map;
  }, [nodes]);

  const reduceConnectionEffects = isInteracting || connections.length > 120;
  const canInteractWithConnections = !isInteracting;

  const renderedNodes = useMemo(() => (
    <AnimatePresence>
      {nodes.map((node) => (
        <motion.div
          key={node.id}
          className="absolute z-20 will-change-transform"
          style={{ width: NODE_WIDTH, x: node.x, y: node.y, left: 0, top: 0 }}
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.8, opacity: 0 }}
          transition={{ type: "spring", stiffness: 350, damping: 25 }}
        >
          <NodeCard
            node={node}
            onUpdateNode={onUpdateNode}
            onStartConnection={onStartConnection}
            onDeleteNode={onDeleteNode}
            onDuplicateNode={onDuplicateNode}
            availableVariables={availableVariablesByNode[node.id] || []}
            activeWorkspace={activeWorkspace}
            isSelected={selectedNodeIds.includes(node.id)}
            onSelect={onSelectNode}
            onDragStart={onNodeDragStart}
            onUpdatePosition={onUpdatePosition}
            onEndConnection={onEndConnection}
            onConfigure={onConfigureNode}
          />
        </motion.div>
      ))}
    </AnimatePresence>
  ), [nodes, onUpdateNode, onStartConnection, onDeleteNode, onDuplicateNode, availableVariablesByNode, activeWorkspace, selectedNodeIds, onSelectNode, onNodeDragStart, onUpdatePosition, onEndConnection]);

  const isEditing = selectedNodeIds.length > 0;

  const renderedConnections = useMemo(() => (
    connections.map((conn) => {
      const source = nodeMap.get(conn.from);
      const target = nodeMap.get(conn.to);
      if (!source || !target) return null;

      const sourcePoint = resolveConnectionPoint(source, 'source', conn.sourceHandle || 'default');
      const targetPoint = resolveConnectionPoint(target, 'target', conn.targetHandle || 'default');

      const x1 = sourcePoint.x;
      const y1 = sourcePoint.y;
      const x2 = targetPoint.x;
      const y2 = targetPoint.y;

      const isHighlighted = highlightedConnectionId === conn.id;
      const path = drawBezierPath(x1, y1, x2, y2);

      // Tracing logic from props
      const isTracingActive = tracePathConnectionIds && tracePathConnectionIds.size > 0;
      const isTraced = isTracingActive && tracePathConnectionIds?.has(conn.id);
      const isDimmed = isTracingActive && !isTraced;

      const strokeColor = isHighlighted ? '#a855f7' : (isTraced ? '#a855f7' : (isDimmed ? '#333' : 'url(#connection-gradient)'));
      const strokeOpacity = isDimmed ? 0.2 : (isHighlighted || isTraced ? 1 : 0.6);
      const strokeWidth = isHighlighted || isTraced ? 3 : 2;

      return (
        <g
          key={conn.id}
          onMouseEnter={canInteractWithConnections ? () => setHighlightedConnectionId(conn.id) : undefined}
          onMouseLeave={canInteractWithConnections ? () => setHighlightedConnectionId(null) : undefined}
          onClick={(e) => {
            e.stopPropagation();
            if (canInteractWithConnections) onDeleteConnection(conn.id);
          }}
          className="transition-all duration-300"
          style={{ cursor: canInteractWithConnections ? 'pointer' : 'default', pointerEvents: canInteractWithConnections ? 'all' : 'none' }}
        >
          <title>Clique para remover conexão</title>
          {/* Background for easier selection */}
          {canInteractWithConnections && (
            <path d={path} stroke="transparent" strokeWidth={24} fill="none" className="pointer-events-auto" />
          )}

          {/* Glow Effect - disable if dimmed */}
          {!reduceConnectionEffects && !isDimmed && (
            <path
              d={path}
              stroke="hsl(var(--primary))"
              strokeWidth={isHighlighted || isTraced ? 4 : 2}
              strokeOpacity={isHighlighted || isTraced ? 0.4 : 0.15}
              fill="none"
              filter="url(#glow)"
              className="transition-all duration-300"
            />
          )}

          {/* Core Line */}
          <path
            d={path}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            fill="none"
            strokeOpacity={strokeOpacity}
            markerEnd={isHighlighted || isTraced ? "url(#arrow-highlight)" : (isDimmed ? "url(#arrow-dimmed)" : "url(#arrow-default)")}
            className="transition-all duration-300"
          />

          {/* Animated Pulse - Only for highlighted or TRACED connections */}
          {!reduceConnectionEffects && !isEditing && !disableAnimations && (isHighlighted || isTraced) && (
            <path
              d={path}
              stroke="white"
              strokeWidth={2}
              fill="none"
              strokeDasharray="10,10"
              className="pointer-events-none animate-dash"
              opacity="0.8"
            />
          )}

          {/* Standard pulse for non-traced (normal state) - hide if tracing is active */}
          {!reduceConnectionEffects && !isHighlighted && !isEditing && !disableAnimations && !isTracingActive && (
            <path
              d={path}
              stroke="white"
              strokeWidth={1}
              strokeOpacity="0.5"
              fill="none"
              strokeDasharray="4, 40"
              className="animate-[dash_4s_linear_infinite]"
            />
          )}
        </g>
      );
    })
  ), [connections, nodeMap, highlightedConnectionId, drawBezierPath, resolveConnectionPoint, onDeleteConnection, setHighlightedConnectionId, canInteractWithConnections, reduceConnectionEffects, isEditing, tracePathConnectionIds]);

  const visualGridSpacing = GRID_SIZE * zoomLevel;

  return (
    <div
      ref={canvasElementRef}
      className="relative flex-1 bg-black overflow-hidden select-none tech-grid h-full w-full"
      onMouseDown={onCanvasMouseDown}
      style={{
        cursor: 'grab',
        backgroundPosition: `${canvasOffset.x % visualGridSpacing}px ${canvasOffset.y % visualGridSpacing}px`,
        backgroundSize: `${visualGridSpacing}px ${visualGridSpacing}px`,
        pointerEvents: 'all' // Ensure we can always click the background
      }}
    >
      <div
        className="absolute top-0 left-0 will-change-transform"
        data-canvas-inner="true"
        style={{
          width: SVG_CANVAS_DIMENSION,
          height: SVG_CANVAS_DIMENSION,
          transform: `translate3d(${canvasOffset.x}px, ${canvasOffset.y}px, 0) scale(${zoomLevel})`,
          transformOrigin: 'top left',
        }}
      >
        <svg width={SVG_CANVAS_DIMENSION} height={SVG_CANVAS_DIMENSION} className="absolute inset-0 z-10 overflow-visible pointer-events-none">
          <defs>
            <linearGradient id="connection-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="hsl(var(--neon-purple))" />
              <stop offset="100%" stopColor="hsl(var(--neon-cyan))" />
            </linearGradient>
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            <marker id="arrow-default" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
              <path d="M0,0 L6,3 L0,6" fill="hsl(var(--neon-cyan))" />
            </marker>
            <marker id="arrow-highlight" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
              <path d="M0,0 L6,3 L0,6" fill="hsl(var(--neon-purple))" />
            </marker>
          </defs>
          {renderedConnections}
          {drawingLine && (
            <path
              d={drawBezierPath(drawingLine.startX, drawingLine.startY, drawingLine.currentX, drawingLine.currentY)}
              stroke="hsl(var(--primary))"
              strokeWidth={1.5}
              strokeDasharray="5,5"
              fill="none"
              className="opacity-50"
            />
          )}
        </svg>
        {renderedNodes}
      </div>

      <style jsx global>{`
        @keyframes dash {
          to { stroke-dashoffset: -100; }
        }
      `}</style>
    </div>
  );
});

Canvas.displayName = 'Canvas';
export default Canvas;
