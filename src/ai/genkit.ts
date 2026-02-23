import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';

const googleApiKey =
  process.env.GEMINI_API_KEY?.trim() ||
  process.env.GOOGLE_API_KEY?.trim() ||
  process.env.GOOGLE_GENAI_API_KEY?.trim() ||
  process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim() ||
  undefined;

export const ai = genkit({
  // If no env key is present, initialize with apiKey:false so per-call config.apiKey can be used.
  plugins: [googleAI(googleApiKey ? {apiKey: googleApiKey} : {apiKey: false})],
  model: 'googleai/gemini-2.0-flash',
});
