"use client";

import React from 'react';
import { NodeComponentProps } from '../NodeProps';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { VariableInserter } from '../components/VariableInserter';

export const RedirectNode: React.FC<NodeComponentProps> = ({ node, onUpdate }) => {
    return (
        <div className="space-y-2" data-no-drag="true">
            <div>
                <Label htmlFor={`${node.id}-redirecturl`} className="text-[10px] font-medium text-zinc-400 mb-1 block">URL para Redirecionamento</Label>
                <div className="relative">
                    <Input id={`${node.id}-redirecturl`} placeholder="https://exemplo.com/{{id_usuario}}" value={node.redirectUrl || ''} onChange={(e) => onUpdate(node.id, { redirectUrl: e.target.value })} className="h-7 text-xs pr-7 bg-black/20 border-white/5 focus:border-primary/50" />
                    <VariableInserter fieldName="redirectUrl" isIconTrigger onInsert={(v) => onUpdate(node.id, { redirectUrl: (node.redirectUrl || '') + v })} />
                </div>
            </div>
        </div>
    );
};
