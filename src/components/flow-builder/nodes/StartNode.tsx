"use client";

import React, { useState } from 'react';
import { NodeComponentProps } from '../NodeProps';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Webhook, MousePointerClick, Copy, History } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from "@/lib/utils";
import { StartNodeTrigger, WebhookVariableMapping } from '@/lib/types'; // Ensure correct types are imported
import { START_NODE_TRIGGER_INITIAL_Y_OFFSET, START_NODE_TRIGGER_SPACING_Y } from '@/lib/constants';
import { v4 as uuidv4 } from 'uuid';
import { WebhookMappingBuilder } from '../components/WebhookMappingBuilder';

// Assuming ConnectorDot is reused or redefined. 
// For now, I will redefine it locally or import it if I extract it later.
// To avoid duplication, I will redefine a simple version or expect it passed.
// But refactoring guidelines say "extract" so I will assume I need to implement the connector rendering here.

const ConnectorDot = ({
    onMouseDown,
    handleId,
    title,
    colorClass = "bg-zinc-400 group-hover/connector:bg-primary"
}: {
    onMouseDown: (e: React.MouseEvent) => void,
    handleId: string,
    title?: string,
    colorClass?: string
}) => (
    <div
        className="w-3 h-3 rounded-full shadow-lg ring-2 ring-zinc-900 transition-all duration-300 group-hover/connector:w-4 group-hover/connector:h-4 group-hover/connector:ring-primary/30 cursor-crosshair"
        onMouseDown={onMouseDown}
        data-connector="true"
        data-handle-type="source"
        data-handle-id={handleId}
        title={title}
    >
        <div className={cn("w-full h-full rounded-full transition-colors duration-300", colorClass)} />
    </div>
);

export const StartNode: React.FC<NodeComponentProps> = ({ node, onUpdate, onStartConnection, activeWorkspace }) => {
    const { toast } = useToast();
    // We need state for webhook mapping dialogs if they were inside the node content.
    // In the original NodeCard, `renderWebhookMappingBuilder` uses local state `activeWebhookTriggerId` etc.
    // I might need to simplify or bring that state here.
    // For this first pass, I'll copy the render logic.

    const webhookUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/api/evolution/trigger/${activeWorkspace?.id || '[ID_DO_FLUXO]'}`;

    const handleTriggerChange = (triggerId: string, field: keyof StartNodeTrigger, value: any) => {
        const updatedTriggers = (node.triggers || []).map(t =>
            t.id === triggerId ? { ...t, [field]: value } : t
        );
        onUpdate(node.id, { triggers: updatedTriggers });
    };

    const handleKeywordsChange = (triggerId: string, value: string) => {
        const keywords = value.split(',').map(kw => kw.trim()).filter(Boolean);
        const uniqueKeywords = Array.from(new Set(keywords));
        handleTriggerChange(triggerId, 'keyword', uniqueKeywords.join(', '));
    };

    // Rendering Handles
    const renderHandles = () => {
        let yOffset = START_NODE_TRIGGER_INITIAL_Y_OFFSET;
        return (node.triggers || [])
            .filter(t => t.enabled)
            .flatMap((trigger) => {
                const triggerY = yOffset;
                const keywords = (trigger.keyword || '').split(',').map(k => k.trim()).filter(Boolean);
                const triggerBlockHeight = 40 + (keywords.length * START_NODE_TRIGGER_SPACING_Y);
                yOffset += triggerBlockHeight + 10;

                const triggerOutput = (
                    <div
                        key={trigger.id}
                        className="absolute -right-3 z-20 flex items-center group/connector"
                        style={{ top: `${triggerY}px`, transform: 'translateY(-50%)' }}
                        title={`Gatilho: ${trigger.name}`}
                    >
                        <span className="text-xs text-muted-foreground mr-3 opacity-0 group-hover/connector:opacity-100 transition-opacity duration-300 whitespace-nowrap">{trigger.name}</span>
                        <ConnectorDot
                            onMouseDown={(e) => { e.stopPropagation(); onStartConnection(e, node, trigger.name); }}
                            handleId={trigger.name}
                            colorClass="bg-emerald-500 group-hover/connector:bg-emerald-400"
                        />
                    </div>
                );

                const keywordOutputs = keywords.map((kw, kwIndex) => (
                    <div
                        key={`${trigger.id}-${kw}`}
                        className="absolute -right-3 z-20 flex items-center group/connector"
                        style={{ top: `${triggerY + 25 + (kwIndex * START_NODE_TRIGGER_SPACING_Y)}px`, transform: 'translateY(-50%)' }}
                        title={`Palavra-chave: ${kw}`}
                    >
                        <span className="text-xs text-muted-foreground mr-3 opacity-0 group-hover/connector:opacity-100 transition-opacity duration-300 whitespace-nowrap">{kw}</span>
                        <ConnectorDot
                            onMouseDown={(e) => { e.stopPropagation(); onStartConnection(e, node, kw); }}
                            handleId={kw}
                            colorClass="bg-purple-500 group-hover/connector:bg-purple-400"
                        />
                    </div>
                ));

                return [triggerOutput, ...keywordOutputs];
            });
    }

    return (
        <>
            <div className="space-y-2" data-no-drag="true">
                <p className="text-[10px] text-zinc-400 leading-tight">Gatilhos de início (ordem de prioridade).</p>
                {(node.triggers || []).map(trigger => (
                    <div key={trigger.id} className="p-2 border border-white/5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center space-x-2">
                                <Switch
                                    id={`trigger-enabled-${trigger.id}`}
                                    checked={trigger.enabled}
                                    onCheckedChange={(checked) => handleTriggerChange(trigger.id, 'enabled', checked)}
                                    className="scale-75 origin-left"
                                />
                                <Label htmlFor={`trigger-enabled-${trigger.id}`} className="text-xs font-medium text-zinc-200">{trigger.name}</Label>
                                {trigger.type === 'webhook' && <Webhook className="w-3 h-3 text-zinc-500" />}
                                {trigger.type === 'manual' && <MousePointerClick className="w-3 h-3 text-zinc-500" />}
                            </div>
                        </div>

                        <div className={cn("space-y-2", !trigger.enabled && "opacity-50 pointer-events-none")}>
                            <div>
                                <Label htmlFor={`trigger-keyword-${trigger.id}`} className="text-[10px] font-medium text-zinc-400">Palavras-chave</Label>
                                <Input
                                    id={`trigger-keyword-${trigger.id}`}
                                    value={trigger.keyword || ''}
                                    onChange={(e) => handleKeywordsChange(trigger.id, e.target.value)}
                                    placeholder="Ex: ajuda, cardapio"
                                    className="h-7 text-xs mt-0.5 bg-black/20 border-white/5 focus:border-primary/50"
                                />
                            </div>

                            {trigger.type === 'webhook' && (
                                <div className="space-y-2 pt-2 border-t border-white/5">
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex-1">
                                            <Label className="text-[10px] text-zinc-400">Timeout (s)</Label>
                                            <Input
                                                type="number"
                                                value={trigger.sessionTimeoutSeconds || 0}
                                                onChange={(e) => handleTriggerChange(trigger.id, 'sessionTimeoutSeconds', parseInt(e.target.value, 10) || 0)}
                                                className="h-6 text-xs bg-black/20 border-white/5 focus:border-primary/50"
                                            />
                                        </div>
                                        <div className="flex items-end gap-1">
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <Button variant="outline" size="sm" className="h-6 text-[10px] px-2 border-white/10 hover:bg-white/5">
                                                        <Webhook className="w-3 h-3 mr-1.5" />
                                                        URL
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-80 p-2" align="end" data-no-drag="true">
                                                    <div className="space-y-2">
                                                        <Label className="text-[10px] font-semibold">URL para Disparo Externo</Label>
                                                        <div className="flex items-center space-x-1">
                                                            <Input readOnly value={webhookUrl} className="h-7 text-[10px] font-mono bg-black/20" />
                                                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { navigator.clipboard.writeText(webhookUrl); toast({ title: "Copiado!" }); }}>
                                                                <Copy className="w-3.5 h-3.5" />
                                                            </Button>
                                                        </div>
                                                        <p className="text-[10px] text-muted-foreground">Envie um POST para esta URL com um JSON no corpo.</p>
                                                    </div>
                                                </PopoverContent>
                                            </Popover>
                                        </div>
                                    </div>
                                    <div className="pt-2 border-t border-white/5">
                                        <Label className="text-[10px] font-medium text-zinc-400 mb-1 block">Mapeamento de Variáveis (Webhook)</Label>
                                        <WebhookMappingBuilder
                                            trigger={trigger}
                                            activeWorkspace={activeWorkspace}
                                            onUpdateTrigger={(tId: string, updates: Partial<StartNodeTrigger>) => handleTriggerChange(tId, 'variableMappings', updates.variableMappings)}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
            {renderHandles()}
        </>
    );
};
