"use client";

import React from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { OrganizationAiKeySummary } from '@/lib/types';

interface GeminiKeySelectorProps {
    label?: string;
    value?: string;
    onChange: (value?: string) => void;
    keys?: OrganizationAiKeySummary[];
    triggerId?: string;
    emptyMessage?: string;
}

export const GeminiKeySelector: React.FC<GeminiKeySelectorProps> = ({
    label = 'Chave Gemini',
    value,
    onChange,
    keys = [],
    triggerId,
    emptyMessage = 'Cadastre chaves em Organizacao > Integracoes.',
}) => {
    const safeValue = value && keys.some((item) => item.id === value) ? value : '__default__';

    return (
        <div className="space-y-1">
            <Label htmlFor={triggerId} className="text-[10px] text-zinc-400">{label}</Label>
            <Select
                value={safeValue}
                onValueChange={(nextValue) => onChange(nextValue === '__default__' ? undefined : nextValue)}
            >
                <SelectTrigger
                    id={triggerId}
                    className="h-7 bg-black/20 text-xs border-white/5 focus:border-primary/50"
                >
                    <SelectValue placeholder="Usar chave Gemini padrao" />
                </SelectTrigger>
                <SelectContent className="border-white/10 bg-zinc-950">
                    <SelectItem value="__default__">Usar chave padrao da organizacao</SelectItem>
                    {keys.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                            {item.name}{item.is_default ? ' (Padrao)' : ''}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground">
                {keys.length > 0 ? 'A selecao usa o nome cadastrado na integracao Gemini da organizacao.' : emptyMessage}
            </p>
        </div>
    );
};
