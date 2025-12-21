"use client";

import React, { useRef } from 'react';
import { NodeComponentProps } from '../NodeProps';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { VariableInserter } from '../components/VariableInserter';
import { TextFormatToolbar } from '../components/TextFormatToolbar';

export const SendEmailNode: React.FC<NodeComponentProps> = ({ node, onUpdate }) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const textAreaRef = useRef<HTMLTextAreaElement>(null);

    return (
        <div className="space-y-2" data-no-drag="true">
            <div>
                <Label htmlFor={`${node.id}-emailto`} className="text-[10px] font-medium text-zinc-400 mb-1 block">Para (E-mail ou {"{{variavel}}"})</Label>
                <div className="relative">
                    <Input id={`${node.id}-emailto`} type="email" placeholder="destinatario@exemplo.com ou {{email_cliente}}" value={node.emailTo || ''} onChange={(e) => onUpdate(node.id, { emailTo: e.target.value })} className="h-7 text-xs pr-7 bg-black/20 border-white/5 focus:border-primary/50" />
                    <VariableInserter fieldName="emailTo" isIconTrigger onInsert={(v) => onUpdate(node.id, { emailTo: (node.emailTo || '') + v })} />
                </div>
            </div>
            <div>
                <Label htmlFor={`${node.id}-emailsubject`} className="text-[10px] font-medium text-zinc-400 mb-1 block">Assunto</Label>
                <div className="relative">
                    <Input ref={inputRef} id={`${node.id}-emailsubject`} placeholder="Assunto do seu e-mail" value={node.emailSubject || ''} onChange={(e) => onUpdate(node.id, { emailSubject: e.target.value })} className="h-7 text-xs pr-7 bg-black/20 border-white/5 focus:border-primary/50" />
                    <VariableInserter fieldName="emailSubject" isIconTrigger onInsert={(v) => onUpdate(node.id, { emailSubject: (node.emailSubject || '') + v })} />
                </div>
                <TextFormatToolbar fieldName="emailSubject" textAreaRef={inputRef as React.RefObject<HTMLInputElement>} onUpdate={onUpdate} nodeId={node.id} />
            </div>
            <div>
                <Label htmlFor={`${node.id}-emailbody`} className="text-[10px] font-medium text-zinc-400 mb-1 block">Corpo do E-mail (HTML ou Texto)</Label>
                <div className="relative">
                    <Textarea ref={textAreaRef} id={`${node.id}-emailbody`} placeholder="Olá {{input.nome_cliente}},\n\nSua mensagem aqui." value={node.emailBody || ''} onChange={(e) => onUpdate(node.id, { emailBody: e.target.value })} rows={4} className="text-xs pr-8 bg-black/20 border-white/5 focus:border-primary/50 resize-none" />
                    <VariableInserter fieldName="emailBody" isIconTrigger isTextarea onInsert={(v) => onUpdate(node.id, { emailBody: (node.emailBody || '') + v })} />
                </div>
                <TextFormatToolbar fieldName="emailBody" textAreaRef={textAreaRef as React.RefObject<HTMLTextAreaElement>} onUpdate={onUpdate} nodeId={node.id} />
            </div>
            <div>
                <Label htmlFor={`${node.id}-emailfrom`} className="text-[10px] font-medium text-zinc-400 mb-1 block">De (E-mail - opcional)</Label>
                <div className="relative">
                    <Input id={`${node.id}-emailfrom`} type="email" placeholder="remetente@exemplo.com" value={node.emailFrom || ''} onChange={(e) => onUpdate(node.id, { emailFrom: e.target.value })} className="h-7 text-xs pr-7 bg-black/20 border-white/5 focus:border-primary/50" />
                    <VariableInserter fieldName="emailFrom" isIconTrigger onInsert={(v) => onUpdate(node.id, { emailFrom: (node.emailFrom || '') + v })} />
                </div>
            </div>
        </div>
    );
};
