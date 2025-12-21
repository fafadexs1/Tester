"use client";

import React from 'react';
import { NodeComponentProps } from '../NodeProps';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { cn } from "@/lib/utils";
import { NODE_HEADER_CONNECTOR_Y_OFFSET } from '@/lib/constants';

const ConnectorDot = ({
    onMouseDown,
    handleId,
    title,
    colorClass = "bg-zinc-400 group-hover/connector:bg-primary"
}: {
    onMouseDown: (e: React.MouseEvent) => void,
    handleId: string,
    title?: string,
    colorClass?: string
}) => (
    <div
        className="w-3 h-3 rounded-full shadow-lg ring-2 ring-zinc-900 transition-all duration-300 group-hover/connector:w-4 group-hover/connector:h-4 group-hover/connector:ring-primary/30 cursor-crosshair"
        onMouseDown={onMouseDown}
        data-connector="true"
        data-handle-type="source"
        data-handle-id={handleId}
        title={title}
    >
        <div className={cn("w-full h-full rounded-full transition-colors duration-300", colorClass)} />
    </div>
);

export const TimeOfDayNode: React.FC<NodeComponentProps> = ({ node, onUpdate, onStartConnection }) => {
    return (
        <div className="space-y-2" data-no-drag="true">
            <p className="text-[10px] text-muted-foreground">Verifica se a hora atual está dentro do intervalo.</p>
            <div className="grid grid-cols-2 gap-2">
                <div>
                    <Label htmlFor={`${node.id}-starttime`} className="text-[10px] font-medium text-zinc-400 mb-1 block">Início</Label>
                    <Input
                        id={`${node.id}-starttime`}
                        type="time"
                        value={node.startTime || ''}
                        onChange={(e) => onUpdate(node.id, { startTime: e.target.value })}
                        className="h-7 text-xs bg-black/20 border-white/5 focus:border-primary/50"
                    />
                </div>
                <div>
                    <Label htmlFor={`${node.id}-endtime`} className="text-[10px] font-medium text-zinc-400 mb-1 block">Fim</Label>
                    <Input
                        id={`${node.id}-endtime`}
                        type="time"
                        value={node.endTime || ''}
                        onChange={(e) => onUpdate(node.id, { endTime: e.target.value })}
                        className="h-7 text-xs bg-black/20 border-white/5 focus:border-primary/50"
                    />
                </div>
            </div>
            <div>
                <Label htmlFor={`${node.id}-timezone`} className="text-[10px] font-medium text-zinc-400 mb-1 block">Timezone (ex: America/Sao_Paulo)</Label>
                <Input
                    id={`${node.id}-timezone`}
                    placeholder="America/Sao_Paulo"
                    value={node.timezone || ''}
                    onChange={(e) => onUpdate(node.id, { timezone: e.target.value })}
                    className="h-7 text-xs bg-black/20 border-white/5 focus:border-primary/50"
                />
            </div>
            {/* Handles rendered alongside the component */}
            <div
                className="absolute -right-3 z-20 flex items-center justify-center group/connector"
                style={{
                    // StartNode aligns triggers dynamically. Condition aligns using offset.
                    // Let's use specific offsets.
                    top: '40px',
                    transform: 'translateY(-50%)',
                }}
            >
                <ConnectorDot
                    onMouseDown={(e) => { e.stopPropagation(); onStartConnection(e, node, 'true'); }}
                    handleId="true"
                    title="Dentro do Horário"
                    colorClass="bg-green-500 group-hover/connector:bg-green-400"
                />
            </div>
            <div
                className="absolute -right-3 z-20 flex items-center justify-center group/connector"
                style={{
                    top: '70px',
                    transform: 'translateY(-50%)',
                }}
            >
                <ConnectorDot
                    onMouseDown={(e) => { e.stopPropagation(); onStartConnection(e, node, 'false'); }}
                    handleId="false"
                    title="Fora do Horário"
                    colorClass="bg-red-500 group-hover/connector:bg-red-400"
                />
            </div>
        </div>
    );
};
