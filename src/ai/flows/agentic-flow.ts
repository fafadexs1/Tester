import { ai } from '../genkit';
import { z } from 'zod';
import { Capability } from '@/lib/types';
import { executeCapability } from '@/lib/capability-executor';

// Helper to convert JSON schema to Zod is complex.
// For now, we will use a generic object schema for tool inputs to avoid validation errors during this proof-of-concept phase.
// In production, we should implement a robust JSON Schema -> Zod converter.
const GenericToolInputSchema = z.record(z.any());
const MAX_TOOL_COUNT = 8;

const MemoryContextSchema = z.object({
    summary: z.string().optional(),
    facts: z.array(z.string()).optional(),
    episodes: z.array(z.string()).optional(),
    procedures: z.array(z.string()).optional(),
});

export const AgenticFlowInputSchema = z.object({
    userMessage: z.string(),
    capabilities: z.array(z.any()),
    history: z.array(z.any()).optional(),
    modelName: z.string().optional(),
    modelConfig: z.any().optional(), // For temperature etc (or apiKey if we can inject it)
    systemPrompt: z.string().optional(),
    temperature: z.number().optional(),
    memoryContext: MemoryContextSchema.optional(),
});

export const AgenticFlowOutputSchema = z.object({
    botReply: z.string(),
});

const tokenize = (text: string): string[] =>
    text
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .split(/\s+/)
        .filter(token => token.length > 2);

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

const formatHistory = (history: any[] | undefined, userMessage: string): string => {
    if (!Array.isArray(history) || history.length === 0) return '';
    const sanitized = history
        .map(entry => ({
            role: String(entry?.role || 'user'),
            content: String(entry?.content || '').trim(),
        }))
        .filter(entry => entry.content.length > 0);

    if (sanitized.length > 0) {
        const last = sanitized[sanitized.length - 1];
        if (last.role === 'user' && last.content === userMessage.trim()) {
            sanitized.pop();
        }
    }

    if (sanitized.length === 0) return '';
    const lines = sanitized.map(entry => `${entry.role.toUpperCase()}: ${entry.content}`);
    return `Conversation:\n${lines.join('\n')}`;
};

const formatMemoryContext = (memoryContext?: z.infer<typeof MemoryContextSchema>): string => {
    if (!memoryContext) return '';
    if (memoryContext.summary) return `Memory Context:\n${memoryContext.summary}`;

    const sections: string[] = [];
    if (memoryContext.facts?.length) {
        sections.push(`Facts:\n- ${memoryContext.facts.join('\n- ')}`);
    }
    if (memoryContext.episodes?.length) {
        sections.push(`Episodes:\n- ${memoryContext.episodes.join('\n- ')}`);
    }
    if (memoryContext.procedures?.length) {
        sections.push(`Procedures:\n- ${memoryContext.procedures.join('\n- ')}`);
    }

    return sections.length ? `Memory Context:\n${sections.join('\n\n')}` : '';
};

const selectRelevantCapabilities = (
    capabilities: Capability[],
    userMessage: string,
    memoryContext?: z.infer<typeof MemoryContextSchema>
): Capability[] => {
    if (capabilities.length <= MAX_TOOL_COUNT) return capabilities;
    const contextText = `${userMessage} ${memoryContext?.summary || ''}`.trim();
    const contextTokens = tokenize(contextText);

    const scored = capabilities.map(cap => {
        const signal = [
            cap.name,
            cap.slug,
            cap.contract.summary,
            cap.contract.description,
            ...(cap.contract.triggerPhrases || []),
        ]
            .filter(Boolean)
            .join(' ');
        const score = jaccardSimilarity(contextTokens, tokenize(signal));
        return { cap, score };
    });

    return scored
        .sort((a, b) => b.score - a.score)
        .slice(0, MAX_TOOL_COUNT)
        .map(entry => entry.cap);
};

export const agenticFlow = ai.defineFlow(
    {
        name: 'agenticFlow',
        inputSchema: AgenticFlowInputSchema,
        outputSchema: AgenticFlowOutputSchema,
    },
    async (input) => {
        const { userMessage, capabilities, history, modelName, systemPrompt, memoryContext } = input;
        const typedCapabilities = capabilities as Capability[];
        const selectedCapabilities = selectRelevantCapabilities(typedCapabilities, userMessage, memoryContext);

        // Define tools dynamically
        const tools = selectedCapabilities.map((cap) => {
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

        const promptSections = [
            systemPrompt ? `System Instructions:\n${systemPrompt}` : 'You are an autonomous assistant.',
            formatMemoryContext(memoryContext),
            formatHistory(history, userMessage),
            `User: ${userMessage}`,
            'Assistant:',
        ]
            .filter(Boolean)
            .join('\n\n');

        // Determine Model to use
        const modelToUse = modelName || 'googleai/gemini-2.0-flash';
        const effectiveModel = modelToUse.includes('/') ? modelToUse : `googleai/${modelToUse}`; // Simple heuristic

        console.log(`[Agentic Flow] Generating with model: ${effectiveModel}`);
        if (selectedCapabilities.length !== typedCapabilities.length) {
            console.log(`[Agentic Flow] Tool shortlist: ${selectedCapabilities.length}/${typedCapabilities.length}`);
        }

        const llmResponse = await ai.generate({
            model: effectiveModel,
            prompt: promptSections,
            tools: tools,
            config: {
                temperature: input.temperature ?? 0.7,
                ...(input.modelConfig && typeof input.modelConfig === 'object' ? input.modelConfig : {}),
            },
        });

        return { botReply: llmResponse.text };
    }
);
