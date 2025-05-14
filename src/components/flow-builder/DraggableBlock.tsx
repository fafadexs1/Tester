
"use client";

import React from 'react';
import type { DraggableBlockItemData } from '@/lib/types';
import { ITEM_TYPE_BLOCK } from '@/lib/constants';
import { useDrag } from 'react-dnd';
import { motion } from 'framer-motion';

interface DraggableBlockProps extends DraggableBlockItemData {
  icon: React.ReactNode;
}

const DraggableBlock: React.FC<DraggableBlockProps> = React.memo(({ type, label, icon, defaultData }) => {
  const [, drag] = useDrag(() => ({
    type: ITEM_TYPE_BLOCK,
    item: { type, label, defaultData } satisfies DraggableBlockItemData,
  }));

  // Adicione o atributo data-ai-hint aqui se houver um defaultData e ele contiver dataAiHint
  const dataAiHint = defaultData?.dataAiHint;

  return (
    <motion.div
      ref={drag}
      className="flex items-center p-2.5 bg-card border border-border rounded-lg shadow-sm cursor-move hover:shadow-md transition-shadow" // Removido mb-2
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      role="button"
      aria-label={`Arraste o bloco ${label}`}
      {...(dataAiHint && { 'data-ai-hint': dataAiHint })} // Adiciona condicionalmente
    >
      {icon}
      <span className="ml-2.5 text-xs font-medium text-card-foreground truncate min-w-0">{label}</span> {/* Adicionado truncate e min-w-0 */}
    </motion.div>
  );
});

DraggableBlock.displayName = 'DraggableBlock';
export default DraggableBlock;
