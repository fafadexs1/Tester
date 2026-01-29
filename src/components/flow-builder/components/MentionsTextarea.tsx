import React, { useState, useRef, useEffect } from 'react';
import { Textarea } from '@/components/ui/textarea';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { Wrench, BookOpen, Globe, Zap } from 'lucide-react';

export interface MentionOption {
    id: string;
    label: string;
    type: 'tool' | 'knowledge' | 'http' | 'capability';
    value: string; // The slug or replacement text
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

    // Sync ref
    useEffect(() => {
        if (!ref) return;
        if (typeof ref === 'function') {
            ref(internalRef.current);
        } else {
            (ref as React.MutableRefObject<HTMLTextAreaElement | null>).current = internalRef.current;
        }
    }, [ref]);

    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');

    const handleCursorActivity = () => {
        const el = internalRef.current;
        if (!el) return;

        // Use setTimeout to ensure we get the updated selection after the event
        requestAnimationFrame(() => {
            const cursor = el.selectionStart;
            const textBefore = el.value.slice(0, cursor);
            const words = textBefore.split(/\s+/);
            const currentWord = words[words.length - 1];

            if (currentWord && currentWord.startsWith(triggerChar)) {
                setQuery(currentWord.slice(1));
                setOpen(true);
            } else {
                setOpen(false);
            }
        });
    };

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        onUpdate(e.target.value);
        // We call handleCursorActivity here but might need to wait for render/value update? 
        // passing e.target.value directly if simplified, but cursor pos is key.
        handleCursorActivity();
    };

    const handleSelect = (option: MentionOption) => {
        const el = internalRef.current;
        if (!el) return;

        const text = value;
        const selectionStart = el.selectionStart;
        const textBeforeCursor = text.slice(0, selectionStart);

        // Trigger is either after last space or at start
        const triggerStart = textBeforeCursor.lastIndexOf(triggerChar);

        if (triggerStart !== -1) {
            const beforeMention = text.slice(0, triggerStart);
            const afterMention = text.slice(selectionStart);
            // Safety: Ensure we don't double space if there's already one
            const newText = `${beforeMention}${triggerChar}${option.label} ${afterMention}`;

            onUpdate(newText);
            setOpen(false);

            setTimeout(() => {
                el.focus();
                const newPos = triggerStart + 1 + option.label.length + 1;
                el.setSelectionRange(newPos, newPos);
            }, 0);
        }
    };

    const filteredOptions = options.filter(opt =>
        opt.label.toLowerCase().includes(query.toLowerCase()) ||
        opt.value.toLowerCase().includes(query.toLowerCase())
    );

    return (
        <Popover open={open && filteredOptions.length > 0} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <div className="relative w-full h-full">
                    <Textarea
                        ref={internalRef}
                        value={value}
                        onChange={handleChange}
                        onKeyUp={handleCursorActivity}
                        onClick={handleCursorActivity}
                        className={cn("w-full resize-none", className)}
                        {...props}
                    />
                </div>
            </PopoverTrigger>
            <PopoverContent
                className="w-[250px] p-0 bg-zinc-950 border-white/10"
                align="start"
                side="bottom"
                onOpenAutoFocus={(e) => e.preventDefault()}
            >
                <Command className="bg-zinc-950 text-zinc-100" shouldFilter={false}>
                    <CommandList>
                        <CommandGroup heading="Tools & Abilities" className="text-zinc-400">
                            {filteredOptions.length === 0 && <CommandEmpty>No tools found.</CommandEmpty>}
                            {filteredOptions.map((opt) => (
                                <CommandItem
                                    key={opt.id}
                                    value={opt.label}
                                    onSelect={() => handleSelect(opt)}
                                    className="cursor-pointer aria-selected:bg-white/10"
                                >
                                    <div className="flex items-center gap-2">
                                        {opt.type === 'tool' && <Wrench className="w-3 h-3 text-amber-500" />}
                                        {opt.type === 'knowledge' && <BookOpen className="w-3 h-3 text-blue-500" />}
                                        {opt.type === 'http' && <Globe className="w-3 h-3 text-green-500" />}
                                        {opt.type === 'capability' && <Zap className="w-3 h-3 text-purple-500" />}
                                        <span className="font-medium text-xs text-white">{opt.label}</span>
                                        <span className="text-[10px] text-zinc-500 ml-auto font-mono truncate max-w-[80px]">{opt.value}</span>
                                    </div>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
});
MentionsTextarea.displayName = "MentionsTextarea";
