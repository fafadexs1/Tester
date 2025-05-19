
"use client";
import React, { useRef, useEffect, useMemo, useCallback } from 'react';
import type { DropTargetMonitor } from 'react-dnd';
import { useDrop } from 'react-dnd';
import { motion } from 'framer-motion';
import NodeCard from './NodeCard';

import type {
  NodeData, Connection, DrawingLineData, CanvasOffset, DraggableBlockItemData
} from '@/lib/types';
import {
  ITEM_TYPE_BLOCK, NODE_WIDTH, GRID_SIZE,
  NODE_HEADER_CONNECTOR_Y_OFFSET, NODE_HEADER_HEIGHT_APPROX,
  START_NODE_TRIGGER_INITIAL_Y_OFFSET, START_NODE_TRIGGER_SPACING_Y,
  OPTION_NODE_HANDLE_INITIAL_Y_OFFSET, OPTION_NODE_HANDLE_SPACING_Y
} from '@/lib/constants';

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
  onDeleteConnection: (id: string) => void;
  onCanvasMouseDown: (event: React.MouseEvent<HTMLDivElement>) => void;
  highlightedConnectionId: string | null;
  setHighlightedConnectionId: (id: string | null) => void;
  definedVariablesInFlow: string[];
}

const Canvas: React.FC<CanvasProps> = React.forwardRef<HTMLDivElement, CanvasProps>(({
  nodes, connections, drawingLine, canvasOffset, zoomLevel,
  onDropNode, onUpdateNode, onStartConnection, onDeleteNode, onDeleteConnection,
  onCanvasMouseDown, highlightedConnectionId, setHighlightedConnectionId,
  definedVariablesInFlow
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
    (draggedItem: { type: string; itemData: DraggableBlockItemData }, monitor: DropTargetMonitor) => {
      const item = draggedItem.itemData; // Correção: itemData é o objeto DraggableBlockItemData
      const clientOffset = monitor.getClientOffset();

      if (clientOffset && flowContentWrapperRef.current) {
        const flowWrapperRect = flowContentWrapperRef.current.getBoundingClientRect();
        const xOnFlowWrapper = clientOffset.x - flowWrapperRect.left;
        const yOnFlowWrapper = clientOffset.y - flowWrapperRect.top;
        
        const currentZoom = zoomLevelRef.current; 
        
        const logicalX = xOnFlowWrapper / currentZoom;
        const logicalY = yOnFlowWrapper / currentZoom;

        // console.log('[Canvas] Drop event (target: flowContentWrapperRef)', { itemType: item.type, clientOffset, flowWrapperRect, xOnFlowWrapper, yOnFlowWrapper, currentZoom, logicalX, logicalY });
        onDropNodeCbRef.current(item, { x: logicalX, y: logicalY });
      } else {
        // console.warn('[Canvas] Drop failed: clientOffset or flowContentWrapperRef.current is null');
      }
    },
    [onDropNodeCbRef, zoomLevelRef, flowContentWrapperRef] 
  );

  const [{ isOver, canDrop }, drop] = useDrop(() => ({
    accept: ITEM_TYPE_BLOCK,
    drop: stableOnDropNode,
    collect: (monitor) => {
      const canActuallyDrop = monitor.canDrop();
      // if (monitor.isOver() || monitor.canDrop()) {
      //  console.log(`[Canvas] Monitored props: isOver=${monitor.isOver()}, canDrop=${canActuallyDrop}`);
      // }
      return {
        isOver: !!monitor.isOver(),
        canDrop: canActuallyDrop, 
      };
    },
  }), [stableOnDropNode]);

  useEffect(() => {
    const currentFlowContentWrapper = flowContentWrapperRef.current;
    if (currentFlowContentWrapper) {
      drop(currentFlowContentWrapper);
    }
    return () => {
      if (flowContentWrapperRef.current) { 
        drop(null); 
      }
    };
  }, [drop]);

  const drawBezierPath = useCallback((x1: number, y1: number, x2: number, y2: number) => {
    const dx = Math.abs(x2 - x1) * 0.5;
    const c1x = x1 + dx;
    const c1y = y1;
    const c2x = x2 - dx;
    const c2y = y2;
    return `M ${x1} ${y1} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${x2} ${y2}`;
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
          definedVariablesInFlow={definedVariablesInFlow}
        />
      </motion.div>
    ))
  ), [nodes, onUpdateNode, onStartConnection, onDeleteNode, definedVariablesInFlow]);

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
      if (sourceNode.type === 'start' && Array.isArray(sourceNode.triggers) && conn.sourceHandle) {
        const triggerIndex = sourceNode.triggers.findIndex(t => t.name === conn.sourceHandle);
        if (triggerIndex !== -1) {
          sourceHandleYOffset = START_NODE_TRIGGER_INITIAL_Y_OFFSET + (triggerIndex * START_NODE_TRIGGER_SPACING_Y);
        }
      } else if (sourceNode.type === 'option' && typeof sourceNode.optionsList === 'string' && conn.sourceHandle) {
        const options = sourceNode.optionsList.split('\n').map(opt => opt.trim()).filter(opt => opt !== '');
        const optionIndex = options.indexOf(conn.sourceHandle);
        if (optionIndex !== -1) {
          sourceHandleYOffset = OPTION_NODE_HANDLE_INITIAL_Y_OFFSET + (optionIndex * OPTION_NODE_HANDLE_SPACING_Y);
        }
      } else if (sourceNode.type === 'condition') {
        if (conn.sourceHandle === 'true') sourceHandleYOffset = NODE_HEADER_HEIGHT_APPROX * (1/3) + 6;
        else if (conn.sourceHandle === 'false') sourceHandleYOffset = NODE_HEADER_HEIGHT_APPROX * (2/3) + 6;
      }

      const x1 = sourceNode.x + NODE_WIDTH;
      const y1 = sourceNode.y + sourceHandleYOffset;
      const x2 = targetNode.x;
      const y2 = targetNode.y + NODE_HEADER_CONNECTOR_Y_OFFSET;
      
      const isHighlighted = highlightedConnectionId === conn.id;
      const strokeColor = isHighlighted ? 'hsl(var(--destructive))' : 'hsl(var(--accent))';
      const baseStrokeWidth = isHighlighted ? 2.5 : 2;
      const calculatedStrokeWidth = Math.max(0.5, baseStrokeWidth / Math.max(zoomLevel, 0.1));

      return (
        <g key={conn.id} className="canvas-connection"
          onClick={e => { e.stopPropagation(); onDeleteConnection(conn.id); }}
          onMouseEnter={() => setHighlightedConnectionId(conn.id)}
          onMouseLeave={() => setHighlightedConnectionId(null)}
          style={{ cursor: 'pointer', pointerEvents: 'all' }} 
        >
          <path d={drawBezierPath(x1, y1, x2, y2)} stroke="transparent" strokeWidth={Math.max(10, 12 / Math.max(zoomLevel, 0.1))} fill="none" />
          <path
            d={drawBezierPath(x1, y1, x2, y2)}
            stroke={strokeColor}
            strokeWidth={calculatedStrokeWidth}
            fill="none"
            markerEnd={isHighlighted ? "url(#arrowhead-highlight)" : "url(#arrowhead)"}
            className="transition-colors duration-100"
          />
        </g>
      );
    })
  ), [connections, nodeMap, highlightedConnectionId, onDeleteConnection, setHighlightedConnectionId, zoomLevel, drawBezierPath]);
  
  const visualGridSpacing = GRID_SIZE * zoomLevel;

  return (
    <div
      ref={canvasElementRef} 
      className="relative flex-1 bg-background overflow-hidden select-none touch-none"
      onMouseDown={onCanvasMouseDown}
      style={{
        cursor: 'grab',
        backgroundImage: `radial-gradient(hsl(var(--flow-grid-dots)) 1px, transparent 1px)`,
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
          width: '100%', 
          height: '100%', 
          transform: `translate(${canvasOffset.x}px, ${canvasOffset.y}px) scale(${zoomLevel})`,
          transformOrigin: 'top left',
        }}
      >
        <svg
          width="10000" 
          height="10000" 
          className="absolute top-0 left-0 pointer-events-none z-10 overflow-visible"
        >
          <defs>
            <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="8.5" refY="3.5" orient="auto" markerUnits="strokeWidth">
              <polygon points="0 0, 10 3.5, 0 7" fill="hsl(var(--accent))" />
            </marker>
            <marker id="arrowhead-highlight" markerWidth="10" markerHeight="7" refX="8.5" refY="3.5" orient="auto" markerUnits="strokeWidth">
              <polygon points="0 0, 10 3.5, 0 7" fill="hsl(var(--destructive))" />
            </marker>
          </defs>
          {renderedConnections}
          {drawingLine && (
            <path
              d={drawBezierPath(
                drawingLine.startX,    
                drawingLine.startY,    
                drawingLine.currentX,  // Já deve ser lógico
                drawingLine.currentY   // Já deve ser lógico
              )}
              stroke="hsl(var(--accent))"
              strokeOpacity="0.8"
              strokeWidth={Math.max(0.5, 2.5 / Math.max(zoomLevelRef.current, 0.1))}
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

    