
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
}

const SVG_CANVAS_DIMENSION = 50000;

const Canvas = forwardRef<HTMLDivElement, CanvasProps>(({
  nodes, connections, drawingLine, canvasOffset, zoomLevel,
  onDropNode, onUpdateNode, onStartConnection, onDeleteNode, onDuplicateNode, onDeleteConnection,
  onCanvasMouseDown, highlightedConnectionId, setHighlightedConnectionId,
  availableVariablesByNode, highlightedNodeIdBySession, activeWorkspace
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

  const getHandleCenterOffset = useCallback((_nodeId: string, _handleId: string | null, _type: 'source' | 'target', _currentZoom: number): number | null => {
    // Deprecated: pure math calculation is now used for better performance
    return null;
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
          onUpdate={onUpdateNode}
          onStartConnection={onStartConnection}
          onDeleteNode={onDeleteNode}
          onDuplicateNode={onDuplicateNode}
          availableVariables={availableVariablesByNode[node.id] || []}
          isSessionHighlighted={node.id === highlightedNodeIdBySession}
          activeWorkspace={activeWorkspace}
        />
      </motion.div>
    ))
  ), [nodes, onUpdateNode, onStartConnection, onDeleteNode, availableVariablesByNode, highlightedNodeIdBySession, activeWorkspace]);

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

      // Pure math calculation for source handle position
      if (sourceNode.type === 'start' && Array.isArray(sourceNode.triggers) && conn.sourceHandle) {
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

      } else if (sourceNode.type === 'option' && typeof sourceNode.optionsList === 'string' && conn.sourceHandle) {
        const options = sourceNode.optionsList.split('\n').map(opt => opt.trim()).filter(opt => opt !== '');
        const optionIndex = options.indexOf(conn.sourceHandle);
        if (optionIndex !== -1) {
          sourceHandleYOffset = OPTION_NODE_HANDLE_INITIAL_Y_OFFSET + (optionIndex * OPTION_NODE_HANDLE_SPACING_Y);
        }
      } else if (sourceNode.type === 'condition' || sourceNode.type === 'time-of-day') {
        if (conn.sourceHandle === 'true') {
          sourceHandleYOffset = NODE_HEADER_HEIGHT_APPROX * (1 / 3) + 6;
        } else if (conn.sourceHandle === 'false') {
          sourceHandleYOffset = NODE_HEADER_HEIGHT_APPROX * (2 / 3) + 6;
        }
      } else if (sourceNode.type === 'switch') {
        const switchCases = sourceNode.switchCases || [];
        const initialY = 65;
        const spacingY = 30;

        if (conn.sourceHandle && conn.sourceHandle !== 'default') {
          const caseIndex = switchCases.findIndex(c => c.id === conn.sourceHandle);
          if (caseIndex !== -1) {
            sourceHandleYOffset = initialY + (caseIndex * spacingY);
          }
        } else {
          // Default/Else case
          sourceHandleYOffset = initialY + (switchCases.length * spacingY);
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
