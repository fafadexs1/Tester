"use client";

import React, { useState, useEffect, forwardRef } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { cn } from "@/lib/utils";

export interface DebouncedTextareaProps extends Omit<React.ComponentProps<"textarea">, "onChange"> {
    value: string | undefined;
    onChange: (value: string) => void;
    debounce?: number;
}

export const DebouncedTextarea = forwardRef<HTMLTextAreaElement, DebouncedTextareaProps>(({
    value,
    onChange,
    debounce = 300,
    className,
    ...props
}, ref) => {
    const [localValue, setLocalValue] = useState<string>(value || '');

    useEffect(() => {
        setLocalValue(value || '');
    }, [value]);

    useEffect(() => {
        const timer = setTimeout(() => {
            if (localValue !== (value || '')) {
                onChange(localValue);
            }
        }, debounce);

        return () => clearTimeout(timer);
    }, [localValue, debounce, onChange, value]);

    return (
        <Textarea
            {...props}
            ref={ref}
            value={localValue}
            onChange={(e) => setLocalValue(e.target.value)}
            className={cn(className)}
        />
    );
});

DebouncedTextarea.displayName = "DebouncedTextarea";
