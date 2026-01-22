"use client";

import React from 'react';
import { NodeComponentProps } from '../NodeProps';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { DebouncedInput } from '../components/DebouncedInput';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { VariableInserter } from '../components/VariableInserter';
import { NodeData } from '@/lib/types';
import { cn } from "@/lib/utils";

const Handle = ({ onMouseDown, handleId, color = "primary", label }: { onMouseDown: (e: React.MouseEvent) => void, handleId: string, color?: string, label: string }) => (
    <div className="flex items-center group/handle gap-2">
        <span className={cn("text-[9px] font-bold uppercase tracking-widest opacity-20 group-hover/handle:opacity-100 transition-opacity", `text-${color}`)}>{label}</span>
        <div
            className="w-2.5 h-2.5 rounded-full bg-black border-2 transition-all duration-300 hover:scale-150 cursor-crosshair shadow-[0_0_10px_rgba(0,0,0,0.5)]"
            style={{ borderColor: `var(--${color === 'primary' ? 'neon-purple' : color === 'green' ? 'neon-green' : 'destructive'})` }}
            onMouseDown={onMouseDown}
            data-connector="true" data-handle-type="source" data-handle-id={handleId}
        />
    </div>
);

export const ConditionNode: React.FC<NodeComponentProps> = ({ node, onUpdate, availableVariables, onStartConnection }) => {

    const renderHandles = () => (
        <div className="absolute -right-2.5 top-11 flex flex-col gap-8">
            <Handle onMouseDown={(e) => { e.stopPropagation(); onStartConnection(e, node, 'true'); }} handleId="true" color="green" label="Yes" />
            <Handle onMouseDown={(e) => { e.stopPropagation(); onStartConnection(e, node, 'false'); }} handleId="false" color="red" label="No" />
        </div>
    );

    return (
        <div className="space-y-4" data-no-drag="true">
            <div className="p-3 bg-white/[0.03] rounded-2xl border border-white/5 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                        <Label className="text-[8px] uppercase tracking-[0.2em] text-zinc-500 font-bold block">Mode</Label>
                        <Select
                            value={node.conditionDataType || 'string'}
                            onValueChange={(value) => onUpdate(node.id, { conditionDataType: value as NodeData['conditionDataType'] })}
                        >
                            <SelectTrigger className="h-8 text-[10px] bg-black/40 border-white/5 focus:border-white/10 focus-visible:ring-0 focus-visible:ring-offset-0 rounded-xl"><SelectValue /></SelectTrigger>
                            <SelectContent className="neo-glass border-white/10">
                                <SelectItem value="string">Text</SelectItem>
                                <SelectItem value="number">Numeric</SelectItem>
                                <SelectItem value="boolean">Logical</SelectItem>
                                <SelectItem value="date">Temporal</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-[8px] uppercase tracking-[0.2em] text-zinc-500 font-bold block">Operator</Label>
                        <Select
                            value={node.conditionOperator || '=='}
                            onValueChange={(value) => onUpdate(node.id, { conditionOperator: value as NodeData['conditionOperator'] })}
                        >
                            <SelectTrigger className="h-8 text-[10px] bg-black/40 border-white/5 focus:border-white/10 focus-visible:ring-0 focus-visible:ring-offset-0 rounded-xl"><SelectValue /></SelectTrigger>
                            <SelectContent className="neo-glass border-white/10">
                                {node.conditionDataType === 'date' ? (
                                    <><SelectItem value="isDateAfter">Later than</SelectItem><SelectItem value="isDateBefore">Earlier than</SelectItem></>
                                ) : node.conditionDataType === 'boolean' ? (
                                    <><SelectItem value="isTrue">Is True</SelectItem><SelectItem value="isFalse">Is False</SelectItem></>
                                ) : (
                                    <>
                                        <SelectItem value="==">Equals</SelectItem>
                                        <SelectItem value="!=">Different</SelectItem>
                                        {node.conditionDataType === 'number' && <>
                                            <SelectItem value=">">Greater</SelectItem>
                                            <SelectItem value="<">Smaller</SelectItem>
                                        </>}
                                        {node.conditionDataType === 'string' && <>
                                            <SelectItem value="contains">Contains</SelectItem>
                                            <SelectItem value="startsWith">Starts</SelectItem>
                                        </>}
                                    </>
                                )}
                                <SelectItem value="isEmpty">Null</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div className="space-y-1.5">
                    <Label className="text-[8px] uppercase tracking-[0.2em] text-zinc-500 font-bold block">Source Variable</Label>
                    <div className="relative">
                        <DebouncedInput placeholder="{{variable}}" value={node.conditionVariable || ''} onChange={(val) => onUpdate(node.id, { conditionVariable: String(val) })} className="h-8 text-[10px] pr-8 bg-black/40 border-white/5 focus:border-white/10 focus-visible:ring-0 focus-visible:ring-offset-0 rounded-xl" />
                        <div className="absolute right-1 top-1/2 -translate-y-1/2 scale-75">
                            <VariableInserter fieldName="conditionVariable" isIconTrigger onInsert={(v) => onUpdate(node.id, { conditionVariable: (node.conditionVariable || '') + v })} />
                        </div>
                    </div>
                </div>

                {node.conditionOperator !== 'isEmpty' && node.conditionOperator !== 'isNotEmpty' && node.conditionOperator !== 'isTrue' && node.conditionOperator !== 'isFalse' && (
                    <div className="space-y-1.5">
                        <Label className="text-[8px] uppercase tracking-[0.2em] text-zinc-500 font-bold block">Comparison Value</Label>
                        <div className="relative">
                            <DebouncedInput placeholder="Target value" value={node.conditionValue || ''} onChange={(val) => onUpdate(node.id, { conditionValue: String(val) })} className="h-8 text-[10px] pr-8 bg-black/40 border-white/5 focus:border-white/10 focus-visible:ring-0 focus-visible:ring-offset-0 rounded-xl" />
                            <div className="absolute right-1 top-1/2 -translate-y-1/2 scale-75">
                                <VariableInserter fieldName="conditionValue" isIconTrigger onInsert={(v) => onUpdate(node.id, { conditionVariable: (node.conditionVariable || '') + v })} />
                            </div>
                        </div>
                    </div>
                )}
            </div>
            {renderHandles()}
        </div>
    );
};
