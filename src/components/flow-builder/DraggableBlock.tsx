
"use client";

import React from 'react';
import type { DraggableBlockItemData } from '@/lib/types';
import { ITEM_TYPE_BLOCK } from '@/lib/constants';
import { useDrag } from 'react-dnd';
import { motion } from 'framer-motion';

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
    const combinedRef = (node: HTMLDivElement) => {
        drag(node);
        if (typeof ref === 'function') {
            ref(node);
        } else if (ref) {
            ref.current = node;
        }
    };

    return (
      <motion.div
        ref={combinedRef}
        className="flex items-start p-3 bg-card border border-border rounded-lg shadow-sm cursor-move hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5"
        role="button"
        aria-label={`Arraste o bloco ${label}`}
        data-testid={`draggable-block-${type}`}
        style={{ opacity: isDragging ? 0.4 : 1 }}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        {...(dataAiHint && { 'data-ai-hint': dataAiHint })}
      >
        <div className="p-2 bg-muted rounded-md mr-3">
          {icon}
        </div>
        <div className="flex-1">
          <p className="font-semibold text-sm text-card-foreground">{label}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        </div>
      </motion.div>
    );
  }
));

DraggableBlock.displayName = 'DraggableBlock';
export default DraggableBlock;
