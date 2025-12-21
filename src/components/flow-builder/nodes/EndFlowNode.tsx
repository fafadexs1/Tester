"use client";

import React from 'react';
import { NodeComponentProps } from '../NodeProps';

export const EndFlowNode: React.FC<NodeComponentProps> = () => {
    return <p className="text-[10px] text-muted-foreground italic">Este nó encerra o fluxo.</p>;
};
