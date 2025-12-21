"use client";

import React from 'react';
import { NodeComponentProps } from '../NodeProps';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { VariableInserter } from '../components/VariableInserter';

export const GoogleSheetsAppendNode: React.FC<NodeComponentProps> = ({ node, onUpdate }) => {
    return (
        <div className="space-y-2" data-no-drag="true">
            <div>
                <Label htmlFor={`${node.id}-gsheetid`} className="text-[10px] font-medium text-zinc-400 mb-1 block">ID da Planilha Google</Label>
                <div className="relative">
                    <Input id={`${node.id}-gsheetid`} placeholder="abc123xyz789" value={node.googleSheetId || ''} onChange={(e) => onUpdate(node.id, { googleSheetId: e.target.value })} className="h-7 text-xs pr-7 bg-black/20 border-white/5 focus:border-primary/50" />
                    <VariableInserter fieldName="googleSheetId" isIconTrigger onInsert={(v) => onUpdate(node.id, { googleSheetId: (node.googleSheetId || '') + v })} />
                </div>
            </div>
            <div>
                <Label htmlFor={`${node.id}-gsheetname`} className="text-[10px] font-medium text-zinc-400 mb-1 block">Nome da Aba (Planilha)</Label>
                <div className="relative">
                    <Input id={`${node.id}-gsheetname`} placeholder="Página1" value={node.googleSheetName || ''} onChange={(e) => onUpdate(node.id, { googleSheetName: e.target.value })} className="h-7 text-xs pr-7 bg-black/20 border-white/5 focus:border-primary/50" />
                    <VariableInserter fieldName="googleSheetName" isIconTrigger onInsert={(v) => onUpdate(node.id, { googleSheetName: (node.googleSheetName || '') + v })} />
                </div>
            </div>
            <div>
                <Label htmlFor={`${node.id}-gsheetdata`} className="text-[10px] font-medium text-zinc-400 mb-1 block">Dados da Linha (JSON array de strings)</Label>
                <div className="relative">
                    <Textarea id={`${node.id}-gsheetdata`} placeholder='["{{input.valor1}}", "{{input.valor2}}", "texto fixo"]' value={node.googleSheetRowData || ''} onChange={(e) => onUpdate(node.id, { googleSheetRowData: e.target.value })} rows={2} className="text-xs pr-8 bg-black/20 border-white/5 focus:border-primary/50 resize-none" />
                    <VariableInserter fieldName="googleSheetRowData" isIconTrigger isTextarea onInsert={(v) => onUpdate(node.id, { googleSheetRowData: (node.googleSheetRowData || '') + v })} />
                </div>
            </div>
            <p className="text-[10px] text-muted-foreground">Certifique-se que a API do Google Sheets está habilitada e as credenciais configuradas no servidor.</p>
        </div>
    );
};
