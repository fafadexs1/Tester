
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

  const onDropNodeRef = useRef(onDropNode);
  useEffect(() => {
    onDropNodeRef.current = onDropNode;
  }, [onDropNode]);

  const canvasElementRef = (ref || localCanvasRef) as React.RefObject<HTMLDivElement>;

  // Refs para zoomLevel e canvasOffset para estabilizar o stableOnDropNode
  const zoomLevelRef = useRef(zoomLevel);
  const canvasOffsetRef = useRef(canvasOffset);

  useEffect(() => {
    zoomLevelRef.current = zoomLevel;
  }, [zoomLevel]);

  useEffect(() => {
    canvasOffsetRef.current = canvasOffset;
  }, [canvasOffset]);

  const stableOnDropNode = useCallback((item: DraggableBlockItemData, monitor: DropTargetMonitor) => {
    const clientOffset = monitor.getClientOffset(); // Coordenadas do mouse relativas à viewport
    if (clientOffset && canvasElementRef.current) {
      const canvasRect = canvasElementRef.current.getBoundingClientRect(); // Retângulo do canvas EXTERNO
      
      const xOnCanvas = clientOffset.x - canvasRect.left;
      const yOnCanvas = clientOffset.y - canvasRect.top;

      // Usar refs para zoomLevel e canvasOffset atuais
      const currentZoom = zoomLevelRef.current;
      const currentOffset = canvasOffsetRef.current;

      const logicalX = (xOnCanvas - currentOffset.x) / currentZoom;
      const logicalY = (yOnCanvas - currentOffset.y) / currentZoom;

      console.log('[Canvas] Drop event triggered (target: canvasElementRef, using stable ref, with zoom/offset refs)', { item, clientOffset, logicalX, logicalY });
      onDropNodeRef.current(item, { x: logicalX, y: logicalY });
    } else {
      console.warn('[Canvas] Drop failed: clientOffset or canvasElementRef.current is null');
    }
  }, [onDropNodeRef, canvasElementRef]); // Dependências estáveis: onDropNodeRef (ref), canvasElementRef (ref)

  const [{ isOver, canDrop: dndCanDrop }, drop] = useDrop(() => ({
    accept: ITEM_TYPE_BLOCK,
    drop: stableOnDropNode, // stableOnDropNode agora é muito estável
    collect: (monitor) => ({
      isOver: !!monitor.isOver(),
      canDrop: !!monitor.canDrop(),
    }),
  }), [stableOnDropNode]); // A dependência aqui é a referência de stableOnDropNode, que agora é estável

  useEffect(() => {
    if (canvasElementRef.current) {
      console.log('[Canvas] Attaching drop target to ref (canvasElementRef):', canvasElementRef.current);
      drop(canvasElementRef.current);
    } else {
      console.warn('[Canvas] Attaching drop target: canvasElementRef.current is null.');
    }
  }, [drop, canvasElementRef]);
  
  useEffect(() => {
    // Este log é útil para depurar o comportamento do dnd
    console.log('[Canvas] Monitored props: isOver:', isOver, 'canDrop:', dndCanDrop);
  }, [isOver, dndCanDrop]);

  const drawBezierPath = (x1: number, y1: number, x2: number, y2: number) => {
    const dx = Math.abs(x2 - x1) * 0.5;
    const c1x = x1 + dx;
    const c2x = x2 - dx;
    return `M ${x1} ${y1} C ${c1x} ${y1}, ${c2x} ${y2}, ${x2} ${y2}`;
  };
  
  const nodeMap = useMemo(() => {
    const map = new Map<string, NodeData>();
    nodes.forEach(node => map.set(node.id, node));
    return map;
  }, [nodes]);

  // console.log("[Canvas] Rendering with nodes:", nodes);

  const renderedNodes = useMemo(() => (
    nodes.map((node) => {
      return (
        <motion.div
          key={node.id}
          className="absolute z-20 pointer-events-auto" 
          style={{ left: node.x, top: node.y, width: NODE_WIDTH }} 
          initial={{ scale: 0.95, opacity: 0.8 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
        >
          <NodeCard
            node={node}
            onUpdate={onUpdateNode}
            onStartConnection={onStartConnection} 
            onDeleteNode={onDeleteNode}
            definedVariablesInFlow={definedVariablesInFlow}
          />
        </motion.div>
      );
    })
  ), [nodes, onUpdateNode, onStartConnection, onDeleteNode, definedVariablesInFlow]);


  const renderedConnections = useMemo(() => (
    connections.map((conn) => {
      const sourceNode = nodeMap.get(conn.from);
      const targetNode = nodeMap.get(conn.to);

      if (!sourceNode || !targetNode) return null;

      let sourceHandleYOffset = NODE_HEADER_CONNECTOR_Y_OFFSET;
      if (sourceNode.type === 'start' && sourceNode.triggers && conn.sourceHandle) {
        const triggerIndex = sourceNode.triggers.findIndex(t => t.name === conn.sourceHandle);
        if (triggerIndex !== -1) {
          sourceHandleYOffset = START_NODE_TRIGGER_INITIAL_Y_OFFSET + (triggerIndex * START_NODE_TRIGGER_SPACING_Y);
        }
      } else if (sourceNode.type === 'option' && sourceNode.optionsList && conn.sourceHandle) {
        const options = (sourceNode.optionsList || '').split('\n').map(opt => opt.trim()).filter(opt => opt !== '');
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
      const strokeColor = isHighlighted ? 'hsl(var(--flow-connection-highlight))' : 'hsl(var(--flow-connection))';

      return (
        <g key={conn.id} className="cursor-pointer"
          onClick={e => { e.stopPropagation(); onDeleteConnection(conn.id); }}
          onMouseEnter={() => setHighlightedConnectionId(conn.id)}
          onMouseLeave={() => setHighlightedConnectionId(null)}
          style={{ pointerEvents: 'all' }} 
        >
          <path d={drawBezierPath(x1, y1, x2, y2)} stroke="transparent" strokeWidth={12} fill="none" />
          <path
            d={drawBezierPath(x1, y1, x2, y2)}
            stroke={strokeColor}
            strokeWidth={isHighlighted ? (2.5 / zoomLevel) : (2 / zoomLevel)}
            fill="none"
            markerEnd={isHighlighted ? "url(#arrowhead-highlight)" : "url(#arrowhead)"}
            className="transition-all duration-100"
          />
        </g>
      );
    })
  ), [connections, nodeMap, highlightedConnectionId, onDeleteConnection, setHighlightedConnectionId, zoomLevel]);
  
  return (
    <div
      ref={canvasElementRef} 
      className="relative flex-1 bg-background overflow-hidden"
      onMouseDown={onCanvasMouseDown}
      style={{
        cursor: 'grab',
        backgroundImage: `radial-gradient(hsl(var(--flow-grid-dots)) ${0.5 * zoomLevel}px, transparent ${0.5 * zoomLevel}px)`,
        backgroundSize: `${GRID_SIZE * zoomLevel}px ${GRID_SIZE * zoomLevel}px`,
        backgroundPosition: `${canvasOffset.x % (GRID_SIZE * zoomLevel)}px ${canvasOffset.y % (GRID_SIZE * zoomLevel)}px`,
        userSelect: 'none', 
        touchAction: 'none'  
      }}
      tabIndex={0} 
    >
      <div 
        ref={flowContentWrapperRef}
        id="flow-content-wrapper"
        className="absolute top-0 left-0" 
        style={{
          transform: `translate(${canvasOffset.x}px, ${canvasOffset.y}px) scale(${zoomLevel})`,
          transformOrigin: 'top left',
          pointerEvents: 'auto', 
        }}
      >
        <svg 
          className="absolute top-0 left-0 pointer-events-none z-10"
          style={{ width: '10000px', height: '10000px' }} 
        >
          <defs>
            <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="8.5" refY="3.5" orient="auto" markerUnits="strokeWidth">
              <polygon points="0 0, 10 3.5, 0 7" fill="hsl(var(--flow-connection))" />
            </marker>
            <marker id="arrowhead-highlight" markerWidth="10" markerHeight="7" refX="8.5" refY="3.5" orient="auto" markerUnits="strokeWidth">
              <polygon points="0 0, 10 3.5, 0 7" fill="hsl(var(--flow-connection-highlight))" />
            </marker>
          </defs>
          {renderedConnections}
          {drawingLine && (
            <>
              {/* console.log('[Canvas] Drawing line active. Data:', JSON.parse(JSON.stringify(drawingLine)), 'Offset:', JSON.parse(JSON.stringify(canvasOffsetRef.current)), 'Zoom:', zoomLevelRef.current) */}
              <path
                d={drawBezierPath(
                  drawingLine.startX, 
                  drawingLine.startY,
                  drawingLine.currentX, // Já é lógico
                  drawingLine.currentY  // Já é lógico
                )}
                stroke="hsl(var(--accent))"
                strokeOpacity="0.8"
                strokeWidth={2.5 / zoomLevelRef.current} 
                fill="none"
                strokeDasharray="7,3" 
                markerEnd="url(#arrowhead)"
              />
            </>
          )}
        </svg>
        {renderedNodes}
      </div>
    </div>
  );
});
Canvas.displayName = 'Canvas';
export default Canvas;

    