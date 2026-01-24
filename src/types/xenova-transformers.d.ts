// Type declarations for @xenova/transformers
declare module '@xenova/transformers' {
    export interface PipelineResult {
        data: Float32Array | number[];
    }

    export type Pipeline = (
        text: string,
        options?: { pooling?: string; normalize?: boolean }
    ) => Promise<PipelineResult>;

    export function pipeline(
        task: string,
        model?: string,
        options?: Record<string, unknown>
    ): Promise<Pipeline>;

    export const env: {
        allowLocalModels: boolean;
        localModelPath?: string;
        cacheDir?: string;
        backends?: {
            onnx?: {
                wasm?: {
                    numThreads?: number;
                };
            };
        };
    };
}
