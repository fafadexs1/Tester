"use client";

import React, { useRef, useMemo } from 'react';
import { NodeComponentProps } from '../NodeProps';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { MousePointerClick } from 'lucide-react';
import { VariableInserter } from '../components/VariableInserter';
import { buildVariableOptions, toSafeJsIdentifier, describeVariableKind, VariableOption } from '../utils/variableUtils';

export const CodeExecutionNode: React.FC<NodeComponentProps> = ({ node, onUpdate, availableVariables, activeWorkspace }) => {
    const codeEditorRef = useRef<HTMLTextAreaElement>(null);

    const variableOptions = useMemo(
        () => buildVariableOptions(availableVariables, activeWorkspace),
        [availableVariables, activeWorkspace]
    );

    const handleInsertCodeVariable = (option: VariableOption) => {
        const accessor = `variables["${option.name}"]`;
        let valueExpression = accessor;
        if (option.kind === 'array') {
            valueExpression = `Array.isArray(${accessor}) ? ${accessor} : []`;
        } else if (option.kind === 'object') {
            valueExpression = `${accessor} ?? {}`;
        }

        const snippet = `const ${toSafeJsIdentifier(option.name)} = ${valueExpression}; // ${describeVariableKind(option.kind)}\n`;
        const current = node.codeSnippet || '';
        const needsNewLine = current.length > 0 && !current.endsWith('\n');
        const updatedSnippet = `${current}${needsNewLine ? '\n' : ''}${snippet}`;

        onUpdate(node.id, { codeSnippet: updatedSnippet });

        requestAnimationFrame(() => {
            if (codeEditorRef.current) {
                const cursor = codeEditorRef.current.value.length;
                codeEditorRef.current.focus();
                codeEditorRef.current.setSelectionRange(cursor, cursor);
            }
        });
    };

    return (
        <div className="space-y-2" data-no-drag="true">
            <div className="flex items-center justify-between gap-2">
                <Label htmlFor={`${node.id}-codesnippet`} className="text-[10px] font-medium text-zinc-400">Trecho de Código (JavaScript)</Label>
                {variableOptions.length > 0 && (
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline" size="sm" className="h-6 text-[10px] px-2 border-white/10 hover:bg-white/5" data-no-drag="true">
                                <MousePointerClick className="w-3 h-3 mr-1" /> Selecionar variável
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-72 p-2" align="end" data-no-drag="true">
                            <p className="text-[10px] text-muted-foreground px-1 pb-2">Insira o valor direto do objeto variables.</p>
                            <div className="max-h-64 overflow-y-auto space-y-1">
                                {variableOptions.map((option) => (
                                    <Button
                                        key={option.name}
                                        variant="ghost"
                                        size="sm"
                                        className="w-full justify-between h-7 px-2 text-xs"
                                        onClick={() => handleInsertCodeVariable(option)}
                                        data-no-drag="true"
                                    >
                                        <span className="truncate">{option.name}</span>
                                        <span className="text-[10px] uppercase text-muted-foreground">{describeVariableKind(option.kind)}</span>
                                    </Button>
                                ))}
                            </div>
                        </PopoverContent>
                    </Popover>
                )}
            </div>
            <div className="relative">
                <Textarea
                    ref={codeEditorRef}
                    id={`${node.id}-codesnippet`}
                    placeholder={`function minhaFuncao(variaveis) { ... }`}
                    value={node.codeSnippet || ''}
                    onChange={(e) => onUpdate(node.id, { codeSnippet: e.target.value })}
                    rows={6}
                    className="pr-8 font-mono text-xs bg-black/20 border-white/5 focus:border-primary/50 resize-none"
                />
                <VariableInserter fieldName="codeSnippet" isIconTrigger isTextarea onInsert={(v) => onUpdate(node.id, { codeSnippet: (node.codeSnippet || '') + v })} />
            </div>
            <div>
                <Label htmlFor={`${node.id}-codeoutputvar`} className="text-[10px] font-medium text-zinc-400 mb-1 block">Salvar Saída (objeto) na Variável</Label>
                <Input id={`${node.id}-codeoutputvar`} placeholder="resultado_codigo" value={node.codeOutputVariable || ''} onChange={(e) => onUpdate(node.id, { codeOutputVariable: e.target.value })} className="h-7 text-xs bg-black/20 border-white/5 focus:border-primary/50" />
            </div>
            <p className="text-[10px] text-muted-foreground">Nota: O código é executado em um ambiente sandbox no servidor. Use o objeto <code>variables[\"nome_da_variavel\"]</code> para acessar dados do fluxo.</p>
        </div>
    );
};
