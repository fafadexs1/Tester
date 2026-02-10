import { ai } from '../genkit';
import { z } from 'zod';
import { Capability } from '@/lib/types';
import { executeCapability } from '@/lib/capability-executor';

// Helper to convert JSON schema to Zod is complex.
// For now, we will use a generic object schema for tool inputs to avoid validation errors during this proof-of-concept phase.
// In production, we should implement a robust JSON Schema -> Zod converter.
const GenericToolInputSchema = z.record(z.any());
const MAX_TOOL_COUNT = 8;
const MAX_KNOWLEDGE_CHARS = 2000;
const DEFAULT_KNOWLEDGE_KEYWORDS = [
    'plano', 'planos', 'preco', 'precos', 'valor', 'valores', 'empresa',
    'servico', 'servicos', 'cobertura', 'internet', 'fibra', 'wifi',
    'instalacao', 'velocidade', 'mega', 'beneficio', 'beneficios',
    'contrato', 'pacote', 'mensalidade'
];

const MemoryContextSchema = z.object({
    summary: z.string().optional(),
    facts: z.array(z.string()).optional(),
    episodes: z.array(z.string()).optional(),
    procedures: z.array(z.string()).optional(),
    unconfirmedFacts: z.array(z.string()).optional(),
    unconfirmedEpisodes: z.array(z.string()).optional(),
    unconfirmedProcedures: z.array(z.string()).optional(),
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
    toolsCalled: z.array(z.string()).optional(),
});

const tokenize = (text: string): string[] =>
    text
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .split(/\s+/)
        .filter(token => token.length > 2);

const normalizeForMatch = (text: string): string =>
    text
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();

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
        sections.push(`Confirmed Facts:\n- ${memoryContext.facts.join('\n- ')}`);
    }
    if (memoryContext.episodes?.length) {
        sections.push(`Confirmed Episodes:\n- ${memoryContext.episodes.join('\n- ')}`);
    }
    if (memoryContext.procedures?.length) {
        sections.push(`Confirmed Procedures:\n- ${memoryContext.procedures.join('\n- ')}`);
    }
    if (memoryContext.unconfirmedFacts?.length) {
        sections.push(`Unconfirmed Facts (use only as hints):\n- ${memoryContext.unconfirmedFacts.join('\n- ')}`);
    }
    if (memoryContext.unconfirmedEpisodes?.length) {
        sections.push(`Unconfirmed Episodes (use only as context):\n- ${memoryContext.unconfirmedEpisodes.join('\n- ')}`);
    }
    if (memoryContext.unconfirmedProcedures?.length) {
        sections.push(`Unconfirmed Procedures (use only as hints):\n- ${memoryContext.unconfirmedProcedures.join('\n- ')}`);
    }

    return sections.length ? `Memory Context:\n${sections.join('\n\n')}` : '';
};

const shouldPrefetchKnowledge = (cap: Capability | undefined, userMessage: string): boolean => {
    if (!cap || !userMessage.trim()) return false;
    const normalizedMessage = normalizeForMatch(userMessage);
    if (!normalizedMessage) return false;

    const triggerPhrases = Array.isArray(cap.contract?.triggerPhrases) ? cap.contract.triggerPhrases : [];
    const keywords = [...triggerPhrases, ...DEFAULT_KNOWLEDGE_KEYWORDS];

    return keywords.some(phrase => {
        const normalizedPhrase = normalizeForMatch(String(phrase || ''));
        return normalizedPhrase ? normalizedMessage.includes(normalizedPhrase) : false;
    });
};

const formatKnowledgeResults = (result: any): string => {
    if (!result || result.error || !result.found || !Array.isArray(result.results)) return '';
    const lines = result.results.map((item: any, index: number) => {
        const title = String(item.title || item.key || item.category || `Item ${index + 1}`);
        const content = String(item.content || '').trim();
        const trimmed = content.length > 600 ? `${content.slice(0, 600).trimEnd()}...` : content;
        return `- ${title}: ${trimmed}`;
    });
    const formatted = `Knowledge Base Results:\n${lines.join('\n')}`.trim();
    if (!formatted) return '';
    return formatted.length > MAX_KNOWLEDGE_CHARS
        ? `${formatted.slice(0, MAX_KNOWLEDGE_CHARS).trimEnd()}...`
        : formatted;
};

const sanitizeModelReply = (reply: string | null | undefined): string => {
    const cleaned = String(reply ?? '')
        .replace(/\r\n/g, '\n')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

    if (!cleaned) return '';
    if (/i\s+didn'?t\s+have\s+anything\s+to\s+say/i.test(cleaned)) return '';
    if (/as\s+an?\s+(ai|language model)/i.test(cleaned)) return '';
    return cleaned;
};

const selectRelevantCapabilities = (
    capabilities: Capability[],
    userMessage: string,
    memoryContext?: z.infer<typeof MemoryContextSchema>
): Capability[] => {
    // STRICTER FILTERING: Filter by relevance to avoid hallucination.
    const contextTokens = tokenize(userMessage);
    const JACCARD_THRESHOLD = 0.1;
    const OVERLAP_THRESHOLD = 0.3; // If 30% of user keywords are found in tool, include it.

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
        const signalTokens = tokenize(signal);

        // Jaccard: Intersection / Union (Good for overall similarity, bad for short query vs long desc)
        const jaccard = jaccardSimilarity(contextTokens, signalTokens);

        // Overlap: Intersection / QueryLength (Good for "Does tool cover my keywords?")
        const setSignal = new Set(signalTokens);
        let intersection = 0;
        for (const token of contextTokens) {
            if (setSignal.has(token)) intersection += 1;
        }
        const overlap = contextTokens.length > 0 ? intersection / contextTokens.length : 0;

        // Final score matches if either is strong enough
        const score = Math.max(jaccard, overlap);

        console.log(`[Agentic Flow Debug] Cap: ${cap.slug}`);
        console.log(`[Agentic Flow Debug] Tokens (User): [${contextTokens.join(', ')}]`);
        console.log(`[Agentic Flow Debug] Scores -> Jaccard: ${jaccard.toFixed(4)}, Overlap: ${overlap.toFixed(4)}, Final: ${score.toFixed(4)}`);

        return { cap, score };
    });

    const filtered = scored.filter(entry => entry.score >= Math.min(JACCARD_THRESHOLD, OVERLAP_THRESHOLD));
    // Wait, we want to Pass if (jaccard > 0.1 OR overlap > 0.3)
    // Ideally we define 'passed' boolean logic. 

    // PERMISSIVE: Always expose ALL tools to the LLM. Let it decide based on context.
    // The LLM has the full System Prompt and conversation history, so it can make better decisions.
    // We only sort by relevance and cap the count to avoid overwhelming the model.
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
        const knowledgeCap = typedCapabilities.find(cap => cap.slug === 'lookup_knowledge');
        const shouldLookupKnowledge = shouldPrefetchKnowledge(knowledgeCap, userMessage);

        let selectedCapabilities = selectRelevantCapabilities(typedCapabilities, userMessage, memoryContext);
        if (knowledgeCap && shouldLookupKnowledge && !selectedCapabilities.some(cap => cap.slug === 'lookup_knowledge')) {
            selectedCapabilities = [knowledgeCap, ...selectedCapabilities].slice(0, MAX_TOOL_COUNT);
        }

        let knowledgeContext = '';
        if (knowledgeCap && shouldLookupKnowledge) {
            const execConfig = (knowledgeCap.execution_config || {}) as any;
            const hasConnection = Boolean(execConfig._connectionString || execConfig.connectionString);
            if (hasConnection) {
                try {
                    const result = await executeCapability(knowledgeCap, { query: userMessage });
                    knowledgeContext = formatKnowledgeResults(result);
                    if (knowledgeContext) {
                        console.log('[Agentic Flow] Knowledge prefetch: results found');
                    } else {
                        console.log('[Agentic Flow] Knowledge prefetch: no results');
                    }
                } catch (err) {
                    console.warn('[Agentic Flow] Knowledge prefetch failed:', err);
                }
            } else {
                console.warn('[Agentic Flow] Knowledge prefetch skipped: missing connection string.');
            }
        }
        const knowledgeGuidance = knowledgeContext
            ? 'Use the Knowledge Base Results to answer. If they do not address the question, ask a focused follow-up.'
            : '';

        const usedToolNames = new Set<string>();
        const toolNameBySlug = new Map<string, string>();
        const calledToolSlugs: string[] = []; // Track which tools are actually called

        // Log which tools ACTUALLY passed the filter
        if (selectedCapabilities.length > 0) {
            console.log(`[Agentic Flow] Tools EXPOSED to LLM (${selectedCapabilities.length}):`, selectedCapabilities.map(c => c.slug).join(', '));
        } else {
            console.log(`[Agentic Flow] NO tools exposed to LLM (filtered out due to low relevance)`);
        }

        // Define tools dynamically
        const tools = selectedCapabilities.map((cap, index) => {
            const baseName = (cap.slug || cap.name || `tool_${index}`).trim();
            let toolName = baseName || `tool_${index}`;
            let suffix = 1;
            while (usedToolNames.has(toolName)) {
                toolName = `${baseName}_${suffix++}`;
            }
            usedToolNames.add(toolName);
            if (!toolNameBySlug.has(cap.slug)) {
                toolNameBySlug.set(cap.slug, toolName);
            }

            return ai.defineTool(
                {
                    name: toolName,
                    description: (cap.contract.description || cap.contract.summary || `Execute ${cap.name}`) +
                        (cap.contract.inputSchema ? `\n\nInput Schema: ${JSON.stringify(cap.contract.inputSchema)}` : ''),
                    inputSchema: GenericToolInputSchema,
                },
                async (toolInput) => {
                    console.log(`[Agentic Flow] Executing tool: ${cap.slug} with input:`, toolInput);
                    try {
                        const result = await executeCapability(cap, toolInput as Record<string, any>);
                        if (!result?.error) {
                            calledToolSlugs.push(cap.slug); // Track only successful tool calls
                        }
                        return result;
                    } catch (err: any) {
                        console.error(`[Agentic Flow] Tool execution failed:`, err);
                        return { error: err.message };
                    }
                }
            );
        });

        const knowledgeToolName = toolNameBySlug.get('lookup_knowledge');
        const knowledgeToolInstruction = knowledgeToolName
            ? `IMPORTANT: You have access to tools/capabilities. If the user asks about the company, plans, prices, services, or coverage, you MUST use the '${knowledgeToolName}' tool to find the answer. Do NOT answer "As a large language model I cannot...". Instead, use the tool to find the info.`
            : 'IMPORTANT: You have access to tools/capabilities. Use them when they help you answer. Do NOT answer "As a large language model I cannot...".';
        const hasUnconfirmedMemory = Boolean(
            memoryContext?.unconfirmedFacts?.length ||
            memoryContext?.unconfirmedEpisodes?.length ||
            memoryContext?.unconfirmedProcedures?.length
        );
        const memorySafetyInstruction = hasUnconfirmedMemory
            ? 'IMPORTANT: Memory Context includes UNCONFIRMED hints. Use them only to guide questions; do NOT state them as facts. Only treat Confirmed Facts/Procedures as reliable.'
            : '';

        const promptSections = [
            systemPrompt ? `System Instructions:\n${systemPrompt}` : 'You are an autonomous assistant.',
            `IMPORTANT: You are an autonomous agent. If you use a tool, you MUST use its output to formulate a response to the user. Do not stop after using a tool. Read your System Instructions to decide what to do next. If the tool result is successful, explain it to the user or ask the next logical question.`,
            knowledgeToolInstruction,
            memorySafetyInstruction,
            formatMemoryContext(memoryContext),
            knowledgeContext,
            knowledgeGuidance,
            formatHistory(history, userMessage),
            `User: ${userMessage}`,
            'Assistant:',
        ]
            .filter(Boolean)
            .join('\n\n');

        // Determine Model to use
        let modelToUse = modelName || 'googleai/gemini-2.5-flash';

        // Force fallback ONLY if unstable model AND tools are exposed (tool calls cause thought_signature errors)
        const hasToolsExposed = selectedCapabilities.length > 0;
        if (hasToolsExposed && (modelToUse.includes('gemini-3') || modelToUse.includes('preview') || modelToUse.includes('thinking'))) {
            console.warn(`[Agentic Flow] Downgrading model ${modelToUse} to gemini-2.5-flash for tool compatibility.`);
            modelToUse = 'googleai/gemini-2.5-flash';
        }

        const effectiveModel = modelToUse.includes('/') ? modelToUse : `googleai/${modelToUse}`;

        console.log(`[Agentic Flow] Generating with model: ${effectiveModel}`);
        if (selectedCapabilities.length !== typedCapabilities.length) {
            console.log(`[Agentic Flow] Tool shortlist: ${selectedCapabilities.length}/${typedCapabilities.length}`);
        }

        let llmResponse;
        try {
            llmResponse = await ai.generate({
                model: effectiveModel,
                prompt: promptSections,
                tools: tools.length > 0 ? tools : undefined, // Pass undefined if no tools, to avoid library issues
                config: {
                    temperature: input.temperature ?? 0.7,
                    ...(input.modelConfig && typeof input.modelConfig === 'object' ? input.modelConfig : {}),
                },
            });
            console.log(`[Agentic Flow] Generation complete. Response text length: ${llmResponse.text?.length || 0}`);
        } catch (e: any) {
            console.error(`[Agentic Flow] AI Generate Error:`, e);
            return { botReply: 'Tive uma instabilidade ao processar sua mensagem. Vamos tentar novamente.' };
        }

        const toolsCalled = calledToolSlugs.length > 0 ? calledToolSlugs : undefined;
        console.log(`[Agentic Flow] Tools called: ${toolsCalled?.join(', ') || 'none'}`);
        return { botReply: sanitizeModelReply(llmResponse.text), toolsCalled };
    }
);
