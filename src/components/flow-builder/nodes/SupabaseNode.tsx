"use client";

import React from 'react';
import { NodeComponentProps } from '../NodeProps';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { VariableInserter } from '../components/VariableInserter';

const SupabaseBaseNode: React.FC<NodeComponentProps & {
    needsIdentifier?: boolean,
    needsDataJson?: boolean,
    isReadOp?: boolean,
    isCreateOp?: boolean
}> = ({
    node, onUpdate, isLoadingSupabaseTables, supabaseTables, supabaseSchemaError, isLoadingSupabaseColumns, supabaseColumns
}) => {
        const isReadOp = node.type === 'supabase-read-row';
        const isCreateOp = node.type === 'supabase-create-row';
        // Props passed primarily override the detection logic if needed, but we can also stick to node.type checks for robustness
        const needsIdentifier = isReadOp || node.type === 'supabase-update-row' || node.type === 'supabase-delete-row';
        const needsDataJson = isCreateOp || node.type === 'supabase-update-row';

        return (
            <div className="space-y-2" data-no-drag="true">
                <div>
                    <Label htmlFor={`${node.id}-tableName`} className="text-[10px] font-medium text-zinc-400 mb-1 block">Nome da Tabela Supabase</Label>
                    {isLoadingSupabaseTables && <div className="flex items-center text-[10px] text-muted-foreground h-7"><Loader2 className="mr-2 h-3 w-3 animate-spin" /> Carregando...</div>}
                    {!isLoadingSupabaseTables && supabaseSchemaError && <p className="text-[10px] text-destructive">{supabaseSchemaError}</p>}
                    {!isLoadingSupabaseTables && !supabaseSchemaError && (!supabaseTables || supabaseTables.length === 0) && <p className="text-[10px] text-muted-foreground">Nenhuma tabela encontrada.</p>}
                    {!isLoadingSupabaseTables && !supabaseSchemaError && supabaseTables && supabaseTables.length > 0 && (
                        <Select
                            value={node.supabaseTableName || ''}
                            onValueChange={(value) => {
                                onUpdate(node.id, {
                                    supabaseTableName: value,
                                    supabaseIdentifierColumn: '',
                                    supabaseColumnsToSelect: '*'
                                });
                            }}
                        >
                            <SelectTrigger id={`${node.id}-tableName`} className="h-7 text-xs bg-black/20 border-white/5 focus:border-primary/50"><SelectValue placeholder="Selecione a Tabela" /></SelectTrigger>
                            <SelectContent>
                                {supabaseTables.map(table => <SelectItem key={table.name} value={table.name}>{table.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    )}
                </div>

                {needsIdentifier && (
                    <>
                        <div>
                            <Label htmlFor={`${node.id}-identifierCol`} className="text-[10px] font-medium text-zinc-400 mb-1 block">Coluna Identificadora (Filtro)</Label>
                            {isLoadingSupabaseColumns && <div className="flex items-center text-[10px] text-muted-foreground h-7"><Loader2 className="mr-2 h-3 w-3 animate-spin" /> Carregando...</div>}
                            {!isLoadingSupabaseColumns && !node.supabaseTableName && <p className="text-[10px] text-muted-foreground">Selecione uma tabela.</p>}
                            {!isLoadingSupabaseColumns && node.supabaseTableName && (!supabaseColumns || supabaseColumns.length === 0) && !supabaseSchemaError && <p className="text-[10px] text-muted-foreground">Nenhuma coluna encontrada.</p>}
                            {!isLoadingSupabaseColumns && supabaseColumns && supabaseColumns.length > 0 && (
                                <Select
                                    value={node.supabaseIdentifierColumn || ''}
                                    onValueChange={(value) => onUpdate(node.id, { supabaseIdentifierColumn: value })}
                                    disabled={!node.supabaseTableName || supabaseColumns.length === 0}
                                >
                                    <SelectTrigger id={`${node.id}-identifierCol`} className="h-7 text-xs bg-black/20 border-white/5 focus:border-primary/50">
                                        <SelectValue placeholder="Selecione a Coluna" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {supabaseColumns.map(col => <SelectItem key={col.name} value={col.name}>{col.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            )}
                            {!isLoadingSupabaseColumns && supabaseSchemaError && node.supabaseTableName && <p className="text-[10px] text-destructive">{supabaseSchemaError}</p>}
                        </div>
                        <div>
                            <Label htmlFor={`${node.id}-identifierVal`} className="text-[10px] font-medium text-zinc-400 mb-1 block">Valor do Identificador</Label>
                            <div className="relative">
                                <Input id={`${node.id}-identifierVal`} placeholder="123 ou {{variavel_id}}" value={node.supabaseIdentifierValue || ''} onChange={(e) => onUpdate(node.id, { supabaseIdentifierValue: e.target.value })} className="h-7 text-xs pr-7 bg-black/20 border-white/5 focus:border-primary/50" />
                                <VariableInserter fieldName="supabaseIdentifierValue" isIconTrigger onInsert={(v) => onUpdate(node.id, { supabaseIdentifierValue: (node.supabaseIdentifierValue || '') + v })} />
                            </div>
                        </div>
                    </>
                )}

                {isReadOp && (
                    <div>
                        <Label htmlFor={`${node.id}-columnsToSelectRead`} className="text-[10px] font-medium text-zinc-400 mb-1 block">Colunas a Selecionar</Label>
                        <div className="relative">
                            <Input id={`${node.id}-columnsToSelectRead`} placeholder="*, nome, email_principal" value={node.supabaseColumnsToSelect || '*'} onChange={(e) => onUpdate(node.id, { supabaseColumnsToSelect: e.target.value })} className="h-7 text-xs pr-7 bg-black/20 border-white/5 focus:border-primary/50" />
                            <VariableInserter fieldName="supabaseColumnsToSelect" isIconTrigger onInsert={(v) => onUpdate(node.id, { supabaseColumnsToSelect: (node.supabaseColumnsToSelect || '') + v })} />
                        </div>
                    </div>
                )}

                {needsDataJson && (
                    <div>
                        <Label htmlFor={`${node.id}-dataJson`} className="text-[10px] font-medium text-zinc-400 mb-1 block">{isCreateOp ? 'Dados da Nova Linha (JSON)' : 'Dados para Atualizar (JSON)'}</Label>
                        <div className="relative">
                            <Textarea id={`${node.id}-dataJson`} placeholder='{ "coluna1": "valor1", "coluna2": "{{variavel_col2}}" }' value={node.supabaseDataJson || ''} onChange={(e) => onUpdate(node.id, { supabaseDataJson: e.target.value })} rows={3} className="text-xs pr-8 bg-black/20 border-white/5 focus:border-primary/50 resize-none" />
                            <VariableInserter fieldName="supabaseDataJson" isIconTrigger isTextarea onInsert={(v) => onUpdate(node.id, { supabaseDataJson: (node.supabaseDataJson || '') + v })} />
                        </div>
                    </div>
                )}

                {(isReadOp || isCreateOp) && (
                    <div>
                        <Label htmlFor={`${node.id}-resultVar`} className="text-[10px] font-medium text-zinc-400 mb-1 block">Salvar Resultado na Variável</Label>
                        <Input
                            id={`${node.id}-resultVar`}
                            placeholder="resultado_supabase"
                            value={node.supabaseResultVariable || ''}
                            onChange={(e) => onUpdate(node.id, { supabaseResultVariable: e.target.value })}
                            className="h-7 text-xs bg-black/20 border-white/5 focus:border-primary/50"
                        />
                    </div>
                )}
                <p className="text-[10px] text-muted-foreground">Requer Supabase habilitado e configurado.</p>
            </div>
        );
    };

export const SupabaseCreateRowNode: React.FC<NodeComponentProps> = (props) => <SupabaseBaseNode {...props} />;
export const SupabaseReadRowNode: React.FC<NodeComponentProps> = (props) => <SupabaseBaseNode {...props} />;
export const SupabaseUpdateRowNode: React.FC<NodeComponentProps> = (props) => <SupabaseBaseNode {...props} />;
export const SupabaseDeleteRowNode: React.FC<NodeComponentProps> = (props) => <SupabaseBaseNode {...props} />;
