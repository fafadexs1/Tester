"use client";

import React, { useState, useEffect, forwardRef } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from "@/lib/utils";

export interface DebouncedInputProps extends Omit<React.ComponentProps<"input">, "onChange"> {
    value: string | number | undefined;
    onChange: (value: string | number) => void;
    debounce?: number;
}

export const DebouncedInput = forwardRef<HTMLInputElement, DebouncedInputProps>(({
    value,
    onChange,
    debounce = 300,
    className,
    ...props
}, ref) => {
    const [localValue, setLocalValue] = useState<string | number>(value || '');

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
        <Input
            {...props}
            ref={ref}
            value={localValue}
            onChange={(e) => setLocalValue(e.target.value)}
            className={cn(className)}
        />
    );
});

DebouncedInput.displayName = "DebouncedInput";
