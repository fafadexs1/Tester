"use client";

import React from 'react';
import { NodeComponentProps } from '../NodeProps';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

export const TypingEmulationNode: React.FC<NodeComponentProps> = ({ node, onUpdate }) => {
    return (
        <div className="space-y-2" data-no-drag="true">
            <div>
                <Label htmlFor={`${node.id}-typingduration`} className="text-[10px] font-medium text-zinc-400 mb-1 block">Duração (ms)</Label>
                <Input id={`${node.id}-typingduration`} type="number" placeholder="1500" value={node.typingDuration ?? ''} onChange={(e) => onUpdate(node.id, { typingDuration: parseInt(e.target.value, 10) || 0 })} className="h-7 text-xs bg-black/20 border-white/5 focus:border-primary/50" />
            </div>
        </div>
    );
};
