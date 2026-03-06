import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';
import { DEFAULT_GEMINI_MODEL } from '@/lib/agent/gemini-models';

const googleApiKey =
  process.env.GEMINI_API_KEY?.trim() ||
  process.env.GOOGLE_API_KEY?.trim() ||
  process.env.GOOGLE_GENAI_API_KEY?.trim() ||
  process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim() ||
  undefined;

export const ai = genkit({
  // If no env key is present, initialize with apiKey:false so per-call config.apiKey can be used.
  plugins: [googleAI(googleApiKey ? {apiKey: googleApiKey} : {apiKey: false})],
  model: DEFAULT_GEMINI_MODEL,
});
