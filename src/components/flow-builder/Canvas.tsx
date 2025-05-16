
"use client";
import React, { useRef, useEffect, useMemo } from 'react';
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
  onDropNode: (item: DraggableBlockItemData, viewportOffset: { x: number; y: number }) => void;
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
  nodes, connections, drawingLine, canvasOffset,
  onDropNode, onUpdateNode, onStartConnection, onDeleteNode, onDeleteConnection,
  onCanvasMouseDown, highlightedConnectionId, setHighlightedConnectionId,
  definedVariablesInFlow
}, ref) => {
  const localCanvasRef = useRef<HTMLDivElement>(null);
  const canvasOffsetRef = useRef(canvasOffset);

  // Use the forwarded ref if available, otherwise use the local ref
  const canvasElementRef = (ref || localCanvasRef) as React.RefObject<HTMLDivElement>;


  // Atualiza ref se canvasOffset mudar
  useEffect(() => {
    canvasOffsetRef.current = canvasOffset;
  }, [canvasOffset]);

  // Hook DnD sem dependências mutáveis
  const [, drop] = useDrop(() => ({
    accept: ITEM_TYPE_BLOCK,
    drop: (item: DraggableBlockItemData, monitor) => {
      const clientOffset = monitor.getClientOffset();
      if (clientOffset && canvasElementRef.current) {
        const canvasRect = canvasElementRef.current.getBoundingClientRect();
        const xRelative = clientOffset.x - canvasRect.left;
        const yRelative = clientOffset.y - canvasRect.top;
        
        // Ajustar pelas coordenadas do canvasOffset usando a ref para o valor mais atual
        const logicalX = xRelative - canvasOffsetRef.current.x;
        const logicalY = yRelative - canvasOffsetRef.current.y;
        
        console.log('[Canvas] Drop event (using ref for offset):', { item, clientOffset, canvasRect, currentOffset: canvasOffsetRef.current, logicalX, logicalY });
        onDropNode(item, { x: logicalX, y: logicalY });
      } else {
         console.warn('[Canvas] Drop failed: clientOffset or canvasElementRef.current is null', {clientOffset, canvasElementRefCurrent: canvasElementRef.current});
      }
    }
  }), [onDropNode]); // canvasOffsetRef.current é estável

  useEffect(() => {
    if (canvasElementRef.current) {
      drop(canvasElementRef);
    }
  }, [drop, canvasElementRef]);

  // Bezier Path
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


  // Memoize nodes/connections for perf
  const renderedNodes = useMemo(() => (
    nodes.map((node) => {
      const renderX = node.x + canvasOffset.x;
      const renderY = node.y + canvasOffset.y;
      return (
        <motion.div
          key={node.id}
          className="absolute z-20" // Nodes acima das conexões
          style={{ left: renderX, top: renderY, width: NODE_WIDTH }}
          initial={{ scale: 0.95, opacity: 0.8 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          // layout // Framer Motion layout pode ser pesado com muitos nós, remover se causar lag
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
  ), [nodes, canvasOffset, onUpdateNode, onStartConnection, onDeleteNode, definedVariablesInFlow]);

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

      const x1 = sourceNode.x + NODE_WIDTH + canvasOffset.x;
      const y1 = sourceNode.y + sourceHandleYOffset + canvasOffset.y;
      const x2 = targetNode.x + canvasOffset.x;
      const y2 = targetNode.y + NODE_HEADER_CONNECTOR_Y_OFFSET + canvasOffset.y;
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
  ), [connections, nodeMap, canvasOffset, highlightedConnectionId, onDeleteConnection, setHighlightedConnectionId]);
  
  console.log("[Canvas] Rendering with nodes:", nodes);

  return (
    <div
      ref={canvasElementRef} // Usar a ref apropriada
      className="relative flex-1 bg-background overflow-hidden"
      onMouseDown={onCanvasMouseDown}
      style={{
        cursor: 'grab',
        backgroundImage: `radial-gradient(hsl(var(--flow-grid-dots)) 0.5px, transparent 0.5px)`,
        backgroundSize: `${GRID_SIZE}px ${GRID_SIZE}px`,
        backgroundPosition: `${canvasOffset.x % GRID_SIZE}px ${canvasOffset.y % GRID_SIZE}px`,
        userSelect: 'none', // Adicionado para previnir seleção de texto
        touchAction: 'none'  // Adicionado para previnir ações de toque padrão
      }}
      tabIndex={0} // Para permitir foco, se necessário para interações de teclado
    >
      {/* SVG para conexões (z-10, abaixo dos nós) */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
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
              drawingLine.startX + canvasOffset.x, drawingLine.startY + canvasOffset.y,
              drawingLine.currentX, drawingLine.currentY // currentX e currentY já são relativos ao canvas
            )}
            stroke="hsl(var(--accent))"
            strokeOpacity="0.8"
            strokeWidth={2.5}
            fill="none"
            strokeDasharray="7,3" // Ajustado para melhor visibilidade
            markerEnd="url(#arrowhead)"
          />
        )}
      </svg>

      {/* Contêiner para os nós (z-20, acima das conexões) */}
      {/* Este div pode ser usado para aplicar transformações de zoom/pan se necessário */}
      <div className="absolute inset-0 z-20 pointer-events-none"> 
        {/*
          Os nós são renderizados aqui. 
          Eles precisam ter pointer-events habilitado individualmente para serem interativos.
          Isso é feito dentro do NodeCard e nos conectores.
          A div que os envolve aqui tem pointer-events-none para permitir cliques no SVG por baixo, se necessário.
        */}
        {renderedNodes}
      </div>
    </div>
  );
});
Canvas.displayName = 'Canvas';
export default Canvas;
