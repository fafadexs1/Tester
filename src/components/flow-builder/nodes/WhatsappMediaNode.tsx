"use client";

import React, { useRef } from 'react';
import { NodeComponentProps } from '../NodeProps';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { VariableInserter } from '../components/VariableInserter';
import { TextFormatToolbar } from '../components/TextFormatToolbar';
import { Loader2 } from 'lucide-react';
import { NodeData } from '@/lib/types';

export const WhatsappMediaNode: React.FC<NodeComponentProps> = ({ node, onUpdate, evolutionInstances, isLoadingEvolutionInstances }) => {
    const inputRef = useRef<HTMLInputElement>(null);

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
                <Label htmlFor={`${node.id}-phone-mg`} className="text-[10px] font-medium text-zinc-400 mb-1 block">Telefone (Ex: 55119... ou {"{{whatsapp_sender_jid}}"})</Label>
                <div className="relative">
                    <Input id={`${node.id}-phone-mg`} placeholder="55119... ou {{whatsapp_sender_jid}}" value={node.phoneNumber || ''} onChange={(e) => onUpdate(node.id, { phoneNumber: e.target.value })} className="h-7 text-xs pr-7 bg-black/20 border-white/5 focus:border-primary/50" />
                    <VariableInserter fieldName="phoneNumber" isIconTrigger onInsert={(v) => onUpdate(node.id, { phoneNumber: (node.phoneNumber || '') + v })} />
                </div>
            </div>
            <div>
                <Label htmlFor={`${node.id}-mediaurl`} className="text-[10px] font-medium text-zinc-400 mb-1 block">URL da Mídia</Label>
                <div className="relative">
                    <Input id={`${node.id}-mediaurl`} placeholder="https://... ou {{url_midia}}" value={node.mediaUrl || ''} onChange={(e) => onUpdate(node.id, { mediaUrl: e.target.value })} className="h-7 text-xs pr-7 bg-black/20 border-white/5 focus:border-primary/50" />
                    <VariableInserter fieldName="mediaUrl" isIconTrigger onInsert={(v) => onUpdate(node.id, { mediaUrl: (node.mediaUrl || '') + v })} />
                </div>
            </div>
            <div>
                <Label htmlFor={`${node.id}-mediatype`} className="text-[10px] font-medium text-zinc-400 mb-1 block">Tipo</Label>
                <Select value={node.mediaType || 'image'} onValueChange={(value) => onUpdate(node.id, { mediaType: value as NodeData['mediaType'] })}>
                    <SelectTrigger id={`${node.id}-mediatype`} className="h-7 text-xs bg-black/20 border-white/5 focus:border-primary/50"><SelectValue placeholder="Selecione o tipo" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="image">Imagem</SelectItem><SelectItem value="video">Vídeo</SelectItem>
                        <SelectItem value="document">Documento</SelectItem><SelectItem value="audio">Áudio</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            <div>
                <Label htmlFor={`${node.id}-caption`} className="text-[10px] font-medium text-zinc-400 mb-1 block">Legenda/Nome</Label>
                <div className="relative">
                    <Input ref={inputRef} id={`${node.id}-caption`} value={node.caption || ''} onChange={(e) => onUpdate(node.id, { caption: e.target.value })} className="h-7 text-xs pr-7 bg-black/20 border-white/5 focus:border-primary/50" />
                    <VariableInserter fieldName="caption" isIconTrigger onInsert={(v) => onUpdate(node.id, { caption: (node.caption || '') + v })} />
                </div>
                <TextFormatToolbar fieldName="caption" textAreaRef={inputRef as React.RefObject<HTMLInputElement>} onUpdate={onUpdate} nodeId={node.id} />
            </div>
        </div>
    );
};
