export const DEFAULT_EMBEDDINGS_MODEL = 'local-embeddinggemma';

export const EMBEDDING_MODEL_OPTIONS = [
  {
    value: DEFAULT_EMBEDDINGS_MODEL,
    label: 'Local (EmbeddingGemma 768d)',
    hint: 'Recommended local default for memory and retrieval.',
  },
  {
    value: 'openai-text-embedding-3-small',
    label: 'OpenAI (text-embedding-3-small)',
    hint: 'Cloud fallback, 1536 dimensions.',
  },
  {
    value: 'openai-text-embedding-3-large',
    label: 'OpenAI (text-embedding-3-large)',
    hint: 'Cloud high-capacity option.',
  },
  {
    value: 'local-e5',
    label: 'Local (E5-Small 384d - Legacy)',
    hint: 'Legacy local model kept for compatibility.',
  },
  {
    value: 'local-minilm',
    label: 'Local (MiniLM-L6 384d - Legacy)',
    hint: 'Legacy fast local model kept for compatibility.',
  },
  {
    value: 'local-hybrid',
    label: 'Local (Hybrid E5 + MiniLM - Legacy)',
    hint: 'Legacy hybrid strategy kept for compatibility.',
  },
] as const;

const LEGACY_MODEL_SET = new Set<string>(['local-e5', 'local-minilm', 'local-hybrid']);

export const isLegacyEmbeddingModel = (model?: string | null): boolean =>
  Boolean(model && LEGACY_MODEL_SET.has(model));
