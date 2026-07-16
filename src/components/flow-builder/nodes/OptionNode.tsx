"use client";

import React, { useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { FileText, PlusCircle, Sparkles, Trash2 } from 'lucide-react';

import { NodeComponentProps } from '../NodeProps';
import { VariableInserter } from '../components/VariableInserter';
import { TextFormatToolbar } from '../components/TextFormatToolbar';
import { GeminiKeySelector } from '../components/GeminiKeySelector';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { OptionNodeOption } from '@/lib/types';
import { cn } from "@/lib/utils";
import { FlowHandle, RefreshNodeInternals } from './FlowHandle';

export const OptionNode: React.FC<NodeComponentProps> = ({ node, onUpdate, organizationGeminiKeys, renderHandles = true }) => {
    const textAreaRef = useRef<HTMLTextAreaElement>(null);
    const [expandedLabels, setExpandedLabels] = useState<Record<string, boolean>>({});

    const handleAddOption = () => {
        const newOption: OptionNodeOption = { id: uuidv4(), value: '', label: '' };
        onUpdate(node.id, { options: [...(node.options || []), newOption] });
    };

    const handleRemoveOption = (optionId: string) => {
        onUpdate(node.id, { options: (node.options || []).filter(option => option.id !== optionId) });
        setExpandedLabels(prev => {
            const next = { ...prev };
            delete next[optionId];
            return next;
        });
    };

    const handleOptionChange = (optionId: string, changes: Partial<OptionNodeOption>) => {
        const updatedOptions = (node.options || []).map(option =>
            option.id === optionId ? { ...option, ...changes } : option
        );
        onUpdate(node.id, { options: updatedOptions });
    };

    const toggleOptionLabel = (optionId: string) => {
        setExpandedLabels(prev => ({ ...prev, [optionId]: !prev[optionId] }));
    };

    const isLabelExpanded = (option: OptionNodeOption) => {
        if (Object.prototype.hasOwnProperty.call(expandedLabels, option.id)) {
            return expandedLabels[option.id];
        }
        return !!option.label?.trim();
    };

    const getOptionPreview = (option: OptionNodeOption) => {
        const value = option.value?.trim() || 'Opção';
        const label = option.label?.trim();
        return label ? `${value} - ${label}` : value;
    };

    return (
        <div className="nodrag nowheel space-y-2" data-no-drag="true">
            <div>
                <Label htmlFor={`${node.id}-prompt`} className="text-[10px] font-medium text-zinc-400 mb-1 block">
                    Mensagem da Pergunta
                </Label>
                <div className="relative">
                    <Textarea
                        ref={textAreaRef}
                        id={`${node.id}-prompt`}
                        placeholder="Escolha uma opção:"
                        value={node.questionText || ''}
                        onChange={(e) => onUpdate(node.id, { questionText: e.target.value })}
                        rows={2}
                        className="text-xs pr-8 bg-black/20 border-white/5 focus:border-primary/50 resize-none"
                    />
                    <VariableInserter
                        fieldName="questionText"
                        isIconTrigger
                        isTextarea
                        onInsert={(value) => onUpdate(node.id, { questionText: (node.questionText || '') + value })}
                    />
                </div>
                <TextFormatToolbar
                    fieldName="questionText"
                    textAreaRef={textAreaRef as React.RefObject<HTMLTextAreaElement>}
                    onUpdate={onUpdate}
                    nodeId={node.id}
                />
            </div>

            <div>
                <Label htmlFor={`${node.id}-footer`} className="text-[10px] font-medium text-zinc-400 mb-1 block">
                    Footer da Lista (Dialogy, opcional)
                </Label>
                <div className="relative">
                    <Input
                        id={`${node.id}-footer`}
                        placeholder="Ex: Escolha uma opção para continuar"
                        value={node.optionFooterText || ''}
                        onChange={(e) => onUpdate(node.id, { optionFooterText: e.target.value })}
                        className="h-7 text-xs pr-8 bg-black/20 border-white/5 focus:border-primary/50"
                    />
                    <VariableInserter
                        fieldName="optionFooterText"
                        isIconTrigger
                        onInsert={(value) => onUpdate(node.id, { optionFooterText: (node.optionFooterText || '') + value })}
                    />
                </div>
            </div>

            <div className="space-y-1.5 pt-2 border-t border-white/5">
                <Label className="text-[10px] font-medium text-zinc-400">Opções de Resposta</Label>
                {(node.options || []).map((option, index) => (
                    <div key={option.id} className="group relative space-y-2">
                        <div className="relative flex items-center space-x-2">
                            <div className="relative flex-1">
                                <Input
                                    placeholder={`Opção ${index + 1}`}
                                    value={option.value}
                                    onChange={(e) => handleOptionChange(option.id, { value: e.target.value })}
                                    className="h-7 text-xs bg-black/20 border-white/5 focus:border-primary/50"
                                />
                            </div>
                            <Button
                                onClick={() => toggleOptionLabel(option.id)}
                                variant="ghost"
                                size="icon"
                                title={option.label?.trim() ? "Editar texto complementar" : "Adicionar texto complementar"}
                                className={cn(
                                    "w-7 h-7 text-zinc-500 hover:text-primary hover:bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity",
                                    option.label?.trim() && "opacity-100 text-primary"
                                )}
                            >
                                <FileText className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                                onClick={() => handleRemoveOption(option.id)}
                                variant="ghost"
                                size="icon"
                                className="w-7 h-7 text-zinc-500 hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                            {renderHandles && <div
                                className="absolute -right-[26px] top-1/2 z-20 flex -translate-y-1/2 items-center justify-center group/connector"
                                title={`Opção: ${getOptionPreview(option)}`}
                            >
                                <FlowHandle
                                    id={option.id}
                                    colorClass="bg-indigo-500 group-hover/connector:bg-indigo-400"
                                />
                            </div>}
                        </div>

                        {isLabelExpanded(option) && (
                            <Input
                                placeholder="Texto complementar (opcional)"
                                value={option.label || ''}
                                onChange={(e) => handleOptionChange(option.id, { label: e.target.value })}
                                className="h-7 text-xs bg-black/10 border-white/5 focus:border-primary/50"
                            />
                        )}

                    </div>
                ))}
                <Button
                    onClick={handleAddOption}
                    variant="outline"
                    size="sm"
                    className="w-full h-7 text-xs border-dashed border-white/10 hover:bg-white/5 text-zinc-400 hover:text-zinc-200"
                >
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
                <p className="text-[10px] text-zinc-500 leading-tight">
                    Se ativado, a IA tentará corresponder a resposta do usuário à opção mais provável.
                </p>
                {node.aiEnabled && (
                    <div className="space-y-1">
                        <Label htmlFor={`${node.id}-aiModelName`} className="text-[10px] text-zinc-400">
                            Modelo de IA (opcional)
                        </Label>
                        <div className="relative">
                            <Sparkles className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-primary pointer-events-none" />
                            <Input
                                id={`${node.id}-aiModelName`}
                                placeholder="googleai/gemini-2.5-flash"
                                value={node.aiModelName || ""}
                                onChange={(e) => onUpdate(node.id, { aiModelName: e.target.value })}
                                className="pl-8 h-7 text-xs bg-black/20 border-white/5 focus:border-primary/50"
                            />
                        </div>
                        <GeminiKeySelector
                            triggerId={`${node.id}-gemini-key`}
                            value={node.aiKeyId}
                            onChange={(value) => onUpdate(node.id, { aiKeyId: value })}
                            keys={organizationGeminiKeys}
                        />
                    </div>
                )}
            </div>

            <div>
                <Label htmlFor={`${node.id}-varsave`}>Salvar Resposta na Variável</Label>
                <Input
                    id={`${node.id}-varsave`}
                    placeholder="nome_da_variavel"
                    value={node.variableToSaveChoice || ''}
                    onChange={(e) => onUpdate(node.id, { variableToSaveChoice: e.target.value })}
                    className="h-7 text-xs bg-black/20 border-white/5 focus:border-primary/50"
                />
            </div>

            <p className="text-xs text-muted-foreground italic pt-1">
                Cada opção na lista acima terá um conector de saída dedicado.
            </p>
            {renderHandles && <RefreshNodeInternals nodeId={node.id} signature={node.options} />}
        </div>
    );
};
