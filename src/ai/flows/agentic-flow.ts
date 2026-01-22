import { ai } from '../genkit';
import { z } from 'zod';
import { Capability } from '@/lib/types';
import { executeCapability } from '@/lib/capability-executor';

// Helper to convert JSON schema to Zod is complex.
// For now, we will use a generic object schema for tool inputs to avoid validation errors during this proof-of-concept phase.
// In production, we should implement a robust JSON Schema -> Zod converter.
const GenericToolInputSchema = z.record(z.any());

export const AgenticFlowInputSchema = z.object({
    userMessage: z.string(),
    capabilities: z.array(z.any()),
    history: z.array(z.any()).optional(),
    modelName: z.string().optional(),
    modelConfig: z.any().optional(), // For temperature etc (or apiKey if we can inject it)
});

export const AgenticFlowOutputSchema = z.object({
    botReply: z.string(),
});

export const agenticFlow = ai.defineFlow(
    {
        name: 'agenticFlow',
        inputSchema: AgenticFlowInputSchema,
        outputSchema: AgenticFlowOutputSchema,
    },
    async (input) => {
        const { userMessage, capabilities, history, modelName } = input;
        const typedCapabilities = capabilities as Capability[];

        // Define tools dynamically
        const tools = typedCapabilities.map((cap) => {
            return ai.defineTool(
                {
                    name: cap.slug,
                    description: cap.contract.description || cap.contract.summary || `Execute ${cap.name}`,
                    inputSchema: GenericToolInputSchema,
                },
                async (toolInput) => {
                    console.log(`[Agentic Flow] Executing tool: ${cap.slug} with input:`, toolInput);
                    try {
                        const result = await executeCapability(cap, toolInput as Record<string, any>);
                        return result;
                    } catch (err: any) {
                        console.error(`[Agentic Flow] Tool execution failed:`, err);
                        return { error: err.message };
                    }
                }
            );
        });

        const promptText = `
        You are an autonomous assistant.
        User Message: ${userMessage}
        
        Previous History: ${JSON.stringify(history || [])}

        Available Tools: Use provided tools if needed.
      `;

        // Determine Model to use
        const modelToUse = modelName || 'googleai/gemini-2.0-flash';
        const effectiveModel = modelToUse.includes('/') ? modelToUse : `googleai/${modelToUse}`; // Simple heuristic

        console.log(`[Agentic Flow] Generating with model: ${effectiveModel}`);

        const llmResponse = await ai.generate({
            model: effectiveModel,
            prompt: promptText,
            tools: tools,
            config: {
                temperature: 0.7,
            },
        });

        return { botReply: llmResponse.text };
    }
);
