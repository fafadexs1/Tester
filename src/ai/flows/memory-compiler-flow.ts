'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const MemoryCandidateSchema = z.object({
  type: z.enum(['semantic', 'episodic', 'procedural']),
  content: z.string().describe('Short, durable memory content.'),
  importance: z.number().describe('0-1 importance score.'),
  ttlDays: z.number().optional().describe('Optional TTL in days.'),
  tags: z.array(z.string()).optional(),
  confirmed: z.boolean().optional(),
  confidence: z.number().optional().describe('0-1 confidence score.'),
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
  prompt: `You are a high-precision memory compiler for an autonomous conversational agent.

Primary objective:
- Extract only memory that improves future turns.
- Prioritize durable user profile data, business slots, constraints, and procedures.

Strict rules:
1. Keep each item atomic, short, and reusable in future turns.
2. Ignore generic chatter, greetings, and low-value small talk.
3. Never store secrets or sensitive values:
   password, token, API key, CVV, full credit card, full personal documents.
4. If a message is uncertain or inferred, mark confirmed=false and lower confidence.
5. Prefer semantic for durable user/business facts, episodic for relevant recent events, procedural for stable instructions.
6. If there is no durable value, return items: [].

Domain emphasis (telecom/commercial flows):
- Candidate durable slots include:
  plan interest, billing day, installation shift, location shared, address intent, contact preferences.
- Store factual slot intent in concise form, e.g. \"Billing day: 25\", \"Install shift: manha\".

Scoring guidance:
- importance: 0.0 to 1.0 (durability + utility for next turns).
- confidence: 0.0 to 1.0 (certainty that the fact is explicit and correct).

Context:
System: {{systemPrompt}}
User: {{{userMessage}}}
Assistant: {{{assistantMessage}}}

Return valid JSON matching the schema only.`,
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
