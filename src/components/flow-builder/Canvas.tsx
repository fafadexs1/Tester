
"use client";
import React, { useRef, useEffect, useMemo } from 'react';
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

  // Use the forwarded ref if available (for the outer canvas div), otherwise use the local ref
  const canvasElementRef = (ref || localCanvasRef) as React.RefObject<HTMLDivElement>;

  const [{ isOver, canDrop: dndCanDrop }, drop] = useDrop(() => ({
    accept: ITEM_TYPE_BLOCK,
    drop: (item: DraggableBlockItemData, monitor: DropTargetMonitor) => {
      const clientOffset = monitor.getClientOffset();
      console.log('[Canvas] Drop event triggered (target: canvasElementRef)', { item, clientOffset });
      if (clientOffset && canvasElementRef.current) {
        const canvasRect = canvasElementRef.current.getBoundingClientRect();
        const xOnCanvas = clientOffset.x - canvasRect.left;
        const yOnCanvas = clientOffset.y - canvasRect.top;

        // Convert visual coords on the main canvas to logical coords for the transformed content
        const logicalX = (xOnCanvas - canvasOffset.x) / zoomLevel;
        const logicalY = (yOnCanvas - canvasOffset.y) / zoomLevel;
        
        console.log('[Canvas] Drop coords (logical):', { logicalX, logicalY, xOnCanvas, yOnCanvas, canvasOffset, zoomLevel });
        onDropNode(item, { x: logicalX, y: logicalY });
      } else {
         console.warn('[Canvas] Drop failed: clientOffset or canvasElementRef.current is null', {clientOffset, canvasElementRefCurrent: canvasElementRef.current});
      }
    },
    collect: (monitor) => ({
      isOver: !!monitor.isOver(),
      canDrop: !!monitor.canDrop(),
    }),
  }), [onDropNode, canvasOffset, zoomLevel]); // Added canvasOffset and zoomLevel as dependencies

  useEffect(() => {
    if (canvasElementRef.current) {
      console.log('[Canvas] Attaching drop target to ref:', canvasElementRef.current);
      drop(canvasElementRef.current);
    } else {
      console.warn('[Canvas] Attaching drop target: canvasElementRef.current is null.');
    }
  }, [drop, canvasElementRef]);

  useEffect(() => {
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
          // layout // Framer Motion layout can be heavy; remove if causing lag during drag
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
      const strokeColor = isHighlighted ? 'var(--flow-connection-highlight)' : 'var(--flow-connection)';

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
            strokeWidth={isHighlighted ? 2.5 : 2}
            fill="none"
            markerEnd={isHighlighted ? "url(#arrowhead-highlight)" : "url(#arrowhead)"}
            className="transition-all duration-100"
          />
        </g>
      );
    })
  ), [connections, nodeMap, highlightedConnectionId, onDeleteConnection, setHighlightedConnectionId]);
  
  console.log("[Canvas] Rendering with nodes:", nodes);

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
        className="absolute top-0 left-0" // Ensures transform-origin is top-left for the wrapper
        style={{
          transform: `translate(${canvasOffset.x}px, ${canvasOffset.y}px) scale(${zoomLevel})`,
          transformOrigin: 'top left',
          pointerEvents: 'auto', // Allow drop target events
        }}
      >
        <svg 
          className="absolute top-0 left-0 pointer-events-none z-10"
          // Define a very large SVG canvas or make it dynamically size to fit content
          // For simplicity, using a large fixed size. Adjust if necessary.
          style={{ width: '10000px', height: '10000px' }} 
        >
          <defs>
            <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="8.5" refY="3.5" orient="auto" markerUnits="strokeWidth">
              <polygon points="0 0, 10 3.5, 0 7" fill="var(--flow-connection)" />
            </marker>
            <marker id="arrowhead-highlight" markerWidth="10" markerHeight="7" refX="8.5" refY="3.5" orient="auto" markerUnits="strokeWidth">
              <polygon points="0 0, 10 3.5, 0 7" fill="var(--flow-connection-highlight)" />
            </marker>
          </defs>
          {renderedConnections}
          {drawingLine && (
            <path
              d={drawBezierPath(
                drawingLine.startX, drawingLine.startY, // These are logical
                (drawingLine.currentX - canvasOffset.x) / zoomLevel, // Convert visual mouse to logical
                (drawingLine.currentY - canvasOffset.y) / zoomLevel  // Convert visual mouse to logical
              )}
              stroke="hsl(var(--accent))"
              strokeOpacity="0.8"
              strokeWidth={2.5}
              fill="none"
              strokeDasharray="7,3" 
              markerEnd="url(#arrowhead)"
            />
          )}
        </svg>
        {/* Nodes are rendered here, positioned absolutely within this transformed div */}
        {renderedNodes}
      </div>
    </div>
  );
});
Canvas.displayName = 'Canvas';
export default Canvas;

    