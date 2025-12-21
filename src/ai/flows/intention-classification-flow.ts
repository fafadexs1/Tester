'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const IntentSchema = z.object({
    id: z.string(),
    label: z.string(),
    description: z.string(),
});

const IntentionClassificationInputSchema = z.object({
    userMessage: z.string().describe('The message sent by the user.'),
    intents: z.array(IntentSchema).describe('The list of defined intents with their descriptions.'),
    modelName: z.string().optional().describe('Optional model name to use for classification.'),
});

// We return the ID of the matched intent, or null if no match found.
const IntentionClassificationOutputSchema = z.object({
    matchedIntentId: z.string().nullable().describe('The ID of the best matching intent, or null if no intent matches.'),
    confidence: z.number().optional().describe('Confidence score from 0 to 1.'),
    reasoning: z.string().optional().describe('Short explanation of why this intent was chosen.'),
});

export type IntentionClassificationInput = z.infer<typeof IntentionClassificationInputSchema>;
export type IntentionClassificationOutput = z.infer<typeof IntentionClassificationOutputSchema>;

// wrapper for easy import
export async function classifyIntent(input: IntentionClassificationInput): Promise<IntentionClassificationOutput> {
    return intentionClassificationFlow(input);
}

const classificationPrompt = ai.definePrompt({
    name: 'intentionClassificationPrompt',
    input: { schema: IntentionClassificationInputSchema },
    output: { schema: IntentionClassificationOutputSchema },
    prompt: `You are an expert intent classifier for a conversational agent.
  
  Your task is to analyze the User Message and match it to one of the following Defined Intents.
  
  Defined Intents:
  {{#each intents}}
  - ID: {{this.id}}
    Label: {{this.label}}
    Description: {{this.description}}
  {{/each}}
  
  User Message: "{{{userMessage}}}"
  
  Instructions:
  1. Read the user message carefully.
  2. PRIORITY RULE: Check if the User Message is a substring of or strongly resembles any Intent Label (ignoring case, accents, or special chars). If a strong lexical match exists (e.g. user says "2 via" and label is "2° Via da Fatura"), SELECT IT IMMEDIATELY.
  3. If no strong lexical match, compare the semantic meaning against the descriptions.
  4. If the user message clearly aligns with an intent's description, select that intent's ID.
  5. If the user message is ambiguous or does not match any intent, return null.
  6. Provide a short reasoning for your decision.
  
  Return format matches the schema: { matchedIntentId: string | null, reasoning: string }
  `,
});

export const intentionClassificationFlow = ai.defineFlow(
    {
        name: 'intentionClassificationFlow',
        inputSchema: IntentionClassificationInputSchema,
        outputSchema: IntentionClassificationOutputSchema,
    },
    async (input) => {
        try {
            const { output } = await classificationPrompt(input, { model: input.modelName });

            if (!output) {
                console.error('[intentionClassificationFlow] LLM returned empty output.');
                return { matchedIntentId: null, reasoning: 'Model failure' };
            }

            return output;
        } catch (error: any) {
            console.error('[intentionClassificationFlow] Error during classification:', error);
            return { matchedIntentId: null, reasoning: `Error: ${error.message}` };
        }
    }
);
