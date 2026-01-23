'use server';

import {
  MemoryItem,
  MemoryProvider,
  MemoryQuery,
  MemoryScope,
  MemoryType,
  MemoryWrite,
  createMemoryStore,
} from './memory-store';
import { memoryCompilerFlow } from '@/ai/flows/memory-compiler-flow';

export interface MemorySettings {
  provider: MemoryProvider;
  scope: MemoryScope;
  scopeKey: string;
  connectionString?: string;
  retentionDays: number;
  maxItems: number;
  minImportance: number;
}

export interface MemoryContext {
  summary: string;
  facts: string[];
  episodes: string[];
  procedures: string[];
  items: MemoryItem[];
}

interface MemoryCandidate {
  type: MemoryType;
  content: string;
  importance?: number;
  ttlDays?: number;
  tags?: string[];
}

const DEFAULT_SETTINGS: Omit<MemorySettings, 'scopeKey'> = {
  provider: 'postgres',
  scope: 'session',
  retentionDays: 14,
  maxItems: 60,
  minImportance: 0.35,
};

const STOPWORDS = new Set([
  'a', 'o', 'os', 'as', 'de', 'do', 'da', 'dos', 'das', 'e', 'ou', 'em', 'no',
  'na', 'nos', 'nas', 'para', 'por', 'com', 'que', 'um', 'uma', 'uns', 'umas',
  'the', 'and', 'or', 'to', 'of', 'in', 'on', 'for', 'with', 'is', 'are', 'be',
]);

const SENSITIVE_PATTERNS = [
  /password/i,
  /senha/i,
  /api[-_ ]?key/i,
  /token/i,
  /secret/i,
  /cvv/i,
  /credit card/i,
  /\b\d{3}-\d{2}-\d{4}\b/,
];

const normalizeText = (text: string): string =>
  text.replace(/\s+/g, ' ').replace(/[ \t]+\n/g, '\n').trim();

const truncateText = (text: string, max = 360): string =>
  text.length > max ? `${text.slice(0, max).trim()}...` : text;

const tokenize = (text: string): string[] =>
  normalizeText(text)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(token => token.length > 2 && !STOPWORDS.has(token));

const jaccardSimilarity = (a: string[], b: string[]): number => {
  if (!a.length || !b.length) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  let intersection = 0;
  for (const token of setA) {
    if (setB.has(token)) intersection += 1;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
};

const recencyScore = (isoDate: string | null | undefined, halfLifeDays: number): number => {
  if (!isoDate) return 0.35;
  const ageMs = Date.now() - new Date(isoDate).getTime();
  const ageDays = Math.max(0, ageMs / (1000 * 60 * 60 * 24));
  return Math.exp(-ageDays / Math.max(1, halfLifeDays));
};

const scoreMemoryItem = (item: MemoryItem, query: string): number => {
  const queryTokens = tokenize(query);
  const contentTokens = tokenize(item.content);
  const relevance = jaccardSimilarity(queryTokens, contentTokens);
  const importance = Math.max(0, Math.min(1, item.importance ?? 0.5));
  const recency = recencyScore(item.createdAt, item.type === 'episodic' ? 7 : 30);

  const weights = item.type === 'semantic'
    ? { relevance: 0.5, importance: 0.4, recency: 0.1 }
    : item.type === 'procedural'
      ? { relevance: 0.6, importance: 0.3, recency: 0.1 }
      : { relevance: 0.4, importance: 0.2, recency: 0.4 };

  return relevance * weights.relevance + importance * weights.importance + recency * weights.recency;
};

const isSensitive = (content: string): boolean =>
  SENSITIVE_PATTERNS.some(pattern => pattern.test(content));

const resolveExpiry = (candidate: MemoryCandidate, settings: MemorySettings): string | null => {
  if (typeof candidate.ttlDays === 'number') {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + candidate.ttlDays);
    return expiresAt.toISOString();
  }
  if (candidate.type === 'episodic') {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + settings.retentionDays);
    return expiresAt.toISOString();
  }
  return null;
};

export const normalizeMemorySettings = (input: Partial<MemorySettings>): MemorySettings => ({
  provider: input.provider ?? DEFAULT_SETTINGS.provider,
  scope: input.scope ?? DEFAULT_SETTINGS.scope,
  scopeKey: input.scopeKey ?? 'session',
  connectionString: input.connectionString,
  retentionDays: input.retentionDays ?? DEFAULT_SETTINGS.retentionDays,
  maxItems: input.maxItems ?? DEFAULT_SETTINGS.maxItems,
  minImportance: input.minImportance ?? DEFAULT_SETTINGS.minImportance,
});

const heuristicMemoryCandidates = (userMessage: string, assistantMessage: string): MemoryCandidate[] => {
  const candidates: MemoryCandidate[] = [];
  const lower = userMessage.toLowerCase();

  const nameMatch = userMessage.match(/\b(meu nome (?:e|é)|me chamo|i am|my name is)\s+([^\.,;]+)/i);
  if (nameMatch && nameMatch[2]) {
    candidates.push({
      type: 'semantic',
      content: `User name: ${nameMatch[2].trim()}`,
      importance: 0.85,
      tags: ['identity'],
    });
  }

  const preferenceMatch = userMessage.match(/\b(prefiro|gosto de|nao gosto de|não gosto de|i like|i prefer|i do not like)\s+([^\.,;]+)/i);
  if (preferenceMatch && preferenceMatch[2]) {
    candidates.push({
      type: 'semantic',
      content: `Preference: ${preferenceMatch[1]} ${preferenceMatch[2].trim()}`,
      importance: 0.7,
      tags: ['preference'],
    });
  }

  const shortEpisode = truncateText(`${normalizeText(userMessage)} | ${normalizeText(assistantMessage)}`, 220);
  if (shortEpisode) {
    candidates.push({
      type: 'episodic',
      content: shortEpisode,
      importance: 0.25,
      ttlDays: 7,
      tags: ['episode'],
    });
  }

  return candidates;
};

const compileMemoryCandidates = async (params: {
  userMessage: string;
  assistantMessage: string;
  systemPrompt?: string;
  modelName?: string;
}): Promise<MemoryCandidate[]> => {
  try {
    const response = await memoryCompilerFlow({
      userMessage: params.userMessage,
      assistantMessage: params.assistantMessage,
      systemPrompt: params.systemPrompt,
      modelName: params.modelName,
    });
    if (response?.items?.length) {
      return response.items.map(item => ({
        type: item.type,
        content: normalizeText(item.content),
        importance: item.importance,
        ttlDays: item.ttlDays,
        tags: item.tags,
      }));
    }
  } catch (error) {
    console.warn('[Memory] Compiler flow failed, using heuristic fallback.', error);
  }

  return heuristicMemoryCandidates(params.userMessage, params.assistantMessage);
};

const filterCandidates = (items: MemoryCandidate[], minImportance: number): MemoryCandidate[] => {
  const dedup = new Map<string, MemoryCandidate>();
  items.forEach(item => {
    const content = normalizeText(item.content);
    if (!content) return;
    const key = `${item.type}:${content.toLowerCase()}`;
    const importance = Math.max(0, Math.min(1, item.importance ?? 0.5));
    if (importance < minImportance) return;
    if (isSensitive(content)) return;
    const existing = dedup.get(key);
    if (!existing || (existing.importance ?? 0) < importance) {
      dedup.set(key, { ...item, content, importance });
    }
  });
  return Array.from(dedup.values());
};

export const loadMemoryContext = async (params: {
  settings: MemorySettings;
  workspaceId: string;
  agentId: string;
  query: string;
}): Promise<MemoryContext> => {
  const settings = normalizeMemorySettings(params.settings);
  const store = createMemoryStore(settings.provider, settings.connectionString);

  await store.deleteExpired?.();

  const queryParams: MemoryQuery = {
    workspaceId: params.workspaceId,
    agentId: params.agentId,
    scope: settings.scope,
    scopeKey: settings.scopeKey,
    limit: Math.min(settings.maxItems * 3, 200),
    minImportance: settings.minImportance,
  };

  const items = await store.query(queryParams);
  const scored = items
    .map(item => ({ item, score: scoreMemoryItem(item, params.query) }))
    .sort((a, b) => b.score - a.score);

  const facts: MemoryItem[] = [];
  const episodes: MemoryItem[] = [];
  const procedures: MemoryItem[] = [];
  const touched: string[] = [];

  for (const { item } of scored) {
    if (item.type === 'semantic' && facts.length < 6) facts.push(item);
    if (item.type === 'episodic' && episodes.length < 4) episodes.push(item);
    if (item.type === 'procedural' && procedures.length < 3) procedures.push(item);
    if ((facts.length >= 6) && (episodes.length >= 4) && (procedures.length >= 3)) break;
  }

  const selectedItems = [...facts, ...episodes, ...procedures];
  selectedItems.forEach(item => touched.push(item.id));
  if (touched.length) await store.touch(touched);

  const summarySections: string[] = [];
  if (facts.length) {
    summarySections.push(`Facts:\n- ${facts.map(f => f.content).join('\n- ')}`);
  }
  if (episodes.length) {
    summarySections.push(`Episodes:\n- ${episodes.map(e => e.content).join('\n- ')}`);
  }
  if (procedures.length) {
    summarySections.push(`Procedures:\n- ${procedures.map(p => p.content).join('\n- ')}`);
  }

  const summary = summarySections.join('\n\n').slice(0, 1600);

  return {
    summary,
    facts: facts.map(item => item.content),
    episodes: episodes.map(item => item.content),
    procedures: procedures.map(item => item.content),
    items: selectedItems,
  };
};

export const recordMemory = async (params: {
  settings: MemorySettings;
  workspaceId: string;
  agentId: string;
  userMessage: string;
  assistantMessage: string;
  systemPrompt?: string;
  modelName?: string;
}): Promise<void> => {
  const settings = normalizeMemorySettings(params.settings);
  const store = createMemoryStore(settings.provider, settings.connectionString);

  const candidates = await compileMemoryCandidates({
    userMessage: params.userMessage,
    assistantMessage: params.assistantMessage,
    systemPrompt: params.systemPrompt,
    modelName: params.modelName,
  });

  const filtered = filterCandidates(candidates, settings.minImportance);
  if (!filtered.length) return;

  const payload: MemoryWrite[] = filtered.map(candidate => ({
    workspaceId: params.workspaceId,
    agentId: params.agentId,
    scope: settings.scope,
    scopeKey: settings.scopeKey,
    type: candidate.type,
    content: truncateText(candidate.content, 500),
    importance: candidate.importance,
    tags: candidate.tags,
    expiresAt: resolveExpiry(candidate, settings),
    source: 'compiler',
  }));

  await store.put(payload);
};
