
"use client";

import type { DraggableBlockItemData } from '@/lib/types';
import { ITEM_TYPE_BLOCK } from '@/lib/constants';
import { useDrag } from 'react-dnd';
import { motion } from 'framer-motion';
import type React from 'react';

interface DraggableBlockProps extends DraggableBlockItemData {
  icon: React.ReactNode;
}

const DraggableBlock: React.FC<DraggableBlockProps> = React.memo(({ type, label, icon, defaultData }) => {
  const [, drag] = useDrag(() => ({
    type: ITEM_TYPE_BLOCK,
    item: { type, label, defaultData } satisfies DraggableBlockItemData,
  }));

  return (
    <motion.div
      ref={drag}
      className="flex items-center p-3 mb-3 bg-card border border-border rounded-lg shadow-sm cursor-move hover:shadow-md transition-shadow"
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      role="button"
      aria-label={`Drag ${label} block`}
    >
      {icon}
      <span className="ml-3 text-sm font-medium text-card-foreground">{label}</span>
    </motion.div>
  );
});

DraggableBlock.displayName = 'DraggableBlock';
export default DraggableBlock;
