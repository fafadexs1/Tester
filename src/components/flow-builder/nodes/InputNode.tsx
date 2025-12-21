"use client";

import React, { useRef } from 'react';
import { NodeComponentProps } from '../NodeProps';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { VariableInserter } from '../components/VariableInserter';
import { TextFormatToolbar } from '../components/TextFormatToolbar';
import { cn } from "@/lib/utils";
import { NodeData } from '@/lib/types';
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

export const InputNode: React.FC<NodeComponentProps> = ({ node, onUpdate, availableVariables, onStartConnection }) => {
    const textAreaRef = useRef<HTMLTextAreaElement>(null);

    const renderHandles = () => (
        <div
            className="absolute -right-3 z-20 flex items-center justify-center group/connector"
            style={{
                top: `${NODE_HEADER_CONNECTOR_Y_OFFSET}px`,
                transform: 'translateY(-50%)',
            }}
        >
            <ConnectorDot
                onMouseDown={(e) => { e.stopPropagation(); onStartConnection(e, node, 'default'); }}
                handleId="default"
                title="Arraste para conectar"
            />
        </div>
    );

    return (
        <>
            <div className="space-y-2" data-no-drag="true">
                <div>
                    <Label htmlFor={`${node.id}-prompt`} className="text-[10px] font-medium text-zinc-400 mb-1 block">Mensagem da Pergunta</Label>
                    <div className="relative">
                        <Textarea ref={textAreaRef} id={`${node.id}-prompt`} placeholder="O que você deseja saber?" value={node.questionText || ''} onChange={(e) => onUpdate(node.id, { questionText: e.target.value })} rows={2} className="text-xs pr-8 bg-black/20 border-white/5 focus:border-primary/50 resize-none" />
                        <VariableInserter fieldName="questionText" isIconTrigger isTextarea onInsert={(v) => onUpdate(node.id, { questionText: (node.questionText || '') + v })} />
                    </div>
                    <TextFormatToolbar fieldName="questionText" textAreaRef={textAreaRef as React.RefObject<HTMLTextAreaElement>} onUpdate={onUpdate} nodeId={node.id} />
                </div>

                <div>
                    <Label htmlFor={`${node.id}-validation`} className="text-[10px] font-medium text-zinc-400 mb-1 block">Tipo de Validação</Label>
                    <Select value={node.inputValidationType || 'none'} onValueChange={(value) => onUpdate(node.id, { inputValidationType: value as NodeData['inputValidationType'] })}>
                        <SelectTrigger id={`${node.id}-validation`} className="h-7 text-xs bg-black/20 border-white/5 focus:border-primary/50"><SelectValue placeholder="Sem validação" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="none">Nenhuma (Texto Livre)</SelectItem>
                            <SelectItem value="email">E-mail</SelectItem>
                            <SelectItem value="cpf">CPF</SelectItem>
                            <SelectItem value="cnpj">CNPJ</SelectItem>
                            <SelectItem value="phone">Telefone (Celular BR)</SelectItem>
                            <SelectItem value="number">Número</SelectItem>
                            <SelectItem value="date">Data (DD/MM/AAAA)</SelectItem>
                            <SelectItem value="custom-regex">Regex Personalizado</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                {node.inputValidationType === 'custom-regex' && (
                    <div>
                        <Label htmlFor={`${node.id}-regex`} className="text-[10px] font-medium text-zinc-400 mb-1 block">Expressão Regular (Regex)</Label>
                        <Input id={`${node.id}-regex`} placeholder="Ex: ^[a-z]+$" value={node.customRegex || ''} onChange={(e) => onUpdate(node.id, { customRegex: e.target.value })} className="h-7 text-xs bg-black/20 border-white/5 focus:border-primary/50" />
                    </div>
                )}

                <div>
                    <Label htmlFor={`${node.id}-varsave`}>Salvar Resposta na Variável</Label>
                    <Input id={`${node.id}-varsave`} placeholder="nome_da_variavel" value={node.variableToSaveResponse || ''} onChange={(e) => onUpdate(node.id, { variableToSaveResponse: e.target.value })} className="h-7 text-xs bg-black/20 border-white/5 focus:border-primary/50" />
                </div>
            </div>
            {renderHandles()}
        </>
    );
};
