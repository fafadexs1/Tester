
"use client";

import type React from 'react';
import { useRef, useEffect } from 'react';
import type { NodeData, Connection, DrawingLineData, CanvasOffset, DraggableBlockItemData } from '@/lib/types';
import { 
  ITEM_TYPE_BLOCK, NODE_WIDTH, GRID_SIZE, 
  NODE_HEADER_CONNECTOR_Y_OFFSET, NODE_HEADER_HEIGHT_APPROX,
  START_NODE_TRIGGER_INITIAL_Y_OFFSET, START_NODE_TRIGGER_SPACING_Y,
  OPTION_NODE_HANDLE_INITIAL_Y_OFFSET, OPTION_NODE_HANDLE_SPACING_Y
} from '@/lib/constants';
import NodeCard from './NodeCard';
import { useDrop } from 'react-dnd';
import { motion } from 'framer-motion';

interface CanvasProps {
  nodes: NodeData[];
  connections: Connection[];
  drawingLine: DrawingLineData | null;
  canvasOffset: CanvasOffset;
  onDropNode: (item: DraggableBlockItemData, viewportOffset: { x: number; y: number }) => void;
  onUpdateNode: (id: string, changes: Partial<NodeData>) => void;
  onStartConnection: (event: React.MouseEvent, fromId: string, sourceHandleId?: string) => void;
  onDeleteNode: (id: string) => void;
  onDeleteConnection: (id: string) => void;
  onCanvasMouseDown: (event: React.MouseEvent<HTMLDivElement>) => void;
  highlightedConnectionId: string | null;
  setHighlightedConnectionId: (id: string | null) => void;
  definedVariablesInFlow: string[];
}

const Canvas: React.FC<CanvasProps> = ({
  nodes, connections, drawingLine, canvasOffset,
  onDropNode, onUpdateNode, onStartConnection, onDeleteNode, onDeleteConnection,
  onCanvasMouseDown, highlightedConnectionId, setHighlightedConnectionId,
  definedVariablesInFlow
}) => {
  const canvasRef = useRef<HTMLDivElement>(null);

  const [, drop] = useDrop(() => ({
    accept: ITEM_TYPE_BLOCK,
    drop: (item: DraggableBlockItemData, monitor) => {
      const clientOffset = monitor.getClientOffset();
      if (clientOffset && canvasRef.current) {
        const canvasRect = canvasRef.current.getBoundingClientRect();
        const xRelativeToCanvasElement = clientOffset.x - canvasRect.left;
        const yRelativeToCanvasElement = clientOffset.y - canvasRect.top;
        const logicalX = xRelativeToCanvasElement - canvasOffset.x;
        const logicalY = yRelativeToCanvasElement - canvasOffset.y;
        
        console.log('[Canvas] Drop event:', { 
            item, 
            clientOffset, 
            canvasRect, 
            canvasOffset: JSON.parse(JSON.stringify(canvasOffset)),
            xRelativeToCanvasElement,
            yRelativeToCanvasElement,
            logicalX, 
            logicalY 
        });
        onDropNode(item, { x: logicalX, y: logicalY });
      } else {
        console.warn('[Canvas] Drop failed: clientOffset or canvasRef.current is null', {clientOffset, canvasRefCurrent: canvasRef.current});
      }
    },
  }), [onDropNode, canvasOffset]);

  useEffect(() => {
    if (canvasRef.current) {
      drop(canvasRef);
    }
  }, [drop]);

  const drawBezierPath = (x1: number, y1: number, x2: number, y2: number) => {
    const dx = Math.abs(x2 - x1) * 0.5;
    const c1x = x1 + dx;
    const c2x = x2 - dx;
    return `M ${x1} ${y1} C ${c1x} ${y1}, ${c2x} ${y2}, ${x2} ${y2}`;
  };

  return (
    <div 
      ref={canvasRef} 
      className="relative flex-1 bg-background overflow-hidden cursor-grab"
      onMouseDown={onCanvasMouseDown}
      style={{
        backgroundImage: `radial-gradient(hsl(var(--flow-grid-dots)) 0.5px, transparent 0.5px)`,
        backgroundSize: `${GRID_SIZE}px ${GRID_SIZE}px`,
        backgroundPosition: `${canvasOffset.x % GRID_SIZE}px ${canvasOffset.y % GRID_SIZE}px`,
      }}
    >
      {nodes.map((node) => {
        const renderX = node.x + canvasOffset.x;
        const renderY = node.y + canvasOffset.y;
        return (
          <motion.div
            key={node.id}
            className="absolute"
            style={{ left: renderX, top: renderY, width: NODE_WIDTH }}
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
      })}

      <svg className="absolute inset-0 w-full h-full pointer-events-none">
        <defs>
          <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="8.5" refY="3.5" orient="auto" markerUnits="strokeWidth">
            <polygon points="0 0, 10 3.5, 0 7" fill="var(--flow-connection)" />
          </marker>
          <marker id="arrowhead-highlight" markerWidth="10" markerHeight="7" refX="8.5" refY="3.5" orient="auto" markerUnits="strokeWidth">
            <polygon points="0 0, 10 3.5, 0 7" fill="var(--flow-connection-highlight)" />
          </marker>
        </defs>
        {connections.map((conn) => {
          const sourceNode = nodes.find((n) => n.id === conn.from);
          const targetNode = nodes.find((n) => n.id === conn.to);
          if (!sourceNode || !targetNode) return null;

          let sourceHandleYOffset = NODE_HEADER_CONNECTOR_Y_OFFSET;
          
          if (sourceNode.type === 'start' && sourceNode.triggers && conn.sourceHandle) {
            const triggerIndex = sourceNode.triggers.indexOf(conn.sourceHandle);
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
          
          const x1 = sourceNode.x + NODE_WIDTH + canvasOffset.x;
          const y1 = sourceNode.y + sourceHandleYOffset + canvasOffset.y;
          
          const x2 = targetNode.x + canvasOffset.x; 
          const y2 = targetNode.y + NODE_HEADER_CONNECTOR_Y_OFFSET + canvasOffset.y; 
          
          const isHighlighted = highlightedConnectionId === conn.id;
          const strokeColor = isHighlighted ? 'var(--flow-connection-highlight)' : 'var(--flow-connection)';
          
          return (
            <g key={conn.id} className="cursor-pointer" 
                onClick={(e) => { e.stopPropagation(); onDeleteConnection(conn.id); }}
                onMouseEnter={() => setHighlightedConnectionId(conn.id)}
                onMouseLeave={() => setHighlightedConnectionId(null)}
                style={{ pointerEvents: 'all' }}
            >
                <path d={drawBezierPath(x1, y1, x2, y2)} stroke="transparent" strokeWidth={12} fill="none"/>
                <path
                    d={drawBezierPath(x1, y1, x2, y2)}
                    stroke={strokeColor}
                    strokeWidth={isHighlighted ? 2.5 : 2} fill="none"
                    markerEnd={isHighlighted ? "url(#arrowhead-highlight)" : "url(#arrowhead)"}
                    className="transition-all duration-100"
                />
            </g>
          );
        })}
        {drawingLine && (
          <path
            d={drawBezierPath(
              drawingLine.startX + canvasOffset.x, drawingLine.startY + canvasOffset.y,
              drawingLine.currentX, drawingLine.currentY 
            )}
            stroke="hsl(var(--accent))"
            strokeOpacity="0.7" strokeWidth={2} fill="none" strokeDasharray="5,3"
            markerEnd="url(#arrowhead)"
          />
        )}
      </svg>
    </div>
  );
};

export default Canvas;
