"use client";

import React, { useRef } from 'react';
import { NodeComponentProps } from '../NodeProps';
import { Textarea } from '@/components/ui/textarea';
import { VariableInserter } from '../components/VariableInserter';
import { TextFormatToolbar } from '../components/TextFormatToolbar';
import { cn } from "@/lib/utils";
import { NODE_HEADER_CONNECTOR_Y_OFFSET } from '@/lib/constants';

export const MessageNode: React.FC<NodeComponentProps> = ({ node, onUpdate, availableVariables, onStartConnection }) => {
    const textAreaRef = useRef<HTMLTextAreaElement>(null);
    const [localText, setLocalText] = React.useState(node.text || '');

    // Sync local state when node.text changes externally (e.g. undo/redo or initial load)
    // We strictly compare to avoid resetting cursor if we are the ones who updated it,
    // but here we just blindly sync if they differ significantly or if it's a new node.
    // Actually, to avoid cursor jumps, we usually only sync if the difference is not from our own debounced update.
    // simpler approach: just use useEffect to sync upstream changes, but guard against local updates.
    // For now, let's trust the user is the only one editing this node at this moment.
    React.useEffect(() => {
        setLocalText(node.text || '');
    }, [node.text]);

    const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newValue = e.target.value;
        setLocalText(newValue);
    };

    // Debounce update
    React.useEffect(() => {
        const timer = setTimeout(() => {
            if (localText !== (node.text || '')) {
                onUpdate(node.id, { text: localText });
            }
        }, 300); // 300ms debounce
        return () => clearTimeout(timer);
    }, [localText, node.id, onUpdate, node.text]);

    return (
        <div data-no-drag="true" className="group/node-content">
            <div className="bg-black/40 rounded-2xl border border-white/5 p-1 relative group-hover:border-primary/20 transition-all duration-300">
                <Textarea
                    ref={textAreaRef}
                    placeholder="Escribe el mensaje del bot aquí..."
                    value={localText}
                    onChange={handleTextChange}
                    className="resize-none text-xs bg-transparent border-0 focus-visible:ring-0 min-h-[100px] leading-relaxed tracking-tight text-white/80"
                />
                <div className="absolute right-2 top-2">
                    <VariableInserter
                        nodeId={node.id}
                        data={node}
                        onUpdate={(id, data) => {
                            // If VariableInserter updates text directly via onUpdate, we need to respect that.
                            // But VariableInserter likely calls onUpdate directly.
                            // Ideally VariableInserter should inject into our local state if we want instant feedback?
                            // For now, let's let VariableInserter update the node, which will trigger our first useEffect to update localText.
                            onUpdate(id, data);
                        }}
                        availableVariables={availableVariables}
                        fieldName="text"
                        isTextarea={true}
                    />
                </div>
                <div className="p-1 mt-1 border-t border-white/[0.03]">
                    <TextFormatToolbar
                        fieldName="text"
                        textAreaRef={textAreaRef}
                        onUpdate={(id, data) => {
                            // Same strategy: allow external update to propagate back to localText
                            onUpdate(id, data);
                        }}
                        nodeId={node.id}
                    />
                </div>
            </div>

            {/* Standard Metrics Output Handle handled by NodeCard, 
                but MessageNode in this codebase doesn't have multiple outputs,
                so it uses the NodeCard's default one. 
                Wait, NodeCard uses SELF_CONTAINED_NODES to decide.
                MessageNode is in SELF_CONTAINED_NODES. So I must render the handle here.
            */}
            <div
                className="absolute -right-2.5 top-11 z-30 flex items-center justify-center group/h-out"
                title="Saída"
            >
                <div className="absolute inset-0 bg-primary/40 rounded-full blur-lg opacity-0 group-hover/h-out:opacity-100 transition-opacity" />
                <div
                    className="w-2.5 h-2.5 rounded-full bg-primary border-2 border-black group-hover/h-out:scale-150 transition-all cursor-crosshair shadow-[0_0_10px_rgba(139,92,246,0.5)]"
                    onMouseDown={(e) => { e.stopPropagation(); onStartConnection(e, node, 'default'); }}
                    data-connector="true" data-handle-id="default"
                />
            </div>
        </div>
    );
};
