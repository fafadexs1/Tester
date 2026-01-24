"use client";

import React, { useState } from 'react';
import { NodeComponentProps } from '../NodeProps';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { VariableInserter } from '../components/VariableInserter';
import { Plus, Trash2, Import, Play, History, Lock, List, FileCode, Check, Map as MapIcon, Link } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { parseCurl } from '@/lib/curl-parser';
import { cn } from "@/lib/utils";

export const HttpToolNode: React.FC<NodeComponentProps> = ({ node, onUpdate }) => {

    // State for cURL import dialog
    const [isImportCurlOpen, setIsImportCurlOpen] = useState(false);
    const [curlText, setCurlText] = useState('');

    const handleImportCurl = () => {
        const parsed = parseCurl(curlText);
        const updates: any = {};
        if (parsed.url) updates.httpToolUrl = parsed.url;
        if (parsed.method) updates.httpToolMethod = parsed.method;
        if (parsed.headers && parsed.headers.length > 0) updates.httpToolHeaders = parsed.headers;
        if (parsed.body) {
            updates.httpToolBody = parsed.body;
            // Try to detect JSON
            try {
                JSON.parse(parsed.body);
                updates.httpToolBodyType = 'json';
            } catch {
                updates.httpToolBodyType = 'text';
            }
        } else {
            updates.httpToolBodyType = 'none';
        }

        if (parsed.authType) {
            updates.httpToolAuthType = parsed.authType;
            if (parsed.authKey) updates.httpToolAuthKey = parsed.authKey;
            if (parsed.authToken) updates.httpToolAuthToken = parsed.authToken;
        }

        onUpdate(node.id, updates);
        setIsImportCurlOpen(false);
        setCurlText('');
    };

    // Helper to manage list-based state (Headers, Params, FormData)
    const updateListField = (field: 'httpToolHeaders' | 'httpToolParams' | 'httpToolFormData', newItems: { key: string, value: string }[]) => {
        onUpdate(node.id, { [field]: newItems });
    };

    const addListItem = (field: 'httpToolHeaders' | 'httpToolParams' | 'httpToolFormData') => {
        const current = (node[field] as { key: string, value: string }[]) || [];
        updateListField(field, [...current, { key: '', value: '' }]);
    };

    const updateListItem = (field: 'httpToolHeaders' | 'httpToolParams' | 'httpToolFormData', index: number, itemField: 'key' | 'value', value: string) => {
        const current = [...((node[field] as { key: string, value: string }[]) || [])];
        if (!current[index]) return;
        current[index] = { ...current[index], [itemField]: value };
        updateListField(field, current);
    };

    const removeListItem = (field: 'httpToolHeaders' | 'httpToolParams' | 'httpToolFormData', index: number) => {
        const current = [...((node[field] as { key: string, value: string }[]) || [])];
        current.splice(index, 1);
        updateListField(field, current);
    };

    const renderKeyValueList = (field: 'httpToolHeaders' | 'httpToolParams' | 'httpToolFormData', placeholderKey: string) => {
        const items = (node[field] as { key: string, value: string }[]) || [];
        return (
            <div className="space-y-2 mt-2">
                {items.length === 0 && (
                    <div className="text-center py-4 text-xs text-zinc-500 border border-dashed border-zinc-800 rounded-md">
                        Nenhum item configurado
                    </div>
                )}
                {items.map((item, i) => (
                    <div key={i} className="grid grid-cols-[1fr_1fr_20px] gap-2 items-center">
                        <Input
                            placeholder={placeholderKey}
                            value={item.key}
                            onChange={(e) => updateListItem(field as any, i, 'key', e.target.value)}
                            className="h-8 text-xs bg-black/20 border-white/5"
                        />
                        <div className="relative">
                            <Input
                                placeholder="Value"
                                value={item.value}
                                onChange={(e) => updateListItem(field as any, i, 'value', e.target.value)}
                                className="h-8 text-xs pr-6 bg-black/20 border-white/5"
                            />
                            <VariableInserter fieldName={`${field}-${i}` as any} isIconTrigger onInsert={(v) => updateListItem(field as any, i, 'value', item.value + v)} />
                        </div>
                        <Button variant="ghost" size="icon" className="h-6 w-6 hover:text-red-400 hover:bg-red-400/10" onClick={() => removeListItem(field as any, i)}>
                            <Trash2 className="h-3 w-3" />
                        </Button>
                    </div>
                ))}
                <Button variant="outline" size="sm" onClick={() => addListItem(field as any)} className="w-full h-7 text-xs border-dashed border-zinc-700 hover:border-zinc-500 hover:bg-zinc-900">
                    <Plus className="h-3 w-3 mr-2" /> Adicionar Item
                </Button>
            </div>
        );
    };

    return (
        <div className="space-y-4 select-none" data-no-drag="true">
            {/* Top Bar: Name & Desc - Simplified for Dialog */}
            <div className="space-y-3">
                <div className="space-y-1">
                    <Label className="text-[10px] font-medium text-zinc-400">Nome da Ferramenta</Label>
                    <Input
                        placeholder="ex: consultar_clima"
                        value={node.httpToolName || ''}
                        onChange={(e) => onUpdate(node.id, { httpToolName: e.target.value })}
                        className="h-8 text-xs bg-black/20 border-white/5 focus:border-primary/50 font-mono"
                    />
                </div>
                <div className="space-y-1">
                    <Label className="text-[10px] font-medium text-zinc-400">Descrição</Label>
                    <Textarea
                        placeholder="Descreva quando a IA deve usar esta ferramenta."
                        value={node.httpToolDescription || ''}
                        onChange={(e) => onUpdate(node.id, { httpToolDescription: e.target.value })}
                        className="text-xs bg-black/20 border-white/5 focus:border-primary/50 resize-none min-h-[60px]"
                    />
                </div>
            </div>

            <div className="h-px bg-white/5" />

            {/* URL & Method Section */}
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <Label className="text-[10px] font-medium text-zinc-400">Detalhes da Requisição</Label>
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-6 text-[10px] gap-1.5 border-white/10 bg-white/5 hover:bg-white/10"
                        onClick={() => setIsImportCurlOpen(true)}
                    >
                        <Import className="w-3 h-3" /> Importar cURL
                    </Button>
                </div>

                <div className="flex gap-2">
                    <Select
                        value={node.httpToolMethod || 'GET'}
                        onValueChange={(v) => onUpdate(node.id, { httpToolMethod: v as any })}
                    >
                        <SelectTrigger className="w-[100px] h-9 text-xs bg-black/20 border-white/5 focus:border-primary/50 font-bold">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="GET" className="font-bold text-blue-400">GET</SelectItem>
                            <SelectItem value="POST" className="font-bold text-green-400">POST</SelectItem>
                            <SelectItem value="PUT" className="font-bold text-orange-400">PUT</SelectItem>
                            <SelectItem value="PATCH" className="font-bold text-yellow-400">PATCH</SelectItem>
                            <SelectItem value="DELETE" className="font-bold text-red-400">DELETE</SelectItem>
                        </SelectContent>
                    </Select>

                    <div className="relative flex-1">
                        <Input
                            placeholder="https://api.exemplo.com/v1/..."
                            value={node.httpToolUrl || ''}
                            onChange={(e) => onUpdate(node.id, { httpToolUrl: e.target.value })}
                            className="h-9 text-xs pr-7 bg-black/20 border-white/5 focus:border-primary/50 font-mono"
                        />
                        <VariableInserter fieldName="httpToolUrl" isIconTrigger onInsert={(v) => onUpdate(node.id, { httpToolUrl: (node.httpToolUrl || '') + v })} />
                    </div>
                </div>
            </div>

            {/* Tabs for Details */}
            <Tabs defaultValue="auth" className="w-full">
                <TabsList className="w-full grid grid-cols-5 h-8 bg-black/40 p-0.5 gap-0.5 rounded-lg border border-white/5">
                    <TabsTrigger value="auth" className="text-[10px] h-full data-[state=active]:bg-white/10 data-[state=active]:text-white gap-1.5">
                        <Lock className="w-3 h-3" /> Auth
                    </TabsTrigger>
                    <TabsTrigger value="headers" className="text-[10px] h-full data-[state=active]:bg-white/10 data-[state=active]:text-white gap-1.5">
                        <List className="w-3 h-3" /> Headers
                    </TabsTrigger>
                    <TabsTrigger value="query" className="text-[10px] h-full data-[state=active]:bg-white/10 data-[state=active]:text-white gap-1.5">
                        <Link className="w-3 h-3" /> Query
                    </TabsTrigger>
                    <TabsTrigger value="body" className="text-[10px] h-full data-[state=active]:bg-white/10 data-[state=active]:text-white gap-1.5">
                        <FileCode className="w-3 h-3" /> Corpo
                    </TabsTrigger>
                </TabsList>

                {/* Auth Tab */}
                <TabsContent value="auth" className="mt-3 space-y-3 min-h-[150px]">
                    <div className="space-y-1">
                        <Label className="text-[10px] font-medium text-zinc-400">Tipo de Autenticação</Label>
                        <Select
                            value={node.httpToolAuthType || 'none'}
                            onValueChange={(v) => onUpdate(node.id, { httpToolAuthType: v as any })}
                        >
                            <SelectTrigger className="h-8 text-xs bg-black/20 border-white/5">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">Nenhuma</SelectItem>
                                <SelectItem value="bearer">Bearer Token</SelectItem>
                                <SelectItem value="basic">Basic Auth</SelectItem>
                                <SelectItem value="header">API Key (Header)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {node.httpToolAuthType === 'bearer' && (
                        <div className="space-y-1">
                            <Label className="text-[10px] font-medium text-zinc-400">Token</Label>
                            <div className="relative">
                                <Input
                                    placeholder="Bearer Token"
                                    value={node.httpToolAuthToken || ''}
                                    onChange={(e) => onUpdate(node.id, { httpToolAuthToken: e.target.value })}
                                    className="h-8 text-xs pr-7 bg-black/20 border-white/5"
                                    type="password"
                                />
                                <VariableInserter fieldName="httpToolAuthToken" isIconTrigger onInsert={(v) => onUpdate(node.id, { httpToolAuthToken: (node.httpToolAuthToken || '') + v })} />
                            </div>
                        </div>
                    )}

                    {node.httpToolAuthType === 'basic' && (
                        <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                                <Label className="text-[10px] font-medium text-zinc-400">Username</Label>
                                <Input
                                    placeholder="User"
                                    value={node.httpToolAuthKey || ''}
                                    onChange={(e) => onUpdate(node.id, { httpToolAuthKey: e.target.value })}
                                    className="h-8 text-xs bg-black/20 border-white/5"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[10px] font-medium text-zinc-400">Password</Label>
                                <Input
                                    placeholder="Pass"
                                    value={node.httpToolAuthToken || ''}
                                    onChange={(e) => onUpdate(node.id, { httpToolAuthToken: e.target.value })}
                                    className="h-8 text-xs bg-black/20 border-white/5"
                                    type="password"
                                />
                            </div>
                        </div>
                    )}
                    {node.httpToolAuthType === 'header' && (
                        <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                                <Label className="text-[10px] font-medium text-zinc-400">Header Name</Label>
                                <Input
                                    placeholder="X-API-KEY"
                                    value={node.httpToolAuthKey || ''}
                                    onChange={(e) => onUpdate(node.id, { httpToolAuthKey: e.target.value })}
                                    className="h-8 text-xs bg-black/20 border-white/5"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[10px] font-medium text-zinc-400">Value</Label>
                                <div className="relative">
                                    <Input
                                        placeholder="Key"
                                        value={node.httpToolAuthToken || ''}
                                        onChange={(e) => onUpdate(node.id, { httpToolAuthToken: e.target.value })}
                                        className="h-8 text-xs pr-7 bg-black/20 border-white/5"
                                        type="password"
                                    />
                                    <VariableInserter fieldName="httpToolAuthToken" isIconTrigger onInsert={(v) => onUpdate(node.id, { httpToolAuthToken: (node.httpToolAuthToken || '') + v })} />
                                </div>
                            </div>
                        </div>
                    )}
                </TabsContent>

                {/* Headers Tab */}
                <TabsContent value="headers" className="mt-3 min-h-[150px]">
                    {renderKeyValueList('httpToolHeaders', 'Header-Name')}
                </TabsContent>

                {/* Query Tab */}
                <TabsContent value="query" className="mt-3 min-h-[150px]">
                    {renderKeyValueList('httpToolParams', 'param_name')}
                </TabsContent>

                {/* Body Tab */}
                <TabsContent value="body" className="mt-3 space-y-3 min-h-[150px]">
                    <div className="space-y-1">
                        <Label className="text-[10px] font-medium text-zinc-400">Tipo de Conteúdo</Label>
                        <Select
                            value={node.httpToolBodyType || 'none'}
                            onValueChange={(v) => onUpdate(node.id, { httpToolBodyType: v as any })}
                        >
                            <SelectTrigger className="h-8 text-xs bg-black/20 border-white/5">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">Nenhum</SelectItem>
                                <SelectItem value="json">JSON (application/json)</SelectItem>
                                <SelectItem value="text">Texto (text/plain)</SelectItem>
                                <SelectItem value="form-data">Multipart (multipart/form-data)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {node.httpToolBodyType !== 'none' && (
                        <div className="space-y-1">
                            <div className="flex justify-between items-center">
                                <Label className="text-[10px] font-medium text-zinc-400">Conteúdo do Corpo</Label>
                                {node.httpToolBodyType === 'json' && (
                                    <Button variant="ghost" size="sm" className="h-5 text-[10px] text-zinc-400 hover:text-white px-2" onClick={() => onUpdate(node.id, { httpToolBody: JSON.stringify({ key: "{{value}}" }, null, 2) })}>
                                        Exemplo
                                    </Button>
                                )}
                            </div>

                            {node.httpToolBodyType === 'form-data' ? (
                                renderKeyValueList('httpToolFormData' as any, 'Key')
                            ) : (
                                <div className="relative">
                                    <Textarea
                                        placeholder={node.httpToolBodyType === 'json' ? "{ 'key': '{{value}}' }" : "Conteúdo raw..."}
                                        value={node.httpToolBody || ''}
                                        onChange={(e) => onUpdate(node.id, { httpToolBody: e.target.value })}
                                        className="bg-black/20 border-white/5 focus:border-primary/50 font-mono text-xs min-h-[120px]"
                                    />
                                    <VariableInserter fieldName="httpToolBody" isIconTrigger onInsert={(v) => onUpdate(node.id, { httpToolBody: (node.httpToolBody || '') + v })} />
                                </div>
                            )}
                        </div>
                    )}
                    {node.httpToolBodyType === 'none' && (
                        <div className="flex flex-col items-center justify-center h-[100px] text-zinc-600 gap-2 text-xs border border-dashed border-zinc-800 rounded">
                            Corpo da requisição vazio.
                        </div>
                    )}
                </TabsContent>
            </Tabs>

            <div className="pt-2 flex gap-2">
                <Button className="flex-1 bg-white/5 border border-white/10 hover:bg-white/10 gap-2 text-zinc-300">
                    <Play className="w-3.5 h-3.5" /> Testar
                </Button>
                <Button className="flex-1 bg-white/5 border border-white/10 hover:bg-white/10 gap-2 text-zinc-300">
                    <History className="w-3.5 h-3.5" /> Histórico
                </Button>
            </div>

            {/* Curl Import Dialog */}
            <Dialog open={isImportCurlOpen} onOpenChange={setIsImportCurlOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Importar cURL</DialogTitle>
                        <DialogDescription>
                            Cole o comando cURL abaixo para preencher automaticamente os dados da requisição.
                        </DialogDescription>
                    </DialogHeader>
                    <Textarea
                        value={curlText}
                        onChange={(e) => setCurlText(e.target.value)}
                        placeholder="curl -X POST https://api.exemplo.com -H 'Content-Type: application/json' -d '{...}'"
                        className="font-mono text-xs h-[200px]"
                    />
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsImportCurlOpen(false)}>Cancelar</Button>
                        <Button onClick={handleImportCurl}>Importar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};
