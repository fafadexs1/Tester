'use server';
/**
 * @fileOverview A Genkit flow for making an intelligent choice based on user input.
 *
 * - intelligentChoiceFlow - Determines the best option from a list based on user input.
 * - IntelligentChoiceInput - The input type for the flow.
 * - IntelligentChoiceOutput - The output type for the flow.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const IntelligentChoiceInputSchema = z.object({
  userMessage: z.string().describe('The message sent by the user.'),
  availableChoices: z.array(z.string()).describe('The list of available options to choose from.'),
});
export type IntelligentChoiceInput = z.infer<typeof IntelligentChoiceInputSchema>;

const IntelligentChoiceOutputSchema = z.object({
  bestChoice: z.string().describe('The best choice from the available options that matches the user\'s intent.'),
});
export type IntelligentChoiceOutput = z.infer<typeof IntelligentChoiceOutputSchema>;

export async function intelligentChoice(input: IntelligentChoiceInput): Promise<IntelligentChoiceOutput> {
  return intelligentChoiceFlow(input);
}

const prompt = ai.definePrompt({
  name: 'intelligentChoicePrompt',
  input: {schema: IntelligentChoiceInputSchema},
  output: {schema: IntelligentChoiceOutputSchema},
  prompt: `You are an expert at understanding user intent. Your task is to determine which of the available choices best matches the user's message.

You must choose exactly one of the following options:
{{#each availableChoices}}
- "{{this}}"
{{/each}}

Analyze the user's message below and select the single most appropriate choice from the list above. Return only the chosen option text in the 'bestChoice' field.

User Message: "{{{userMessage}}}"`,
});

const intelligentChoiceFlow = ai.defineFlow(
  {
    name: 'intelligentChoiceFlow',
    inputSchema: IntelligentChoiceInputSchema,
    outputSchema: IntelligentChoiceOutputSchema,
  },
  async (input) => {
    const {output} = await prompt(input);
    if (!output) {
      console.error('[intelligentChoiceFlow] LLM did not return a valid output. Returning the first available choice as a fallback.');
      return { bestChoice: input.availableChoices[0] || '' };
    }
    // Ensure the AI returns one of the provided choices. If not, fallback.
    if (!input.availableChoices.includes(output.bestChoice)) {
        console.warn(`[intelligentChoiceFlow] AI returned a choice ("${output.bestChoice}") not in the original list. Falling back.`);
        // Basic fallback: try to find a partial match or return the first option.
        const fallbackChoice = input.availableChoices.find(c => c.toLowerCase().includes(output.bestChoice.toLowerCase())) || input.availableChoices[0];
        return { bestChoice: fallbackChoice || '' };
    }
    return output;
  }
);
