import type { ResolvedOption } from '@/lib/types';

export type OptionLike = string | ResolvedOption;

type MatchedOption = {
  index: number;
  option: OptionLike;
  id: string;
  value: string;
  displayText: string;
  normalizedTexts: string[];
  strategy: 'number' | 'exact' | 'contains';
};

export const getOptionDisplayText = (option: OptionLike): string =>
  typeof option === 'string'
    ? option
    : String(option?.displayText || option?.value || '');

export const getOptionValue = (option: OptionLike): string =>
  typeof option === 'string' ? option : String(option?.value || '');

export const getOptionDescription = (option: OptionLike): string =>
  typeof option === 'string' ? '' : String(option?.description || '');

export const getOptionId = (option: OptionLike): string =>
  typeof option === 'string' ? option : String(option?.id || '');

export const normalizeOptionMatchText = (value: string | null | undefined): string => {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/(\d+)\s*[ªº°]/g, '$1')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
};

const extractOptionNumberChoice = (rawMessage: string, optionsLength: number): number | null => {
  const normalized = normalizeOptionMatchText(rawMessage);
  if (!normalized) return null;

  const patterns = [
    /^(\d+)$/,
    /^(?:opcao|opc|item|numero|num|n)\s+(\d+)$/,
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (!match) continue;
    const numericChoice = Number(match[1]);
    if (Number.isInteger(numericChoice) && numericChoice >= 1 && numericChoice <= optionsLength) {
      return numericChoice - 1;
    }
  }

  const hashMatch = String(rawMessage || '').trim().match(/^#\s*(\d+)$/);
  if (!hashMatch) return null;

  const numericChoice = Number(hashMatch[1]);
  if (Number.isInteger(numericChoice) && numericChoice >= 1 && numericChoice <= optionsLength) {
    return numericChoice - 1;
  }

  return null;
};

const getOptionNormalizedTexts = (option: OptionLike): string[] =>
  Array.from(
    new Set(
      [getOptionDisplayText(option), getOptionValue(option)]
        .map(value => normalizeOptionMatchText(value))
        .filter(Boolean)
    )
  );

export const matchOptionByHeuristics = (
  options: OptionLike[],
  rawMessage: string | null | undefined
): MatchedOption | null => {
  if (!Array.isArray(options) || options.length === 0) return null;

  const normalizedMessage = normalizeOptionMatchText(rawMessage);
  if (!normalizedMessage) return null;

  const numericIndex = extractOptionNumberChoice(normalizedMessage, options.length);
  if (numericIndex !== null) {
    const option = options[numericIndex];
    return {
      index: numericIndex,
      option,
      id: getOptionId(option),
      value: getOptionValue(option),
      displayText: getOptionDisplayText(option),
      normalizedTexts: getOptionNormalizedTexts(option),
      strategy: 'number',
    };
  }

  const normalizedOptions = options.map((option, index) => ({
    index,
    option,
    id: getOptionId(option),
    value: getOptionValue(option),
    displayText: getOptionDisplayText(option),
    normalizedTexts: getOptionNormalizedTexts(option),
  }));

  const exactMatches = normalizedOptions.filter((item) => item.normalizedTexts.includes(normalizedMessage));
  if (exactMatches.length === 1) {
    return { ...exactMatches[0], strategy: 'exact' };
  }

  if (normalizedMessage.length < 3) {
    return null;
  }

  const containsMatches = normalizedOptions.filter((item) =>
    item.normalizedTexts.some((normalizedText) =>
      normalizedText &&
      normalizedText !== normalizedMessage &&
      (normalizedText.includes(normalizedMessage) || normalizedMessage.includes(normalizedText))
    )
  );

  if (containsMatches.length === 1) {
    return {
      ...containsMatches[0],
      strategy: 'contains',
    };
  }

  return null;
};
