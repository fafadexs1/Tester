"use client";

import React from 'react';
import { Braces } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from "@/lib/utils";
import { NodeData } from '@/lib/types';

interface VariableInserterProps {
    nodeId?: string;
    data?: NodeData;
    onUpdate?: (id: string, data: Partial<NodeData>) => void;
    availableVariables?: string[];
    fieldName?: keyof NodeData;
    isTextarea?: boolean;
    isListItem?: boolean;
    itemId?: string;
    itemKeyOrValue?: 'key' | 'value';
    isIconTrigger?: boolean;
    onInsert?: (value: string) => void;
}

export const VariableInserter: React.FC<VariableInserterProps> = ({
    nodeId,
    data,
    onUpdate,
    availableVariables = [],
    fieldName,
    isTextarea = false,
    isListItem = false,
    itemId,
    itemKeyOrValue,
    isIconTrigger = false,
    onInsert
}) => {

    const handleVariableInsert = (variableName: string) => {
        if (onInsert) {
            onInsert(`{{${variableName}}}`);
            return;
        }

        if (!onUpdate || !data || !nodeId || !fieldName) return;

        if (isListItem && itemId && itemKeyOrValue && (fieldName === 'apiHeadersList' || fieldName === 'apiQueryParamsList' || fieldName === 'apiBodyFormDataList')) {
            const currentList = (data[fieldName] as any[] || []);
            const updatedList = currentList.map(item => {
                if (item.id === itemId) {
                    return { ...item, [itemKeyOrValue]: (item[itemKeyOrValue] || '') + `{{${variableName}}}` };
                }
                return item;
            });
            onUpdate(nodeId, { [fieldName]: updatedList } as Partial<NodeData>);
        } else if (!isListItem) {
            const currentValue = (data[fieldName] as string | undefined) || '';
            onUpdate(nodeId, { [fieldName]: currentValue + `{{${variableName}}}` } as Partial<NodeData>);
        }
    };

    const allVars = Array.from(new Set([
        ...(availableVariables || []),
        ...(
            (data?.apiResponseMappings || [])
                .map(mapping => mapping.flowVariable)
                .filter((name): name is string => typeof name === 'string' && name.trim() !== '')
        ),
    ])).sort((a, b) => a.localeCompare(b));

    if (allVars.length === 0) return null;

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className={cn("absolute h-6 w-6 z-10 text-zinc-400 hover:text-zinc-200", isTextarea ? 'top-1.5 right-1.5' : 'top-1/2 right-1 -translate-y-1/2')}
                    data-no-drag="true"
                    aria-label="Inserir Variável"
                >
                    <Braces className="h-3.5 w-3.5" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[220px] p-0 bg-zinc-950 border-white/10" data-no-drag="true" align="end">
                <div className="max-h-64 overflow-y-auto">
                    <div className="p-1">
                        {allVars.map((varName) => (
                            <Button
                                key={varName}
                                variant="ghost"
                                className="w-full justify-start h-6 px-2 text-[10px] font-mono text-zinc-300 hover:bg-white/5 hover:text-white"
                                onClick={() => handleVariableInsert(varName)}
                            >
                                {varName}
                            </Button>
                        ))}
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
};
