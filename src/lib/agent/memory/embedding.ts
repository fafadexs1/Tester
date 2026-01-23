
import OpenAI from 'openai';

// Simple interface for embedding response
export interface EmbeddingResult {
    embedding: number[];
    model: string;
}

const openai = process.env.OPENAI_API_KEY
    ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    : null;

export const generateEmbedding = async (
    text: string,
    model: string = 'openai-text-embedding-3-small'
): Promise<EmbeddingResult | null> => {
    if (!text) return null;

    try {
        // 1. OpenAI Providers
        if (model.startsWith('openai-')) {
            if (!openai) {
                console.warn('[Memory] OpenAI API key not found, skipping embedding generation.');
                return null;
            }

            const openAiModel = model.replace('openai-', ''); // e.g. text-embedding-3-small

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

        // 2. Future: Local / Other providers
        if (model === 'local-bert') {
            console.warn('[Memory] Local BERT embedding not yet implemented.');
            return null;
        }

        return null;
    } catch (error) {
        console.error(`[Memory] Failed to generate embedding with model ${model}:`, error);
        return null;
    }
};
