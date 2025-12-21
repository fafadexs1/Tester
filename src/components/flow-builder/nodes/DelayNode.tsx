"use client";

import React from 'react';
import { NodeComponentProps } from '../NodeProps';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

export const DelayNode: React.FC<NodeComponentProps> = ({ node, onUpdate }) => {
    return (
        <div className="space-y-2" data-no-drag="true">
            <div>
                <Label htmlFor={`${node.id}-delay`} className="text-[10px] font-medium text-zinc-400 mb-1 block">Duração (ms)</Label>
                <Input id={`${node.id}-delay`} type="number" placeholder="1000" value={node.delayDuration ?? ''} onChange={(e) => onUpdate(node.id, { delayDuration: parseInt(e.target.value, 10) || 0 })} className="h-7 text-xs bg-black/20 border-white/5 focus:border-primary/50" />
            </div>
        </div>
    );
};
