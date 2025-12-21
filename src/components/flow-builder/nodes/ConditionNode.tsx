"use client";

import React from 'react';
import { NodeComponentProps } from '../NodeProps';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { VariableInserter } from '../components/VariableInserter';
import { NodeData } from '@/lib/types';
import { cn } from "@/lib/utils";
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

export const ConditionNode: React.FC<NodeComponentProps> = ({ node, onUpdate, availableVariables, onStartConnection }) => {

    const renderHandles = () => (
        <>
            <div
                className="absolute -right-3 z-20 flex items-center justify-center group/connector"
                style={{
                    top: `${NODE_HEADER_CONNECTOR_Y_OFFSET}px`,
                    transform: 'translateY(-50%)',
                }}
            >
                <span className="text-[10px] text-green-500 mr-2 opacity-15 group-hover/connector:opacity-100 transition-opacity font-semibold">TRUE</span>
                <ConnectorDot
                    onMouseDown={(e) => { e.stopPropagation(); onStartConnection(e, node, 'true'); }}
                    handleId="true"
                    title="Verdadeiro"
                    colorClass="bg-green-500 group-hover/connector:bg-green-400"
                />
            </div>
            <div
                className="absolute -right-3 z-20 flex items-center justify-center group/connector"
                style={{
                    top: `${NODE_HEADER_CONNECTOR_Y_OFFSET + 30}px`, // Offset for False
                    transform: 'translateY(-50%)',
                }}
            >
                <span className="text-[10px] text-red-500 mr-2 opacity-15 group-hover/connector:opacity-100 transition-opacity font-semibold">FALSE</span>
                <ConnectorDot
                    onMouseDown={(e) => { e.stopPropagation(); onStartConnection(e, node, 'false'); }}
                    handleId="false"
                    title="Falso"
                    colorClass="bg-red-500 group-hover/connector:bg-red-400"
                />
            </div>
        </>
    );

    return (
        <>
            <div className="space-y-2" data-no-drag="true">
                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <Label htmlFor={`${node.id}-condtype`} className="text-[10px] font-medium text-zinc-400 mb-1 block">Tipo de Dado</Label>
                        <Select
                            value={node.conditionDataType || 'string'}
                            onValueChange={(value) => onUpdate(node.id, { conditionDataType: value as NodeData['conditionDataType'] })}
                        >
                            <SelectTrigger id={`${node.id}-condtype`} className="h-7 text-xs bg-black/20 border-white/5 focus:border-primary/50"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="string">Texto</SelectItem>
                                <SelectItem value="number">Número</SelectItem>
                                <SelectItem value="boolean">Booleano</SelectItem>
                                <SelectItem value="date">Data/Hora</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <Label htmlFor={`${node.id}-condop`} className="text-[10px] font-medium text-zinc-400 mb-1 block">Operador</Label>
                        <Select
                            value={node.conditionOperator || '=='}
                            onValueChange={(value) => onUpdate(node.id, { conditionOperator: value as NodeData['conditionOperator'] })}
                        >
                            <SelectTrigger id={`${node.id}-condop`} className="h-7 text-xs bg-black/20 border-white/5 focus:border-primary/50"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {node.conditionDataType === 'date' ? (
                                    <>
                                        <SelectItem value="isDateAfter">É depois de</SelectItem>
                                        <SelectItem value="isDateBefore">É antes de</SelectItem>
                                    </>
                                ) : node.conditionDataType === 'boolean' ? (
                                    <>
                                        <SelectItem value="isTrue">É verdadeiro</SelectItem>
                                        <SelectItem value="isFalse">É falso</SelectItem>
                                    </>
                                ) : (
                                    <>
                                        <SelectItem value="==">Igual a</SelectItem>
                                        <SelectItem value="!=">Diferente de</SelectItem>
                                        {node.conditionDataType === 'number' && <>
                                            <SelectItem value=">">Maior que</SelectItem>
                                            <SelectItem value="<">Menor que</SelectItem>
                                            <SelectItem value=">=">Maior ou igual a</SelectItem>
                                            <SelectItem value="<=">Menor ou igual a</SelectItem>
                                        </>}
                                        {node.conditionDataType === 'string' && <>
                                            <SelectItem value="contains">Contém</SelectItem>
                                            <SelectItem value="startsWith">Começa com</SelectItem>
                                            <SelectItem value="endsWith">Termina com</SelectItem>
                                        </>}
                                    </>
                                )}
                                <SelectItem value="isEmpty">É vazio/nulo</SelectItem>
                                <SelectItem value="isNotEmpty">Não é vazio/nulo</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <div>
                    <Label htmlFor={`${node.id}-condvar`} className="text-[10px] font-medium text-zinc-400 mb-1 block">Variável (ex: {"{{variavel}}"})</Label>
                    <div className="relative">
                        <Input id={`${node.id}-condvar`} placeholder="{{variavel_a_verificar}}" value={node.conditionVariable || ''} onChange={(e) => onUpdate(node.id, { conditionVariable: e.target.value })} className="h-7 text-xs pr-7 bg-black/20 border-white/5 focus:border-primary/50" />
                        <VariableInserter fieldName="conditionVariable" isIconTrigger onInsert={(v) => onUpdate(node.id, { conditionVariable: (node.conditionVariable || '') + v })} />
                    </div>
                </div>
                {node.conditionOperator !== 'isEmpty' && node.conditionOperator !== 'isNotEmpty' && node.conditionOperator !== 'isTrue' && node.conditionOperator !== 'isFalse' && (
                    <div>
                        <Label htmlFor={`${node.id}-condval`} className="text-[10px] font-medium text-zinc-400 mb-1 block">Valor para Comparar</Label>
                        <div className="relative">
                            <Input id={`${node.id}-condval`} placeholder="Valor" value={node.conditionValue || ''} onChange={(e) => onUpdate(node.id, { conditionValue: e.target.value })} className="h-7 text-xs pr-7 bg-black/20 border-white/5 focus:border-primary/50" />
                            <VariableInserter fieldName="conditionValue" isIconTrigger onInsert={(v) => onUpdate(node.id, { conditionValue: (node.conditionValue || '') + v })} />
                        </div>
                        {node.conditionDataType === 'date' && <p className="text-[10px] text-muted-foreground mt-1">Use `HH:mm` para horas ou `{"{{now}}"}` para a hora atual.</p>}
                    </div>
                )}
            </div>
            {renderHandles()}
        </>
    );
};
