'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const MemoryCandidateSchema = z.object({
  type: z.enum(['semantic', 'episodic', 'procedural']),
  content: z.string().describe('Short, durable memory content.'),
  importance: z.number().describe('0-1 importance score.'),
  ttlDays: z.number().optional().describe('Optional TTL in days.'),
  tags: z.array(z.string()).optional(),
});

const MemoryCompilerInputSchema = z.object({
  userMessage: z.string(),
  assistantMessage: z.string(),
  systemPrompt: z.string().optional(),
  modelName: z.string().optional(),
});

const MemoryCompilerOutputSchema = z.object({
  items: z.array(MemoryCandidateSchema).default([]),
  summary: z.string().optional(),
});

export type MemoryCompilerInput = z.infer<typeof MemoryCompilerInputSchema>;
export type MemoryCompilerOutput = z.infer<typeof MemoryCompilerOutputSchema>;

const memoryCompilerPrompt = ai.definePrompt({
  name: 'memoryCompilerPrompt',
  input: { schema: MemoryCompilerInputSchema },
  output: { schema: MemoryCompilerOutputSchema },
  prompt: `You are a memory compiler for an AI agent.

Rules:
- Extract only durable, stable facts, preferences, constraints, or procedures.
- Avoid transient chatter or per-turn details unless it affects future behavior.
- Never store secrets or sensitive data (passwords, tokens, API keys, personal IDs).
- Keep each memory item short and self-contained.
- If there is nothing durable to store, return an empty items array.

Context:
System: {{systemPrompt}}
User: {{{userMessage}}}
Assistant: {{{assistantMessage}}}

Return JSON that matches the schema.`,
});

export const memoryCompilerFlow = ai.defineFlow(
  {
    name: 'memoryCompilerFlow',
    inputSchema: MemoryCompilerInputSchema,
    outputSchema: MemoryCompilerOutputSchema,
  },
  async (input) => {
    try {
      // Fallback for known invalid models or default to configured model
      let effectiveModel = input.modelName;
      if (!effectiveModel || effectiveModel === 'gemini-3-flash-preview') {
        effectiveModel = 'googleai/gemini-2.0-flash';
      }

      const { output } = await memoryCompilerPrompt(input, { model: effectiveModel });
      if (!output) {
        return { items: [], summary: undefined };
      }
      return output;
    } catch (error: any) {
      console.error('[memoryCompilerFlow] Error compiling memory:', error);
      return { items: [], summary: undefined };
    }
  }
);
