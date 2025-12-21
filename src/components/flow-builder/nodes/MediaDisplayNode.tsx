"use client";

import React, { useRef } from 'react';
import { NodeComponentProps } from '../NodeProps';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { VariableInserter } from '../components/VariableInserter';
import { TextFormatToolbar } from '../components/TextFormatToolbar';
import { NodeData } from '@/lib/types';

export const MediaDisplayNode: React.FC<NodeComponentProps> = ({ node, onUpdate }) => {
    const inputRef = useRef<HTMLInputElement>(null);

    return (
        <div className="space-y-2" data-no-drag="true">
            <div>
                <Label htmlFor={`${node.id}-mediadisplaytype`} className="text-[10px] font-medium text-zinc-400 mb-1 block">Tipo de Mídia</Label>
                <Select value={node.mediaDisplayType || 'image'} onValueChange={(value) => onUpdate(node.id, { mediaDisplayType: value as NodeData['mediaDisplayType'] })}>
                    <SelectTrigger id={`${node.id}-mediadisplaytype`} className="h-7 text-xs bg-black/20 border-white/5 focus:border-primary/50"><SelectValue placeholder="Selecione o tipo" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="image">Imagem</SelectItem><SelectItem value="video">Vídeo</SelectItem><SelectItem value="audio">Áudio</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            <div>
                <Label htmlFor={`${node.id}-mediadisplayurl`} className="text-[10px] font-medium text-zinc-400 mb-1 block">URL da Mídia</Label>
                <div className="relative">
                    <Input id={`${node.id}-mediadisplayurl`} placeholder="https://... ou {{url_da_imagem}}" value={node.mediaDisplayUrl || ''} onChange={(e) => onUpdate(node.id, { mediaDisplayUrl: e.target.value })} className="h-7 text-xs pr-7 bg-black/20 border-white/5 focus:border-primary/50" />
                    <VariableInserter fieldName="mediaDisplayUrl" isIconTrigger onInsert={(v) => onUpdate(node.id, { mediaDisplayUrl: (node.mediaDisplayUrl || '') + v })} />
                </div>
            </div>
            <div>
                <Label htmlFor={`${node.id}-mediadisplaytext`} className="text-[10px] font-medium text-zinc-400 mb-1 block">Texto Alternativo/Legenda</Label>
                <div className="relative">
                    <Input ref={inputRef} id={`${node.id}-mediadisplaytext`} placeholder="Descrição da mídia" value={node.mediaDisplayText || ''} onChange={(e) => onUpdate(node.id, { mediaDisplayText: e.target.value })} className="h-7 text-xs pr-7 bg-black/20 border-white/5 focus:border-primary/50" />
                    <VariableInserter fieldName="mediaDisplayText" isIconTrigger onInsert={(v) => onUpdate(node.id, { mediaDisplayText: (node.mediaDisplayText || '') + v })} />
                </div>
                <TextFormatToolbar fieldName="mediaDisplayText" textAreaRef={inputRef as React.RefObject<HTMLInputElement>} onUpdate={onUpdate} nodeId={node.id} />
            </div>
        </div>
    );
};
