"use client";

import React from 'react';
import { Bold, Italic, Strikethrough, Code } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NodeData } from '@/lib/types';

interface TextFormatToolbarProps {
    fieldName: keyof NodeData;
    textAreaRef: React.RefObject<HTMLTextAreaElement | HTMLInputElement | null>;
    onUpdate: (id: string, data: Partial<NodeData>) => void;
    nodeId: string;
}

export const TextFormatToolbar: React.FC<TextFormatToolbarProps> = ({ fieldName, textAreaRef, onUpdate, nodeId }) => {
    const handleFormat = (formatChar: string) => {
        const textarea = textAreaRef.current;
        if (!textarea) return;

        const start = textarea.selectionStart ?? 0;
        const end = textarea.selectionEnd ?? 0;
        const selectedText = textarea.value.substring(start, end);
        const newText = `${textarea.value.substring(0, start)}${formatChar}${selectedText}${formatChar}${textarea.value.substring(end)}`;

        onUpdate(nodeId, { [fieldName]: newText });

        // Restore focus and selection
        setTimeout(() => {
            textarea.focus();
            if (selectedText) {
                textarea.setSelectionRange(start + formatChar.length, end + formatChar.length);
            } else {
                textarea.setSelectionRange(start + formatChar.length, start + formatChar.length);
            }
        }, 0);
    };

    return (
        <div className="flex items-center gap-1 mt-1.5 bg-muted p-1 rounded-md" data-no-drag="true">
            <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleFormat('*')} title="Negrito">
                <Bold className="w-4 h-4" />
            </Button>
            <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleFormat('_')} title="Itálico">
                <Italic className="w-4 h-4" />
            </Button>
            <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleFormat('~')} title="Riscado">
                <Strikethrough className="w-4 h-4" />
            </Button>
            <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleFormat('```')} title="Monoespaçado">
                <Code className="w-4 h-4" />
            </Button>
        </div>
    );
};
