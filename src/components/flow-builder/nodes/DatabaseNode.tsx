"use client";

import React, { useState, useEffect, useCallback } from 'react';
import type { NodeData, DatabaseConnection, DbFilterCondition } from '@/lib/types';
import { NodeComponentProps } from '../NodeProps';
import { cn } from '@/lib/utils';
import {
    Plus, Trash2, Loader2, AlertTriangle
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

const OPERATORS = [
    { value: '=', label: '=' },
    { value: '!=', label: '≠' },
    { value: '>', label: '>' },
    { value: '<', label: '<' },
    { value: '>=', label: '≥' },
    { value: '<=', label: '≤' },
    { value: 'LIKE', label: 'LIKE' },
    { value: 'ILIKE', label: 'ILIKE' },
    { value: 'IN', label: 'IN' },
    { value: 'IS NULL', label: 'É NULO' },
    { value: 'IS NOT NULL', label: 'NÃO NULO' },
];

const ON_ERROR_OPTIONS = [
    { value: 'stop', label: 'Parar Fluxo' },
    { value: 'continue', label: 'Continuar' },
    { value: 'goto', label: 'Ir para nó' },
];

const selectClass = "w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white/90 focus:outline-none focus:border-primary/40";
const inputClass = "w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white/90 placeholder-zinc-600 focus:outline-none focus:border-primary/40";
const labelClass = "text-[9px] uppercase tracking-widest text-zinc-500 font-bold";

const DatabaseNodeInner: React.FC<NodeComponentProps> = ({ node, onUpdate, activeWorkspace }) => {
    const operation = node.dbOperation || 'select';
    const isToolNode = node.type === 'db-tool';

    const [tables, setTables] = useState<{ name: string }[]>([]);
    const [columns, setColumns] = useState<{ name: string; type: string }[]>([]);
    const [isLoadingTables, setIsLoadingTables] = useState(false);
    const [isLoadingColumns, setIsLoadingColumns] = useState(false);

    const connections: DatabaseConnection[] = activeWorkspace?.databaseConnections || [];
    const selectedConnection = connections.find(c => c.id === node.dbConnectionId);

    const fetchTables = useCallback(async (conn: DatabaseConnection) => {
        setIsLoadingTables(true);
        try {
            const res = await fetch('/api/database/schema', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'schema', connection: conn }),
            });
            const result = await res.json();
            setTables(result.tables || []);
        } catch {
            setTables([]);
        } finally {
            setIsLoadingTables(false);
        }
    }, []);

    const fetchColumns = useCallback(async (conn: DatabaseConnection, tableName: string) => {
        setIsLoadingColumns(true);
        try {
            const res = await fetch('/api/database/schema', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'schema', connection: conn, table: tableName }),
            });
            const result = await res.json();
            setColumns(result.columns || []);
        } catch {
            setColumns([]);
        } finally {
            setIsLoadingColumns(false);
        }
    }, []);

    useEffect(() => {
        if (selectedConnection) fetchTables(selectedConnection);
    }, [selectedConnection?.id]);

    useEffect(() => {
        if (selectedConnection && node.dbTableName) {
            fetchColumns(selectedConnection, node.dbTableName);
        }
    }, [selectedConnection?.id, node.dbTableName]);

    const update = (changes: Partial<NodeData>) => onUpdate(node.id, changes);

    const addFilter = () => {
        const filters = [...(node.dbFilters || [])];
        filters.push({ id: uuidv4(), column: '', operator: '=', value: '' });
        update({ dbFilters: filters });
    };

    const updateFilter = (index: number, changes: Partial<DbFilterCondition>) => {
        const filters = [...(node.dbFilters || [])];
        filters[index] = { ...filters[index], ...changes };
        update({ dbFilters: filters });
    };

    const removeFilter = (index: number) => {
        const filters = [...(node.dbFilters || [])];
        filters.splice(index, 1);
        update({ dbFilters: filters });
    };

    const needsFilters = operation === 'select' || operation === 'update' || operation === 'delete';
    const needsData = operation === 'insert' || operation === 'update';

    return (
        <div className="space-y-3">
            {/* Operation selector for db-tool */}
            {isToolNode && (
                <div className="space-y-1">
                    <label className={labelClass}>Operação</label>
                    <select className={selectClass} value={operation} onChange={(e) => update({ dbOperation: e.target.value as any })}>
                        <option value="select" className="bg-zinc-900">Consultar (SELECT)</option>
                        <option value="insert" className="bg-zinc-900">Inserir (INSERT)</option>
                        <option value="update" className="bg-zinc-900">Atualizar (UPDATE)</option>
                        <option value="delete" className="bg-zinc-900">Deletar (DELETE)</option>
                    </select>
                </div>
            )}

            {/* Connection Selector */}
            <div className="space-y-1">
                <label className={labelClass}>Conexão</label>
                <select
                    className={selectClass}
                    value={node.dbConnectionId || ''}
                    onChange={(e) => update({ dbConnectionId: e.target.value, dbTableName: '' })}
                >
                    <option value="" className="bg-zinc-900">Selecione...</option>
                    {connections.map(c => (
                        <option key={c.id} value={c.id} className="bg-zinc-900">
                            {c.name} ({c.type === 'postgres' ? 'PG' : 'SB'})
                        </option>
                    ))}
                </select>
                {connections.length === 0 && (
                    <p className="text-[9px] text-amber-500/70 mt-0.5">Configure conexões em ⚙ Banco de Dados</p>
                )}
            </div>

            {/* Table Selector */}
            {node.dbConnectionId && (
                <div className="space-y-1">
                    <label className={labelClass}>Tabela</label>
                    {isLoadingTables ? (
                        <div className="flex items-center gap-2 text-[10px] text-zinc-500 py-1">
                            <Loader2 className="w-3 h-3 animate-spin" /> Carregando tabelas...
                        </div>
                    ) : (
                        <select className={selectClass} value={node.dbTableName || ''} onChange={(e) => update({ dbTableName: e.target.value })}>
                            <option value="" className="bg-zinc-900">Selecione a tabela...</option>
                            {tables.map(t => (
                                <option key={t.name} value={t.name} className="bg-zinc-900">{t.name}</option>
                            ))}
                        </select>
                    )}
                </div>
            )}

            {/* Columns to Select (only for SELECT) */}
            {operation === 'select' && node.dbTableName && (
                <div className="space-y-1">
                    <label className={labelClass}>Colunas</label>
                    <input className={inputClass} placeholder="* (todas)" value={node.dbColumnsToSelect || ''} onChange={(e) => update({ dbColumnsToSelect: e.target.value })} />
                </div>
            )}

            {/* Data JSON (for INSERT/UPDATE) */}
            {needsData && node.dbTableName && (
                <div className="space-y-1">
                    <label className={labelClass}>Dados (JSON)</label>
                    <textarea
                        className={cn(inputClass, "font-mono h-16 resize-none")}
                        placeholder={'{\n  "campo": "{{variavel}}"\n}'}
                        value={node.dbDataJson || ''}
                        onChange={(e) => update({ dbDataJson: e.target.value })}
                    />
                </div>
            )}

            {/* Filters */}
            {needsFilters && node.dbTableName && (
                <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                        <label className={labelClass}>Filtros</label>
                        <button onClick={addFilter} className="text-[9px] text-primary hover:text-primary/80 flex items-center gap-0.5 font-medium">
                            <Plus className="w-3 h-3" /> Adicionar
                        </button>
                    </div>

                    {(node.dbFilters || []).map((filter, idx) => (
                        <div key={filter.id} className="flex gap-1 items-center">
                            <select
                                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-1.5 py-1 text-[10px] text-white/90 focus:outline-none focus:border-primary/40"
                                value={filter.column}
                                onChange={(e) => updateFilter(idx, { column: e.target.value })}
                            >
                                <option value="" className="bg-zinc-900">Coluna</option>
                                {columns.map(c => (
                                    <option key={c.name} value={c.name} className="bg-zinc-900">{c.name}</option>
                                ))}
                            </select>
                            <select
                                className="w-14 bg-white/5 border border-white/10 rounded-lg px-1 py-1 text-[10px] text-white/90 focus:outline-none focus:border-primary/40"
                                value={filter.operator}
                                onChange={(e) => updateFilter(idx, { operator: e.target.value as any })}
                            >
                                {OPERATORS.map(op => (
                                    <option key={op.value} value={op.value} className="bg-zinc-900">{op.label}</option>
                                ))}
                            </select>
                            {!['IS NULL', 'IS NOT NULL'].includes(filter.operator) && (
                                <input
                                    className="flex-1 bg-white/5 border border-white/10 rounded-lg px-1.5 py-1 text-[10px] text-white/90 placeholder-zinc-600 focus:outline-none focus:border-primary/40"
                                    placeholder="{{var}}"
                                    value={filter.value}
                                    onChange={(e) => updateFilter(idx, { value: e.target.value })}
                                />
                            )}
                            <button onClick={() => removeFilter(idx)} className="text-zinc-500 hover:text-red-400 transition-colors p-0.5">
                                <Trash2 className="w-3 h-3" />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Result Variable */}
            {(operation === 'select' || operation === 'insert') && (
                <div className="space-y-1">
                    <label className={labelClass}>Salvar em Variável</label>
                    <input className={inputClass} placeholder="resultado_db" value={node.dbResultVariable || ''} onChange={(e) => update({ dbResultVariable: e.target.value })} />
                </div>
            )}

            {/* Agent Tool fields */}
            {isToolNode && (
                <>
                    <div className="space-y-1">
                        <label className={labelClass}>Nome da Ferramenta</label>
                        <input className={inputClass} placeholder="consultar_clientes" value={node.dbToolName || ''} onChange={(e) => update({ dbToolName: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                        <label className={labelClass}>Descrição</label>
                        <input className={inputClass} placeholder="Consulta dados dos clientes..." value={node.dbToolDescription || ''} onChange={(e) => update({ dbToolDescription: e.target.value })} />
                    </div>
                </>
            )}

            {/* Error Handling */}
            {!isToolNode && (
                <div className="space-y-1 pt-1 border-t border-white/5">
                    <label className={cn(labelClass, "flex items-center gap-1")}>
                        <AlertTriangle className="w-3 h-3 text-amber-500/60" />
                        Em caso de erro
                    </label>
                    <select className={selectClass} value={node.dbOnError || 'stop'} onChange={(e) => update({ dbOnError: e.target.value as any })}>
                        {ON_ERROR_OPTIONS.map(opt => (
                            <option key={opt.value} value={opt.value} className="bg-zinc-900">{opt.label}</option>
                        ))}
                    </select>
                </div>
            )}
        </div>
    );
};

export const DbSelectNode: React.FC<NodeComponentProps> = (props) => <DatabaseNodeInner {...props} />;
export const DbInsertNode: React.FC<NodeComponentProps> = (props) => <DatabaseNodeInner {...props} />;
export const DbUpdateNode: React.FC<NodeComponentProps> = (props) => <DatabaseNodeInner {...props} />;
export const DbDeleteNode: React.FC<NodeComponentProps> = (props) => <DatabaseNodeInner {...props} />;
export const DbToolNode: React.FC<NodeComponentProps> = (props) => <DatabaseNodeInner {...props} />;
