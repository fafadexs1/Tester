"use client";

import React, { useRef } from 'react';
import { NodeComponentProps } from '../NodeProps';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { VariableInserter } from '../components/VariableInserter';
import { TextFormatToolbar } from '../components/TextFormatToolbar';
import { ApiResponseSettings } from '../components/ApiResponseSettings';
import { NodeData } from '@/lib/types';

export const RatingInputNode: React.FC<NodeComponentProps> = ({ node, onUpdate }) => {
    const inputRef = useRef<HTMLInputElement>(null);

    return (
        <div className="space-y-2" data-no-drag="true">
            <div>
                <Label htmlFor={`${node.id}-ratingq`} className="text-[10px] font-medium text-zinc-400 mb-1 block">Pergunta da Avaliação</Label>
                <div className="relative">
                    <Input ref={inputRef} id={`${node.id}-ratingq`} placeholder="Como você nos avalia?" value={node.ratingQuestionText || ''} onChange={(e) => onUpdate(node.id, { ratingQuestionText: e.target.value })} className="h-7 text-xs pr-7 bg-black/20 border-white/5 focus:border-primary/50" />
                    <VariableInserter fieldName="ratingQuestionText" isIconTrigger onInsert={(v) => onUpdate(node.id, { ratingQuestionText: (node.ratingQuestionText || '') + v })} />
                </div>
                <TextFormatToolbar fieldName="ratingQuestionText" textAreaRef={inputRef as React.RefObject<HTMLInputElement>} onUpdate={onUpdate} nodeId={node.id} />
            </div>
            <div>
                <Label htmlFor={`${node.id}-maxrating`} className="text-[10px] font-medium text-zinc-400 mb-1 block">Avaliação Máxima</Label>
                <Input id={`${node.id}-maxrating`} type="number" placeholder="5" value={node.maxRatingValue ?? ''} onChange={(e) => onUpdate(node.id, { maxRatingValue: parseInt(e.target.value, 10) || 5 })} className="h-7 text-xs bg-black/20 border-white/5 focus:border-primary/50" />
            </div>
            <div>
                <Label htmlFor={`${node.id}-ratingicon`} className="text-[10px] font-medium text-zinc-400 mb-1 block">Ícone de Avaliação</Label>
                <Select value={node.ratingIconType || 'star'} onValueChange={(value) => onUpdate(node.id, { ratingIconType: value as NodeData['ratingIconType'] })}>
                    <SelectTrigger id={`${node.id}-ratingicon`} className="h-7 text-xs bg-black/20 border-white/5 focus:border-primary/50"><SelectValue placeholder="Selecione o ícone" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="star">Estrela</SelectItem><SelectItem value="heart">Coração</SelectItem><SelectItem value="number">Número</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            <div>
                <Label htmlFor={`${node.id}-ratingoutputvar`} className="text-[10px] font-medium text-zinc-400 mb-1 block">Salvar Avaliação na Variável</Label>
                <Input id={`${node.id}-ratingoutputvar`} placeholder="avaliacao_usuario" value={node.ratingOutputVariable || ''} onChange={(e) => onUpdate(node.id, { ratingOutputVariable: e.target.value })} className="h-7 text-xs bg-black/20 border-white/5 focus:border-primary/50" />
            </div>
            <ApiResponseSettings node={node} onUpdate={onUpdate} />
        </div>
    );
};
