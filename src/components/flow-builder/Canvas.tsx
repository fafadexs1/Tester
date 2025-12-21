
"use client";
import React, { useRef, useEffect, useMemo, useCallback, forwardRef } from 'react';
import type { DropTargetMonitor } from 'react-dnd';
import { useDrop } from 'react-dnd';
import { motion } from 'framer-motion';
import NodeCard from './NodeCard';

import type {
  NodeData, Connection, DrawingLineData, CanvasOffset, DraggableBlockItemData, WorkspaceData
} from '@/lib/types';
import {
  ITEM_TYPE_BLOCK, NODE_WIDTH, GRID_SIZE,
  NODE_HEADER_CONNECTOR_Y_OFFSET, NODE_HEADER_HEIGHT_APPROX,
  START_NODE_TRIGGER_INITIAL_Y_OFFSET, START_NODE_TRIGGER_SPACING_Y,
  OPTION_NODE_HANDLE_INITIAL_Y_OFFSET, OPTION_NODE_HANDLE_SPACING_Y
} from '@/lib/constants';

const escapeCssSelector = (value: string) => {
  if (typeof window !== 'undefined' && window.CSS && typeof window.CSS.escape === 'function') {
    return window.CSS.escape(value);
  }
  return value.replace(/([ !"#$%&'()*+,.\/:;<=>?@\[\]^`{|}~\\])/g, '\\$1');
};

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
  highlightedConnectionId: string | null;
  setHighlightedConnectionId: (id: string | null) => void;
  availableVariablesByNode: Record<string, string[]>;
  highlightedNodeIdBySession: string | null;
  activeWorkspace: WorkspaceData | undefined | null;
  // New selection & drag props
  selectedNodeIds: string[];
  onSelectNode: (id: string, shiftKey: boolean) => void;
  onNodeDragStart: (e: React.MouseEvent, id: string) => void;
  onUpdatePosition: (id: string, x: number, y: number) => void;
  onEndConnection: (e: React.MouseEvent, node: NodeData) => void;
}

const SVG_CANVAS_DIMENSION = 50000;

const Canvas = forwardRef<HTMLDivElement, CanvasProps>(({
  nodes, connections, drawingLine, canvasOffset, zoomLevel,
  onDropNode, onUpdateNode, onStartConnection, onDeleteNode, onDuplicateNode, onDeleteConnection,
  onCanvasMouseDown, highlightedConnectionId, setHighlightedConnectionId,
  availableVariablesByNode, highlightedNodeIdBySession, activeWorkspace,
  selectedNodeIds, onSelectNode, onNodeDragStart, onUpdatePosition, onEndConnection
}, ref) => {
  const localCanvasRef = useRef<HTMLDivElement>(null);
  const flowContentWrapperRef = useRef<HTMLDivElement>(null);

  const canvasElementRef = (ref || localCanvasRef) as React.RefObject<HTMLDivElement>;

  const onDropNodeCbRef = useRef(onDropNode);
  useEffect(() => {
    onDropNodeCbRef.current = onDropNode;
  }, [onDropNode]);

  const zoomLevelRef = useRef(zoomLevel);
  useEffect(() => {
    zoomLevelRef.current = zoomLevel;
  }, [zoomLevel]);

  const canvasOffsetRef = useRef(canvasOffset);
  useEffect(() => {
    canvasOffsetRef.current = canvasOffset;
  }, [canvasOffset]);


  const stableOnDropNode = useCallback(
    (item: DraggableBlockItemData, monitor: DropTargetMonitor) => {
      const clientOffset = monitor.getClientOffset();
      if (clientOffset && canvasElementRef.current) {
        const canvasRect = canvasElementRef.current.getBoundingClientRect();

        // Coordenadas do mouse relativas ao viewport
        const mouseX = clientOffset.x;
        const mouseY = clientOffset.y;

        // Posição do canvas no viewport
        const canvasLeft = canvasRect.left;
        const canvasTop = canvasRect.top;

        // Coordenadas do drop relativas ao canvas, considerando o estado atual de pan e zoom
        const currentZoom = zoomLevelRef.current;
        const currentOffset = canvasOffsetRef.current;

        const logicalX = (mouseX - canvasLeft - currentOffset.x) / currentZoom;
        const logicalY = (mouseY - canvasTop - currentOffset.y) / currentZoom;

        onDropNodeCbRef.current(item, { x: logicalX, y: logicalY });
      }
    },
    [onDropNodeCbRef, zoomLevelRef, canvasElementRef, canvasOffsetRef]
  );

  const [{ isOver, canDrop }, drop] = useDrop(() => ({
    accept: ITEM_TYPE_BLOCK,
    drop: stableOnDropNode,
    collect: (monitor) => ({
      isOver: !!monitor.isOver(),
      canDrop: !!monitor.canDrop(),
    }),
  }), [stableOnDropNode]);

  // Attach drop target to the main canvas element
  useEffect(() => {
    const currentCanvas = canvasElementRef.current;
    if (currentCanvas) {
      drop(currentCanvas);
    }
    return () => {
      if (canvasElementRef.current) {
        drop(null);
      }
    };
  }, [drop, canvasElementRef]);

  const drawBezierPath = useCallback((x1: number, y1: number, x2: number, y2: number) => {
    const dx = Math.abs(x2 - x1) * 0.5;
    const c1x = x1 + dx;
    const c1y = y1;
    const c2x = x2 - dx;
    const c2y = y2;
    return `M ${x1} ${y1} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${x2} ${y2}`;
  }, []);

  const getHandleCenterOffset = useCallback((nodeId: string, handleId: string | null, _type: 'source' | 'target', currentZoom: number): number | null => {
    // DOM-based lookup for accurate handle positioning
    try {
      if (!handleId) return null;
      if (typeof document === 'undefined') return null;

      const nodeEl = document.querySelector(`[data-node-id="${nodeId}"]`);
      if (!nodeEl) return null;

      // Search for specific handle within the node
      let handleEl = nodeEl.querySelector(`[data-handle-id="${handleId}"]`);

      if (!handleEl) return null;

      const nodeRect = nodeEl.getBoundingClientRect();
      const handleRect = handleEl.getBoundingClientRect();

      // Calculate relative position from top of node content
      // Note: node.y corresponds to the top of the nodeCard element (nodeEl).
      // Difference in pixels = handleRect.top - nodeRect.top.
      // Divide by zoom to get logical pixels.
      // Add half height to center it.

      const relativeTop = (handleRect.top - nodeRect.top) / currentZoom;
      const relativeCenter = relativeTop + (handleRect.height / currentZoom / 2);

      return relativeCenter;

    } catch (e) {
      return null;
    }
  }, []);

  const nodeMap = useMemo(() => {
    const map = new Map<string, NodeData>();
    (nodes || []).forEach(node => map.set(node.id, node));
    return map;
  }, [nodes]);


  const renderedNodes = useMemo(() => (
    (nodes || []).map((node) => (
      <motion.div
        key={node.id}
        className="absolute z-20"
        style={{
          left: node.x,
          top: node.y,
          width: NODE_WIDTH,
        }}
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ type: "spring", stiffness: 400, damping: 25, mass: 0.7 }}
      >
        <NodeCard
          node={node}
          onUpdateNode={onUpdateNode}
          onStartConnection={onStartConnection}
          onDeleteNode={onDeleteNode}
          onDuplicateNode={onDuplicateNode}
          availableVariables={availableVariablesByNode[node.id] || []}
          activeWorkspace={activeWorkspace}

          // Passing new props
          isSelected={selectedNodeIds.includes(node.id)}
          onSelect={onSelectNode}
          onDragStart={onNodeDragStart}
          onUpdatePosition={onUpdatePosition}
          onEndConnection={onEndConnection}
        />
      </motion.div>
    ))
  ), [nodes, onUpdateNode, onStartConnection, onDeleteNode, onDuplicateNode, availableVariablesByNode, highlightedNodeIdBySession, activeWorkspace, selectedNodeIds, onSelectNode, onNodeDragStart, onUpdatePosition, onEndConnection]);

  const renderedConnections = useMemo(() => (
    (connections || []).map((conn) => {
      const sourceNode = nodeMap.get(conn.from);
      const targetNode = nodeMap.get(conn.to);

      if (!sourceNode || !targetNode) {
        return null;
      }

      if (typeof sourceNode.x !== 'number' || typeof sourceNode.y !== 'number' ||
        typeof targetNode.x !== 'number' || typeof targetNode.y !== 'number') {
        return null;
      }

      let sourceHandleYOffset = NODE_HEADER_CONNECTOR_Y_OFFSET;

      // Try accurate DOM lookup first
      const domOffset = getHandleCenterOffset(sourceNode.id, conn.sourceHandle || 'default', 'source', zoomLevel);
      if (domOffset !== null) {
        sourceHandleYOffset = domOffset;
      } else if (sourceNode.type === 'start' && Array.isArray(sourceNode.triggers) && conn.sourceHandle) {
        let yOffset = START_NODE_TRIGGER_INITIAL_Y_OFFSET;
        let found = false;

        for (const trigger of sourceNode.triggers.filter(t => t.enabled)) {
          if (trigger.name === conn.sourceHandle) {
            sourceHandleYOffset = yOffset;
            found = true;
            break;
          }
          const keywords = (trigger.keyword || '').split(',').map(k => k.trim()).filter(Boolean);
          if (keywords.includes(conn.sourceHandle)) {
            const kwIndex = keywords.indexOf(conn.sourceHandle);
            sourceHandleYOffset = yOffset + 25 + (kwIndex * START_NODE_TRIGGER_SPACING_Y);
            found = true;
            break;
          }
          const triggerBlockHeight = 40 + (keywords.length * START_NODE_TRIGGER_SPACING_Y);
          yOffset += triggerBlockHeight + 10;
        }
        if (!found) sourceHandleYOffset = NODE_HEADER_CONNECTOR_Y_OFFSET; // Fallback

      } else if (sourceNode.type === 'option') {
        // New logic for array-based options
        const options = sourceNode.options || [];
        // Legacy string fallback
        const paramsOptions = typeof sourceNode.optionsList === 'string'
          ? sourceNode.optionsList.split('\n').map((opt, i) => ({ id: "", value: opt.trim() })) // simplified
          : [];

        // Use array options if present, otherwise legacy
        const effectiveOptions = options.length > 0 ? options : paramsOptions;

        // Layout estimation:
        // Header: 40px
        // Prompt+Toolbar: ~110px
        // "Opções": ~20px
        // Start ~170px
        const initialY = 175;
        const spacingY = 44;

        if (conn.sourceHandle) {
          // Try finding by ID first (new way)
          let index = effectiveOptions.findIndex(o => o.id === conn.sourceHandle);
          // If not found, try by value (legacy/string way)
          if (index === -1) {
            // For legacy string list, sourceHandle is the value itself
            index = effectiveOptions.findIndex(o => o.value === conn.sourceHandle);
          }

          if (index !== -1) {
            sourceHandleYOffset = initialY + (index * spacingY);
          }
        }

      } else if (sourceNode.type === 'condition' || sourceNode.type === 'time-of-day') {
        if (conn.sourceHandle === 'true') {
          sourceHandleYOffset = NODE_HEADER_HEIGHT_APPROX * (1 / 3) + 6 + 100; // Adjusted for content height
        } else if (conn.sourceHandle === 'false') {
          sourceHandleYOffset = NODE_HEADER_HEIGHT_APPROX * (2 / 3) + 6 + 100;
        }
        // Condition layout: Variables input (~80px) -> True/False handles. 
        // Handles are distinct blocks. 
        // Actually, ConditionNode.tsx shows a different layout. 
        // It's safer to stick to roughly middle if we can't be precise, 
        // OR inspect ConditionNode again. 
        // Let's use a standard offset + spacing.
        sourceHandleYOffset = conn.sourceHandle === 'true' ? 140 : 180;

      } else if (sourceNode.type === 'switch') {
        const switchCases = sourceNode.switchCases || [];
        // Layout: Variable input (~80px) -> "Casos" (~20px) -> Loop
        const initialY = 145;
        const spacingY = 44;

        if (conn.sourceHandle && conn.sourceHandle !== 'default') {
          const caseIndex = switchCases.findIndex(c => c.id === conn.sourceHandle);
          if (caseIndex !== -1) {
            sourceHandleYOffset = initialY + (caseIndex * spacingY);
          }
        } else {
          // Default/Else case
          // It's after the list.
          sourceHandleYOffset = initialY + (switchCases.length * spacingY) + 40; // Extra spacing for label
        }

      } else if (sourceNode.type === 'intention-router') {
        const intents = sourceNode.intents || [];
        // Layout: Desc (~80px) -> List
        const initialY = 140;
        const spacingY = 125; // Each intent block is tall

        if (conn.sourceHandle && conn.sourceHandle !== 'default') {
          const index = intents.findIndex(i => i.id === conn.sourceHandle);
          if (index !== -1) {
            sourceHandleYOffset = initialY + (index * spacingY) + 50; // Handle is largely centered in block?
            // In IntentionRouterNode, output handle is "top-1/2" of the intent block.
            // Intent block ~120px? 
            // Let's say center is +60px from start of block.
          }
        } else {
          // Fallback
          sourceHandleYOffset = initialY + (intents.length * spacingY) + 40;
        }
      }

      const x1 = sourceNode.x + NODE_WIDTH;
      const y1 = sourceNode.y + sourceHandleYOffset;

      const targetHandleYOffset = NODE_HEADER_CONNECTOR_Y_OFFSET;
      const x2 = targetNode.x;
      const y2 = targetNode.y + targetHandleYOffset;

      const isHighlighted = highlightedConnectionId === conn.id;
      const strokeColor = isHighlighted ? 'hsl(var(--destructive))' : 'url(#gradient-line)';
      const baseStrokeWidth = isHighlighted ? 3 : 2;
      const calculatedStrokeWidth = Math.max(0.5, baseStrokeWidth / Math.max(zoomLevel, 0.1));

      return (
        <g key={conn.id} className="canvas-connection"
          onClick={e => { e.stopPropagation(); onDeleteConnection(conn.id); }}
          onMouseEnter={() => setHighlightedConnectionId(conn.id)}
          onMouseLeave={() => setHighlightedConnectionId(null)}
          style={{ cursor: 'pointer', pointerEvents: 'all' }}
        >
          {/* Invisible wide path for easier clicking */}
          <path d={drawBezierPath(x1, y1, x2, y2)} stroke="transparent" strokeWidth={Math.max(15, 20 / Math.max(zoomLevel, 0.1))} fill="none" />

          {/* Glow effect path */}
          {!isHighlighted && (
            <path
              d={drawBezierPath(x1, y1, x2, y2)}
              stroke="hsl(var(--primary))"
              strokeWidth={calculatedStrokeWidth * 2}
              strokeOpacity="0.3"
              fill="none"
              filter="url(#glow)"
            />
          )}

          {/* Main path */}
          <path
            d={drawBezierPath(x1, y1, x2, y2)}
            stroke={strokeColor}
            strokeWidth={calculatedStrokeWidth}
            fill="none"
            markerEnd={isHighlighted ? "url(#arrowhead-highlight)" : "url(#arrowhead)"}
            className="transition-all duration-300"
          />
        </g>
      );
    })


  ), [connections, nodeMap, highlightedConnectionId, onDeleteConnection, setHighlightedConnectionId, zoomLevel, drawBezierPath, getHandleCenterOffset]);

  const visualGridSpacing = GRID_SIZE * zoomLevel;

  return (
    <div
      ref={canvasElementRef}
      className="relative flex-1 bg-neutral-950 overflow-hidden select-none touch-none"
      onMouseDown={onCanvasMouseDown}
      style={{
        cursor: 'grab',
        backgroundImage: `
          linear-gradient(to right, rgba(255, 255, 255, 0.05) 1px, transparent 1px),
          linear-gradient(to bottom, rgba(255, 255, 255, 0.05) 1px, transparent 1px)
        `,
        backgroundSize: `${visualGridSpacing}px ${visualGridSpacing}px`,
        backgroundPosition: `${canvasOffset.x % visualGridSpacing}px ${canvasOffset.y % visualGridSpacing}px`,
      }}
      tabIndex={0}
    >
      <div
        ref={flowContentWrapperRef}
        id="flow-content-wrapper"
        className="absolute top-0 left-0"
        style={{
          width: `${SVG_CANVAS_DIMENSION}px`,
          height: `${SVG_CANVAS_DIMENSION}px`,
          transformOrigin: 'top left',
          transform: `translate(${canvasOffset.x}px, ${canvasOffset.y}px) scale(${zoomLevel})`,
        }}
      >
        <svg
          width={SVG_CANVAS_DIMENSION}
          height={SVG_CANVAS_DIMENSION}
          className="absolute top-0 left-0 pointer-events-none z-10 overflow-visible"
        >
          <defs>
            <linearGradient id="gradient-line" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="hsl(var(--primary))" />
              <stop offset="100%" stopColor="hsl(var(--accent))" />
            </linearGradient>
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9.5" refY="3.5" orient="auto" markerUnits="strokeWidth">
              <polygon points="0 0, 10 3.5, 0 7" fill="hsl(var(--primary))" />
            </marker>
            <marker id="arrowhead-highlight" markerWidth="10" markerHeight="7" refX="9.5" refY="3.5" orient="auto" markerUnits="strokeWidth">
              <polygon points="0 0, 10 3.5, 0 7" fill="hsl(var(--destructive))" />
            </marker>
          </defs>
          {renderedConnections}
          {drawingLine && (
            <path
              d={drawBezierPath(
                drawingLine.startX,    // Lógico
                drawingLine.startY,    // Lógico
                drawingLine.currentX,  // Já é lógico (definido no FlowBuilderClient)
                drawingLine.currentY   // Já é lógico (definido no FlowBuilderClient)
              )}
              stroke="hsl(var(--primary))"
              strokeOpacity="0.8"
              strokeWidth={Math.max(0.5, 2.5 / Math.max(zoomLevel, 0.1))}
              fill="none"
              strokeDasharray="7,3"
              markerEnd="url(#arrowhead)"
            />
          )}
        </svg>
        {renderedNodes}
      </div>
    </div>
  );
});

Canvas.displayName = 'Canvas';
export default Canvas;
