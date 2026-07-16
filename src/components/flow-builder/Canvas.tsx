"use client";

import React, {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { DropTargetMonitor } from "react-dnd";
import { useDrop } from "react-dnd";
import {
  applyNodeChanges,
  Background,
  BaseEdge,
  getBezierPath,
  MarkerType,
  ReactFlow,
  type Connection as ReactFlowConnection,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeProps,
  type ReactFlowInstance,
} from "@xyflow/react";
import NodeCard from "./NodeCard";
import type {
  CanvasOffset,
  Connection,
  DraggableBlockItemData,
  DrawingLineData,
  NodeData,
  OrganizationAiKeySummary,
  WorkspaceData,
} from "@/lib/types";
import { GRID_SIZE, ITEM_TYPE_BLOCK, NODE_WIDTH } from "@/lib/constants";

interface CanvasProps {
  nodes: NodeData[];
  connections: Connection[];
  /** @deprecated React Flow now owns the temporary connection line. */
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
  organizationGeminiKeys?: OrganizationAiKeySummary[];
  selectedNodeIds: string[];
  onSelectNode: (id: string, shiftKey: boolean) => void;
  onSelectionChangeIds?: (ids: string[]) => void;
  /** @deprecated Node dragging is handled by React Flow. */
  onNodeDragStart: (e: React.MouseEvent, id: string) => void;
  onUpdatePosition: (id: string, x: number, y: number) => void;
  onEndConnection: (e: React.MouseEvent, node: NodeData) => void;
  onConfigureNode?: (id: string) => void;
  disableAnimations: boolean;
  tracePathConnectionIds?: Set<string> | null;
  /** Persists a connection created through React Flow handles. */
  onConnectNodes?: (connection: Omit<Connection, "id">) => void;
}

interface CanvasNodeData extends Record<string, unknown> {
  node: NodeData;
  onUpdateNode: CanvasProps["onUpdateNode"];
  onStartConnection: CanvasProps["onStartConnection"];
  onDeleteNode: CanvasProps["onDeleteNode"];
  onDuplicateNode: CanvasProps["onDuplicateNode"];
  onSelectNode: CanvasProps["onSelectNode"];
  onUpdatePosition: CanvasProps["onUpdatePosition"];
  onEndConnection: CanvasProps["onEndConnection"];
  onConfigureNode?: CanvasProps["onConfigureNode"];
  availableVariables: string[];
  activeWorkspace: WorkspaceData | undefined | null;
  organizationGeminiKeys?: OrganizationAiKeySummary[];
}

interface CanvasEdgeData extends Record<string, unknown> {
  connectionId: string;
  highlighted: boolean;
  traced: boolean;
  dimmed: boolean;
  animate: boolean;
  reduceEffects: boolean;
  onDelete: (id: string) => void;
  onHighlight: (id: string | null) => void;
}

type CanvasFlowNode = Node<CanvasNodeData, "canvasNode">;

const CanvasNode = memo(({ data, selected }: NodeProps<CanvasFlowNode>) => {
  const { node } = data;

  return (
    <div data-node-id={node.id} style={{ width: NODE_WIDTH }}>
      <NodeCard
        node={node}
        onUpdateNode={data.onUpdateNode}
        onStartConnection={data.onStartConnection}
        onDeleteNode={data.onDeleteNode}
        onDuplicateNode={data.onDuplicateNode}
        availableVariables={data.availableVariables}
        activeWorkspace={data.activeWorkspace}
        organizationGeminiKeys={data.organizationGeminiKeys}
        isSelected={selected}
        onSelect={data.onSelectNode}
        // React Flow owns the wrapper transform and drag lifecycle.
        onDragStart={() => undefined}
        onUpdatePosition={data.onUpdatePosition}
        onEndConnection={data.onEndConnection}
        onConfigure={data.onConfigureNode}
      />
    </div>
  );
});
CanvasNode.displayName = "CanvasNode";

const CanvasEdge = memo((props: EdgeProps) => {
  const {
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    markerEnd,
  } = props;
  const data = props.data as CanvasEdgeData | undefined;
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  if (!data) return null;

  const emphasized = data.highlighted || data.traced;
  const stroke = emphasized
    ? "#a855f7"
    : data.dimmed
      ? "#333333"
      : "hsl(var(--neon-cyan))";

  return (
    <g
      style={{ cursor: "pointer" }}
      onMouseEnter={() => data.onHighlight(data.connectionId)}
      onMouseLeave={() => data.onHighlight(null)}
      onClick={(event) => {
        event.stopPropagation();
        data.onDelete(data.connectionId);
      }}
    >
      <title>Clique para remover conexao</title>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        interactionWidth={24}
        style={{
          stroke,
          strokeOpacity: data.dimmed ? 0.2 : emphasized ? 1 : 0.65,
          strokeWidth: emphasized ? 3 : 2,
          transition: "stroke 200ms, stroke-opacity 200ms, stroke-width 200ms",
        }}
      />

      {!data.reduceEffects && data.animate && emphasized && (
        <path
          d={edgePath}
          fill="none"
          stroke="white"
          strokeDasharray="10 10"
          strokeWidth={2}
          opacity={0.8}
          className="pointer-events-none animate-dash"
        />
      )}
    </g>
  );
});
CanvasEdge.displayName = "CanvasEdge";

const nodeTypes = { canvasNode: CanvasNode };
const edgeTypes = { canvasEdge: CanvasEdge };
const SNAP_GRID: [number, number] = [GRID_SIZE, GRID_SIZE];
const CONNECTION_LINE_STYLE: React.CSSProperties = {
  stroke: "hsl(var(--primary))",
  strokeWidth: 2,
};
const PRO_OPTIONS = { hideAttribution: true } as const;

const Canvas = forwardRef<HTMLDivElement, CanvasProps>(({
  nodes,
  connections,
  canvasOffset,
  zoomLevel,
  onDropNode,
  onUpdateNode,
  onStartConnection,
  onDeleteNode,
  onDuplicateNode,
  onDeleteConnection,
  onCanvasMouseDown,
  isInteracting,
  highlightedConnectionId,
  setHighlightedConnectionId,
  availableVariablesByNode,
  activeWorkspace,
  organizationGeminiKeys,
  selectedNodeIds,
  onSelectNode,
  onSelectionChangeIds,
  onUpdatePosition,
  onEndConnection,
  onConfigureNode,
  disableAnimations,
  tracePathConnectionIds,
  onConnectNodes,
}, forwardedRef) => {
  const localRef = useRef<HTMLDivElement>(null);
  const reactFlow = useRef<ReactFlowInstance<CanvasFlowNode, Edge> | null>(null);
  const initialViewport = useRef({
    x: canvasOffset.x,
    y: canvasOffset.y,
    zoom: zoomLevel,
  }).current;
  const [isFlowInteracting, setIsFlowInteracting] = useState(false);

  const assignRef = useCallback((element: HTMLDivElement | null) => {
    localRef.current = element;
    if (typeof forwardedRef === "function") forwardedRef(element);
    else if (forwardedRef) forwardedRef.current = element;
  }, [forwardedRef]);

  const mappedNodes = useMemo<CanvasFlowNode[]>(() => nodes.map((node) => ({
    id: node.id,
    type: "canvasNode",
    position: { x: node.x, y: node.y },
    selected: selectedNodeIds.includes(node.id),
    data: {
      node,
      onUpdateNode,
      onStartConnection,
      onDeleteNode,
      onDuplicateNode,
      onSelectNode,
      onUpdatePosition,
      onEndConnection,
      onConfigureNode,
      availableVariables: availableVariablesByNode[node.id] || [],
      activeWorkspace,
      organizationGeminiKeys,
    },
  })), [
    nodes,
    selectedNodeIds,
    onUpdateNode,
    onStartConnection,
    onDeleteNode,
    onDuplicateNode,
    onSelectNode,
    onUpdatePosition,
    onEndConnection,
    onConfigureNode,
    availableVariablesByNode,
    activeWorkspace,
    organizationGeminiKeys,
  ]);

  const [flowNodes, setFlowNodes] = useState<CanvasFlowNode[]>(mappedNodes);
  useEffect(() => setFlowNodes(mappedNodes), [mappedNodes]);

  const performanceMode = nodes.length > 30 || connections.length > 40;
  const reduceConnectionEffects = isInteracting || isFlowInteracting || performanceMode;
  const isTracing = Boolean(tracePathConnectionIds?.size);
  const flowEdges = useMemo<Edge[]>(() => connections.map((connection) => {
    const traced = Boolean(tracePathConnectionIds?.has(connection.id));
    const highlighted = highlightedConnectionId === connection.id;
    return {
      id: connection.id,
      source: connection.from,
      target: connection.to,
      sourceHandle: connection.sourceHandle || "default",
      targetHandle: connection.targetHandle || "default",
      type: "canvasEdge",
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 16,
        height: 16,
        color: highlighted || traced ? "#a855f7" : "hsl(var(--neon-cyan))",
      },
      data: {
        connectionId: connection.id,
        highlighted,
        traced,
        dimmed: isTracing && !traced,
        animate: !disableAnimations && selectedNodeIds.length === 0,
        reduceEffects: reduceConnectionEffects,
        onDelete: onDeleteConnection,
        onHighlight: setHighlightedConnectionId,
      } satisfies CanvasEdgeData,
    };
  }), [
    connections,
    tracePathConnectionIds,
    highlightedConnectionId,
    isTracing,
    disableAnimations,
    selectedNodeIds.length,
    reduceConnectionEffects,
    onDeleteConnection,
    setHighlightedConnectionId,
  ]);

  const handleConnect = useCallback((connection: ReactFlowConnection) => {
    if (!connection.source || !connection.target || connection.source === connection.target) return;
    onConnectNodes?.({
      from: connection.source,
      to: connection.target,
      sourceHandle: connection.sourceHandle || "default",
      targetHandle: connection.targetHandle || undefined,
    });
  }, [onConnectNodes]);

  const stableOnDropNode = useCallback((item: DraggableBlockItemData, monitor: DropTargetMonitor) => {
    const clientOffset = monitor.getClientOffset();
    if (!clientOffset || !reactFlow.current) return;
    const position = reactFlow.current.screenToFlowPosition(clientOffset, { snapToGrid: true });
    onDropNode(item, position);
  }, [onDropNode]);

  const [, drop] = useDrop(() => ({
    accept: ITEM_TYPE_BLOCK,
    drop: stableOnDropNode,
  }), [stableOnDropNode]);

  useEffect(() => {
    drop(localRef.current);
    return () => { drop(null); };
  }, [drop]);

  const handleNodesChange = useCallback((changes: Parameters<typeof applyNodeChanges<CanvasFlowNode>>[0]) => {
    setFlowNodes((current) => applyNodeChanges(changes, current));
    changes.forEach((change) => {
      if (change.type !== "position" || change.dragging !== false || !change.position) return;
      const x = Math.round(change.position.x / GRID_SIZE) * GRID_SIZE;
      const y = Math.round(change.position.y / GRID_SIZE) * GRID_SIZE;
      onUpdatePosition(change.id, x, y);
    });
  }, [onUpdatePosition]);

  const handleSelectionChange = useCallback(({ nodes: selectedNodes }: { nodes: CanvasFlowNode[] }) => {
    const nextIds = selectedNodes.map((node) => node.id);
    const selectionIsUnchanged = nextIds.length === selectedNodeIds.length
      && nextIds.every((id) => selectedNodeIds.includes(id));
    if (!selectionIsUnchanged) onSelectionChangeIds?.(nextIds);
  }, [onSelectionChangeIds, selectedNodeIds]);

  const beginInteraction = useCallback(() => setIsFlowInteracting(true), []);
  const endInteraction = useCallback(() => setIsFlowInteracting(false), []);
  const handlePaneClick = useCallback(() => setHighlightedConnectionId(null), [setHighlightedConnectionId]);
  const handleInit = useCallback((instance: ReactFlowInstance<CanvasFlowNode, Edge>) => {
    reactFlow.current = instance;
  }, []);

  return (
    <div
      ref={assignRef}
      className="relative flex-1 h-full w-full overflow-hidden bg-black select-none"
      onMouseDown={(event) => {
        const target = event.target as HTMLElement;
        if (target.classList.contains("react-flow__pane")) onCanvasMouseDown(event);
      }}
    >
      <ReactFlow<CanvasFlowNode, Edge>
        nodes={flowNodes}
        edges={flowEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultViewport={initialViewport}
        onInit={handleInit}
        onNodesChange={handleNodesChange}
        onSelectionChange={handleSelectionChange}
        onMoveStart={beginInteraction}
        onMoveEnd={endInteraction}
        onNodeDragStart={beginInteraction}
        onNodeDragStop={endInteraction}
        onConnect={handleConnect}
        onPaneClick={handlePaneClick}
        minZoom={0.2}
        maxZoom={2}
        snapToGrid
        snapGrid={SNAP_GRID}
        panOnDrag
        zoomOnScroll
        zoomOnPinch
        zoomOnDoubleClick={false}
        selectionOnDrag={false}
        multiSelectionKeyCode="Shift"
        deleteKeyCode={null}
        connectionLineStyle={CONNECTION_LINE_STYLE}
        className={performanceMode ? "bg-black performance-flow" : "bg-black"}
        proOptions={PRO_OPTIONS}
      >
        <Background
          gap={GRID_SIZE}
          size={1}
          color="rgba(148, 163, 184, 0.18)"
        />
      </ReactFlow>

      <style jsx global>{`
        @keyframes dash {
          to { stroke-dashoffset: -100; }
        }
        .animate-dash {
          animation: dash 1.25s linear infinite;
        }
        .react-flow__node-canvasNode {
          background: transparent;
          border: 0;
          width: ${NODE_WIDTH}px;
        }
        .react-flow__edge-path {
          stroke-linecap: round;
        }
        .performance-flow .neo-glass {
          -webkit-backdrop-filter: none !important;
          backdrop-filter: none !important;
          background-color: rgba(9, 9, 11, 0.96) !important;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.45) !important;
        }
      `}</style>
    </div>
  );
});

Canvas.displayName = "Canvas";
export default Canvas;
