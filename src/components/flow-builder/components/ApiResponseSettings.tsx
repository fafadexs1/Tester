"use client";

import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { NodeComponentProps } from '../NodeProps';

export const ApiResponseSettings: React.FC<Pick<NodeComponentProps, 'node' | 'onUpdate'>> = ({ node, onUpdate }) => {
    return (
        <div className="space-y-2 pt-2 border-t border-white/5">
            <div className="flex items-center space-x-2">
                <Switch
                    id={`${node.id}-apiResponseAsInput`}
                    checked={node.apiResponseAsInput || false}
                    onCheckedChange={(checked) => onUpdate(node.id, { apiResponseAsInput: checked })}
                    className="scale-75 origin-left"
                />
                <Label htmlFor={`${node.id}-apiResponseAsInput`} className="text-[10px] font-medium text-zinc-400">Aceitar Resposta via API</Label>
            </div>
            {node.apiResponseAsInput && (
                <div>
                    <Label htmlFor={`${node.id}-apiResponsePathForValue`} className="text-[10px] font-medium text-zinc-400 mb-1 block">Caminho do Valor no JSON</Label>
                    <div className="relative">
                        <Input
                            id={`${node.id}-apiResponsePathForValue`}
                            placeholder="Ex: data.choice"
                            value={node.apiResponsePathForValue || ''}
                            onChange={(e) => onUpdate(node.id, { apiResponsePathForValue: e.target.value })}
                            className="h-7 text-xs pr-7 bg-black/20 border-white/5 focus:border-primary/50"
                        />
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">O fluxo usará o valor deste caminho como se fosse a resposta do usuário.</p>
                </div>
            )}
        </div>
    );
};
