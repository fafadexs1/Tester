'use server';
/**
 * @fileOverview Um fluxo Genkit simples para gerar respostas de chat.
 *
 * - simpleChatReplyFlow - Gera uma resposta para uma mensagem do usuário.
 * - UserMessageInput - O tipo de entrada para o fluxo.
 * - SimpleChatReplyOutput - O tipo de saída do fluxo.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const UserMessageInputSchema = z.object({
  userMessage: z.string().describe('A mensagem enviada pelo usuário.'),
  modelName: z.string().optional().describe('Modelo de IA a ser usado (opcional).'),
  systemPrompt: z.string().optional().describe('Instruções do sistema para orientar o tom/objetivo.'),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant', 'system']).describe('Quem enviou a mensagem.'),
        content: z.string().describe('Conteúdo da mensagem.'),
      })
    )
    .optional()
    .describe('Histórico de mensagens para dar contexto.'),
});
export type UserMessageInput = z.infer<typeof UserMessageInputSchema>;

const SimpleChatReplyOutputSchema = z.object({
  botReply: z.string().describe('A resposta gerada pelo assistente de IA.'),
});
export type SimpleChatReplyOutput = z.infer<typeof SimpleChatReplyOutputSchema>;

export async function simpleChatReply(input: UserMessageInput): Promise<SimpleChatReplyOutput> {
  return simpleChatReplyFlow(input);
}

const prompt = ai.definePrompt({
  name: 'simpleChatReplyPrompt',
  input: {schema: UserMessageInputSchema},
  output: {schema: SimpleChatReplyOutputSchema},
  prompt: `{{#if systemPrompt}}
Sistema: {{{systemPrompt}}}
{{/if}}
{{#if history}}
Historico recente:
{{#each history}}
- {{role}}: {{{content}}}
{{/each}}
{{/if}}
Mensagem do Usuario: {{{userMessage}}}
Responda de forma natural, mantendo o contexto do historico.`,
});

const simpleChatReplyFlow = ai.defineFlow(
  {
    name: 'simpleChatReplyFlow',
    inputSchema: UserMessageInputSchema,
    outputSchema: SimpleChatReplyOutputSchema,
  },
  async (input) => {
    const {output} = await prompt(input, { model: input.modelName });
    if (!output) {
      // Adiciona um fallback caso a IA não retorne uma estrutura válida
      console.error('[simpleChatReplyFlow] LLM did not return a valid output structure. Returning default reply.');
      return { botReply: "Desculpe, não consegui processar sua mensagem no momento." };
    }
    return output;
  }
);
