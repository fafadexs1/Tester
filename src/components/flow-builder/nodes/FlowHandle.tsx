"use client";

import React from 'react';
import { Handle, Position, useUpdateNodeInternals } from '@xyflow/react';
import { cn } from '@/lib/utils';

interface FlowHandleProps {
    id: string;
    type?: 'source' | 'target';
    position?: Position;
    title?: string;
    className?: string;
    colorClass?: string;
    style?: React.CSSProperties;
}

/**
 * Stable React Flow anchor. The measured handle never changes size or position;
 * only its inner visual dot animates, keeping edges attached at every zoom level.
 */
export const FlowHandle = ({
    id,
    type = 'source',
    position = type === 'source' ? Position.Right : Position.Left,
    title,
    className,
    colorClass = 'bg-zinc-400 group-hover/connector:bg-primary',
    style,
}: FlowHandleProps) => (
    <Handle
        id={id}
        type={type}
        position={position}
        title={title}
        className={cn(
            '!relative !left-auto !right-auto !top-auto !bottom-auto !translate-x-0 !translate-y-0',
            '!w-3 !h-3 !min-w-3 !min-h-3 rounded-full shadow-lg ring-2 ring-zinc-900',
            'transition-shadow duration-150 group-hover/connector:ring-primary/30 cursor-crosshair !border-0 !bg-transparent',
            className,
        )}
        style={style}
    >
        <span className={cn('block h-full w-full rounded-full transition-[background-color,transform] duration-150 group-hover/connector:scale-125', colorClass)} />
    </Handle>
);

export const RefreshNodeInternals = ({ nodeId, signature }: { nodeId: string; signature: unknown }) => {
    const updateNodeInternals = useUpdateNodeInternals();

    React.useEffect(() => {
        updateNodeInternals(nodeId);
    }, [nodeId, signature, updateNodeInternals]);

    return null;
};
