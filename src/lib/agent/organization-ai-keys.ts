import 'server-only';

import { getOrganizationAiKeysForRuntime } from '@/app/actions/databaseActions';
import { isGeminiModelName, normalizeGenkitModelName } from '@/lib/agent/gemini-models';
import type { AiProvider, OrganizationAiKeyRecord } from '@/lib/types';

const canUseGeminiKey = (provider?: AiProvider, modelName?: string): boolean => {
  if (provider && provider !== 'google') return false;
  if (!modelName) return true;
  return isGeminiModelName(normalizeGenkitModelName(modelName));
};

export const selectOrganizationGeminiKey = (
  keys: OrganizationAiKeyRecord[],
  selectedKeyId?: string | null
): OrganizationAiKeyRecord | undefined => {
  if (!Array.isArray(keys) || keys.length === 0) return undefined;
  if (selectedKeyId) {
    const selected = keys.find((item) => item.id === selectedKeyId);
    if (selected) return selected;
  }
  return keys.find((item) => item.is_default) || keys[0];
};

export const resolveOrganizationGeminiApiKey = async (params: {
  organizationId?: string | null;
  selectedKeyId?: string | null;
  legacyApiKey?: string | null;
  modelName?: string;
  provider?: AiProvider;
  cachedKeys?: OrganizationAiKeyRecord[];
}): Promise<string | undefined> => {
  const legacyApiKey = String(params.legacyApiKey || '').trim();
  if (legacyApiKey) return legacyApiKey;

  if (!canUseGeminiKey(params.provider, params.modelName)) {
    return undefined;
  }

  const organizationId = String(params.organizationId || '').trim();
  if (!organizationId) return undefined;

  const keys = params.cachedKeys || await getOrganizationAiKeysForRuntime(organizationId, 'google');
  return selectOrganizationGeminiKey(keys, params.selectedKeyId)?.api_key;
};
