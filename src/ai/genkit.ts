import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';
import { DEFAULT_GEMINI_MODEL } from '@/lib/agent/gemini-models';

export const ai = genkit({
  // Gemini keys are resolved per call from the organization integration settings.
  plugins: [googleAI({ apiKey: false })],
  model: DEFAULT_GEMINI_MODEL,
});
