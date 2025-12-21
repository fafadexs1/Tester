"use client";

import React from 'react';
import { NodeComponentProps } from '../NodeProps';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { PlusCircle, Trash2, BrainCircuit } from 'lucide-react';
import { cn } from "@/lib/utils";
import { v4 as uuidv4 } from 'uuid';
import { NODE_HEADER_CONNECTOR_Y_OFFSET } from '@/lib/constants';

interface Intent {
    id: string;
    label: string;
    description: string;
}

// Ensure this matches the type in types.ts (needs update)
export const IntentionRouterNode: React.FC<NodeComponentProps> = ({ node, onUpdate, onStartConnection }) => {

    const intents: Intent[] = (node as any).intents || [];

    const handleAddIntent = () => {
        const newIntent: Intent = { id: uuidv4(), label: '', description: '' };
        onUpdate(node.id, { intents: [...intents, newIntent] } as any);
    };

    const handleRemoveIntent = (intentId: string) => {
        onUpdate(node.id, { intents: intents.filter(i => i.id !== intentId) } as any);
    };

    const handleIntentChange = (intentId: string, field: keyof Intent, value: string) => {
        onUpdate(node.id, {
            intents: intents.map(i => i.id === intentId ? { ...i, [field]: value } : i)
        } as any);
    };

    const connectorDot = (handleId: string, title: string, colorClass: string) => (
        <div
            className="w-3 h-3 rounded-full shadow-lg ring-2 ring-zinc-900 transition-all duration-300 group-hover/connector:w-4 group-hover/connector:h-4 group-hover/connector:ring-primary/30 cursor-crosshair"
            onMouseDown={(e: React.MouseEvent) => { e.stopPropagation(); onStartConnection(e, node, handleId); }}
            data-connector="true"
            data-handle-type="source"
            data-handle-id={handleId}
            title={title}
        >
            <div className={cn("w-full h-full rounded-full transition-colors duration-300", colorClass)} />
        </div>
    );

    return (
        <div className="space-y-2" data-no-drag="true">
            <div className="flex items-center gap-2 mb-2 p-2 bg-indigo-500/10 border border-indigo-500/20 rounded-md">
                <BrainCircuit className="w-4 h-4 text-indigo-400" />
                <p className="text-[10px] text-indigo-300 leading-tight">
                    O roteador analisará a entrada do usuário e direcionará para o caminho mais adequado com base nas descrições.
                </p>
            </div>

            <div className="space-y-3">
                {intents.map((intent, index) => (
                    <div key={intent.id} className="relative rounded-md border border-white/5 bg-black/20 p-2 space-y-2 group">
                        <div className="flex items-center justify-between">
                            <Label className="text-[10px] font-semibold text-zinc-400">Intenção #{index + 1}</Label>
                            <Button
                                onClick={() => handleRemoveIntent(intent.id)}
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-zinc-500 hover:text-destructive hover:bg-destructive/10"
                            >
                                <Trash2 className="w-3 h-3" />
                            </Button>
                        </div>

                        <div>
                            <Input
                                placeholder="Nome da Intenção (ex: Financeiro)"
                                value={intent.label}
                                onChange={(e) => handleIntentChange(intent.id, 'label', e.target.value)}
                                className="h-7 text-xs bg-black/40 border-white/5 focus:border-indigo-500/50 mb-1.5"
                            />
                            <Textarea
                                placeholder="Descrição detalhada do que o usuário pode dizer para cair aqui..."
                                value={intent.description}
                                onChange={(e) => handleIntentChange(intent.id, 'description', e.target.value)}
                                rows={2}
                                className="text-[10px] resize-none bg-black/40 border-white/5 focus:border-indigo-500/50 min-h-[50px]"
                            />
                        </div>

                        {/* Output Handle for this Intent */}
                        <div
                            className="absolute -right-5 top-1/2 -translate-y-1/2 z-20 flex items-center justify-center group/connector"
                            title={`Caminho: ${intent.label}`}
                        >
                            {connectorDot(intent.id, intent.label || 'Sem nome', "bg-indigo-500 group-hover/connector:bg-indigo-400")}
                        </div>
                    </div>
                ))}
            </div>

            <Button onClick={handleAddIntent} variant="outline" size="sm" className="w-full h-7 text-xs border-dashed border-white/10 hover:bg-white/5 text-zinc-400 hover:text-zinc-200 mt-2">
                <PlusCircle className="w-3 h-3 mr-1.5" /> Adicionar Intenção
            </Button>

            <div className="pt-2 border-t border-white/5 relative mt-2">
                <div className="flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground italic">Caso nenhuma intenção seja reconhecida</span>
                </div>
                {/* Default Fallback Handle */}
                <div
                    className="absolute -right-3 top-1/2 -translate-y-1/2 z-20 flex items-center justify-center group/connector"
                    title="Caminho Padrão (Fallback)"
                >
                    {connectorDot('default', 'Fallback', "bg-zinc-500 group-hover/connector:bg-zinc-400")}
                </div>
            </div>
        </div>
    );
};
