export type AgentRoute = 'SUPORTE' | 'FINANCEIRO' | 'ENCERRAR' | 'ASSINATURA' | 'UNKNOWN';

export interface AgentRouteDecision {
  route: AgentRoute;
  confidence: number;
  reason: string;
  matchedSignals: string[];
  shouldExitFlow: boolean;
}

export interface AgentReplyGuardResult {
  reply: string;
  fallbackApplied: boolean;
  fallbackReason?: string;
}

export interface AgentHistoryLike {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface AgentStateSlots {
  cpf?: string;
  cep?: string;
  billingDay?: string;
  installShift?: 'manha' | 'tarde';
  address?: string;
  location?: string;
  primaryPhone?: string;
  secondaryPhone?: string;
  planInterest?: string;
}

export interface AgentConversationState {
  updatedAt: string;
  lastRoute?: AgentRoute;
  slots: AgentStateSlots;
}

const COMMERCIAL_DATA_REQUEST_SIGNALS = [
  'cpf',
  'cep',
  'endereco',
  'localizacao',
  'dia de vencimento',
  'vencimento',
  'turno',
  'instalacao',
  'telefone',
  'numero para contato',
  'segundo numero',
  'telefone secundario',
];

const NORMALIZE_REGEX = /[^\p{L}\p{N}\s]/gu;
const MULTI_SPACE_REGEX = /\s+/g;
const AMBIGUOUS_SHORT_REPLY_REGEX = /^(sim|nao|não|ok|certo|isso|esse|essa|quero|pode|fechado|de manha|de manhã|a tarde|à tarde|25|20|15|10|5)$/i;

const ROUTE_SIGNALS: Record<Exclude<AgentRoute, 'UNKNOWN'>, string[]> = {
  SUPORTE: [
    'suporte',
    'internet caiu',
    'sem internet',
    'instavel',
    'instabilidade',
    'lenta',
    'lentidao',
    'sinal ruim',
    'wifi ruim',
    'roteador',
    'modem',
    'tecnico',
    'ping alto',
    'queda de conexao',
  ],
  FINANCEIRO: [
    'financeiro',
    'boleto',
    'fatura',
    'segunda via',
    '2 via',
    'pagamento',
    'pagar',
    'vencimento',
    'debito',
    'divida',
    'negociar',
    'juros',
    'desconto da fatura',
  ],
  ENCERRAR: [
    'encerrar',
    'finalizar',
    'cancelar atendimento',
    'quero parar',
    'nao quero continuar',
    'nao desejo continuar',
    'tchau',
    'adeus',
    'obrigado mas nao',
    'obrigada mas nao',
  ],
  ASSINATURA: [
    'assinar',
    'contratar',
    'plano',
    'internet fibra',
    'quero internet',
    'novo servico',
    'instalacao',
    'velocidade',
    'mega',
    'wifi 6',
  ],
};

const EXPLICIT_EXIT_SIGNALS = [
  'encerrar atendimento',
  'quero encerrar',
  'pode encerrar',
  'pode finalizar',
  'finaliza ai',
  'finaliza por aqui',
  'encerrar por aqui',
  'parar por aqui',
  'quero parar',
  'nao quero continuar',
  'nao desejo continuar',
  'nao quero prosseguir',
  'nao quero seguir',
  'nao tenho mais interesse',
  'quero cancelar atendimento',
  'cancelar atendimento',
  'sair do atendimento',
  'tchau',
  'adeus',
  'obrigado mas nao',
  'obrigada mas nao',
];

const DATA_REFUSAL_FIELD_SIGNALS = [
  'email',
  'e mail',
  'segundo numero',
  'segundo telefone',
  'telefone secundario',
  'telefone secundario',
  'outro numero',
  'numero adicional',
  'telefone adicional',
  'cpf',
  'rg',
  'documento',
  'cep',
  'endereco',
  'localizacao',
  'bairro',
  'comprovante',
];

const DATA_REFUSAL_CUES = [
  'nao quero passar',
  'nao quero informar',
  'nao quero fornecer',
  'nao quero compartilhar',
  'nao vou passar',
  'nao vou informar',
  'nao vou fornecer',
  'prefiro nao passar',
  'prefiro nao informar',
  'prefiro nao fornecer',
  'nao tenho',
  'nao possuo',
  'sem ',
];

const FALLBACK_BLOCKED_PATTERNS: RegExp[] = [
  /i\s+didn'?t\s+have\s+anything\s+to\s+say/i,
  /as\s+an?\s+(ai|language model)/i,
  /i\s+cannot\s+help\s+with\s+that/i,
];

const INTERNAL_LEAK_PATTERNS: RegExp[] = [
  /\btool\s*:/i,
  /\bferramenta\s*:/i,
  /\btool[_\s-]?call\b/i,
  /\btool[_\s-]?result\b/i,
  /```(?:json|javascript|js|yaml|xml)?/i,
];

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const normalizeForMatch = (text: string): string =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(NORMALIZE_REGEX, ' ')
    .replace(MULTI_SPACE_REGEX, ' ')
    .trim();

const prettifyFieldLabel = (field: string): string =>
  field
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, char => char.toUpperCase());

const toFlatReplyValue = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  try {
    const serialized = JSON.stringify(value);
    if (!serialized) return '';
    return serialized.length > 120 ? `${serialized.slice(0, 117)}...` : serialized;
  } catch {
    return String(value);
  }
};

const looksLikeJsonPayload = (text: string): boolean => {
  const trimmed = text.trim();
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return false;
  return /"[^"]+"\s*:/.test(trimmed);
};

const humanizeJsonPayload = (text: string): string | null => {
  try {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;

    const entries = Object.entries(parsed as Record<string, unknown>)
      .map(([key, value]) => [prettifyFieldLabel(key), toFlatReplyValue(value)] as const)
      .filter(([, value]) => value.length > 0);

    if (!entries.length) return null;
    if (entries.length > 12) {
      return 'Perfeito. Recebi os dados e vou seguir com o atendimento.';
    }

    const lines = entries.map(([key, value]) => `- ${key}: ${value}`);
    return `Perfeito, organizei as informacoes que voce compartilhou:\n${lines.join('\n')}`;
  } catch {
    return null;
  }
};

const stripInternalArtifacts = (text: string): string => {
  let cleaned = text
    .replace(/```(?:json|javascript|js|yaml|xml)?[\s\S]*?```/gi, '\n')
    .replace(/\(\s*tool\s*:[^)]+\)/gi, '')
    .replace(/\(\s*ferramenta\s*:[^)]+\)/gi, '')
    .replace(/^\s*\(?\s*tool\s*:[^)]+?\)?\s*$/gim, '')
    .replace(/^\s*\(?\s*ferramenta\s*:[^)]+?\)?\s*$/gim, '')
    .replace(/^\s*(?:executando|chamando|usando)\s+(?:a\s+)?(?:tool|ferramenta)\b.*$/gim, '')
    .replace(/^\s*(?:tool[_\s-]?call|tool[_\s-]?result|function[_\s-]?call)\b.*$/gim, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (looksLikeJsonPayload(cleaned)) {
    const humanized = humanizeJsonPayload(cleaned);
    cleaned = humanized || '';
  }

  return cleaned
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

const countSignalMatches = (normalizedText: string, route: Exclude<AgentRoute, 'UNKNOWN'>): { count: number; matched: string[] } => {
  const matched = ROUTE_SIGNALS[route].filter(signal => normalizedText.includes(signal));
  return { count: matched.length, matched };
};

const getLastAssistantMessage = (history: AgentHistoryLike[] = []): string => {
  const lastAssistant = [...history]
    .reverse()
    .find(item => item.role === 'assistant' && String(item.content || '').trim().length > 0);
  return normalizeForMatch(lastAssistant?.content || '');
};

export const detectScopedDataRefusal = (
  userMessage: string,
  history: AgentHistoryLike[] = []
): boolean => {
  const normalized = normalizeForMatch(userMessage || '');
  if (!normalized) return false;

  const hasExitCue = EXPLICIT_EXIT_SIGNALS.some(signal => normalized.includes(signal));
  if (hasExitCue) return false;

  const hasRefusalCue = DATA_REFUSAL_CUES.some(signal => normalized.includes(signal));
  if (!hasRefusalCue) return false;

  const matchedFields = DATA_REFUSAL_FIELD_SIGNALS.filter(signal => normalized.includes(signal));
  if (matchedFields.length > 0) return true;

  const lastAssistant = getLastAssistantMessage(history);
  if (!lastAssistant) return false;

  const assistantAskedSensitiveField = DATA_REFUSAL_FIELD_SIGNALS.some(signal => lastAssistant.includes(signal));
  const shortRefusal = normalized.length <= 48;
  return assistantAskedSensitiveField && shortRefusal;
};

export const detectExplicitExitIntent = (
  userMessage: string,
  history: AgentHistoryLike[] = []
): boolean => {
  const normalized = normalizeForMatch(userMessage || '');
  if (!normalized) return false;
  if (detectScopedDataRefusal(normalized, history)) return false;
  return EXPLICIT_EXIT_SIGNALS.some(signal => normalized.includes(signal));
};

const confidenceThresholdForExit = (route: AgentRoute): number => {
  if (route === 'ENCERRAR') return 0.55;
  if (route === 'SUPORTE' || route === 'FINANCEIRO') return 0.68;
  return 1;
};

export const inferAgentRouteFromText = (userMessage: string): AgentRouteDecision => {
  const normalized = normalizeForMatch(userMessage || '');

  if (!normalized) {
    return {
      route: 'ASSINATURA',
      confidence: 0.35,
      reason: 'Mensagem vazia ou sem sinal util.',
      matchedSignals: [],
      shouldExitFlow: false,
    };
  }

  const scored = (Object.keys(ROUTE_SIGNALS) as Exclude<AgentRoute, 'UNKNOWN'>[]).map(route => {
    const { count, matched } = countSignalMatches(normalized, route);
    const confidence = clamp01(0.42 + count * 0.17 + (count >= 2 ? 0.12 : 0));
    return { route, confidence, count, matched };
  });

  scored.sort((a, b) => b.count - a.count || b.confidence - a.confidence);
  const best = scored[0];
  const second = scored[1];

  if (!best || best.count === 0) {
    return {
      route: 'UNKNOWN',
      confidence: 0,
      reason: 'Nenhum sinal claro de rota encontrado.',
      matchedSignals: [],
      shouldExitFlow: false,
    };
  }

  if (second && second.count === best.count && second.count > 0) {
    return {
      route: 'UNKNOWN',
      confidence: clamp01(Math.max(best.confidence, second.confidence) - 0.2),
      reason: `Empate entre sinais de rota (${best.route} e ${second.route}).`,
      matchedSignals: [...best.matched, ...second.matched],
      shouldExitFlow: false,
    };
  }

  const route = best.route;
  const confidence = best.confidence;
  const shouldExitFlow = confidence >= confidenceThresholdForExit(route) && route !== 'ASSINATURA';

  return {
    route,
    confidence,
    reason: `Rota inferida por ${best.count} sinal(is) textual(is).`,
    matchedSignals: best.matched,
    shouldExitFlow,
  };
};

export const buildRouteRedirectMessage = (route: AgentRoute): string => {
  if (route === 'SUPORTE') return 'Perfeito, vou te direcionar para o suporte agora mesmo.';
  if (route === 'FINANCEIRO') return 'Certo, vou te direcionar para o setor financeiro agora mesmo.';
  if (route === 'ENCERRAR') return 'Tudo bem, vou encerrar este atendimento por aqui.';
  return 'Perfeito, vamos continuar seu atendimento comercial.';
};

export const detectExplicitRouteSignalFromReply = (reply: string): AgentRoute => {
  const normalized = normalizeForMatch(reply || '');
  if (!normalized) return 'UNKNOWN';

  const marker = normalized.match(/\b(?:route|rota)\s*[:=]\s*(suporte|financeiro|encerrar|assinatura)\b/);
  if (marker?.[1]) return marker[1].toUpperCase() as AgentRoute;

  if (/direcionar .* suporte|encaminhar .* suporte|setor de suporte/.test(normalized)) return 'SUPORTE';
  if (/direcionar .* financeiro|encaminhar .* financeiro|setor financeiro/.test(normalized)) return 'FINANCEIRO';
  if (/encerrar este atendimento|vou encerrar|atendimento encerrado/.test(normalized)) return 'ENCERRAR';
  if (/continuar .* comercial|seguir .* contratacao|prosseguir .* assinatura/.test(normalized)) return 'ASSINATURA';

  return 'UNKNOWN';
};

export const sanitizeAgentReply = (params: {
  rawReply: string | null | undefined;
  userMessage: string;
  preferredRoute?: AgentRoute;
}): AgentReplyGuardResult => {
  const raw = String(params.rawReply ?? '');
  let cleaned = raw
    .replace(/\[(?:ROUTE|ROTA)\s*:[^\]]+\]/gi, '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  cleaned = stripInternalArtifacts(cleaned);

  const blockedByFallbackPattern = FALLBACK_BLOCKED_PATTERNS.some(pattern => pattern.test(cleaned));
  const blockedByInternalLeak = INTERNAL_LEAK_PATTERNS.some(pattern => pattern.test(raw));
  const blocked = blockedByFallbackPattern || blockedByInternalLeak;
  if (!cleaned || blocked) {
    const preferredRoute = params.preferredRoute ?? 'ASSINATURA';
    const fallbackReason = blockedByInternalLeak
      ? 'internal_artifact_reply'
      : blockedByFallbackPattern
        ? 'blocked_english_fallback'
        : 'empty_reply';
    if (preferredRoute !== 'ASSINATURA' && preferredRoute !== 'UNKNOWN') {
      return {
        reply: buildRouteRedirectMessage(preferredRoute),
        fallbackApplied: true,
        fallbackReason,
      };
    }
    return {
      reply: 'Perfeito, entendi. Me diga rapidamente o que voce precisa agora para eu te ajudar.',
      fallbackApplied: true,
      fallbackReason,
    };
  }

  if (cleaned.length < 2) {
    return {
      reply: 'Entendi. Pode me passar mais um detalhe para eu te ajudar melhor?',
      fallbackApplied: true,
      fallbackReason: 'too_short',
    };
  }

  return { reply: cleaned, fallbackApplied: false };
};

const extractFirstMatch = (regex: RegExp, text: string): string | undefined => {
  const match = text.match(regex);
  return match?.[1];
};

const normalizeDigits = (text: string): string => text.replace(/\D/g, '');

const pickPhoneCandidates = (text: string): string[] => {
  const matches = text.match(/(?:\+?\d[\d\s().-]{7,}\d)/g) || [];
  const normalized = matches
    .map(candidate => normalizeDigits(candidate))
    .filter(candidate => candidate.length >= 10 && candidate.length <= 13);
  return Array.from(new Set(normalized));
};

export const extractAgentSlotsFromMessage = (message: string): Partial<AgentStateSlots> => {
  const text = String(message || '');
  const normalized = normalizeForMatch(text);
  const slots: Partial<AgentStateSlots> = {};

  const cpf = extractFirstMatch(/\b(\d{3}\.?\d{3}\.?\d{3}-?\d{2})\b/, text);
  if (cpf) slots.cpf = normalizeDigits(cpf);

  const cep = extractFirstMatch(/\b(\d{5}-?\d{3})\b/, text);
  if (cep) slots.cep = normalizeDigits(cep);

  const billingMatch = normalized.match(/\b(?:vencimento|dia)\b[^\d]{0,12}(5|10|15|20|25)\b/);
  if (billingMatch?.[1]) slots.billingDay = billingMatch[1];

  if (/\bmanha\b/.test(normalized)) slots.installShift = 'manha';
  if (/\btarde\b/.test(normalized)) slots.installShift = 'tarde';

  const latLng = text.match(/\b(-?\d{1,3}\.\d{4,})\s*,\s*(-?\d{1,3}\.\d{4,})\b/);
  if (latLng?.[0]) slots.location = latLng[0];

  if (/\b(?:rua|avenida|av|travessa|quadra|lote|condominio|bloco|casa|apartamento)\b/i.test(text) && text.length <= 220) {
    slots.address = text.trim();
  }

  const plan = text.match(/\b(\d{2,4}\s*(?:mega|mb|gb))\b/i);
  if (plan?.[1]) slots.planInterest = plan[1].toUpperCase().replace(/\s+/g, ' ');

  const phones = pickPhoneCandidates(text);
  if (phones[0]) slots.primaryPhone = phones[0];
  if (phones[1]) slots.secondaryPhone = phones[1];

  return slots;
};

export const mergeAgentConversationState = (
  previousState: unknown,
  userMessage: string,
  inferredRoute?: AgentRoute
): AgentConversationState => {
  const base: AgentConversationState = {
    updatedAt: new Date().toISOString(),
    lastRoute: inferredRoute && inferredRoute !== 'UNKNOWN' ? inferredRoute : undefined,
    slots: {},
  };

  const previous =
    previousState && typeof previousState === 'object'
      ? (previousState as AgentConversationState)
      : undefined;

  const merged: AgentConversationState = {
    updatedAt: new Date().toISOString(),
    lastRoute: inferredRoute && inferredRoute !== 'UNKNOWN' ? inferredRoute : previous?.lastRoute,
    slots: { ...(previous?.slots || {}) },
  };

  const extracted = extractAgentSlotsFromMessage(userMessage);
  merged.slots = {
    ...base.slots,
    ...merged.slots,
    ...Object.fromEntries(
      Object.entries(extracted).filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== '')
    ),
  };

  return merged;
};

export const shouldPreserveCommercialSignupRoute = (params: {
  userMessage: string;
  history: AgentHistoryLike[];
  state?: unknown;
}): boolean => {
  const typedState =
    params.state && typeof params.state === 'object'
      ? (params.state as AgentConversationState)
      : undefined;

  const hasCommercialContext = Boolean(
    typedState?.lastRoute === 'ASSINATURA' ||
    typedState?.slots?.planInterest ||
    typedState?.slots?.address ||
    typedState?.slots?.cep ||
    typedState?.slots?.cpf ||
    typedState?.slots?.billingDay ||
    typedState?.slots?.installShift ||
    typedState?.slots?.primaryPhone
  );

  if (!hasCommercialContext) return false;

  const lastAssistant = getLastAssistantMessage(params.history || []);
  const assistantAskedForCommercialData = COMMERCIAL_DATA_REQUEST_SIGNALS.some(signal => lastAssistant.includes(signal));
  if (!assistantAskedForCommercialData) return false;

  const extractedSlots = extractAgentSlotsFromMessage(params.userMessage);
  const repliedWithStructuredData = Object.values(extractedSlots).some(value =>
    value !== undefined && value !== null && String(value).trim() !== ''
  );
  const normalized = normalizeForMatch(params.userMessage || '');
  const mentionsBillingOrShift = /\b(?:5|10|15|20|25)\b/.test(normalized) || /\bmanha\b|\btarde\b/.test(normalized);
  const scopedRefusal = detectScopedDataRefusal(params.userMessage, params.history);

  return repliedWithStructuredData || mentionsBillingOrShift || scopedRefusal;
};

export const buildAgentStatePromptFragment = (state: unknown): string => {
  if (!state || typeof state !== 'object') return '';
  const typed = state as AgentConversationState;
  const slots = typed.slots || {};

  const lines: string[] = [];
  if (typed.lastRoute) lines.push(`Ultima rota inferida: ${typed.lastRoute}`);
  if (slots.planInterest) lines.push(`Plano de interesse: ${slots.planInterest}`);
  if (slots.billingDay) lines.push(`Dia de vencimento: ${slots.billingDay}`);
  if (slots.installShift) lines.push(`Turno de instalacao: ${slots.installShift}`);
  if (slots.cpf) lines.push(`CPF informado: ${slots.cpf}`);
  if (slots.cep) lines.push(`CEP informado: ${slots.cep}`);
  if (slots.primaryPhone) lines.push(`Telefone principal: ${slots.primaryPhone}`);
  if (slots.secondaryPhone) lines.push(`Telefone secundario: ${slots.secondaryPhone}`);
  if (slots.location) lines.push(`Localizacao compartilhada: ${slots.location}`);
  if (slots.address) lines.push(`Endereco informado: ${slots.address}`);

  if (!lines.length) return '';
  return `Estado operacional atual (fonte: memoria estruturada do fluxo):\n- ${lines.join('\n- ')}`;
};

const trimForQuery = (text: string, maxChars = 220): string => {
  const cleaned = String(text || '').replace(/\s+/g, ' ').trim();
  if (cleaned.length <= maxChars) return cleaned;
  return `${cleaned.slice(0, maxChars - 3).trimEnd()}...`;
};

const buildRecentHistoryFragment = (history: AgentHistoryLike[]): string => {
  const recent = history
    .filter(item => String(item.content || '').trim().length > 0)
    .slice(-3)
    .map(item => `${item.role.toUpperCase()}: ${trimForQuery(item.content, 160)}`);

  if (!recent.length) return '';
  return `Historico recente relevante:\n${recent.join('\n')}`;
};

export const buildMemoryQueryFromTurn = (params: {
  userMessage: string;
  history: AgentHistoryLike[];
  state?: unknown;
}): string => {
  const userMessage = String(params.userMessage || '').trim();
  const lastAssistant = [...(params.history || [])]
    .reverse()
    .find(item => item.role === 'assistant' && String(item.content || '').trim().length > 0);
  const lastUser = [...(params.history || [])]
    .reverse()
    .find(item => item.role === 'user' && String(item.content || '').trim().length > 0);

  const stateFragment = buildAgentStatePromptFragment(params.state);
  const recentHistoryFragment = buildRecentHistoryFragment(params.history || []);
  const normalizedUserMessage = normalizeForMatch(userMessage);
  const isShortUserReply = userMessage.length > 0 && userMessage.length <= 24;
  const isAmbiguousReply =
    (userMessage.length > 0 && userMessage.length <= 32) ||
    AMBIGUOUS_SHORT_REPLY_REGEX.test(normalizedUserMessage);

  if ((isShortUserReply || isAmbiguousReply) && lastAssistant) {
    const fragments = [
      lastUser ? `Ultima mensagem util do usuario: ${trimForQuery(lastUser.content, 160)}` : '',
      `Pergunta anterior do agente: ${trimForQuery(lastAssistant.content, 200)}`,
      `Resposta atual do usuario: ${trimForQuery(userMessage, 120)}`,
      stateFragment,
      recentHistoryFragment,
    ].filter(Boolean);

    return fragments.join('\n');
  }

  const fragments = [
    trimForQuery(userMessage, 220),
    stateFragment,
    userMessage.length <= 120 ? recentHistoryFragment : '',
  ].filter(Boolean);

  return fragments.join('\n');
};
