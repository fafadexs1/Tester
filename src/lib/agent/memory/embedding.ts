
import OpenAI from 'openai';
import { pipeline, env } from '@xenova/transformers';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DEFAULT_EMBEDDINGS_MODEL } from './models';

// Configure transformers.js to use local cache and not unnecessary remote checks if possible
// env.localModelPath = ... (optional: default is usually fine)
env.allowLocalModels = false; // Set to true if you are loading from FS, false allows downloading from HF Hub
env.cacheDir = process.env.TRANSFORMERS_CACHE_DIR || join(tmpdir(), 'transformers-cache');

// Simple interface for embedding response
export interface EmbeddingResult {
    embedding: number[];
    model: string;
}

export interface EmbeddingOptions {
    role?: 'query' | 'document';
}

const openai = process.env.OPENAI_API_KEY
    ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    : null;

interface LocalEmbeddingModelSpec {
    modelName: string;
    quantized?: boolean;
    dimension: number;
    queryPrefix?: string;
    documentPrefix?: string;
}

const LOCAL_MODEL_SPECS: Record<string, LocalEmbeddingModelSpec> = {
    'local-embeddinggemma': {
        modelName: 'onnx-community/embeddinggemma-300m-ONNX',
        quantized: true,
        dimension: 768,
    },
    'local-minilm': {
        modelName: 'Xenova/all-MiniLM-L6-v2',
        quantized: true,
        dimension: 384,
    },
    'local-e5': {
        modelName: 'Xenova/e5-small',
        quantized: true,
        dimension: 384,
        queryPrefix: 'query: ',
        documentPrefix: 'passage: ',
    },
};

// Singleton service to hold the pipeline in memory (simulating the 'worker')
class LocalEmbeddingService {
    private static instance: LocalEmbeddingService;
    private pipelines: Record<string, any> = {};
    private embeddingCache: Map<string, number[]> = new Map();
    private cacheLimit = 1000; // Limit cache size

    private constructor() { }

    public static getInstance(): LocalEmbeddingService {
        if (!LocalEmbeddingService.instance) {
            LocalEmbeddingService.instance = new LocalEmbeddingService();
        }
        return LocalEmbeddingService.instance;
    }

    private getCacheKey(text: string, model: string, role: 'query' | 'document'): string {
        return `${model}:${role}:${text}`; // Simple hash key
    }

    private prepareInput(text: string, spec: LocalEmbeddingModelSpec, role: 'query' | 'document'): string {
        const cleaned = text.replace(/\s+/g, ' ').trim();
        if (!cleaned) return '';
        if (role === 'query' && spec.queryPrefix) return `${spec.queryPrefix}${cleaned}`;
        if (role === 'document' && spec.documentPrefix) return `${spec.documentPrefix}${cleaned}`;
        return cleaned;
    }

    public async getEmbedding(
        text: string,
        modelAlias: string,
        options: EmbeddingOptions = {}
    ): Promise<number[] | null> {
        const spec = LOCAL_MODEL_SPECS[modelAlias];
        if (!spec) return null;

        const role = options.role || 'document';
        const preparedInput = this.prepareInput(text, spec, role);
        if (!preparedInput) return null;

        // 1. Check Cache
        const cacheKey = this.getCacheKey(preparedInput, modelAlias, role);
        if (this.embeddingCache.has(cacheKey)) {
            // console.log('[Memory] Cache hit for embedding');
            return this.embeddingCache.get(cacheKey)!;
        }

        // 2. Load Pipeline (Lazy Loading)
        if (!this.pipelines[modelAlias]) {
            console.log(`[Memory] Loading local embedding model: ${spec.modelName} (${modelAlias})...`);
            try {
                // "feature-extraction" is the task for embeddings
                this.pipelines[modelAlias] = await pipeline('feature-extraction', spec.modelName, {
                    quantized: spec.quantized ?? true,
                });
                console.log(`[Memory] Model ${spec.modelName} loaded successfully.`);
            } catch (e) {
                console.error(`[Memory] Failed to load model ${spec.modelName}:`, e);
                return null;
            }
        }

        // 3. Generate embedding
        try {
            const pipe = this.pipelines[modelAlias];
            const output = await pipe(preparedInput, { pooling: 'mean', normalize: true });

            const embedding = Array.from(output.data) as number[];
            if (embedding.length !== spec.dimension) {
                console.warn(
                    `[Memory] Unexpected embedding dimension for ${modelAlias}. Expected ${spec.dimension}, got ${embedding.length}.`
                );
            }

            // 4. Update cache
            if (this.embeddingCache.size >= this.cacheLimit) {
                const firstKey = this.embeddingCache.keys().next().value;
                if (firstKey) this.embeddingCache.delete(firstKey);
            }
            this.embeddingCache.set(cacheKey, embedding);

            return embedding;
        } catch (e) {
            console.error(`[Memory] Error generating embedding for ${modelAlias}:`, e);
            return null;
        }
    }
}

export const generateEmbedding = async (
    text: string,
    model: string = DEFAULT_EMBEDDINGS_MODEL,
    options: EmbeddingOptions = {}
): Promise<EmbeddingResult | null> => {
    if (!text) return null;

    const effectiveModel = model === 'local-hybrid' ? 'local-e5' : model;

    try {
        // 1. OpenAI Providers
        if (effectiveModel.startsWith('openai-')) {
            if (!openai) {
                // Fail silently or warn? For now warn if someone specifically requested OpenAI but no key
                // console.warn('[Memory] OpenAI API key not found for openai model.');
                // Fallback to local if desired? No, stick to explicit request.
                return null;
            }

            const openAiModel = effectiveModel.replace('openai-', '');
            const response = await openai.embeddings.create({
                model: openAiModel,
                input: text.replace(/\n/g, ' '),
                encoding_format: 'float',
            });
            return {
                embedding: response.data[0].embedding,
                model: effectiveModel
            };
        }

        // 2. Local Providers (MiniLM / E5)
        if (effectiveModel.startsWith('local-')) {
            const service = LocalEmbeddingService.getInstance();
            const embedding = await service.getEmbedding(text, effectiveModel, options);

            if (embedding) {
                return {
                    embedding,
                    model: effectiveModel
                };
            }
            return null;
        }

        return null;
    } catch (error) {
        console.error(`[Memory] Failed to generate embedding with model ${effectiveModel}:`, error);
        return null;
    }
};
