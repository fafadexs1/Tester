"use client";

import React from 'react';
import { NodeComponentProps } from '../NodeProps';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { VariableInserter } from '../components/VariableInserter';
import { Database } from 'lucide-react';

import { testPostgresConnection, testRedisConnection } from '@/app/actions/connectionTestActions';
import { Loader2, Play } from 'lucide-react';
import { useState } from 'react';
import { useToast } from "@/hooks/use-toast";

export const MemoryNode: React.FC<NodeComponentProps> = ({ node, onUpdate }) => {
    const { toast } = useToast();
    const [testingPostgres, setTestingPostgres] = useState(false);
    const [testingRedis, setTestingRedis] = useState(false);

    const handleTestPostgres = async (connStr: string) => {
        if (!connStr) {
            toast({
                title: "Error",
                description: "Please enter a connection string first.",
                variant: "destructive"
            });
            return;
        }
        setTestingPostgres(true);
        try {
            const res = await testPostgresConnection(connStr);
            if (res.success) {
                toast({
                    title: "Success",
                    description: res.message,
                    variant: "default"
                });
            } else {
                toast({
                    title: "Connection Failed",
                    description: res.message,
                    variant: "destructive"
                });
            }
        } catch (e: any) {
            toast({
                title: "Error",
                description: "Failed to test connection: " + e.message,
                variant: "destructive"
            });
        } finally {
            setTestingPostgres(false);
        }
    };

    const handleTestRedis = async (connStr: string) => {
        if (!connStr) {
            toast({
                title: "Error",
                description: "Please enter a connection URL first.",
                variant: "destructive"
            });
            return;
        }
        setTestingRedis(true);
        try {
            const res = await testRedisConnection(connStr);
            if (res.success) {
                toast({
                    title: "Success",
                    description: res.message,
                    variant: "default"
                });
            } else {
                toast({
                    title: "Connection Failed",
                    description: res.message,
                    variant: "destructive"
                });
            }
        } catch (e: any) {
            toast({
                title: "Error",
                description: "Failed to test connection: " + e.message,
                variant: "destructive"
            });
        } finally {
            setTestingRedis(false);
        }
    };

    return (
        <div className="space-y-3" data-no-drag="true">
            <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-lg bg-zinc-800 flex items-center justify-center border border-zinc-700">
                    <Database className="w-3.5 h-3.5 text-zinc-400" />
                </div>
                <div>
                    <h3 className="text-xs font-bold text-zinc-200">Memory Config</h3>
                    <p className="text-[9px] text-zinc-500">Provider & Retention</p>
                </div>
            </div>

            <div className="space-y-2">
                <div>
                    <Label className="text-[10px] text-zinc-400">Provider</Label>
                    <Select
                        value={node.memoryProvider || 'postgres'}
                        onValueChange={(v) => onUpdate(node.id, { memoryProvider: v as any })}
                    >
                        <SelectTrigger className="h-7 text-xs bg-zinc-900 border-zinc-800 text-zinc-300">
                            <SelectValue placeholder="Select provider" />
                        </SelectTrigger>
                        <SelectContent className="dark bg-zinc-950 border-zinc-800">
                            <SelectItem value="postgres">Postgres (Default)</SelectItem>
                            <SelectItem value="hybrid">Hybrid (Redis + Postgres)</SelectItem>
                            <SelectItem value="redis">Redis (Cache Only)</SelectItem>
                            <SelectItem value="mariadb">MariaDB (Legacy)</SelectItem>
                            <SelectItem value="in-memory">In-Memory (Testing)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {node.memoryProvider === 'hybrid' && (
                    <div className="space-y-2 p-2 bg-zinc-900/50 rounded-md border border-zinc-800/50">
                        <Label className="text-[10px] font-semibold text-zinc-300">Hybrid Configuration</Label>

                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <Label className="text-[9px] text-zinc-500">Redis Connection URL</Label>
                                <button
                                    onClick={() => handleTestRedis(node.memoryRedisConnectionString || '')}
                                    disabled={testingRedis}
                                    className="flex items-center gap-1 text-[9px] text-emerald-400 hover:text-emerald-300 disabled:opacity-50"
                                >
                                    {testingRedis ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Play className="w-2.5 h-2.5" />}
                                    Test
                                </button>
                            </div>
                            <Input
                                placeholder="redis://default:pass@host:6379"
                                value={node.memoryRedisConnectionString || ''}
                                onChange={(e) => onUpdate(node.id, { memoryRedisConnectionString: e.target.value })}
                                className="h-6 text-[10px] bg-zinc-950 border-zinc-800 focus:border-zinc-700 transition-colors"
                            />
                        </div>

                        <div className="flex items-center justify-between">
                            <Label className="text-[9px] text-zinc-500">Cache TTL (s)</Label>
                            <span className="text-[9px] text-zinc-500 font-mono">{node.memoryHybridCacheTTL ?? 3600}</span>
                        </div>
                        <Slider
                            min={60} max={86400} step={60}
                            defaultValue={[node.memoryHybridCacheTTL ?? 3600]}
                            onValueChange={(v) => onUpdate(node.id, { memoryHybridCacheTTL: v[0] })}
                            className="py-1"
                        />
                    </div>
                )}

                {(node.memoryProvider === 'postgres' || node.memoryProvider === 'hybrid') && (
                    <div className="space-y-2 pt-2 border-t border-zinc-800">
                        <Label className="text-[10px] font-semibold text-zinc-400">Advanced Settings</Label>
                        <div className="flex items-center justify-between">
                            <Label className="text-[9px] text-zinc-500">Enable Embeddings (Vector Search)</Label>
                            <input
                                type="checkbox"
                                checked={node.memoryEmbeddingsEnabled ?? false}
                                onChange={(e) => onUpdate(node.id, { memoryEmbeddingsEnabled: e.target.checked })}
                                className="toggle toggle-xs toggle-neutral opacity-80 hover:opacity-100"
                            />
                        </div>
                        {node.memoryEmbeddingsEnabled && (
                            <div>
                                <Label className="text-[9px] text-zinc-500">Embedding Model</Label>
                                <Select
                                    value={node.memoryEmbeddingsModel || 'openai-text-embedding-3-small'}
                                    onValueChange={(v) => onUpdate(node.id, { memoryEmbeddingsModel: v })}
                                >
                                    <SelectTrigger className="h-6 text-[10px] bg-zinc-950 border-zinc-800 text-zinc-300">
                                        <SelectValue placeholder="Select Model" />
                                    </SelectTrigger>
                                    <SelectContent className="dark bg-zinc-950 border-zinc-800">
                                        <SelectItem value="openai-text-embedding-3-small">OpenAI (text-embedding-3-small)</SelectItem>
                                        <SelectItem value="openai-text-embedding-3-large">OpenAI (text-embedding-3-large)</SelectItem>
                                        <SelectItem value="start-mistral-embed">Mistral (embed)</SelectItem>
                                        <SelectItem value="start-mistral-embed">Mistral (embed)</SelectItem>
                                        <SelectItem value="local-minilm">Local (MiniLM-L6 - Fast)</SelectItem>
                                        <SelectItem value="local-e5">Local (E5-Small - High Quality)</SelectItem>
                                        <SelectItem value="local-hybrid">Local (Smart Hybrid: MiniLM + E5)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                    </div>
                )}

                {node.memoryProvider !== 'in-memory' && (
                    <div>
                        <div className="flex justify-between items-center mb-1">
                            <Label className="text-[10px] text-zinc-400">
                                {node.memoryProvider === 'postgres' || node.memoryProvider === 'hybrid'
                                    ? 'Postgres Connection URL (optional)'
                                    : 'Connection String (optional)'}
                            </Label>
                            <button
                                onClick={() => handleTestPostgres(node.memoryConnectionString || '')}
                                disabled={testingPostgres}
                                className="flex items-center gap-1 text-[9px] text-emerald-400 hover:text-emerald-300 disabled:opacity-50"
                            >
                                {testingPostgres ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Play className="w-2.5 h-2.5" />}
                                Test
                            </button>
                        </div>
                        <div className="relative">
                            <Input
                                placeholder={node.memoryProvider === 'postgres' || node.memoryProvider === 'hybrid'
                                    ? "postgresql://user:pass@host:5432/db"
                                    : "Provider URL..."}
                                value={node.memoryConnectionString || ''}
                                onChange={(e) => onUpdate(node.id, { memoryConnectionString: e.target.value })}
                                className="h-7 text-xs pr-7 bg-zinc-950 border-zinc-800 focus:border-zinc-700 placeholder:text-zinc-600"
                            />
                            <VariableInserter fieldName="memoryConnectionString" isIconTrigger onInsert={(v) => onUpdate(node.id, { memoryConnectionString: (node.memoryConnectionString || '') + v })} />
                        </div>
                        <p className="text-[9px] text-zinc-600 mt-1">If empty, uses system default.</p>
                    </div>
                )}

                <div>
                    <Label className="text-[10px] text-zinc-400">Scope</Label>
                    <Select
                        value={node.memoryScope || 'session'}
                        onValueChange={(v) => onUpdate(node.id, { memoryScope: v as any })}
                    >
                        <SelectTrigger className="h-7 text-xs bg-zinc-900 border-zinc-800 text-zinc-300">
                            <SelectValue placeholder="Select scope" />
                        </SelectTrigger>
                        <SelectContent className="dark bg-zinc-950 border-zinc-800">
                            <SelectItem value="session">Session</SelectItem>
                            <SelectItem value="user">User</SelectItem>
                            <SelectItem value="workspace">Workspace</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div>
                    <Label className="text-[10px] text-zinc-400">Scope Key Variable (optional)</Label>
                    <div className="relative">
                        <Input
                            placeholder="{{user_id}}"
                            value={node.memoryScopeKeyVariable || ''}
                            onChange={(e) => onUpdate(node.id, { memoryScopeKeyVariable: e.target.value })}
                            className="h-7 text-xs pr-7 bg-zinc-950 border-zinc-800 focus:border-zinc-700 placeholder:text-zinc-600"
                        />
                        <VariableInserter fieldName="memoryScopeKeyVariable" isIconTrigger onInsert={(v) => onUpdate(node.id, { memoryScopeKeyVariable: (node.memoryScopeKeyVariable || '') + v })} />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <Label className="text-[10px] text-zinc-400">Retention Days</Label>
                        <Input
                            type="number"
                            placeholder="14"
                            value={node.memoryRetentionDays ?? ''}
                            onChange={(e) => onUpdate(node.id, { memoryRetentionDays: e.target.value ? parseInt(e.target.value, 10) : undefined })}
                            className="h-7 text-xs bg-black/20 border-white/5"
                        />
                    </div>
                    <div>
                        <Label className="text-[10px] text-zinc-400">Max Items</Label>
                        <Input
                            type="number"
                            placeholder="60"
                            value={node.memoryMaxItems ?? ''}
                            onChange={(e) => onUpdate(node.id, { memoryMaxItems: e.target.value ? parseInt(e.target.value, 10) : undefined })}
                            className="h-7 text-xs bg-black/20 border-white/5"
                        />
                    </div>
                </div>

                <div>
                    <Label className="text-[10px] text-zinc-400">Min Importance ({node.memoryMinImportance ?? 0.35})</Label>
                    <div className="flex items-center space-x-2 h-7">
                        <Slider
                            min={0} max={1} step={0.05}
                            defaultValue={[node.memoryMinImportance ?? 0.35]}
                            onValueChange={(value) => onUpdate(node.id, { memoryMinImportance: value[0] })}
                            className="flex-1"
                        />
                    </div>
                </div>
            </div>

            <p className="text-[10px] text-muted-foreground">
                Memory is plug-and-play. If omitted, the agent uses built-in session memory.
            </p>
        </div>
    );
};
