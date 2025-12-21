"use client";

import React, { useRef } from 'react';
import { NodeComponentProps } from '../NodeProps';
import { Textarea } from '@/components/ui/textarea';
import { VariableInserter } from '../components/VariableInserter';
import { TextFormatToolbar } from '../components/TextFormatToolbar';
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

export const MessageNode: React.FC<NodeComponentProps> = ({ node, onUpdate, availableVariables, onStartConnection }) => {
    const textAreaRef = useRef<HTMLTextAreaElement>(null);

    const renderHandles = () => (
        <div
            className="absolute -right-3 z-20 flex items-center justify-center group/connector"
            style={{
                top: `${NODE_HEADER_CONNECTOR_Y_OFFSET}px`,
                transform: 'translateY(-50%)',
            }}
        >
            <ConnectorDot
                onMouseDown={(e) => { e.stopPropagation(); onStartConnection(e, node, 'default'); }}
                handleId="default"
                title="Arraste para conectar"
            />
        </div>
    );

    return (
        <>
            <div data-no-drag="true" className="space-y-2">
                <div className="relative">
                    <Textarea
                        ref={textAreaRef}
                        placeholder="Mensagem do bot..."
                        value={node.text || ''}
                        onChange={(e) => onUpdate(node.id, { text: e.target.value })}
                        className="resize-none text-xs pr-8 bg-black/20 border-white/5 focus:border-primary/50 min-h-[80px]"
                        rows={3}
                    />
                    <VariableInserter
                        nodeId={node.id}
                        data={node}
                        onUpdate={onUpdate}
                        availableVariables={availableVariables}
                        fieldName="text"
                        isTextarea={true}
                    />
                </div>
                <TextFormatToolbar fieldName="text" textAreaRef={textAreaRef} onUpdate={onUpdate} nodeId={node.id} />
            </div>
            {renderHandles()}
        </>
    );
};
