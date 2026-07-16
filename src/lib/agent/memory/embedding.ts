
import OpenAI from 'openai';
import { pipeline, env } from '@huggingface/transformers';
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
    dtype?: 'auto' | 'fp32' | 'fp16' | 'int8' | 'uint8' | 'q8' | 'q4' | 'bnb4' | 'q4f16';
    dimension: number;
    queryPrefix?: string;
    documentPrefix?: string;
}

const LOCAL_MODEL_FALLBACKS: Record<string, string> = {
    'local-embeddinggemma': 'local-e5',
};

const LOCAL_MODEL_SPECS: Record<string, LocalEmbeddingModelSpec> = {
    'local-embeddinggemma': {
        modelName: 'onnx-community/embeddinggemma-300m-ONNX',
        dtype: 'q8',
        dimension: 768,
    },
    'local-minilm': {
        modelName: 'Xenova/all-MiniLM-L6-v2',
        dtype: 'q8',
        dimension: 384,
    },
    'local-e5': {
        modelName: 'Xenova/e5-small',
        dtype: 'q8',
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
    private failedModels: Set<string> = new Set();
    private aliasRedirects: Map<string, string> = new Map();
    private loggedFallbacks: Set<string> = new Set();
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

    private getPreferredAlias(modelAlias: string): string {
        return this.aliasRedirects.get(modelAlias) || modelAlias;
    }

    private registerFallback(requestedAlias: string, failedAlias: string): string | null {
        const fallbackAlias = LOCAL_MODEL_FALLBACKS[failedAlias];
        if (!fallbackAlias || fallbackAlias === failedAlias) {
            return null;
        }

        this.aliasRedirects.set(requestedAlias, fallbackAlias);
        const logKey = `${requestedAlias}->${fallbackAlias}`;
        if (!this.loggedFallbacks.has(logKey)) {
            this.loggedFallbacks.add(logKey);
            console.warn(
                `[Memory] Falling back from ${failedAlias} to ${fallbackAlias} for embeddings after local model load failure.`
            );
        }
        return fallbackAlias;
    }

    private async ensurePipeline(modelAlias: string, spec: LocalEmbeddingModelSpec): Promise<any | null> {
        if (this.pipelines[modelAlias]) {
            return this.pipelines[modelAlias];
        }

        if (this.failedModels.has(modelAlias)) {
            return null;
        }

        console.log(`[Memory] Loading local embedding model: ${spec.modelName} (${modelAlias})...`);
        try {
            this.pipelines[modelAlias] = await pipeline('feature-extraction', spec.modelName, {
                dtype: spec.dtype ?? 'q8',
            });
            console.log(`[Memory] Model ${spec.modelName} loaded successfully.`);
            return this.pipelines[modelAlias];
        } catch (e) {
            this.failedModels.add(modelAlias);
            delete this.pipelines[modelAlias];
            console.error(`[Memory] Failed to load model ${spec.modelName}:`, e);
            return null;
        }
    }

    public async getEmbedding(
        text: string,
        modelAlias: string,
        options: EmbeddingOptions = {}
    ): Promise<number[] | null> {
        const role = options.role || 'document';
        const attemptedAliases = new Set<string>();
        let activeAlias = this.getPreferredAlias(modelAlias);

        while (activeAlias && !attemptedAliases.has(activeAlias)) {
            attemptedAliases.add(activeAlias);

            const spec = LOCAL_MODEL_SPECS[activeAlias];
            if (!spec) return null;

            const preparedInput = this.prepareInput(text, spec, role);
            if (!preparedInput) return null;

            const cacheKey = this.getCacheKey(preparedInput, activeAlias, role);
            if (this.embeddingCache.has(cacheKey)) {
                return this.embeddingCache.get(cacheKey)!;
            }

            const pipe = await this.ensurePipeline(activeAlias, spec);
            if (!pipe) {
                const fallbackAlias = this.registerFallback(modelAlias, activeAlias);
                if (fallbackAlias) {
                    activeAlias = fallbackAlias;
                    continue;
                }
                return null;
            }

            try {
                const output = await pipe(preparedInput, { pooling: 'mean', normalize: true });
                const embedding = Array.from(output.data) as number[];
                if (embedding.length !== spec.dimension) {
                    console.warn(
                        `[Memory] Unexpected embedding dimension for ${activeAlias}. Expected ${spec.dimension}, got ${embedding.length}.`
                    );
                }

                if (this.embeddingCache.size >= this.cacheLimit) {
                    const firstKey = this.embeddingCache.keys().next().value;
                    if (firstKey) this.embeddingCache.delete(firstKey);
                }
                this.embeddingCache.set(cacheKey, embedding);

                if (activeAlias !== modelAlias) {
                    this.aliasRedirects.set(modelAlias, activeAlias);
                }

                return embedding;
            } catch (e) {
                this.failedModels.add(activeAlias);
                delete this.pipelines[activeAlias];
                console.error(`[Memory] Error generating embedding for ${activeAlias}:`, e);
                const fallbackAlias = this.registerFallback(modelAlias, activeAlias);
                if (fallbackAlias) {
                    activeAlias = fallbackAlias;
                    continue;
                }
                return null;
            }
        }

        return null;
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
