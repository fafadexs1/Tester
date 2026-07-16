"use client";

import React from 'react';
import { NodeComponentProps } from '../NodeProps';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { DebouncedInput } from '../components/DebouncedInput';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Webhook, MousePointerClick, Copy, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from "@/lib/utils";
import { StartNodeTrigger } from '@/lib/types';
import { START_NODE_TRIGGER_INITIAL_Y_OFFSET, START_NODE_TRIGGER_SPACING_Y } from '@/lib/constants';
import { WebhookMappingBuilder } from '../components/WebhookMappingBuilder';
import { FlowHandle, RefreshNodeInternals } from './FlowHandle';

const StartHandle = ({ handleId, color = "primary" }: { handleId: string, color?: string }) => (
    <FlowHandle id={handleId} className="!border-2 !border-solid !bg-black" colorClass="bg-transparent" style={{ borderColor: `hsl(var(--${color === 'primary' ? 'neon-purple' : color}))` }} />
);

export const StartNode: React.FC<NodeComponentProps> = ({ node, onUpdate, activeWorkspace, renderHandles = true }) => {
    const { toast } = useToast();
    const webhookUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/api/evolution/trigger/${activeWorkspace?.id || '[ID]'}`;

    const handleTriggerChange = (triggerId: string, field: keyof StartNodeTrigger, value: any) => {
        const updatedTriggers = (node.triggers || []).map(t =>
            t.id === triggerId ? { ...t, [field]: value } : t
        );
        onUpdate(node.id, { triggers: updatedTriggers });
    };

    const renderStartHandles = () => {
        let yOffset = START_NODE_TRIGGER_INITIAL_Y_OFFSET;
        return (node.triggers || [])
            .filter(t => t.enabled)
            .flatMap((trigger) => {
                const triggerY = yOffset;
                const keywords = (trigger.keyword || '').split(',').map(k => k.trim()).filter(Boolean);
                const triggerBlockHeight = 40 + (keywords.length * START_NODE_TRIGGER_SPACING_Y);
                yOffset += triggerBlockHeight + 10;

                const triggerOutput = (
                    <div key={trigger.id} className="absolute -right-1.5 z-30" style={{ top: `${triggerY}px`, transform: 'translateY(-50%)' }}>
                        <StartHandle handleId={trigger.name} color="neon-green" />
                    </div>
                );

                const keywordOutputs = keywords.map((kw, kwIndex) => (
                    <div key={`${trigger.id}-${kw}`} className="absolute -right-1.5 z-30" style={{ top: `${triggerY + 25 + (kwIndex * START_NODE_TRIGGER_SPACING_Y)}px`, transform: 'translateY(-50%)' }}>
                        <StartHandle handleId={kw} color="neon-purple" />
                    </div>
                ));

                return [triggerOutput, ...keywordOutputs];
            });
    }

    return (
        <div className="nodrag nowheel space-y-3" data-no-drag="true">
            <div className="flex items-center gap-1.5 px-1 opacity-60">
                <Info className="w-3 h-3" />
                <span className="text-[9px] uppercase tracking-widest font-bold">Execution Entry Points</span>
            </div>

            {(node.triggers || []).map(trigger => (
                <div key={trigger.id} className={cn(
                    "p-3 rounded-2xl border transition-all duration-300",
                    trigger.enabled ? "bg-white/[0.03] border-white/10" : "bg-black/20 border-white/5 opacity-50"
                )}>
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <Switch
                                checked={trigger.enabled}
                                onCheckedChange={(checked) => handleTriggerChange(trigger.id, 'enabled', checked)}
                                className="scale-75 origin-left data-[state=checked]:bg-primary"
                            />
                            <span className="text-[10px] font-bold text-white/90">{trigger.name}</span>
                        </div>
                        {trigger.type === 'webhook' ? <Webhook className="w-3 h-3 text-primary" /> : <MousePointerClick className="w-3 h-3 text-zinc-600" />}
                    </div>

                    <div className="space-y-3">
                        <div>
                            <Label className="text-[8px] uppercase tracking-[0.2em] text-zinc-500 font-bold mb-1 block">Keywords</Label>
                            <DebouncedInput
                                value={trigger.keyword || ''}
                                onChange={(val) => handleTriggerChange(trigger.id, 'keyword', String(val))}
                                placeholder="hi, help..."
                                className="h-7 text-[10px] bg-black/40 border-white/5 focus:border-primary/50 rounded-xl"
                            />
                        </div>

                        {trigger.type === 'webhook' && (
                            <div className="pt-2 mt-2 border-t border-white/5 space-y-3">
                                <div className="flex items-center justify-between">
                                    <Label className="text-[8px] uppercase tracking-widest text-zinc-500 font-bold">Endpoint</Label>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button variant="ghost" className="h-5 p-0 text-[9px] hover:text-primary transition-colors">Show URL</Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="neo-glass w-80 border-white/10 p-4">
                                            <Label className="text-[10px] font-bold mb-2 block">Webhook URL</Label>
                                            <div className="flex gap-2">
                                                <Input readOnly value={webhookUrl} className="h-8 text-[10px] font-mono bg-black/40 border-white/5" />
                                                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { navigator.clipboard.writeText(webhookUrl); toast({ title: "Copied!" }); }}>
                                                    <Copy className="w-3.5 h-3.5" />
                                                </Button>
                                            </div>
                                        </PopoverContent>
                                    </Popover>
                                </div>
                                <WebhookMappingBuilder
                                    trigger={trigger}
                                    activeWorkspace={activeWorkspace}
                                    onUpdateTrigger={(tId: string, updates: any) => handleTriggerChange(tId, 'variableMappings', updates.variableMappings)}
                                />
                            </div>
                        )}
                    </div>
                </div>
            ))}
            {renderHandles && renderStartHandles()}
            {renderHandles && <RefreshNodeInternals nodeId={node.id} signature={node.triggers} />}
        </div>
    );
};
