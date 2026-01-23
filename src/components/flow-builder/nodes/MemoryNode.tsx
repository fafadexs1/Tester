"use client";

import React from 'react';
import { NodeComponentProps } from '../NodeProps';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { VariableInserter } from '../components/VariableInserter';
import { Database } from 'lucide-react';

export const MemoryNode: React.FC<NodeComponentProps> = ({ node, onUpdate }) => {
    return (
        <div className="space-y-3" data-no-drag="true">
            <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-lg bg-sky-500/20 flex items-center justify-center">
                    <Database className="w-3.5 h-3.5 text-sky-400" />
                </div>
                <div>
                    <h3 className="text-xs font-bold text-white/90">Memory Config</h3>
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
                        <SelectTrigger className="h-7 text-xs bg-black/20 border-white/5">
                            <SelectValue placeholder="Select provider" />
                        </SelectTrigger>
                        <SelectContent className="dark bg-zinc-950 border-white/10">
                            <SelectItem value="postgres">Postgres (default)</SelectItem>
                            <SelectItem value="redis">Redis</SelectItem>
                            <SelectItem value="mariadb">MariaDB</SelectItem>
                            <SelectItem value="in-memory">In-Memory</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div>
                    <Label className="text-[10px] text-zinc-400">Connection String (optional)</Label>
                    <div className="relative">
                        <Input
                            placeholder="postgres://user:pass@host:5432/db"
                            value={node.memoryConnectionString || ''}
                            onChange={(e) => onUpdate(node.id, { memoryConnectionString: e.target.value })}
                            className="h-7 text-xs pr-7 bg-black/20 border-white/5"
                        />
                        <VariableInserter fieldName="memoryConnectionString" isIconTrigger onInsert={(v) => onUpdate(node.id, { memoryConnectionString: (node.memoryConnectionString || '') + v })} />
                    </div>
                </div>

                <div>
                    <Label className="text-[10px] text-zinc-400">Scope</Label>
                    <Select
                        value={node.memoryScope || 'session'}
                        onValueChange={(v) => onUpdate(node.id, { memoryScope: v as any })}
                    >
                        <SelectTrigger className="h-7 text-xs bg-black/20 border-white/5">
                            <SelectValue placeholder="Select scope" />
                        </SelectTrigger>
                        <SelectContent className="dark bg-zinc-950 border-white/10">
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
                            className="h-7 text-xs pr-7 bg-black/20 border-white/5"
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
