"use client";

import React, { useRef } from 'react';
import { NodeComponentProps } from '../NodeProps';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { VariableInserter } from '../components/VariableInserter';
import { TextFormatToolbar } from '../components/TextFormatToolbar';
import { GeminiKeySelector } from '../components/GeminiKeySelector';

export const AiTextGenerationNode: React.FC<NodeComponentProps> = ({ node, onUpdate, organizationGeminiKeys }) => {
    const textAreaRef = useRef<HTMLTextAreaElement>(null);

    return (
        <div className="space-y-2" data-no-drag="true">
            <div>
                <Label htmlFor={`${node.id}-aiprompt`} className="mb-1 block text-[10px] font-medium text-zinc-400">Prompt para IA</Label>
                <div className="relative">
                    <Textarea
                        ref={textAreaRef}
                        id={`${node.id}-aiprompt`}
                        placeholder="Gere uma descricao para um produto chamado {{input.nome_produto}}."
                        value={node.aiPromptText || ''}
                        onChange={(event) => onUpdate(node.id, { aiPromptText: event.target.value })}
                        rows={4}
                        className="resize-none bg-black/20 pr-8 text-xs border-white/5 focus:border-primary/50"
                    />
                    <VariableInserter
                        fieldName="aiPromptText"
                        isIconTrigger
                        isTextarea
                        onInsert={(value) => onUpdate(node.id, { aiPromptText: (node.aiPromptText || '') + value })}
                    />
                </div>
                <TextFormatToolbar
                    fieldName="aiPromptText"
                    textAreaRef={textAreaRef as React.RefObject<HTMLTextAreaElement>}
                    onUpdate={onUpdate}
                    nodeId={node.id}
                />
            </div>

            <div>
                <Label htmlFor={`${node.id}-aimodel`} className="mb-1 block text-[10px] font-medium text-zinc-400">Modelo de IA (opcional)</Label>
                <div className="relative">
                    <Input
                        id={`${node.id}-aimodel`}
                        placeholder="googleai/gemini-2.5-flash"
                        value={node.aiModelName || ''}
                        onChange={(event) => onUpdate(node.id, { aiModelName: event.target.value })}
                        className="h-7 bg-black/20 pr-7 text-xs border-white/5 focus:border-primary/50"
                    />
                    <VariableInserter
                        fieldName="aiModelName"
                        isIconTrigger
                        onInsert={(value) => onUpdate(node.id, { aiModelName: (node.aiModelName || '') + value })}
                    />
                </div>
            </div>

            <GeminiKeySelector
                triggerId={`${node.id}-gemini-key`}
                value={node.aiKeyId}
                onChange={(value) => onUpdate(node.id, { aiKeyId: value })}
                keys={organizationGeminiKeys}
            />

            <div>
                <Label htmlFor={`${node.id}-aioutputvar`} className="mb-1 block text-[10px] font-medium text-zinc-400">Salvar resposta da IA na variavel</Label>
                <Input
                    id={`${node.id}-aioutputvar`}
                    placeholder="resposta_ia"
                    value={node.aiOutputVariable || ''}
                    onChange={(event) => onUpdate(node.id, { aiOutputVariable: event.target.value })}
                    className="h-7 bg-black/20 text-xs border-white/5 focus:border-primary/50"
                />
            </div>

            <p className="text-[10px] text-muted-foreground">
                A chave Gemini e resolvida pela integracao da organizacao e pode ser trocada pelo nome.
            </p>
        </div>
    );
};
