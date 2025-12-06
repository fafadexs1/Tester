"use client";

import React from 'react';
import type { DraggableBlockItemData } from '@/lib/types';
import { ITEM_TYPE_BLOCK } from '@/lib/constants';
import { useDrag } from 'react-dnd';

interface DraggableBlockProps extends DraggableBlockItemData {
  icon: React.ReactNode;
  description: string;
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

    // Combinar o ref do forwardRef com o ref do useDrag
    const combinedRef = (node: HTMLDivElement | null) => {
      drag(node);
      if (typeof ref === 'function') {
        ref(node);
      } else if (ref) {
        ref.current = node;
      }
    };

    return (
      <div
        ref={combinedRef}
        className="flex items-start p-3 bg-zinc-900/40 backdrop-blur-sm border border-white/5 rounded-xl shadow-sm cursor-move hover:shadow-[0_0_15px_-3px_rgba(255,255,255,0.05)] hover:border-white/10 hover:bg-zinc-900/60 transition-all duration-300 hover:-translate-y-0.5 group"
        role="button"
        aria-label={`Arraste o bloco ${label}`}
        data-testid={`draggable-block-${type}`}
        style={{ opacity: isDragging ? 0.4 : 1 }}
        onPointerDown={(e) => e.stopPropagation()} // Keep this to prevent accordion interaction on drag start
        {...(dataAiHint && { 'data-ai-hint': dataAiHint })}
      >
        <div className="p-2 bg-white/5 ring-1 ring-white/10 rounded-lg mr-3 group-hover:bg-white/10 transition-colors duration-300">
          {icon}
        </div>
        <div className="flex-1">
          <p className="font-semibold text-sm text-zinc-200 group-hover:text-white transition-colors duration-300">{label}</p>
          <p className="text-xs text-zinc-400 mt-0.5 group-hover:text-zinc-300 transition-colors duration-300">{description}</p>
        </div>
      </div>
    );
  }
));

DraggableBlock.displayName = 'DraggableBlock';
export default DraggableBlock;
