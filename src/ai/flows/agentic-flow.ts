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
    // We accept capabilities as 'any' here to avoid complex circular type issues with Zod/TS in the flow definition, 
    // but we cast them in the logic.
    capabilities: z.array(z.any()),
    history: z.array(z.any()).optional(),
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
        const { userMessage, capabilities, history } = input;
        const typedCapabilities = capabilities as Capability[];

        // Define tools dynamically
        const tools = typedCapabilities.map((cap) => {
            return ai.defineTool(
                {
                    name: cap.slug,
                    description: cap.contract.description || cap.contract.summary || `Execute ${cap.name}`,
                    inputSchema: GenericToolInputSchema, // We'll rely on the model to follow the text description of the schema if we pass it in prompt, or relax validation.
                },
                async (toolInput) => {
                    console.log(`[Agentic Flow] Executing tool: ${cap.slug} with input:`, toolInput);
                    try {
                        const result = await executeCapability(cap, toolInput as Record<string, any>);
                        // Genkit expects the tool output to be a string or JSON.
                        return result;
                    } catch (err: any) {
                        console.error(`[Agentic Flow] Tool execution failed:`, err);
                        return { error: err.message };
                    }
                }
            );
        });

        // Generate response using the tools
        // We inject history into the prompt since we are using a text generation interface or simple chat interface.
        const promptText = `
        You are an autonomous assistant.
        User Message: ${userMessage}
        
        Previous History: ${JSON.stringify(history || [])}

        Available Tools: The system has provided tools you can call. Use them to answer the user's request.
        If a tool returns an error, try to explain it to the user or try a different approach.
      `;

        // Note: ai.generate() in this project version seems to use a specific signature.
        // We assume it supports { model, prompt, tools, config }.
        const llmResponse = await ai.generate({
            model: 'googleai/gemini-2.0-flash',
            prompt: promptText,
            tools: tools,
            config: {
                temperature: 0.7,
            },
        });

        return { botReply: llmResponse.text };
    }
);
