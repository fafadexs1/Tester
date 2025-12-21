"use client";

import React, { useRef } from 'react';
import { NodeComponentProps } from '../NodeProps';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { VariableInserter } from '../components/VariableInserter';
import { TextFormatToolbar } from '../components/TextFormatToolbar';
import { ApiResponseSettings } from '../components/ApiResponseSettings';

export const FileUploadNode: React.FC<NodeComponentProps> = ({ node, onUpdate }) => {
    const inputRef = useRef<HTMLInputElement>(null);

    return (
        <div className="space-y-2" data-no-drag="true">
            <div>
                <Label htmlFor={`${node.id}-uploadprompt`} className="text-[10px] font-medium text-zinc-400 mb-1 block">Texto do Prompt de Upload</Label>
                <div className="relative">
                    <Input ref={inputRef} id={`${node.id}-uploadprompt`} placeholder="Por favor, envie seu documento." value={node.uploadPromptText || ''} onChange={(e) => onUpdate(node.id, { uploadPromptText: e.target.value })} className="h-7 text-xs pr-7 bg-black/20 border-white/5 focus:border-primary/50" />
                    <VariableInserter fieldName="uploadPromptText" isIconTrigger onInsert={(v) => onUpdate(node.id, { uploadPromptText: (node.uploadPromptText || '') + v })} />
                </div>
                <TextFormatToolbar fieldName="uploadPromptText" textAreaRef={inputRef as React.RefObject<HTMLInputElement>} onUpdate={onUpdate} nodeId={node.id} />
            </div>
            <div>
                <Label htmlFor={`${node.id}-filefilter`} className="text-[10px] font-medium text-zinc-400 mb-1 block">Filtro de Tipo de Arquivo</Label>
                <Input id={`${node.id}-filefilter`} placeholder="image/*, .pdf, .docx" value={node.fileTypeFilter || ''} onChange={(e) => onUpdate(node.id, { fileTypeFilter: e.target.value })} className="h-7 text-xs bg-black/20 border-white/5 focus:border-primary/50" />
            </div>
            <div>
                <Label htmlFor={`${node.id}-maxsize`} className="text-[10px] font-medium text-zinc-400 mb-1 block">Tam. Máx. Arquivo (MB)</Label>
                <Input id={`${node.id}-maxsize`} type="number" placeholder="5" value={node.maxFileSizeMB ?? ''} onChange={(e) => onUpdate(node.id, { maxFileSizeMB: e.target.value ? parseInt(e.target.value, 10) : undefined })} className="h-7 text-xs bg-black/20 border-white/5 focus:border-primary/50" />
            </div>
            <div>
                <Label htmlFor={`${node.id}-fileurlvar`} className="text-[10px] font-medium text-zinc-400 mb-1 block">Salvar URL na Variável</Label>
                <Input id={`${node.id}-fileurlvar`} placeholder="url_do_arquivo" value={node.fileUrlVariable || ''} onChange={(e) => onUpdate(node.id, { fileUrlVariable: e.target.value })} className="h-7 text-xs bg-black/20 border-white/5 focus:border-primary/50" />
            </div>
            <ApiResponseSettings node={node} onUpdate={onUpdate} />
        </div>
    );
};
