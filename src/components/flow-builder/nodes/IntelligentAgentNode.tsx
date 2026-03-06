"use client";

import React, { useMemo, useRef } from 'react';
import { NodeComponentProps } from '../NodeProps';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { MentionsTextarea, MentionOption } from '../components/MentionsTextarea';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { VariableInserter } from '../components/VariableInserter';
import { TextFormatToolbar } from '../components/TextFormatToolbar';

export const IntelligentAgentNode: React.FC<NodeComponentProps> = ({
    node,
    onUpdate,
    onEndConnection,
    activeWorkspace,
}) => {
    const textAreaRef = useRef<HTMLTextAreaElement>(null);

    const availableTools = useMemo(() => {
        const tools: MentionOption[] = [];

        if (activeWorkspace?.nodes) {
            activeWorkspace.nodes
                .filter(workspaceNode => ['http-tool', 'capability', 'knowledge'].includes(workspaceNode.type))
                .forEach(workspaceNode => {
                    let label = workspaceNode.title;
                    let type: MentionOption['type'] = 'tool';

                    if (workspaceNode.type === 'http-tool') {
                        label = workspaceNode.httpToolName || workspaceNode.title || 'HTTP Tool';
                        type = 'http';
                    } else if (workspaceNode.type === 'capability') {
                        label = workspaceNode.capabilityName || workspaceNode.title || 'Capability';
                        type = 'capability';
                    } else if (workspaceNode.type === 'knowledge') {
                        label = workspaceNode.title || 'Knowledge Base';
                        type = 'knowledge';
                    }

                    tools.push({
                        id: workspaceNode.id,
                        label,
                        value: workspaceNode.id,
                        type,
                    });
                });
        }

        tools.push({
            id: 'finalizar_atendimento',
            label: 'finalizar_atendimento',
            value: 'finalizar_atendimento',
            type: 'tool',
        });

        return tools;
    }, [activeWorkspace?.nodes]);

    return (
        <div className="space-y-2" data-no-drag="true">
            <div>
                <Label htmlFor={`${node.id}-agentname`} className="mb-1 block text-[10px] font-medium text-zinc-400">
                    Nome do Agente
                </Label>
                <div className="relative">
                    <Input
                        id={`${node.id}-agentname`}
                        placeholder="Agente Comercial"
                        value={node.agentName || ''}
                        onChange={(event) => onUpdate(node.id, { agentName: event.target.value })}
                        className="h-7 bg-black/20 pr-7 text-xs border-white/5 focus:border-primary/50"
                    />
                    <VariableInserter
                        fieldName="agentName"
                        isIconTrigger
                        onInsert={(value) => onUpdate(node.id, { agentName: (node.agentName || '') + value })}
                    />
                </div>
            </div>

            <div>
                <Label htmlFor={`${node.id}-agentsystemprompt`} className="mb-1 block text-[10px] font-medium text-zinc-400">
                    Prompt do Sistema / Instrucoes
                </Label>
                <div className="relative h-32">
                    <MentionsTextarea
                        ref={textAreaRef}
                        id={`${node.id}-agentsystemprompt`}
                        placeholder="Voce e um assistente virtual... Use @Ferramenta para..."
                        value={node.agentSystemPrompt || ''}
                        onUpdate={(value) => onUpdate(node.id, { agentSystemPrompt: value })}
                        options={availableTools}
                        rows={4}
                        className="h-full resize-none bg-black/20 pr-8 text-xs border-white/5 focus:border-primary/50"
                    />
                    <VariableInserter
                        fieldName="agentSystemPrompt"
                        isIconTrigger
                        isTextarea
                        onInsert={(value) => onUpdate(node.id, { agentSystemPrompt: (node.agentSystemPrompt || '') + value })}
                    />
                </div>
                <TextFormatToolbar
                    fieldName="agentSystemPrompt"
                    textAreaRef={textAreaRef as React.RefObject<HTMLTextAreaElement>}
                    onUpdate={onUpdate}
                    nodeId={node.id}
                />
            </div>

            <div>
                <Label htmlFor={`${node.id}-userinputvar`} className="mb-1 block text-[10px] font-medium text-zinc-400">
                    Variavel com Entrada do Usuario
                </Label>
                <div className="relative">
                    <Input
                        id={`${node.id}-userinputvar`}
                        placeholder="{{pergunta_usuario}}"
                        value={node.userInputVariable || ''}
                        onChange={(event) => onUpdate(node.id, { userInputVariable: event.target.value })}
                        className="h-7 bg-black/20 pr-7 text-xs border-white/5 focus:border-primary/50"
                    />
                    <VariableInserter
                        fieldName="userInputVariable"
                        isIconTrigger
                        onInsert={(value) => onUpdate(node.id, { userInputVariable: (node.userInputVariable || '') + value })}
                    />
                </div>
            </div>

            <div>
                <Label htmlFor={`${node.id}-agentresponsevar`} className="mb-1 block text-[10px] font-medium text-zinc-400">
                    Salvar Resposta na Variavel
                </Label>
                <Input
                    id={`${node.id}-agentresponsevar`}
                    placeholder="resposta_agente"
                    value={node.agentResponseVariable || ''}
                    onChange={(event) => onUpdate(node.id, { agentResponseVariable: event.target.value })}
                    className="h-7 bg-black/20 text-xs border-white/5 focus:border-primary/50"
                />
            </div>

            <div className="grid grid-cols-2 gap-2">
                <div>
                    <Label htmlFor={`${node.id}-maxturns`} className="mb-1 block text-[10px] font-medium text-zinc-400">
                        Max. Turnos
                    </Label>
                    <Input
                        id={`${node.id}-maxturns`}
                        type="number"
                        placeholder="5"
                        value={node.maxConversationTurns ?? ''}
                        onChange={(event) =>
                            onUpdate(node.id, {
                                maxConversationTurns: event.target.value ? parseInt(event.target.value, 10) : undefined,
                            })
                        }
                        className="h-7 bg-black/20 text-xs border-white/5 focus:border-primary/50"
                    />
                </div>
                <div>
                    <Label htmlFor={`${node.id}-temperature`} className="mb-1 block text-[10px] font-medium text-zinc-400">
                        Temperatura ({node.temperature ?? 0.7})
                    </Label>
                    <div className="flex h-7 items-center space-x-2">
                        <Slider
                            id={`${node.id}-temperature`}
                            min={0}
                            max={1}
                            step={0.01}
                            defaultValue={[node.temperature ?? 0.7]}
                            onValueChange={(value) => onUpdate(node.id, { temperature: value[0] })}
                            className="flex-1"
                        />
                    </div>
                </div>
            </div>

            <div>
                <Label htmlFor={`${node.id}-route-lock`} className="mb-1 block text-[10px] font-medium text-zinc-400">
                    Lock de Rota
                </Label>
                <Select
                    value={node.agentRouteLock || 'none'}
                    onValueChange={(value) => onUpdate(node.id, { agentRouteLock: value as any })}
                >
                    <SelectTrigger id={`${node.id}-route-lock`} className="h-7 bg-black/20 text-xs border-white/5 focus:border-primary/50">
                        <SelectValue placeholder="Sem lock" />
                    </SelectTrigger>
                    <SelectContent className="border-white/10 bg-zinc-950">
                        <SelectItem value="none">Sem lock</SelectItem>
                        <SelectItem value="ASSINATURA">Assinatura Comercial</SelectItem>
                        <SelectItem value="SUPORTE">Suporte</SelectItem>
                        <SelectItem value="FINANCEIRO">Financeiro</SelectItem>
                    </SelectContent>
                </Select>
                <p className="mt-1 text-[10px] text-muted-foreground">
                    Mantem o agente preso nessa rota e evita desvios automaticos do roteador.
                </p>
            </div>

            <p className="text-[10px] text-muted-foreground">
                Este no simula uma conversa com um agente de IA. A logica real usa Genkit.
            </p>

            <div className="absolute -bottom-3 left-0 right-0 flex justify-center gap-4 px-2">
                <div className="group/h-model relative flex flex-col items-center gap-1">
                    <div
                        className="h-3 w-3 cursor-crosshair rounded-full border border-black bg-violet-500 shadow-[0_0_5px_rgba(139,92,246,0.5)] transition-transform hover:scale-125"
                        data-connector="true"
                        data-handle-type="target"
                        data-handle-id="model"
                        data-node-id={node.id}
                        onMouseUp={(event) => {
                            event.stopPropagation();
                            onEndConnection?.(event, node, 'model');
                        }}
                        title="Connect AI Model"
                    />
                    <span className="absolute -bottom-4 whitespace-nowrap rounded bg-black/80 px-1 text-[8px] font-bold uppercase tracking-tighter text-zinc-500 opacity-0 transition-opacity group-hover/h-model:opacity-100">
                        Model
                    </span>
                </div>

                <div className="group/h-mem relative flex flex-col items-center gap-1">
                    <div
                        className="h-3 w-3 cursor-crosshair rounded-full border border-black bg-blue-500 shadow-[0_0_5px_rgba(59,130,246,0.5)] transition-transform hover:scale-125"
                        data-connector="true"
                        data-handle-type="target"
                        data-handle-id="memory"
                        data-node-id={node.id}
                        onMouseUp={(event) => {
                            event.stopPropagation();
                            onEndConnection?.(event, node, 'memory');
                        }}
                        title="Connect Memory"
                    />
                    <span className="absolute -bottom-4 whitespace-nowrap rounded bg-black/80 px-1 text-[8px] font-bold uppercase tracking-tighter text-zinc-500 opacity-0 transition-opacity group-hover/h-mem:opacity-100">
                        Memory
                    </span>
                </div>

                <div className="group/h-tool relative flex flex-col items-center gap-1">
                    <div
                        className="h-3 w-3 cursor-crosshair rounded-full border border-black bg-amber-500 shadow-[0_0_5px_rgba(245,158,11,0.5)] transition-transform hover:scale-125"
                        data-connector="true"
                        data-handle-type="target"
                        data-handle-id="tools"
                        data-node-id={node.id}
                        onMouseUp={(event) => {
                            event.stopPropagation();
                            onEndConnection?.(event, node, 'tools');
                        }}
                        title="Connect Tools"
                    />
                    <span className="absolute -bottom-4 whitespace-nowrap rounded bg-black/80 px-1 text-[8px] font-bold uppercase tracking-tighter text-zinc-500 opacity-0 transition-opacity group-hover/h-tool:opacity-100">
                        Tools
                    </span>
                </div>
            </div>
        </div>
    );
};
