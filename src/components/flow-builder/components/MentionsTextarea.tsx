"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { Wrench, BookOpen, Globe, Zap } from 'lucide-react';

export interface MentionOption {
    id: string;
    label: string;
    type: 'tool' | 'knowledge' | 'http' | 'capability';
    value: string;
}

interface MentionsTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
    value: string;
    onUpdate: (value: string) => void;
    options: MentionOption[];
    triggerChar?: string;
}

export const MentionsTextarea = React.forwardRef<HTMLTextAreaElement, MentionsTextareaProps>(({
    value,
    onUpdate,
    options,
    triggerChar = '@',
    className,
    ...props
}, ref) => {
    const internalRef = useRef<HTMLTextAreaElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const [showDropdown, setShowDropdown] = useState(false);
    const [query, setQuery] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });

    // Sync refs
    useEffect(() => {
        if (!ref) return;
        if (typeof ref === 'function') {
            ref(internalRef.current);
        } else {
            (ref as React.MutableRefObject<HTMLTextAreaElement | null>).current = internalRef.current;
        }
    }, [ref]);

    const filteredOptions = options.filter(opt =>
        opt.label.toLowerCase().includes(query.toLowerCase())
    );

    const checkForTrigger = useCallback(() => {
        const el = internalRef.current;
        if (!el) return;

        const cursor = el.selectionStart;
        const text = el.value;
        const textBefore = text.slice(0, cursor);

        // Find the last @ before cursor
        const lastTriggerIndex = textBefore.lastIndexOf(triggerChar);

        if (lastTriggerIndex === -1) {
            setShowDropdown(false);
            return;
        }

        // Check if there's a space between @ and cursor (means we're not in a mention anymore)
        const textAfterTrigger = textBefore.slice(lastTriggerIndex + 1);
        if (textAfterTrigger.includes(' ') || textAfterTrigger.includes('\n')) {
            setShowDropdown(false);
            return;
        }

        // We're in a mention!
        setQuery(textAfterTrigger);
        setShowDropdown(true);
        setSelectedIndex(0);

        // Position the dropdown near the cursor (simplified)
        const rect = el.getBoundingClientRect();
        setDropdownPosition({
            top: rect.height + 4,
            left: 0
        });
    }, [triggerChar]);

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        onUpdate(e.target.value);
    };

    // Check for trigger after value updates
    useEffect(() => {
        checkForTrigger();
    }, [value, checkForTrigger]);

    const insertMention = (option: MentionOption) => {
        const el = internalRef.current;
        if (!el) return;

        const cursor = el.selectionStart;
        const text = value;
        const textBefore = text.slice(0, cursor);
        const lastTriggerIndex = textBefore.lastIndexOf(triggerChar);

        if (lastTriggerIndex !== -1) {
            const before = text.slice(0, lastTriggerIndex);
            const after = text.slice(cursor);
            const newText = `${before}${triggerChar}${option.label} ${after}`;
            onUpdate(newText);
            setShowDropdown(false);

            // Restore focus and cursor position
            setTimeout(() => {
                el.focus();
                const newPos = lastTriggerIndex + 1 + option.label.length + 1;
                el.setSelectionRange(newPos, newPos);
            }, 10);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (!showDropdown || filteredOptions.length === 0) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(i => (i + 1) % filteredOptions.length);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(i => (i - 1 + filteredOptions.length) % filteredOptions.length);
        } else if (e.key === 'Enter' || e.key === 'Tab') {
            if (showDropdown && filteredOptions.length > 0) {
                e.preventDefault();
                insertMention(filteredOptions[selectedIndex]);
            }
        } else if (e.key === 'Escape') {
            setShowDropdown(false);
        }
    };

    const getIcon = (type: MentionOption['type']) => {
        switch (type) {
            case 'tool': return <Wrench className="w-3 h-3 text-amber-500" />;
            case 'knowledge': return <BookOpen className="w-3 h-3 text-blue-500" />;
            case 'http': return <Globe className="w-3 h-3 text-green-500" />;
            case 'capability': return <Zap className="w-3 h-3 text-purple-500" />;
        }
    };

    return (
        <div className="relative w-full h-full">
            <Textarea
                ref={internalRef}
                value={value}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
                className={cn("w-full resize-none", className)}
                {...props}
            />

            {showDropdown && filteredOptions.length > 0 && (
                <div
                    ref={dropdownRef}
                    className="absolute z-50 bg-zinc-950 border border-white/10 rounded-md shadow-lg max-h-48 overflow-y-auto"
                    style={{ top: dropdownPosition.top, left: dropdownPosition.left, minWidth: '200px' }}
                >
                    {filteredOptions.map((opt, index) => (
                        <div
                            key={opt.id}
                            className={cn(
                                "flex items-center gap-2 px-3 py-2 cursor-pointer text-sm",
                                index === selectedIndex ? "bg-white/10" : "hover:bg-white/5"
                            )}
                            onMouseDown={(e) => {
                                e.preventDefault(); // Prevent blur
                                insertMention(opt);
                            }}
                            onMouseEnter={() => setSelectedIndex(index)}
                        >
                            {getIcon(opt.type)}
                            <span className="text-white font-medium">{opt.label}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
});

MentionsTextarea.displayName = "MentionsTextarea";
