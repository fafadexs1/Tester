export const DEFAULT_GEMINI_MODEL = 'googleai/gemini-2.5-flash';
export const DEFAULT_GEMINI_AUX_MODEL = DEFAULT_GEMINI_MODEL;
export const SAFE_GEMINI_FALLBACK_MODEL = 'googleai/gemini-2.5-flash-lite';

const GOOGLE_PROVIDER_PREFIX = 'googleai/';
const MODELS_PREFIX = 'models/';

const cleanModelName = (model?: string): string => String(model || '').trim();

const unique = (values: string[]): string[] => Array.from(new Set(values.filter(Boolean)));

export const stripGeminiProviderPrefix = (model?: string): string => {
  const raw = cleanModelName(model);
  if (!raw) return '';
  if (raw.startsWith(GOOGLE_PROVIDER_PREFIX)) {
    return raw.slice(GOOGLE_PROVIDER_PREFIX.length).trim();
  }
  if (raw.startsWith(MODELS_PREFIX)) {
    return raw.slice(MODELS_PREFIX.length).trim();
  }
  return raw;
};

export const isGeminiModelName = (model?: string): boolean =>
  stripGeminiProviderPrefix(model).toLowerCase().startsWith('gemini-');

export const isExperimentalGeminiModel = (model?: string): boolean => {
  const normalized = stripGeminiProviderPrefix(model).toLowerCase();
  return (
    normalized.startsWith('gemini-3') ||
    normalized.includes('preview') ||
    normalized.includes('thinking')
  );
};

export const normalizeGenkitModelName = (
  model?: string,
  fallback = DEFAULT_GEMINI_MODEL
): string => {
  const raw = cleanModelName(model);
  if (!raw) return fallback;
  if (raw.startsWith(GOOGLE_PROVIDER_PREFIX)) return raw;
  if (raw.startsWith(MODELS_PREFIX)) return `${GOOGLE_PROVIDER_PREFIX}${raw.slice(MODELS_PREFIX.length)}`;
  if (raw.startsWith('gemini-')) return `${GOOGLE_PROVIDER_PREFIX}${raw}`;
  return raw;
};

export const normalizeNativeGeminiModelName = (
  model?: string,
  fallback = stripGeminiProviderPrefix(DEFAULT_GEMINI_MODEL)
): string => {
  const normalized = stripGeminiProviderPrefix(model);
  return normalized || fallback;
};

export const resolveAuxiliaryGenkitModel = (requestedModel?: string): string => {
  const normalized = normalizeGenkitModelName(requestedModel, DEFAULT_GEMINI_AUX_MODEL);
  if (!isGeminiModelName(normalized)) return normalized;
  return isExperimentalGeminiModel(normalized) ? DEFAULT_GEMINI_AUX_MODEL : normalized;
};

export const buildAuxiliaryGenkitModelCandidates = (requestedModel?: string): string[] => {
  const primary = resolveAuxiliaryGenkitModel(requestedModel);
  if (!isGeminiModelName(primary)) return [primary];
  return unique([primary, SAFE_GEMINI_FALLBACK_MODEL]);
};

export const buildNativeGeminiModelCandidates = (requestedModel?: string): string[] =>
  unique([
    normalizeNativeGeminiModelName(requestedModel),
    normalizeNativeGeminiModelName(DEFAULT_GEMINI_MODEL),
    normalizeNativeGeminiModelName(SAFE_GEMINI_FALLBACK_MODEL),
  ]);

const extractNumericStatus = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

const extractStatusFromMessage = (message: string): number | undefined => {
  const match = message.match(/\b([45]\d{2})\b/);
  return match ? Number(match[1]) : undefined;
};

export const getGeminiErrorStatus = (error: any): number | undefined =>
  extractNumericStatus(error?.status) ||
  extractNumericStatus(error?.code) ||
  extractStatusFromMessage(String(error?.message || error?.originalMessage || ''));

export const getGeminiErrorMessage = (error: any): string =>
  String(error?.message || error?.originalMessage || 'Unknown Gemini error');

export const isMissingGeminiModelError = (error: any): boolean => {
  const status = getGeminiErrorStatus(error);
  const message = getGeminiErrorMessage(error).toLowerCase();
  return (
    status === 404 ||
    message.includes('not_found') ||
    (message.includes('model') && message.includes('not found'))
  );
};

export const isRetryableGeminiError = (error: any): boolean => {
  const status = getGeminiErrorStatus(error);
  const message = getGeminiErrorMessage(error).toLowerCase();
  return (
    status === 408 ||
    status === 429 ||
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504 ||
    message.includes('resource exhausted') ||
    message.includes('too many requests') ||
    message.includes('high demand') ||
    message.includes('overloaded') ||
    message.includes('temporarily unavailable') ||
    message.includes('try again later')
  );
};
