"use client";

import React from 'react';
import { NodeComponentProps } from '../NodeProps';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { VariableInserter } from '../components/VariableInserter';
import { Loader2 } from 'lucide-react';

export const WhatsappGroupNode: React.FC<NodeComponentProps> = ({ node, onUpdate, evolutionInstances, isLoadingEvolutionInstances }) => {
    return (
        <div className="space-y-2" data-no-drag="true">
            <div>
                <Label htmlFor={`${node.id}-instance-mg`} className="text-[10px] font-medium text-zinc-400 mb-1 block">Instância</Label>
                {isLoadingEvolutionInstances ? (
                    <div className="flex items-center text-xs text-muted-foreground h-7"><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />Carregando...</div>
                ) : (
                    <Select onValueChange={(value) => onUpdate(node.id, { instanceName: value })} value={node.instanceName || ''}>
                        <SelectTrigger id={`${node.id}-instance-mg`} className="h-7 text-xs bg-black/20 border-white/5 focus:border-primary/50">
                            <SelectValue placeholder="Selecione uma instância..." />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="">Usar Padrão do Fluxo</SelectItem>
                            {evolutionInstances?.map(instance => (
                                <SelectItem key={instance.id} value={instance.name}>
                                    {instance.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                )}
            </div>
            <div>
                <Label htmlFor={`${node.id}-groupname`} className="text-[10px] font-medium text-zinc-400 mb-1 block">Nome do Grupo</Label>
                <div className="relative">
                    <Input id={`${node.id}-groupname`} value={node.groupName || ''} onChange={(e) => onUpdate(node.id, { groupName: e.target.value })} className="h-7 text-xs pr-7 bg-black/20 border-white/5 focus:border-primary/50" />
                    <VariableInserter fieldName="groupName" isIconTrigger onInsert={(v) => onUpdate(node.id, { groupName: (node.groupName || '') + v })} />
                </div>
            </div>
            <div>
                <Label htmlFor={`${node.id}-participants`} className="text-[10px] font-medium text-zinc-400 mb-1 block">Participantes (IDs)</Label>
                <div className="relative">
                    <Textarea id={`${node.id}-participants`} value={node.participants || ''} onChange={(e) => onUpdate(node.id, { participants: e.target.value })} rows={2} className="text-xs pr-8 bg-black/20 border-white/5 focus:border-primary/50 resize-none" />
                    <VariableInserter fieldName="participants" isIconTrigger isTextarea onInsert={(v) => onUpdate(node.id, { participants: (node.participants || '') + v })} />
                </div>
            </div>
        </div>
    );
};
