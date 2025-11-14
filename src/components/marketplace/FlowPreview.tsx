"use client";

import { useMemo } from "react";
import type { MouseEvent } from "react";
import type { Connection, NodeData } from "@/lib/types";

interface FlowPreviewProps {
  nodes: NodeData[];
  connections: Connection[];
  zoomLevel: number;
  canvasOffset: { x: number; y: number };
  onPan?: (event: MouseEvent<HTMLDivElement>) => void;
}

const NODE_WIDTH = 260;
const NODE_HEIGHT = 120;
const PADDING = 200;

const NODE_COLORS: Record<string, { fill: string; stroke: string }> = {
  start: { fill: "hsl(var(--primary)/0.15)", stroke: "hsl(var(--primary))" },
  message: { fill: "hsl(var(--accent)/0.2)", stroke: "hsl(var(--accent))" },
  "api-call": { fill: "hsl(var(--destructive)/0.15)", stroke: "hsl(var(--destructive))" },
};

const getNodeColors = (type: string) => NODE_COLORS[type] ?? { fill: "hsl(var(--muted))", stroke: "hsl(var(--muted-foreground))" };

export function FlowPreview({
  nodes = [],
  connections = [],
  zoomLevel,
  canvasOffset,
  onPan,
}: FlowPreviewProps) {
  const bounds = useMemo(() => {
    if (!nodes.length) {
      return {
        minX: 0,
        minY: 0,
        maxX: 800,
        maxY: 600,
      };
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    nodes.forEach((node) => {
      minX = Math.min(minX, node.x);
      minY = Math.min(minY, node.y);
      maxX = Math.max(maxX, node.x + NODE_WIDTH);
      maxY = Math.max(maxY, node.y + NODE_HEIGHT);
    });

    return { minX, minY, maxX, maxY };
  }, [nodes]);

  const viewBox = {
    x: bounds.minX - PADDING,
    y: bounds.minY - PADDING,
    width: Math.max(bounds.maxX - bounds.minX, 800) + PADDING * 2,
    height: Math.max(bounds.maxY - bounds.minY, 600) + PADDING * 2,
  };

  const connectionPaths = useMemo(() => {
    const nodeMap = new Map(nodes.map((node) => [node.id, node]));

    return connections
      .map((connection) => {
        const fromNode = nodeMap.get(connection.from);
        const toNode = nodeMap.get(connection.to);
        if (!fromNode || !toNode) {
          return null;
        }

        const startX = fromNode.x + NODE_WIDTH;
        const startY = fromNode.y + NODE_HEIGHT / 2;
        const endX = toNode.x;
        const endY = toNode.y + NODE_HEIGHT / 2;
        const delta = Math.max(Math.abs(endX - startX) * 0.4, 80);

        const d = `M ${startX} ${startY} C ${startX + delta} ${startY} ${endX - delta} ${endY} ${endX} ${endY}`;
        return { id: connection.id, d };
      })
      .filter(Boolean) as { id: string; d: string }[];
  }, [nodes, connections]);

  return (
    <div
      className="relative h-full w-full overflow-hidden bg-muted"
      onMouseMove={onPan}
      role="presentation"
    >
      <div className="absolute inset-0 bg-[linear-gradient(90deg,hsl(var(--accent))/0.08_1px,transparent_1px),linear-gradient(0deg,hsl(var(--accent))/0.08_1px,transparent_1px)] bg-[length:32px_32px]" />
      {!nodes.length && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center text-sm text-muted-foreground">
          Nenhum nó incluído neste fluxo ainda.
        </div>
      )}

      <svg
        className="relative h-full w-full"
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
        style={{
          transform: `translate(${canvasOffset.x}px, ${canvasOffset.y}px) scale(${zoomLevel})`,
          transformOrigin: "0 0",
        }}
      >
        <defs>
          <marker
            id="flow-preview-arrow"
            markerWidth="8"
            markerHeight="8"
            refX="2"
            refY="4"
            orient="auto"
          >
            <path d="M0,0 L0,8 L8,4 z" fill="hsl(var(--foreground)/0.6)" />
          </marker>
        </defs>

        {connectionPaths.map((path) => (
          <path
            key={path.id}
            d={path.d}
            stroke="hsl(var(--foreground)/0.3)"
            strokeWidth={4}
            fill="none"
            markerEnd="url(#flow-preview-arrow)"
          />
        ))}

        {nodes.map((node) => {
          const colors = getNodeColors(node.type);
          return (
            <g key={node.id} transform={`translate(${node.x}, ${node.y})`}>
              <rect
                width={NODE_WIDTH}
                height={NODE_HEIGHT}
                rx={16}
                ry={16}
                fill={colors.fill}
                stroke={colors.stroke}
                strokeWidth={2}
              />
              <text
                x={16}
                y={36}
                fontSize={18}
                fontWeight={600}
                fill="hsl(var(--foreground))"
              >
                {node.title}
              </text>
              <text
                x={16}
                y={68}
                fontSize={12}
                fill="hsl(var(--foreground)/0.7)"
              >
                {node.type}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
