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

const NORMALIZE_REGEX = /[^\p{L}\p{N}\s]/gu;
const MULTI_SPACE_REGEX = /\s+/g;

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

const FALLBACK_BLOCKED_PATTERNS: RegExp[] = [
  /i\s+didn'?t\s+have\s+anything\s+to\s+say/i,
  /as\s+an?\s+(ai|language model)/i,
  /i\s+cannot\s+help\s+with\s+that/i,
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

const countSignalMatches = (normalizedText: string, route: Exclude<AgentRoute, 'UNKNOWN'>): { count: number; matched: string[] } => {
  const matched = ROUTE_SIGNALS[route].filter(signal => normalizedText.includes(signal));
  return { count: matched.length, matched };
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

  const blocked = FALLBACK_BLOCKED_PATTERNS.some(pattern => pattern.test(cleaned));
  if (!cleaned || blocked) {
    const preferredRoute = params.preferredRoute ?? 'ASSINATURA';
    if (preferredRoute !== 'ASSINATURA' && preferredRoute !== 'UNKNOWN') {
      return {
        reply: buildRouteRedirectMessage(preferredRoute),
        fallbackApplied: true,
        fallbackReason: blocked ? 'blocked_english_fallback' : 'empty_reply',
      };
    }
    return {
      reply: 'Perfeito, entendi. Me diga rapidamente o que voce precisa agora para eu te ajudar.',
      fallbackApplied: true,
      fallbackReason: blocked ? 'blocked_english_fallback' : 'empty_reply',
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

export const buildMemoryQueryFromTurn = (params: {
  userMessage: string;
  history: AgentHistoryLike[];
  state?: unknown;
}): string => {
  const userMessage = String(params.userMessage || '').trim();
  const lastAssistant = [...(params.history || [])]
    .reverse()
    .find(item => item.role === 'assistant' && String(item.content || '').trim().length > 0);

  const stateFragment = buildAgentStatePromptFragment(params.state);
  const isShortUserReply = userMessage.length > 0 && userMessage.length <= 24;

  if (isShortUserReply && lastAssistant) {
    const base = `Pergunta anterior do agente: ${lastAssistant.content}\nResposta atual do usuario: ${userMessage}`;
    return stateFragment ? `${base}\n${stateFragment}` : base;
  }

  return stateFragment ? `${userMessage}\n${stateFragment}` : userMessage;
};

