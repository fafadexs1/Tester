"use client";

import React, { useRef } from 'react';
import { NodeComponentProps } from '../NodeProps';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { VariableInserter } from '../components/VariableInserter';
import { TextFormatToolbar } from '../components/TextFormatToolbar';

export const IntelligentAgentNode: React.FC<NodeComponentProps> = ({ node, onUpdate }) => {
    const textAreaRef = useRef<HTMLTextAreaElement>(null);

    return (
        <div className="space-y-2" data-no-drag="true">
            <div>
                <Label htmlFor={`${node.id}-agentname`} className="text-[10px] font-medium text-zinc-400 mb-1 block">Nome do Agente</Label>
                <div className="relative">
                    <Input id={`${node.id}-agentname`} placeholder="Agente de Suporte N1" value={node.agentName || ''} onChange={(e) => onUpdate(node.id, { agentName: e.target.value })} className="h-7 text-xs pr-7 bg-black/20 border-white/5 focus:border-primary/50" />
                    <VariableInserter fieldName="agentName" isIconTrigger onInsert={(v) => onUpdate(node.id, { agentName: (node.agentName || '') + v })} />
                </div>
            </div>
            <div>
                <Label htmlFor={`${node.id}-agentsystemprompt`} className="text-[10px] font-medium text-zinc-400 mb-1 block">Prompt do Sistema / Instruções</Label>
                <div className="relative">
                    <Textarea ref={textAreaRef} id={`${node.id}-agentsystemprompt`} placeholder="Você é um assistente virtual especializado em {{area_especializacao}}." value={node.agentSystemPrompt || ''} onChange={(e) => onUpdate(node.id, { agentSystemPrompt: e.target.value })} rows={4} className="text-xs pr-8 bg-black/20 border-white/5 focus:border-primary/50 resize-none" />
                    <VariableInserter fieldName="agentSystemPrompt" isIconTrigger isTextarea onInsert={(v) => onUpdate(node.id, { agentSystemPrompt: (node.agentSystemPrompt || '') + v })} />
                </div>
                <TextFormatToolbar fieldName="agentSystemPrompt" textAreaRef={textAreaRef as React.RefObject<HTMLTextAreaElement>} onUpdate={onUpdate} nodeId={node.id} />
            </div>
            <div>
                <Label htmlFor={`${node.id}-userinputvar`} className="text-[10px] font-medium text-zinc-400 mb-1 block">Variável com Entrada do Usuário</Label>
                <div className="relative">
                    <Input id={`${node.id}-userinputvar`} placeholder="{{pergunta_usuario}}" value={node.userInputVariable || ''} onChange={(e) => onUpdate(node.id, { userInputVariable: e.target.value })} className="h-7 text-xs pr-7 bg-black/20 border-white/5 focus:border-primary/50" />
                    <VariableInserter fieldName="userInputVariable" isIconTrigger onInsert={(v) => onUpdate(node.id, { userInputVariable: (node.userInputVariable || '') + v })} />
                </div>
            </div>
            <div>
                <Label htmlFor={`${node.id}-agentresponsevar`} className="text-[10px] font-medium text-zinc-400 mb-1 block">Salvar Resposta na Variável</Label>
                <Input id={`${node.id}-agentresponsevar`} placeholder="resposta_agente" value={node.agentResponseVariable || ''} onChange={(e) => onUpdate(node.id, { agentResponseVariable: e.target.value })} className="h-7 text-xs bg-black/20 border-white/5 focus:border-primary/50" />
            </div>
            <div>
                <Label htmlFor={`${node.id}-aimodel`} className="text-[10px] font-medium text-zinc-400 mb-1 block">Modelo de IA (opcional)</Label>
                <div className="relative">
                    <Input id={`${node.id}-aimodel`} placeholder="gemini-1.5-flash (padrão Genkit)" value={node.aiModelName || ''} onChange={(e) => onUpdate(node.id, { aiModelName: e.target.value })} className="h-7 text-xs pr-7 bg-black/20 border-white/5 focus:border-primary/50" />
                    <VariableInserter fieldName="aiModelName" isIconTrigger onInsert={(v) => onUpdate(node.id, { aiModelName: (node.aiModelName || '') + v })} />
                </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
                <div>
                    <Label htmlFor={`${node.id}-maxturns`} className="text-[10px] font-medium text-zinc-400 mb-1 block">Máx. Turnos</Label>
                    <Input id={`${node.id}-maxturns`} type="number" placeholder="5" value={node.maxConversationTurns ?? ''} onChange={(e) => onUpdate(node.id, { maxConversationTurns: e.target.value ? parseInt(e.target.value, 10) : undefined })} className="h-7 text-xs bg-black/20 border-white/5 focus:border-primary/50" />
                </div>
                <div>
                    <Label htmlFor={`${node.id}-temperature`} className="text-[10px] font-medium text-zinc-400 mb-1 block">Temperatura ({node.temperature ?? 0.7})</Label>
                    <div className="flex items-center space-x-2 h-7">
                        <Slider
                            id={`${node.id}-temperature`}
                            min={0} max={1} step={0.01}
                            defaultValue={[node.temperature ?? 0.7]}
                            onValueChange={(value) => onUpdate(node.id, { temperature: value[0] })}
                            className="flex-1"
                        />
                    </div>
                </div>
            </div>
            <p className="text-[10px] text-muted-foreground">Este nó simula uma conversa com um agente de IA. A lógica real usa Genkit.</p>
        </div>
    );
};
