"use client";

import React, { useRef, useMemo } from 'react';
import { NodeComponentProps } from '../NodeProps';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea'; // Keep for other fields if needed
import { MentionsTextarea, MentionOption } from '../components/MentionsTextarea';
import { Slider } from '@/components/ui/slider';
import { VariableInserter } from '../components/VariableInserter';
import { TextFormatToolbar } from '../components/TextFormatToolbar';
import { Bot, BrainCircuit, Database, Wrench } from 'lucide-react';
import { cn } from '@/lib/utils';

export const IntelligentAgentNode: React.FC<NodeComponentProps> = ({ node, onUpdate, onEndConnection, activeWorkspace }) => {
    const textAreaRef = useRef<HTMLTextAreaElement>(null);

    const availableTools = useMemo(() => {
        const tools: MentionOption[] = [];

        // Add tools from workspace nodes
        if (activeWorkspace?.nodes) {
            activeWorkspace.nodes
                .filter(n => ['http-tool', 'capability', 'knowledge'].includes(n.type))
                .forEach(n => {
                    let label = n.title;
                    let type: MentionOption['type'] = 'tool';

                    if (n.type === 'http-tool') {
                        label = n.httpToolName || n.title || 'HTTP Tool';
                        type = 'http';
                    } else if (n.type === 'capability') {
                        label = n.capabilityName || n.title || 'Capability';
                        type = 'capability';
                    } else if (n.type === 'knowledge') {
                        label = n.title || 'Knowledge Base';
                        type = 'knowledge';
                    }

                    tools.push({
                        id: n.id,
                        label,
                        value: n.id,
                        type
                    });
                });
        }

        // Always add the built-in finalizar_atendimento tool
        tools.push({
            id: 'finalizar_atendimento',
            label: 'finalizar_atendimento',
            value: 'finalizar_atendimento',
            type: 'tool'
        });

        return tools;
    }, [activeWorkspace?.nodes]);

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
                <div className="relative h-32"> {/* Fixed height container for popover positioning context */}
                    <MentionsTextarea
                        ref={textAreaRef}
                        id={`${node.id}-agentsystemprompt`}
                        placeholder="Você é um assistente virtual... Use @Ferramenta para..."
                        value={node.agentSystemPrompt || ''}
                        onUpdate={(val) => onUpdate(node.id, { agentSystemPrompt: val })}
                        options={availableTools}
                        rows={4}
                        className="text-xs pr-8 bg-black/20 border-white/5 focus:border-primary/50 resize-none h-full"
                    />
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

            {/* Resource Handles - Bottom */}
            <div className="absolute -bottom-3 left-0 right-0 flex justify-center gap-4 px-2">

                {/* AI Model Handle */}
                <div className="flex flex-col items-center gap-1 group/h-model relative">
                    <div
                        className="w-3 h-3 rounded-full bg-violet-500 border border-black shadow-[0_0_5px_rgba(139,92,246,0.5)] cursor-crosshair hover:scale-125 transition-transform"
                        data-connector="true"
                        data-handle-type="target"
                        data-handle-id="model"
                        data-node-id={node.id}
                        onMouseUp={(e) => { e.stopPropagation(); onEndConnection?.(e, node, 'model'); }}
                        title="Connect AI Model"
                    />
                    <span className="text-[8px] uppercase tracking-tighter text-zinc-500 font-bold absolute -bottom-4 whitespace-nowrap opacity-0 group-hover/h-model:opacity-100 transition-opacity bg-black/80 px-1 rounded">Model</span>
                </div>

                {/* Memory Handle */}
                <div className="flex flex-col items-center gap-1 group/h-mem relative">
                    <div
                        className="w-3 h-3 rounded-full bg-blue-500 border border-black shadow-[0_0_5px_rgba(59,130,246,0.5)] cursor-crosshair hover:scale-125 transition-transform"
                        data-connector="true"
                        data-handle-type="target"
                        data-handle-id="memory"
                        data-node-id={node.id}
                        onMouseUp={(e) => { e.stopPropagation(); onEndConnection?.(e, node, 'memory'); }}
                        title="Connect Memory"
                    />
                    <span className="text-[8px] uppercase tracking-tighter text-zinc-500 font-bold absolute -bottom-4 whitespace-nowrap opacity-0 group-hover/h-mem:opacity-100 transition-opacity bg-black/80 px-1 rounded">Memory</span>
                </div>

                {/* Tools Handle */}
                <div className="flex flex-col items-center gap-1 group/h-tool relative">
                    <div
                        className="w-3 h-3 rounded-full bg-amber-500 border border-black shadow-[0_0_5px_rgba(245,158,11,0.5)] cursor-crosshair hover:scale-125 transition-transform"
                        data-connector="true"
                        data-handle-type="target"
                        data-handle-id="tools"
                        data-node-id={node.id}
                        onMouseUp={(e) => { e.stopPropagation(); onEndConnection?.(e, node, 'tools'); }}
                        title="Connect Tools"
                    />
                    <span className="text-[8px] uppercase tracking-tighter text-zinc-500 font-bold absolute -bottom-4 whitespace-nowrap opacity-0 group-hover/h-tool:opacity-100 transition-opacity bg-black/80 px-1 rounded">Tools</span>
                </div>

            </div>
        </div>
    );
};
