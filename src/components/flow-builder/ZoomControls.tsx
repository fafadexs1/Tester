"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { cn } from "@/lib/utils";

interface ZoomControlsProps {
    onZoom: (direction: 'in' | 'out' | 'reset') => void;
    currentZoomLevel: number;
}

export const ZoomControls: React.FC<ZoomControlsProps> = ({ onZoom, currentZoomLevel }) => {
    return (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
            <div className="neo-glass pointer-events-auto rounded-2xl p-1.5 flex items-center gap-1 border-white/10 shadow-[0_16px_32px_-12px_rgba(0,0,0,0.5)]">
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-xl hover:bg-white/10 text-zinc-400 hover:text-white transition-all"
                    onClick={() => onZoom('out')}
                >
                    <ZoomOut className="w-4 h-4" />
                </Button>

                <div className="px-3 min-w-[60px] text-center">
                    <span className="text-[10px] font-mono font-bold text-white/60 tracking-tight">
                        {Math.round(currentZoomLevel * 100)}%
                    </span>
                </div>

                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-xl hover:bg-white/10 text-zinc-400 hover:text-white transition-all"
                    onClick={() => onZoom('in')}
                >
                    <ZoomIn className="w-4 h-4" />
                </Button>

                <div className="w-px h-4 bg-white/10 mx-1" />

                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-xl hover:bg-white/10 text-zinc-400 hover:text-white transition-all"
                    onClick={() => onZoom('reset')}
                    title="Reset Zoom"
                >
                    <Maximize2 className="w-3.5 h-3.5" />
                </Button>
            </div>
        </div>
    );
};
