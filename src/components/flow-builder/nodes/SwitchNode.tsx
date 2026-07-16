"use client";

import React from 'react';
import { NodeComponentProps } from '../NodeProps';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { VariableInserter } from '../components/VariableInserter';
import { Trash2, PlusCircle } from 'lucide-react';
import { cn } from "@/lib/utils";
import { v4 as uuidv4 } from 'uuid';
import { NODE_HEADER_CONNECTOR_Y_OFFSET } from '@/lib/constants';
import { FlowHandle, RefreshNodeInternals } from './FlowHandle';

export const SwitchNode: React.FC<NodeComponentProps> = ({ node, onUpdate, availableVariables, renderHandles = true }) => {

    const handleAddSwitchCase = () => {
        const newCase = { id: uuidv4(), value: '' };
        const updatedCases = [...(node.switchCases || []), newCase];
        onUpdate(node.id, { switchCases: updatedCases });
    };

    const handleRemoveSwitchCase = (caseId: string) => {
        const updatedCases = (node.switchCases || []).filter(c => c.id !== caseId);
        onUpdate(node.id, { switchCases: updatedCases });
    };

    const handleSwitchCaseChange = (caseId: string, value: string) => {
        const updatedCases = (node.switchCases || []).map(c =>
            c.id === caseId ? { ...c, value } : c
        );
        onUpdate(node.id, { switchCases: updatedCases });
    };

    // Rendering handles alongside the case inputs, similar to OptionNode.
    // And a Default handle.

    // Wait, Switch Node in original NodeCard calculated handle positions based on index (lines 2609).
    // "top: `${initialY + switchCases.length * spacingY - 10}px`" for default.
    // I will Render handles alongside the rows again.

    return (
        <div className="nodrag nowheel space-y-2" data-no-drag="true">
            <div>
                <Label htmlFor={`${node.id}-condvar-switch`} className="text-[10px] font-medium text-zinc-400 mb-1 block">Variável a Avaliar</Label>
                <div className="relative">
                    <Input id={`${node.id}-condvar-switch`} placeholder="{{variavel}}" value={node.switchVariable || ''} onChange={(e) => onUpdate(node.id, { switchVariable: e.target.value })} className="h-7 text-xs pr-7 bg-black/20 border-white/5 focus:border-primary/50" />
                    <VariableInserter fieldName="switchVariable" isIconTrigger onInsert={(v) => onUpdate(node.id, { switchVariable: (node.switchVariable || '') + v })} />
                </div>
            </div>

            <div className="space-y-1.5 pt-2 border-t border-white/5">
                <Label className="text-[10px] font-medium text-zinc-400">Casos (Caminhos)</Label>
                {(node.switchCases || []).map((caseItem, index) => (
                    <div key={caseItem.id} className="flex items-center space-x-2 group relative">
                        <div className="relative flex-1">
                            <Input
                                placeholder={`Valor ${index + 1}`}
                                value={caseItem.value}
                                onChange={(e) => handleSwitchCaseChange(caseItem.id, e.target.value)}
                                className="h-7 text-xs bg-black/20 border-white/5 focus:border-primary/50"
                            />
                        </div>
                        <Button
                            onClick={() => handleRemoveSwitchCase(caseItem.id)}
                            variant="ghost"
                            size="icon"
                            className="text-zinc-500 hover:text-destructive hover:bg-destructive/10 w-7 h-7 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                        </Button>

                        {/* Handle for this case */}
                        {renderHandles && <div
                            className="absolute -right-1.5 z-20 flex items-center justify-center group/connector top-1/2 -translate-y-1/2"
                            title={`Caso: ${caseItem.value}`}
                        >
                            <FlowHandle
                                id={caseItem.id}
                                colorClass="bg-indigo-500 group-hover/connector:bg-indigo-400"
                            />
                        </div>}
                    </div>
                ))}
                <Button onClick={handleAddSwitchCase} variant="outline" size="sm" className="w-full h-7 text-xs border-dashed border-white/10 hover:bg-white/5 text-zinc-400 hover:text-zinc-200">
                    <PlusCircle className="w-3 h-3 mr-1.5" /> Adicionar Caso
                </Button>
            </div>

            <div className="pt-2 border-t border-white/5 relative">
                <p className="text-[10px] text-muted-foreground italic pr-4">
                    Se nenhum caso corresponder, o fluxo seguirá pelo conector "padrão".
                </p>
                {/* Handle for Default */}
                {renderHandles && <div
                    className="absolute -right-1.5 z-20 flex items-center justify-center group/connector top-1/2 -translate-y-1/2"
                    title="Caso Contrário (Padrão)"
                >
                    <FlowHandle
                        id="otherwise"
                        title="Padrão"
                        colorClass="bg-zinc-500 group-hover/connector:bg-zinc-400"
                    />
                </div>}
            </div>
            {renderHandles && <RefreshNodeInternals nodeId={node.id} signature={node.switchCases} />}
        </div>
    );
};
