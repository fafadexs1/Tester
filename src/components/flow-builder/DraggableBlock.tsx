"use client";

import React from 'react';
import type { DraggableBlockItemData } from '@/lib/types';
import { ITEM_TYPE_BLOCK } from '@/lib/constants';
import { useDrag } from 'react-dnd';
import { cn } from "@/lib/utils";

interface DraggableBlockProps extends DraggableBlockItemData {
  icon: React.ReactNode;
  description?: string;
}

const DraggableBlock = React.memo(React.forwardRef<HTMLDivElement, DraggableBlockProps>(
  ({ type, label, icon, description, defaultData }, ref) => {
    const [{ isDragging }, drag] = useDrag(() => ({
      type: ITEM_TYPE_BLOCK,
      item: { type, label, defaultData } satisfies DraggableBlockItemData,
      collect: (monitor) => ({
        isDragging: !!monitor.isDragging(),
      }),
    }), [type, label, defaultData]);

    const dataAiHint = defaultData?.dataAiHint;

    const combinedRef = (node: HTMLDivElement | null) => {
      drag(node);
      if (typeof ref === 'function') ref(node);
      else if (ref) ref.current = node;
    };

    return (
      <div
        ref={combinedRef}
        className={cn(
          "relative flex items-center p-3 transition-all duration-300 cursor-grab active:cursor-grabbing group",
          "bg-white/[0.03] border border-white/10 rounded-2xl overflow-hidden",
          "hover:bg-white/[0.08] hover:border-white/20 hover:shadow-[0_8px_24px_-12px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.05)]",
          isDragging ? "opacity-40 grayscale" : "opacity-100"
        )}
        role="button"
        data-testid={`draggable-block-${type}`}
        onPointerDown={(e) => e.stopPropagation()}
        {...(dataAiHint && { 'data-ai-hint': dataAiHint })}
      >
        {/* Glow Background Effect */}
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

        <div className="p-2.5 rounded-xl bg-black/40 border border-white/5 ring-1 ring-white/5 group-hover:ring-primary/20 transition-all duration-300">
          {icon}
        </div>

        <div className="ml-3 flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-zinc-100 tracking-tight">{label}</span>
          </div>
          {description && (
            <p className="text-[10px] text-zinc-500 font-medium truncate group-hover:text-zinc-400 transition-colors">
              {description}
            </p>
          )}
        </div>

        {/* Action Hint */}
        <div className="w-1 h-4 bg-white/10 rounded-full opacity-0 group-hover:opacity-100 transition-all -mr-1" />
      </div>
    );
  }
));

DraggableBlock.displayName = 'DraggableBlock';
export default DraggableBlock;
