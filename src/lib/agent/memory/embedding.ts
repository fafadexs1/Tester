
import OpenAI from 'openai';
import { pipeline, env } from '@xenova/transformers';

// Configure transformers.js to use local cache and not unnecessary remote checks if possible
// env.localModelPath = ... (optional: default is usually fine)
env.allowLocalModels = false; // Set to true if you are loading from FS, false allows downloading from HF Hub

// Simple interface for embedding response
export interface EmbeddingResult {
    embedding: number[];
    model: string;
}

const openai = process.env.OPENAI_API_KEY
    ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    : null;

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

    private getCacheKey(text: string, model: string): string {
        return `${model}:${text}`; // Simple hash key
    }

    public async getEmbedding(text: string, modelAlias: string): Promise<number[] | null> {
        // 1. Check Cache
        const cacheKey = this.getCacheKey(text, modelAlias);
        if (this.embeddingCache.has(cacheKey)) {
            // console.log('[Memory] Cache hit for embedding');
            return this.embeddingCache.get(cacheKey)!;
        }

        // 2. Map aliases to HF models
        let modelName = 'Xenova/all-MiniLM-L6-v2'; // Default safe fallback
        if (modelAlias === 'local-minilm') modelName = 'Xenova/all-MiniLM-L6-v2';
        if (modelAlias === 'local-e5') modelName = 'Xenova/e5-small'; // Use Xenova quantized version

        // 3. Load Pipeline (Lazy Loading)
        if (!this.pipelines[modelAlias]) {
            console.log(`[Memory] Loading local embedding model: ${modelName} (${modelAlias})...`);
            try {
                // "feature-extraction" is the task for embeddings
                this.pipelines[modelAlias] = await pipeline('feature-extraction', modelName);
                console.log(`[Memory] Model ${modelName} loaded successfully.`);
            } catch (e) {
                console.error(`[Memory] Failed to load model ${modelName}:`, e);
                return null;
            }
        }

        // 4. Generate Embedding
        try {
            const pipe = this.pipelines[modelAlias];
            // E5 models require "query: " or "passage: " prefix usually, but for raw similarity we often use raw text or generic prefix.
            // For standard memory, raw text is often sufficient. User can prepend prefixes if needed.

            const output = await pipe(text, { pooling: 'mean', normalize: true });

            // Output is a Tensor, we need array
            const embedding = Array.from(output.data) as number[];

            // 5. Update Cache
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
    model: string = 'openai-text-embedding-3-small'
): Promise<EmbeddingResult | null> => {
    if (!text) return null;

    try {
        // 1. OpenAI Providers
        if (model.startsWith('openai-')) {
            if (!openai) {
                // Fail silently or warn? For now warn if someone specifically requested OpenAI but no key
                // console.warn('[Memory] OpenAI API key not found for openai model.');
                // Fallback to local if desired? No, stick to explicit request.
                return null;
            }

            const openAiModel = model.replace('openai-', '');
            const response = await openai.embeddings.create({
                model: openAiModel,
                input: text.replace(/\n/g, ' '),
                encoding_format: 'float',
            });
            return {
                embedding: response.data[0].embedding,
                model: model
            };
        }

        // 2. Local Providers (MiniLM / E5)
        if (model.startsWith('local-')) {
            const service = LocalEmbeddingService.getInstance();
            const embedding = await service.getEmbedding(text, model);

            if (embedding) {
                return {
                    embedding,
                    model
                };
            }
            return null;
        }

        return null;
    } catch (error) {
        console.error(`[Memory] Failed to generate embedding with model ${model}:`, error);
        return null;
    }
};
