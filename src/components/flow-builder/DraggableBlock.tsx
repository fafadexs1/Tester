
"use client";

import React from 'react'; // Ensure React is imported
import type { DraggableBlockItemData } from '@/lib/types';
import { ITEM_TYPE_BLOCK } from '@/lib/constants';
import { useDrag } from 'react-dnd';
// import { motion } from 'framer-motion'; // Temporarily remove framer-motion

interface DraggableBlockProps extends DraggableBlockItemData {
  icon: React.ReactNode;
}

const DraggableBlock: React.FC<DraggableBlockProps> = React.memo(({ type, label, icon, defaultData }) => {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: ITEM_TYPE_BLOCK,
    item: { type: type, label: label, defaultData: defaultData } satisfies DraggableBlockItemData,
    collect: (monitor) => ({
      isDragging: !!monitor.isDragging(),
    }),
  }), [type, label, defaultData]);

  const dataAiHint = defaultData?.dataAiHint;

  return (
    <div // Changed from motion.div
      ref={drag}
      className="flex items-center p-2.5 bg-card border border-border rounded-lg shadow-sm cursor-move hover:shadow-md transition-shadow"
      // whileHover={{ scale: 1.02 }} // Temporarily remove framer-motion props
      // whileTap={{ scale: 0.98 }}  // Temporarily remove framer-motion props
      role="button"
      aria-label={`Arraste o bloco ${label}`}
      data-testid={`draggable-block-${type}`}
      style={{ opacity: isDragging ? 0.5 : 1 }}
      {...(dataAiHint && { 'data-ai-hint': dataAiHint })}
    >
      {icon}
      <span className="ml-2.5 text-xs font-medium text-card-foreground truncate min-w-0">{label}</span>
    </div>
  );
});

DraggableBlock.displayName = 'DraggableBlock';
export default DraggableBlock;
