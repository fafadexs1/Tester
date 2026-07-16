"use client";

import React from 'react';
import { StopCircle } from 'lucide-react';
import { NodeComponentProps } from '../NodeProps';

export const DialogyCloseChatNode: React.FC<NodeComponentProps> = () => (
  <div className="space-y-2" data-no-drag="true">
    <div className="rounded-xl border border-red-500/15 bg-red-500/5 p-2 text-[10px] leading-relaxed text-red-200/80">
      <span className="mb-1 flex items-center gap-1 font-semibold">
        <StopCircle className="h-3 w-3" /> Encerrar conversa
      </span>
      Encerra o chat atual na Dialogy e finaliza a execução do fluxo.
    </div>
    <p className="text-[9px] text-zinc-500">
      A instância e o chat são identificados automaticamente pelo contexto do fluxo.
    </p>
  </div>
);
