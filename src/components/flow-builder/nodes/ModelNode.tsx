"use client";

import React from 'react';
import { NodeComponentProps } from '../NodeProps';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from '@/components/ui/input';
import { VariableInserter } from '../components/VariableInserter';
import { Bot, Key, Settings2 } from 'lucide-react';

export const ModelNode: React.FC<NodeComponentProps> = ({ node, onUpdate }) => {
    return (
        <div className="space-y-3" data-no-drag="true">
            <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-lg bg-violet-500/20 flex items-center justify-center">
                    <Bot className="w-3.5 h-3.5 text-violet-400" />
                </div>
                <div>
                    <h3 className="text-xs font-bold text-white/90">AI Model Config</h3>
                    <p className="text-[9px] text-zinc-500">Provider & Parameters</p>
                </div>
            </div>

            <div className="space-y-2">
                <div>
                    <Label className="text-[10px] text-zinc-400">Provider</Label>
                    <Select
                        value={node.aiProvider || 'google'}
                        onValueChange={(v) => onUpdate(node.id, { aiProvider: v as any })}
                    >
                        <SelectTrigger className="h-7 text-xs bg-black/20 border-white/5">
                            <SelectValue placeholder="Select provider" />
                        </SelectTrigger>
                        <SelectContent className="dark bg-zinc-950 border-white/10">
                            <SelectItem value="google">Google Gemini</SelectItem>
                            <SelectItem value="openai">OpenAI</SelectItem>
                            <SelectItem value="anthropic">Anthropic Claude</SelectItem>
                            <SelectItem value="groq">Groq</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div>
                    <Label className="text-[10px] text-zinc-400">Model Name</Label>
                    <div className="relative">
                        <Input
                            placeholder="e.g. gemini-2.0-flash"
                            value={node.aiModelName || ''}
                            onChange={(e) => onUpdate(node.id, { aiModelName: e.target.value })}
                            className="h-7 text-xs pr-7 bg-black/20 border-white/5"
                        />
                        <VariableInserter fieldName="aiModelName" isIconTrigger onInsert={(v) => onUpdate(node.id, { aiModelName: (node.aiModelName || '') + v })} />
                    </div>
                </div>

                <div>
                    <Label className="text-[10px] text-zinc-400">API Key (Optional Override)</Label>
                    <div className="relative">
                        <Input
                            type="password"
                            placeholder="Defaults to ENV"
                            value={node.aiApiKey || ''}
                            onChange={(e) => onUpdate(node.id, { aiApiKey: e.target.value })}
                            className="h-7 text-xs pr-7 bg-black/20 border-white/5"
                        />
                        <VariableInserter fieldName="aiApiKey" isIconTrigger onInsert={(v) => onUpdate(node.id, { aiApiKey: (node.aiApiKey || '') + v })} />
                    </div>
                </div>
            </div>
        </div>
    );
};
