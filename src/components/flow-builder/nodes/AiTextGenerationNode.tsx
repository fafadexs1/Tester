"use client";

import React, { useRef } from 'react';
import { NodeComponentProps } from '../NodeProps';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { VariableInserter } from '../components/VariableInserter';
import { TextFormatToolbar } from '../components/TextFormatToolbar';

export const AiTextGenerationNode: React.FC<NodeComponentProps> = ({ node, onUpdate }) => {
    const textAreaRef = useRef<HTMLTextAreaElement>(null);

    return (
        <div className="space-y-2" data-no-drag="true">
            <div>
                <Label htmlFor={`${node.id}-aiprompt`} className="text-[10px] font-medium text-zinc-400 mb-1 block">Prompt para IA</Label>
                <div className="relative">
                    <Textarea ref={textAreaRef} id={`${node.id}-aiprompt`} placeholder="Gere uma descrição para um produto chamado {{input.nome_produto}}." value={node.aiPromptText || ''} onChange={(e) => onUpdate(node.id, { aiPromptText: e.target.value })} rows={4} className="text-xs pr-8 bg-black/20 border-white/5 focus:border-primary/50 resize-none" />
                    <VariableInserter fieldName="aiPromptText" isIconTrigger isTextarea onInsert={(v) => onUpdate(node.id, { aiPromptText: (node.aiPromptText || '') + v })} />
                </div>
                <TextFormatToolbar fieldName="aiPromptText" textAreaRef={textAreaRef as React.RefObject<HTMLTextAreaElement>} onUpdate={onUpdate} nodeId={node.id} />
            </div>
            <div>
                <Label htmlFor={`${node.id}-aimodel`} className="text-[10px] font-medium text-zinc-400 mb-1 block">Modelo de IA (opcional)</Label>
                <div className="relative">
                    <Input id={`${node.id}-aimodel`} placeholder="gemini-1.5-flash (padrão)" value={node.aiModelName || ''} onChange={(e) => onUpdate(node.id, { aiModelName: e.target.value })} className="h-7 text-xs pr-7 bg-black/20 border-white/5 focus:border-primary/50" />
                    <VariableInserter fieldName="aiModelName" isIconTrigger onInsert={(v) => onUpdate(node.id, { aiModelName: (node.aiModelName || '') + v })} />
                </div>
            </div>
            <div>
                <Label htmlFor={`${node.id}-aioutputvar`} className="text-[10px] font-medium text-zinc-400 mb-1 block">Salvar Resposta da IA na Variável</Label>
                <Input id={`${node.id}-aioutputvar`} placeholder="resposta_ia" value={node.aiOutputVariable || ''} onChange={(e) => onUpdate(node.id, { aiOutputVariable: e.target.value })} className="h-7 text-xs bg-black/20 border-white/5 focus:border-primary/50" />
            </div>
            <p className="text-[10px] text-muted-foreground">Esta integração usa Genkit. Configure seu modelo em `src/ai/genkit.ts`.</p>
        </div>
    );
};
