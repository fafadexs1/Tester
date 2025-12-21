"use client";

import React from 'react';
import { NodeComponentProps } from '../NodeProps';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { VariableInserter } from '../components/VariableInserter';

export const SetVariableNode: React.FC<NodeComponentProps> = ({ node, onUpdate }) => {
    return (
        <div className="space-y-2" data-no-drag="true">
            <div>
                <Label htmlFor={`${node.id}-varname`} className="text-[10px] font-medium text-zinc-400 mb-1 block">Nome da Variável</Label>
                <Input id={`${node.id}-varname`} placeholder="minhaVariavel" value={node.variableName || ''} onChange={(e) => onUpdate(node.id, { variableName: e.target.value })} className="h-7 text-xs bg-black/20 border-white/5 focus:border-primary/50" />
            </div>
            <div>
                <Label htmlFor={`${node.id}-varval`} className="text-[10px] font-medium text-zinc-400 mb-1 block">Valor (pode usar {"{{outra_var}}"})</Label>
                <div className="relative">
                    <Input id={`${node.id}-varval`} placeholder="Valor ou {{outra_var}}" value={node.variableValue || ''} onChange={(e) => onUpdate(node.id, { variableValue: e.target.value })} className="h-7 text-xs pr-7 bg-black/20 border-white/5 focus:border-primary/50" />
                    <VariableInserter fieldName="variableValue" isIconTrigger onInsert={(v) => onUpdate(node.id, { variableValue: (node.variableValue || '') + v })} />
                </div>
            </div>
        </div>
    );
};
