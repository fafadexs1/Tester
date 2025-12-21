"use client";

import React, { useRef } from 'react';
import { NodeComponentProps } from '../NodeProps';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { VariableInserter } from '../components/VariableInserter';
import { TextFormatToolbar } from '../components/TextFormatToolbar';

export const DialogySendMessageNode: React.FC<NodeComponentProps> = ({ node, onUpdate }) => {
    const textAreaRef = useRef<HTMLTextAreaElement>(null);

    return (
        <div className="space-y-2" data-no-drag="true">
            <div>
                <Label htmlFor={`${node.id}-dialogychatid`} className="text-[10px] font-medium text-zinc-400 mb-1 block">Chat ID</Label>
                <div className="relative">
                    <Input
                        id={`${node.id}-dialogychatid`}
                        placeholder="{{dialogy_conversation_id}}"
                        value={node.dialogyChatId || ''}
                        onChange={(e) => onUpdate(node.id, { dialogyChatId: e.target.value })}
                        className="h-7 text-xs pr-7 bg-black/20 border-white/5 focus:border-primary/50"
                    />
                    <VariableInserter fieldName="dialogyChatId" isIconTrigger onInsert={(v) => onUpdate(node.id, { dialogyChatId: (node.dialogyChatId || '') + v })} />
                </div>
            </div>
            <div>
                <Label htmlFor={`${node.id}-dialogycontent`} className="text-[10px] font-medium text-zinc-400 mb-1 block">Conteúdo da Mensagem</Label>
                <div className="relative">
                    <Textarea
                        ref={textAreaRef}
                        id={`${node.id}-dialogycontent`}
                        placeholder="Olá, {{contact_name}}!"
                        value={node.dialogyMessageContent || ''}
                        onChange={(e) => onUpdate(node.id, { dialogyMessageContent: e.target.value })}
                        rows={3}
                        className="text-xs pr-8 bg-black/20 border-white/5 focus:border-primary/50 resize-none"
                    />
                    <VariableInserter fieldName="dialogyMessageContent" isIconTrigger isTextarea onInsert={(v) => onUpdate(node.id, { dialogyMessageContent: (node.dialogyMessageContent || '') + v })} />
                </div>
                <TextFormatToolbar fieldName="dialogyMessageContent" textAreaRef={textAreaRef as React.RefObject<HTMLTextAreaElement>} onUpdate={onUpdate} nodeId={node.id} />
            </div>
            <p className="text-[10px] text-muted-foreground">
                A instância da Dialogy a ser usada é definida nas Configurações do Fluxo.
            </p>
        </div>
    );
};
