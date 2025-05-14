'use server';

/**
 * @fileOverview A flow that generates suggested responses for a given node in a conversation flow.
 *
 * - generateSuggestedResponses - A function that generates suggested responses.
 * - SuggestedResponsesInput - The input type for the generateSuggestedResponses function.
 * - SuggestedResponsesOutput - The return type for the generateSuggestedResponses function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SuggestedResponsesInputSchema = z.object({
  nodeContent: z.string().describe('The content of the current node.'),
  previousTurns: z.array(z.string()).describe('The previous turns of the conversation.'),
});
export type SuggestedResponsesInput = z.infer<typeof SuggestedResponsesInputSchema>;

const SuggestedResponsesOutputSchema = z.object({
  suggestedResponses: z.array(z.string()).describe('An array of suggested responses.'),
});
export type SuggestedResponsesOutput = z.infer<typeof SuggestedResponsesOutputSchema>;

export async function generateSuggestedResponses(input: SuggestedResponsesInput): Promise<SuggestedResponsesOutput> {
  return generateSuggestedResponsesFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestedResponsesPrompt',
  input: {schema: SuggestedResponsesInputSchema},
  output: {schema: SuggestedResponsesOutputSchema},
  prompt: `You are a chatbot assistant that helps create conversation flows. Given the current node content and previous turns of the conversation, suggest 3-5 possible responses that the user might say next. Return the responses as a JSON array of strings.

Node Content: {{{nodeContent}}}
Previous Turns: {{#each previousTurns}}- {{{this}}}{{/each}}

Suggested Responses:`,
});

const generateSuggestedResponsesFlow = ai.defineFlow(
  {
    name: 'generateSuggestedResponsesFlow',
    inputSchema: SuggestedResponsesInputSchema,
    outputSchema: SuggestedResponsesOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
