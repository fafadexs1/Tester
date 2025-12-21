"use client";

import React, { useRef } from 'react';
import { NodeComponentProps } from '../NodeProps';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { VariableInserter } from '../components/VariableInserter';
import { TextFormatToolbar } from '../components/TextFormatToolbar';
import { Sparkles, Trash2, PlusCircle } from 'lucide-react';
import { cn } from "@/lib/utils";
import { NodeData } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';
import { NODE_HEADER_CONNECTOR_Y_OFFSET } from '@/lib/constants';

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

export const OptionNode: React.FC<NodeComponentProps> = ({ node, onUpdate, availableVariables, onStartConnection }) => {
    const textAreaRef = useRef<HTMLTextAreaElement>(null);

    const handleAddOption = () => {
        const newOption = { id: uuidv4(), value: '' };
        const updatedOptions = [...(node.options || []), newOption];
        onUpdate(node.id, { options: updatedOptions });
    };

    const handleRemoveOption = (optionId: string) => {
        const updatedOptions = (node.options || []).filter(o => o.id !== optionId);
        onUpdate(node.id, { options: updatedOptions });
    };

    const handleOptionChange = (optionId: string, value: string) => {
        const updatedOptions = (node.options || []).map(o =>
            o.id === optionId ? { ...o, value } : o
        );
        onUpdate(node.id, { options: updatedOptions });
    };

    const renderHandles = () => {
        // Option node has handles for each option
        return (
            <div className="absolute right-0 top-0 bottom-0 flex flex-col justify-center pointer-events-none">
                {/* This positioning logic is tricky matching the exact row height. 
             The original code calculated absolute positions. 
             Let's replicate absolute positioning logic relative to the card.
             We need to know the offset.
         */}
            </div>
        );
    };

    // Re-implementing the handle rendering logic from NodeCard (lines 2500~)
    // Note: Since we are inside the Node body, we might need to rely on the parent or calculate offsets.
    // BUT the handles are rendered OUTSIDE the content div in NodeCard. 
    // NodeCard had `renderOutputConnectors` which used `startY` + `index * spacing`.
    // Here we are inside the body. The visual alignment relies on the input fields being there.
    // The handles should be rendered absolutely, positioned to match the input fields.

    // Let's render the handles alongside the input fields in the loop!
    // This is much easier than calculating offsets.

    return (
        <div className="space-y-2" data-no-drag="true">
            <div>
                <Label htmlFor={`${node.id}-prompt`} className="text-[10px] font-medium text-zinc-400 mb-1 block">Mensagem da Pergunta</Label>
                <div className="relative">
                    <Textarea ref={textAreaRef} id={`${node.id}-prompt`} placeholder="Escolha uma opção:" value={node.questionText || ''} onChange={(e) => onUpdate(node.id, { questionText: e.target.value })} rows={2} className="text-xs pr-8 bg-black/20 border-white/5 focus:border-primary/50 resize-none" />
                    <VariableInserter fieldName="questionText" isIconTrigger isTextarea onInsert={(v) => onUpdate(node.id, { questionText: (node.questionText || '') + v })} />
                </div>
                <TextFormatToolbar fieldName="questionText" textAreaRef={textAreaRef as React.RefObject<HTMLTextAreaElement>} onUpdate={onUpdate} nodeId={node.id} />
            </div>

            <div className="space-y-1.5 pt-2 border-t border-white/5">
                <Label className="text-[10px] font-medium text-zinc-400">Opções de Resposta</Label>
                {(node.options || []).map((option, index) => (
                    <div key={option.id} className="flex items-center space-x-2 group relative">
                        <div className="relative flex-1">
                            <Input
                                placeholder={`Opção ${index + 1}`}
                                value={option.value}
                                onChange={(e) => handleOptionChange(option.id, e.target.value)}
                                className="h-7 text-xs bg-black/20 border-white/5 focus:border-primary/50"
                            />
                        </div>
                        <Button
                            onClick={() => handleRemoveOption(option.id)}
                            variant="ghost"
                            size="icon"
                            className="text-zinc-500 hover:text-destructive hover:bg-destructive/10 w-7 h-7 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                        </Button>

                        {/* Handle for this option. Positioned absolutely to the right of this row. */}
                        <div
                            className="absolute -right-5 z-20 flex items-center justify-center group/connector top-1/2 -translate-y-1/2"
                            title={`Opção: ${option.value}`}
                        >
                            <ConnectorDot
                                onMouseDown={(e) => { e.stopPropagation(); onStartConnection(e, node, option.id); }}
                                handleId={option.id}
                                colorClass="bg-indigo-500 group-hover/connector:bg-indigo-400"
                            />
                        </div>
                    </div>
                ))}
                <Button onClick={handleAddOption} variant="outline" size="sm" className="w-full h-7 text-xs border-dashed border-white/10 hover:bg-white/5 text-zinc-400 hover:text-zinc-200">
                    <PlusCircle className="w-3 h-3 mr-1.5" /> Adicionar Opção
                </Button>
            </div>

            <div className="pt-2 border-t border-white/5 space-y-2">
                <div className="flex items-center justify-between">
                    <Label htmlFor={`${node.id}-ai-enable`} className="text-[10px] font-medium text-zinc-200 flex items-center gap-2">
                        <Sparkles className="w-3 h-3 text-amber-500" />
                        Reconhecimento Inteligente (IA)
                    </Label>
                    <Switch
                        id={`${node.id}-ai-enable`}
                        checked={node.aiEnabled}
                        onCheckedChange={(checked) => onUpdate(node.id, { aiEnabled: checked })}
                        className="scale-75 origin-right bg-zinc-700 data-[state=checked]:bg-amber-600"
                    />
                </div>
                <p className="text-[10px] text-zinc-500 leading-tight">Se ativado, a IA tentará corresponder a resposta do usuário à opção mais provável.</p>
                {node.aiEnabled && (
                    <div className="space-y-1">
                        <Label htmlFor={`${node.id}-aiModelName`} className="text-[10px] text-zinc-400">Modelo de IA (opcional)</Label>
                        <div className="relative">
                            <Sparkles className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-primary pointer-events-none" />
                            <Input
                                id={`${node.id}-aiModelName`}
                                placeholder="googleai/gemini-2.0-flash"
                                value={node.aiModelName || ""}
                                onChange={(e) => onUpdate(node.id, { aiModelName: e.target.value })}
                                className="pl-8 h-7 text-xs bg-black/20 border-white/5 focus:border-primary/50"
                            />
                        </div>
                    </div>
                )}
            </div>

            <div>
                <Label htmlFor={`${node.id}-varsave`}>Salvar Resposta na Variável</Label>
                <Input id={`${node.id}-varsave`} placeholder="nome_da_variavel" value={node.variableToSaveChoice || ''} onChange={(e) => onUpdate(node.id, { variableToSaveChoice: e.target.value })} className="h-7 text-xs bg-black/20 border-white/5 focus:border-primary/50" />
            </div>

            <p className="text-xs text-muted-foreground italic pt-1">Cada opção na lista acima terá um conector de saída dedicado.</p>
        </div>
    );
};
