"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Trash2, PlusCircle } from 'lucide-react';
import { VariableInserter } from './VariableInserter';
import { ApiHeader, ApiQueryParam, ApiFormDataEntry } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';

interface KeyValueListProps {
    list: ApiHeader[] | ApiQueryParam[] | ApiFormDataEntry[];
    onUpdate: (updatedList: any[]) => void;
    keyPlaceholder: string;
    valuePlaceholder: string;
    addButtonLabel: string;
    variableInserterId: string; // Unique ID for variable inserter context
}

export const KeyValueList: React.FC<KeyValueListProps> = ({
    list,
    onUpdate,
    keyPlaceholder,
    valuePlaceholder,
    addButtonLabel,
    variableInserterId
}) => {
    const handleAdd = () => {
        const newItem = { id: uuidv4(), key: '', value: '' };
        onUpdate([...(list || []), newItem]);
    };

    const handleRemove = (id: string) => {
        onUpdate((list || []).filter(item => item.id !== id));
    };

    const handleChange = (id: string, field: 'key' | 'value', value: string) => {
        onUpdate((list || []).map(item =>
            item.id === id ? { ...item, [field]: value } : item
        ));
    };

    return (
        <div className="space-y-1.5">
            {(list || []).map((item) => (
                <div key={item.id} className="flex items-center space-x-2 group">
                    <div className="relative flex-1">
                        <Input
                            placeholder={keyPlaceholder}
                            value={item.key}
                            onChange={(e) => handleChange(item.id, 'key', e.target.value)}
                            className="text-xs h-7 pr-7 bg-black/20 border-white/5 focus:border-primary/50"
                        />
                        <VariableInserter
                            onInsert={(variable) => handleChange(item.id, 'key', (item.key || '') + variable)}
                            isIconTrigger
                        />
                    </div>
                    <div className="relative flex-1">
                        <Input
                            placeholder={valuePlaceholder}
                            value={item.value}
                            onChange={(e) => handleChange(item.id, 'value', e.target.value)}
                            className="text-xs h-7 pr-7 bg-black/20 border-white/5 focus:border-primary/50"
                        />
                        <VariableInserter
                            onInsert={(variable) => handleChange(item.id, 'value', (item.value || '') + variable)}
                            isIconTrigger
                        />
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemove(item.id)}
                        className="text-zinc-500 hover:text-destructive hover:bg-destructive/10 w-7 h-7 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                </div>
            ))}
            <Button onClick={handleAdd} variant="outline" size="sm" className="w-full h-7 text-xs border-dashed border-white/10 hover:bg-white/5 text-zinc-400 hover:text-zinc-200">
                <PlusCircle className="w-3 h-3 mr-1.5" /> {addButtonLabel}
            </Button>
        </div>
    );
};
