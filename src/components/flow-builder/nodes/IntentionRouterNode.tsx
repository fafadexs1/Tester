"use client";

import React from 'react';
import { v4 as uuidv4 } from 'uuid';
import { BrainCircuit, PlusCircle, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { NodeComponentProps } from '../NodeProps';
import { GeminiKeySelector } from '../components/GeminiKeySelector';
import { FlowHandle, RefreshNodeInternals } from './FlowHandle';

interface Intent {
    id: string;
    label: string;
    description: string;
}

export const IntentionRouterNode: React.FC<NodeComponentProps> = ({
    node,
    onUpdate,
    organizationGeminiKeys,
    renderHandles = true,
}) => {
    const intents: Intent[] = (node as any).intents || [];

    const handleAddIntent = () => {
        const newIntent: Intent = { id: uuidv4(), label: '', description: '' };
        onUpdate(node.id, { intents: [...intents, newIntent] } as any);
    };

    const handleRemoveIntent = (intentId: string) => {
        onUpdate(node.id, { intents: intents.filter((item) => item.id !== intentId) } as any);
    };

    const handleIntentChange = (intentId: string, field: keyof Intent, value: string) => {
        onUpdate(node.id, {
            intents: intents.map((item) => item.id === intentId ? { ...item, [field]: value } : item),
        } as any);
    };

    const connectorDot = (handleId: string, title: string, colorClass: string) => <FlowHandle id={handleId} title={title} colorClass={colorClass} />;

    return (
        <div className="nodrag nowheel space-y-3" data-no-drag="true">
            <div className="rounded-md border border-indigo-500/20 bg-indigo-500/10 p-2">
                <div className="mb-2 flex items-center gap-2">
                    <BrainCircuit className="h-4 w-4 text-indigo-400" />
                    <span className="text-[10px] font-medium text-indigo-200">Roteamento por intencao</span>
                </div>
                <p className="text-[10px] leading-tight text-indigo-300">
                    O roteador analisa a resposta do usuario e escolhe a saida mais compativel com o texto e a descricao de cada intencao.
                </p>
            </div>

            <GeminiKeySelector
                triggerId={`${node.id}-gemini-key`}
                value={node.aiKeyId}
                onChange={(value) => onUpdate(node.id, { aiKeyId: value })}
                keys={organizationGeminiKeys}
            />

            <div className="space-y-3">
                {intents.map((intent, index) => (
                    <div key={intent.id} className="group relative space-y-2 rounded-md border border-white/5 bg-black/20 p-2">
                        <div className="flex items-center justify-between">
                            <Label className="text-[10px] font-semibold text-zinc-400">Intencao #{index + 1}</Label>
                            <Button
                                onClick={() => handleRemoveIntent(intent.id)}
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-zinc-500 hover:bg-destructive/10 hover:text-destructive"
                            >
                                <Trash2 className="h-3 w-3" />
                            </Button>
                        </div>

                        <div>
                            <Input
                                placeholder="Nome da intencao (ex.: Financeiro)"
                                value={intent.label}
                                onChange={(event) => handleIntentChange(intent.id, 'label', event.target.value)}
                                className="mb-1.5 h-7 bg-black/40 text-xs border-white/5 focus:border-indigo-500/50"
                            />
                            <Textarea
                                placeholder="Descreva o tipo de mensagem que deve cair neste caminho."
                                value={intent.description}
                                onChange={(event) => handleIntentChange(intent.id, 'description', event.target.value)}
                                rows={2}
                                className="min-h-[50px] resize-none bg-black/40 text-[10px] border-white/5 focus:border-indigo-500/50"
                            />
                        </div>

                        {renderHandles && <div
                            className="group/connector absolute -right-1.5 top-1/2 z-20 flex -translate-y-1/2 items-center justify-center"
                            title={`Caminho: ${intent.label}`}
                        >
                            {connectorDot(intent.id, intent.label || 'Sem nome', 'bg-indigo-500 group-hover/connector:bg-indigo-400')}
                        </div>}
                    </div>
                ))}
            </div>

            <Button
                onClick={handleAddIntent}
                variant="outline"
                size="sm"
                className="mt-2 h-7 w-full border-dashed border-white/10 text-xs text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
            >
                <PlusCircle className="mr-1.5 h-3 w-3" />
                Adicionar intencao
            </Button>

            <div className="relative mt-2 border-t border-white/5 pt-2">
                <div className="flex items-center justify-between">
                    <span className="text-[10px] italic text-muted-foreground">Caso nenhuma intencao seja reconhecida</span>
                </div>
                {renderHandles && <div
                    className="group/connector absolute -right-1.5 top-1/2 z-20 flex -translate-y-1/2 items-center justify-center"
                    title="Caminho padrao"
                >
                    {connectorDot('default', 'Fallback', 'bg-zinc-500 group-hover/connector:bg-zinc-400')}
                </div>}
            </div>
            {renderHandles && <RefreshNodeInternals nodeId={node.id} signature={intents} />}
        </div>
    );
};
