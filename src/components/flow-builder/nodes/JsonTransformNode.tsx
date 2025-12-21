"use client";

import React from 'react';
import { NodeComponentProps } from '../NodeProps';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { VariableInserter } from '../components/VariableInserter';

export const JsonTransformNode: React.FC<NodeComponentProps> = ({ node, onUpdate }) => {
    return (
        <div className="space-y-2" data-no-drag="true">
            <div>
                <Label htmlFor={`${node.id}-inputjson`} className="text-[10px] font-medium text-zinc-400 mb-1 block">JSON de Entrada</Label>
                <div className="relative">
                    <Textarea id={`${node.id}-inputjson`} placeholder='{ "chave": "valor" } ou {{dados_api}}' value={node.inputJson || ''} onChange={(e) => onUpdate(node.id, { inputJson: e.target.value })} rows={3} className="text-xs pr-8 bg-black/20 border-white/5 focus:border-primary/50 resize-none" />
                    <VariableInserter fieldName="inputJson" isIconTrigger isTextarea onInsert={(v) => onUpdate(node.id, { inputJson: (node.inputJson || '') + v })} />
                </div>
            </div>
            <div>
                <Label htmlFor={`${node.id}-jsonata`} className="text-[10px] font-medium text-zinc-400 mb-1 block">Expressão JSONata</Label>
                <div className="relative">
                    <Input id={`${node.id}-jsonata`} placeholder="Ex: $.chave" value={node.jsonataExpression || ''} onChange={(e) => onUpdate(node.id, { jsonataExpression: e.target.value })} className="h-7 text-xs pr-7 bg-black/20 border-white/5 focus:border-primary/50" />
                    <VariableInserter fieldName="jsonataExpression" isIconTrigger onInsert={(v) => onUpdate(node.id, { jsonataExpression: (node.jsonataExpression || '') + v })} />
                </div>
            </div>
            <div>
                <Label htmlFor={`${node.id}-jsonoutput`} className="text-[10px] font-medium text-zinc-400 mb-1 block">Salvar Resultado na Variável</Label>
                <Input id={`${node.id}-jsonoutput`} placeholder="resultado_json" value={node.jsonOutputVariable || ''} onChange={(e) => onUpdate(node.id, { jsonOutputVariable: e.target.value })} className="h-7 text-xs bg-black/20 border-white/5 focus:border-primary/50" />
            </div>
        </div>
    );
};
