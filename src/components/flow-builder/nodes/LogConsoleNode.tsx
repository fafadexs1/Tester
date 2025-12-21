"use client";

import React from 'react';
import { NodeComponentProps } from '../NodeProps';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { VariableInserter } from '../components/VariableInserter';

export const LogConsoleNode: React.FC<NodeComponentProps> = ({ node, onUpdate }) => {
    return (
        <div className="space-y-2" data-no-drag="true">
            <div>
                <Label htmlFor={`${node.id}-logmsg`} className="text-[10px] font-medium text-zinc-400 mb-1 block">Mensagem para Log</Label>
                <div className="relative">
                    <Textarea id={`${node.id}-logmsg`} placeholder="Ex: Status: {{input.status}}, Usuário: {{user.id}}" value={node.logMessage || ''} onChange={(e) => onUpdate(node.id, { logMessage: e.target.value })} rows={2} className="text-xs pr-8 bg-black/20 border-white/5 focus:border-primary/50 resize-none" />
                    <VariableInserter fieldName="logMessage" isIconTrigger isTextarea onInsert={(v) => onUpdate(node.id, { logMessage: (node.logMessage || '') + v })} />
                </div>
            </div>
        </div>
    );
};
