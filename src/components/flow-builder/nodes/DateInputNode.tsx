"use client";

import React, { useRef } from 'react';
import { NodeComponentProps } from '../NodeProps';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { VariableInserter } from '../components/VariableInserter';
import { ApiResponseSettings } from '../components/ApiResponseSettings';

export const DateInputNode: React.FC<NodeComponentProps> = ({ node, onUpdate }) => {
    const inputRef = useRef<HTMLInputElement>(null);

    return (
        <div className="space-y-2" data-no-drag="true">
            <div>
                <Label htmlFor={`${node.id}-datelabel`} className="text-[10px] font-medium text-zinc-400 mb-1 block">Texto da Pergunta</Label>
                <div className="relative">
                    <Input ref={inputRef} id={`${node.id}-datelabel`} placeholder="Ex: Qual sua data de nascimento?" value={node.dateInputLabel || ''} onChange={(e) => onUpdate(node.id, { dateInputLabel: e.target.value })} className="h-7 text-xs pr-7 bg-black/20 border-white/5 focus:border-primary/50" />
                    <VariableInserter fieldName="dateInputLabel" isIconTrigger onInsert={(v) => onUpdate(node.id, { dateInputLabel: (node.dateInputLabel || '') + v })} />
                </div>
            </div>
            <div>
                <Label htmlFor={`${node.id}-varsavedate`} className="text-[10px] font-medium text-zinc-400 mb-1 block">Salvar Data na Variável</Label>
                <Input id={`${node.id}-varsavedate`} placeholder="data_nascimento" value={node.variableToSaveDate || ''} onChange={(e) => onUpdate(node.id, { variableToSaveDate: e.target.value })} className="h-7 text-xs bg-black/20 border-white/5 focus:border-primary/50" />
            </div>
            <ApiResponseSettings node={node} onUpdate={onUpdate} />
        </div>
    );
};
