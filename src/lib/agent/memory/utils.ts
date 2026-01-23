import crypto from 'node:crypto';
import { MemoryType } from './types';

export const hashMemoryContent = (type: MemoryType, content: string): string =>
    crypto.createHash('sha256').update(`${type}|${content}`).digest('hex');

export const normalizeImportance = (value: number | undefined): number => {
    if (typeof value !== 'number' || Number.isNaN(value)) return 0.5;
    return Math.max(0, Math.min(1, value));
};
