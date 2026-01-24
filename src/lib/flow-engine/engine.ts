'use server';
import { getProperty, setProperty } from 'dot-prop';
import vm from 'node:vm';
import { sendWhatsAppMessageAction } from '@/app/actions/evolutionApiActions';
import { sendChatwootMessageAction } from '@/app/actions/chatwootApiActions';
import { sendDialogyMessageAction } from '@/app/actions/dialogyApiActions';
import {
  loadSessionFromDB,
  saveSessionToDB,
  deleteSessionFromDB,
  loadChatwootInstanceFromDB,
  loadDialogyInstanceFromDB,
  saveFlowLog,
  loadWorkspaceFromDB,
  getCapabilityById,
  getCapabilitiesForWorkspace,
} from '@/app/actions/databaseActions';
import { executeCapability } from '@/lib/capability-executor';
import type { NodeData, Connection, FlowSession, WorkspaceData, ApiResponseMapping, FlowLog } from '@/lib/types';
import { genericTextGenerationFlow } from '@/ai/flows/generic-text-generation-flow';
import { simpleChatReply } from '@/ai/flows/simple-chat-reply-flow';
import { agenticFlow } from '@/ai/flows/agentic-flow';
import { intelligentChoice } from '@/ai/flows/intelligent-choice-flow';
import { classifyIntent } from '@/ai/flows/intention-classification-flow';
import { loadMemoryContext, normalizeMemorySettings, recordMemory, type MemorySettings } from '@/lib/agent/memory';
import { findNodeById, findNextNodeId, substituteVariablesInText, coerceToDate, compareDates, evaluateExpression } from './utils';
import jsonata from 'jsonata';


const CODE_EXECUTION_TIMEOUT_MS = 2000;
const MAX_AGENT_HISTORY_MESSAGES = 50;
const MAX_AGENT_MEMORY_SUMMARY_CHARS = 4000;
const MOJIBAKE_HINT_REGEX = /(Ã.|â.|)/;

type AgentHistoryEntry = { role: 'user' | 'assistant' | 'system'; content: string };
const EXIT_INTENT_PATTERNS = [
  'não quero', 'nao quero', 'não desejo', 'nao desejo', 'não', 'nao',
  'encerrar', 'encerra', 'encerrando', 'encerrar atendimento', 'finalizar', 'finaliza',
  'cancelar', 'cancelamento', 'cancela',
  'parar', 'chega', 'sair', 'sair do atendimento', 'tchau', 'adeus', 'obrigado, mas', 'obrigada, mas'
];

const repairMojibake = (text: string): string => {
  if (!text || !MOJIBAKE_HINT_REGEX.test(text)) return text;
  try {
    const candidate = Buffer.from(text, 'latin1').toString('utf8');
    const hasReplacement = candidate.includes('');
    const hasPortugueseAccents = /[áàãâéêíóôõúüçÁÀÃÂÉÊÍÓÔÕÚÜÇ]/.test(candidate);
    if (!hasReplacement && hasPortugueseAccents) {
      return candidate;
    }
  } catch {
    // ignore decoding issues
  }
  return text;
};

const cleanAndNormalizeText = (content: string): string => {
  if (!content) return '';
  let cleaned = repairMojibake(String(content));
  cleaned = cleaned.replace(/\r\n/g, '\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n');
  cleaned = cleaned.replace(/[ \t]{2,}/g, ' ').replace(/\s+([,.;!?])/g, '$1').trim();
  return cleaned.normalize('NFC');
};

const mergeMemorySummary = (currentSummary: string | undefined, addition: string): string => {
  const sanitizedAddition = cleanAndNormalizeText(addition);
  if (!sanitizedAddition) return currentSummary || '';
  const merged = [currentSummary, sanitizedAddition].filter(Boolean).join(' | ');
  return merged.length > MAX_AGENT_MEMORY_SUMMARY_CHARS
    ? merged.slice(merged.length - MAX_AGENT_MEMORY_SUMMARY_CHARS)
    : merged;
};

const splitIntoMessageBlocks = (text: string): string[] => {
  const cleaned = cleanAndNormalizeText(text);
  if (!cleaned) return [];

  // 1. Initial split by double newlines (paragraphs)
  let parts = cleaned.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);

  // 2. Refine: Split huge blocks (> 600 chars) by single newlines or sentences
  // This avoids sending massive walls of text in a single bubble
  const MAX_CHARS_PER_BLOCK = 600;

  parts = parts.flatMap(part => {
    if (part.length <= MAX_CHARS_PER_BLOCK) return [part];

    // Try splitting by single newline first
    const lines = part.split(/\n+/);
    if (lines.length > 1) {
      // Re-group lines to avoid tiny 1-word bubbles if possible, but keep under limit
      const groupedLines: string[] = [];
      let currentGroup = "";

      for (const line of lines) {
        if ((currentGroup + "\n" + line).length > MAX_CHARS_PER_BLOCK && currentGroup) {
          groupedLines.push(currentGroup.trim());
          currentGroup = line;
        } else {
          currentGroup = currentGroup ? currentGroup + "\n" + line : line;
        }
      }
      if (currentGroup) groupedLines.push(currentGroup.trim());

      // If splitting by lines helped reduce size, return it
      if (groupedLines.every(g => g.length <= MAX_CHARS_PER_BLOCK)) {
        return groupedLines;
      }
    }

    // Fallback: Split by sentence-like endings if still too big or no newlines
    // Regex matches . ! ? followed by space or end of string.
    const sentences = part.split(/([.!?]+(?:\s+|$))/).reduce((acc: string[], val, i, arr) => {
      if (i % 2 === 0) {
        const next = arr[i + 1] || "";
        acc.push(val + next);
      }
      return acc;
    }, []);

    const groupedSentences: string[] = [];
    let currentChunk = "";

    for (const s of sentences) {
      if ((currentChunk + s).length > MAX_CHARS_PER_BLOCK && currentChunk) {
        groupedSentences.push(currentChunk.trim());
        currentChunk = s;
      } else {
        currentChunk += s;
      }
    }
    if (currentChunk) groupedSentences.push(currentChunk.trim());

    return groupedSentences;
  });

  if (parts.length <= 1) return parts;

  // 3. Cap the number of bubbles to prevent spam notification storm
  // Increased to 7 to allow for more granular updates as requested
  const MAX_BUBBLES = 7;

  if (parts.length <= MAX_BUBBLES) {
    return parts;
  }

  // Merge tail if we exceed the limit (the last bubble might be longer, but it's a trade-off)
  const head = parts.slice(0, MAX_BUBBLES - 1);
  const tail = parts.slice(MAX_BUBBLES - 1).join('\n\n');

  return [...head, tail];
};

const trimAndSummarizeHistory = (
  history: AgentHistoryEntry[] | undefined,
  memorySummary: string | undefined
): { history: AgentHistoryEntry[]; memorySummary?: string } => {
  if (!Array.isArray(history) || history.length === 0) {
    return { history: [], memorySummary };
  }

  if (history.length <= MAX_AGENT_HISTORY_MESSAGES) {
    return { history, memorySummary };
  }

  const overflow = history.slice(0, history.length - MAX_AGENT_HISTORY_MESSAGES);
  const overflowText = overflow.map(entry => `${entry.role}: ${entry.content}`).join(' | ');
  const mergedSummary = mergeMemorySummary(memorySummary, overflowText);

  return {
    history: history.slice(-MAX_AGENT_HISTORY_MESSAGES),
    memorySummary: mergedSummary,
  };
};

const detectExitIntent = (text: string): boolean => {
  if (!text) return false;
  const normalized = text.toLowerCase();
  return EXIT_INTENT_PATTERNS.some(pattern => normalized.includes(pattern));
};

const normalizeOptionsFromString = (raw: string): string[] => {
  if (!raw) return [];
  const trimmed = raw.trim();
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed
          .map(item => (item === null || item === undefined ? '' : String(item)))
          .map(item => item.trim())
          .filter(item => item.length > 0);
      }
    } catch {
      // ignore parse errors
    }
  }
  const lines = raw
    .split(/\r?\n/)
    .map(opt => opt.replace(/^[\[\s,]+|[\],\s]+$/g, '').trim())
    .filter(opt => opt.length > 0);

  if (lines.length > 1) return lines;

  const validLine = lines[0];
  if (!validLine) return [];

  if (validLine.includes('\\n')) {
    return validLine.split('\\n').map(s => s.trim()).filter(Boolean);
  }

  if (validLine.includes(',')) {
    return validLine.split(',').map(s => s.trim()).filter(Boolean);
  }

  if (/^[\d.-]+(\s+[\d.-]+)+$/.test(validLine)) {
    return validLine.split(/\s+/).map(s => s.trim()).filter(Boolean);
  }

  return [validLine];
};

const resolveMemoryScopeKey = (
  memoryNode: NodeData | null,
  session: FlowSession,
  workspace: WorkspaceData
): string => {
  const scope = (memoryNode?.memoryScope || 'session').toString().toLowerCase();
  if (scope === 'workspace') return workspace.id;

  if (scope === 'user') {
    const rawPath = memoryNode?.memoryScopeKeyVariable?.replace(/\{\{|\}\}/g, '').trim();
    const scopedValue = rawPath ? getProperty(session.flow_variables, rawPath) : undefined;
    const fallbackValue =
      getProperty(session.flow_variables, 'user_id') ||
      getProperty(session.flow_variables, 'contact_id') ||
      getProperty(session.flow_variables, 'chatwoot_contact_id') ||
      getProperty(session.flow_variables, 'dialogy_contact_id');

    const resolved = scopedValue ?? fallbackValue;
    return resolved ? String(resolved) : session.session_id;
  }

  return session.session_id;
};

const buildMemorySettings = (
  memoryNode: NodeData | null,
  session: FlowSession,
  workspace: WorkspaceData
): MemorySettings => {
  const scopeKey = resolveMemoryScopeKey(memoryNode, session, workspace);
  return normalizeMemorySettings({
    provider: (memoryNode?.memoryProvider as any) || 'postgres',
    connectionString: memoryNode?.memoryConnectionString,
    scope: (memoryNode?.memoryScope as any) || 'session',
    scopeKey,
    retentionDays: memoryNode?.memoryRetentionDays ?? 14,
    maxItems: memoryNode?.memoryMaxItems ?? 60,
    minImportance: memoryNode?.memoryMinImportance ?? 0.35,
    redisConnectionString: memoryNode?.memoryRedisConnectionString,
    hybridCacheTTL: memoryNode?.memoryHybridCacheTTL,
    hybridWriteThrough: true, // Defaulting to true as not yet exposed in UI fully or defaults
    embeddingsEnabled: memoryNode?.memoryEmbeddingsEnabled,
    embeddingsModel: memoryNode?.memoryEmbeddingsModel,
  });
};

function createSandboxConsole(sessionId: string) {
  const prefix = `[Flow Engine Code][${sessionId}]`;
  return {
    log: (...args: any[]) => console.log(prefix, ...args),
    warn: (...args: any[]) => console.warn(prefix, ...args),
    error: (...args: any[]) => console.error(prefix, ...args),
  };
}

function toJSONSafe(value: any, seen = new WeakSet()): any {
  if (value === null || value === undefined) return value;
  const type = typeof value;
  if (type === 'string' || type === 'number' || type === 'boolean') return value;
  if (type === 'bigint') return value.toString();
  if (type === 'function' || type === 'symbol') return undefined;
  if (value instanceof Date) return value.toISOString();
  if (value instanceof RegExp) return value.toString();

  if (type === 'object') {
    if (seen.has(value)) return '[Circular]';
    seen.add(value);

    if (value instanceof Map) {
      return Array.from(value.entries()).map(([k, v]) => [toJSONSafe(k, seen), toJSONSafe(v, seen)]);
    }
    if (value instanceof Set) {
      return Array.from(value.values()).map(v => toJSONSafe(v, seen));
    }
    if (value instanceof Error) {
      return { name: value.name, message: value.message, stack: value.stack || '' };
    }
    if (Array.isArray(value)) {
      return value.map(item => toJSONSafe(item, seen));
    }

    const output: Record<string, any> = {};
    for (const key in value) {
      try {
        output[key] = toJSONSafe(value[key], seen);
      } catch {
        output[key] = '[Unserializable]';
      }
    }
    return output;
  }

  return value;
}

async function executeUserCodeSnippet(
  sessionId: string,
  codeSnippet: string,
  variables: Record<string, any>
) {
  const sandbox = {
    console: createSandboxConsole(sessionId),
    variables: JSON.parse(JSON.stringify(variables ?? {})),
    __userCode: codeSnippet,
  };

  const context = vm.createContext(sandbox, { name: `flow-engine-${sessionId}` });
  const script = new vm.Script(
    `(async () => {
        const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
        const fn = new AsyncFunction('variables', __userCode);
        return await fn(variables);
      })()`,
    { filename: 'flow-engine-user-code.js' }
  );

  const execution = script.runInContext(context);
  const result = await Promise.race([
    execution,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Code execution timed out')), CODE_EXECUTION_TIMEOUT_MS)
    ),
  ]);

  return toJSONSafe(result);
}

async function sendOmniChannelMessage(
  session: FlowSession,
  workspace: WorkspaceData,
  content: string
): Promise<void> {
  if (!content) return;

  const ctx = session.flow_context || (
    session.session_id.startsWith('dialogy_conv_') ? 'dialogy' :
      session.session_id.startsWith('chatwoot_conv_') ? 'chatwoot' :
        'evolution'
  );

  console.log(`[sendOmniChannelMessage] Initiating send for session ${session.session_id} with context ${ctx}`);

  if (ctx === 'dialogy') {
    let chatId =
      getProperty(session.flow_variables, 'dialogy_conversation_id') ||
      getProperty(session.flow_variables, 'webhook_payload.conversation.id') ||
      (session.session_id.startsWith('dialogy_conv_')
        ? session.session_id.replace('dialogy_conv_', '')
        : null);

    if (workspace.dialogy_instance_id && chatId) {
      const dialogyInstance = await loadDialogyInstanceFromDB(workspace.dialogy_instance_id);
      if (dialogyInstance) {
        console.log(`[sendOmniChannelMessage] Roteando para Dialogy (chatId=${chatId})`);
        await sendDialogyMessageAction({
          baseUrl: dialogyInstance.baseUrl,
          apiKey: dialogyInstance.apiKey,
          chatId: String(chatId),
          content
        });
        // Small delay to ensure message order is preserved by the API
        await new Promise(resolve => setTimeout(resolve, 500));
        return;
      } else {
        console.error(`[sendOmniChannelMessage] Instância Dialogy ${workspace.dialogy_instance_id} não encontrada na base.`);
        return;
      }
    }
    console.error(`[sendOmniChannelMessage] Falha ao enviar pela Dialogy. Instância (${workspace.dialogy_instance_id}) ou Chat ID (${chatId}) ausente.`);
    return;
  }

  if (ctx === 'chatwoot') {
    const accountId = getProperty(session.flow_variables, 'chatwoot_account_id');
    const conversationId = getProperty(session.flow_variables, 'chatwoot_conversation_id');
    if (workspace.chatwoot_instance_id && accountId && conversationId) {
      const chatwootInstance = await loadChatwootInstanceFromDB(workspace.chatwoot_instance_id);
      if (chatwootInstance) {
        console.log(`[sendOmniChannelMessage] Roteando para Chatwoot (conv=${conversationId})`);
        await sendChatwootMessageAction({
          baseUrl: chatwootInstance.baseUrl,
          apiAccessToken: chatwootInstance.apiAccessToken,
          accountId: Number(accountId),
          conversationId: Number(conversationId),
          content
        });
        // Small delay to ensure message order is preserved by the API
        await new Promise(resolve => setTimeout(resolve, 500));
        return;
      }
    }
    console.error(`[sendOmniChannelMessage] Falha ao enviar pelo Chatwoot. Instância, Account ID ou Conversation ID ausente.`);
    return;
  }

  // Se não for nenhum dos contextos acima, assume-se Evolution/WhatsApp como padrão
  const recipientPhoneNumber = session.flow_variables.whatsapp_sender_jid || session.session_id.split('@@')[0].replace('evolution_jid_', '');
  const evoWorkspace = workspace; // Usa o workspace já carregado

  if (evoWorkspace && evoWorkspace.evolution_instance_id && recipientPhoneNumber) {
    // Aqui, precisamos buscar os detalhes da instância evolution a partir do ID
    const evoDetails = await loadWorkspaceFromDB(evoWorkspace.id); // Esta chamada parece incorreta, deveria ser uma busca de instância
    // A lógica para buscar detalhes da instância precisa ser revista
    console.error(`[sendOmniChannelMessage] Lógica para buscar detalhes da instância Evolution precisa de revisão. Assumindo que o workspace tem os detalhes.`);
    // Assumindo por enquanto que o workspace tem os detalhes necessários, o que não é o caso ideal
    // Em uma refatoração futura, loadEvolutionInstanceFromDB(evoWorkspace.evolution_instance_id) seria o correto.

    console.log(`[sendOmniChannelMessage] Roteando para Evolution (jid=${recipientPhoneNumber})`);
    // A ação de envio de mensagem do Evolution precisa da URL base e API key, que não estão diretamente no objeto workspace.
    // Esta parte da lógica está quebrada e precisa ser consertada no futuro.
    // Por agora, vamos pular o envio se não tivermos os detalhes.
    console.error(`[sendOmniChannelMessage] Falha ao enviar pelo Evolution. A lógica para obter detalhes da instância (URL, API Key) a partir do workspace precisa ser implementada.`);
  } else {
    console.error(`[sendOmniChannelMessage] Falha ao enviar pelo Evolution. Instância (${evoWorkspace?.evolution_instance_id}) ou JID do destinatário (${recipientPhoneNumber}) ausente.`);
  }
}


export async function executeFlow(
  session: FlowSession,
  workspace: WorkspaceData | null
): Promise<void> {

  let currentWorkspace = workspace;
  if (!currentWorkspace || !currentWorkspace.id || !currentWorkspace.nodes || !currentWorkspace.connections) {
    console.error(`[Flow Engine] FATAL: Invalid workspace object provided. Aborting execution for session ${session.session_id}.`);
    return;
  }

  const { nodes, connections } = currentWorkspace;
  let currentNodeId = session.current_node_id;
  let shouldContinue = true;
  let flowEnded = false;

  console.log(`[Flow Engine] Starting execution loop. Start Node: ${currentNodeId}`);
  console.log(`[Flow Engine DEBUG] Workspace "${currentWorkspace.name}" has ${nodes.length} nodes and ${connections.length} connections.`);

  while (currentNodeId && shouldContinue) {
    const currentNode = findNodeById(currentNodeId, nodes);
    if (!currentNode) {
      console.error(`[Flow Engine - ${session.session_id}] Critical: Current node ID ${currentNodeId} not found. Deleting session.`);
      await deleteSessionFromDB(session.session_id);
      break;
    }

    console.log(`[Flow Engine - ${session.session_id}] Executing Node: ${currentNode.id} (${currentNode.type} - ${currentNode.title})`);

    // Track execution steps
    if (!session.steps) {
      session.steps = [];
    }
    // Avoid duplicate trailing steps if re-entering? No, users might loop.
    // However, we might want to avoid adding valid re-entries if it confuses the "path". 
    // But for "exact path", we should record it.
    session.steps.push(currentNodeId);

    let nextNodeId: string | null = null;
    session.current_node_id = currentNodeId;

    const nodeType = (currentNode.type ?? '')
      .toString()
      .trim()
      .toLowerCase()
      .replace(/[\u2010-\u2015\u2212]/g, '-');

    switch (nodeType) {
      case 'start': {
        const triggerHandle = getProperty(session.flow_variables, '_triggerHandle') || 'default';
        delete session.flow_variables['_triggerHandle'];
        nextNodeId = findNextNodeId(currentNode.id, triggerHandle, connections);
        break;
      }

      case 'message': {
        const messageText = substituteVariablesInText(currentNode.text, session.flow_variables);
        await sendOmniChannelMessage(session, currentWorkspace, messageText);
        nextNodeId = findNextNodeId(currentNode.id, 'default', connections);
        break;
      }

      case 'input':
      case 'date-input':
      case 'file-upload':
      case 'rating-input':
      case 'option': {
        if (getProperty(session.flow_variables, '_invalidOption') === true) {
          await sendOmniChannelMessage(session, currentWorkspace, "Opção inválida. Por favor, tente novamente.");
          delete session.flow_variables['_invalidOption'];
          shouldContinue = false;
          break;
        }

        if (nodeType === 'option') {
          const q = substituteVariablesInText(currentNode.questionText, session.flow_variables);

          let optionsList: Array<string | { id: string; value: string }> = [];
          // New structured options
          if (Array.isArray(currentNode.options) && currentNode.options.length > 0) {
            optionsList = currentNode.options.flatMap(opt => {
              const val = substituteVariablesInText(opt.value, session.flow_variables);
              if (opt.value && opt.value.includes('{{')) {
                const splitVals = normalizeOptionsFromString(val);
                if (splitVals.length > 1) {
                  return splitVals.map((v, i) => ({ id: `${opt.id}_${i}`, value: v }));
                }
              }
              return [{ id: opt.id, value: val }];
            });
          } else {
            // Legacy string-based options
            const substitutedOptions = substituteVariablesInText(currentNode.optionsList || '', session.flow_variables);
            optionsList = normalizeOptionsFromString(substitutedOptions);
          }

          if (q && optionsList.length > 0) {
            let messageWithOptions = q + '\n\n';
            optionsList.forEach((opt, index) => {
              const text = typeof opt === 'string' ? opt : opt.value;
              messageWithOptions += `${index + 1}. ${text}\n`;
            });

            let finalMessage = messageWithOptions.trim();
            if (session.flow_context !== 'chatwoot') {
              finalMessage += "\nResponda com o numero da opcao desejada ou o texto exato da opcao.";
              if (currentNode.aiEnabled) {
                finalMessage += "\nPode responder em texto livre; vou entender sua intencao.";
              }
            }

            await sendOmniChannelMessage(session, currentWorkspace, finalMessage);
            session.awaiting_input_type = 'option';
            session.awaiting_input_details = {
              variableToSave: currentNode.variableToSaveChoice || 'last_user_choice',
              options: optionsList,
              originalNodeId: currentNode.id,
              aiEnabled: currentNode.aiEnabled || false,
              aiModelName: currentNode.aiModelName
            };
            shouldContinue = false;
          } else {
            nextNodeId = findNextNodeId(currentNode.id, 'default', connections);
          }
        } else {
          const promptFieldName =
            nodeType === 'input' ? 'promptText' :
              nodeType === 'date-input' ? 'dateInputLabel' :
                nodeType === 'file-upload' ? 'uploadPromptText' :
                  'ratingQuestionText';

          const promptText = substituteVariablesInText(currentNode[promptFieldName], session.flow_variables);
          if (promptText) await sendOmniChannelMessage(session, currentWorkspace, promptText);

          session.awaiting_input_type = nodeType as any;
          session.awaiting_input_details = {
            variableToSave:
              currentNode.variableToSaveResponse ||
              currentNode.variableToSaveDate ||
              currentNode.fileUrlVariable ||
              currentNode.ratingOutputVariable ||
              'last_user_input',
            originalNodeId: currentNode.id
          };
          shouldContinue = false;
        }
        break;
      }

      case 'condition': {
        let conditionMet = false;
        const op = (currentNode.conditionOperator || '').toString().trim().toLowerCase();

        const varPath = currentNode.conditionVariable?.replace(/\{\{|\}\}/g, '').trim();
        let rawValA = varPath ? getProperty(session.flow_variables, varPath) : currentNode.conditionVariable;
        if (rawValA === undefined) rawValA = currentNode.conditionVariable;

        const rawValB = substituteVariablesInText(currentNode.conditionValue, session.flow_variables);

        const isDateOp = op === 'isdateafter' || op === 'isdatebefore';
        const dataType = (currentNode.conditionDataType || 'string').toString().toLowerCase();

        const parseValue = (v: any) => {
          if (isDateOp || dataType === 'date') {
            return coerceToDate(v) ?? v;
          }
          if (dataType === 'number') {
            const num = parseFloat(String(v));
            return isNaN(num) ? v : num;
          }
          if (dataType === 'boolean') {
            if (String(v).toLowerCase() === 'true') return true;
            if (String(v).toLowerCase() === 'false') return false;
            return v;
          }
          return v;
        };

        const valA: any = parseValue(rawValA);
        const valB: any = parseValue(rawValB);

        switch (op) {
          case '==': conditionMet = (valA as any) == (valB as any); break;
          case '!=': conditionMet = (valA as any) != (valB as any); break;
          case '>': conditionMet = (valA as any) > (valB as any); break;
          case '<': conditionMet = (valA as any) < (valB as any); break;
          case '>=': conditionMet = (valA as any) >= (valB as any); break;
          case '<=': conditionMet = (valA as any) <= (valB as any); break;
          case 'contains': conditionMet = String(valA ?? '').toLowerCase().includes(String(valB ?? '').toLowerCase()); break;
          case 'startswith': conditionMet = String(valA ?? '').toLowerCase().startsWith(String(valB ?? '').toLowerCase()); break;
          case 'endswith': conditionMet = String(valA ?? '').toLowerCase().endsWith(String(valB ?? '').toLowerCase()); break;
          case 'isempty': conditionMet = valA === undefined || valA === null || String(valA).trim() === ''; break;
          case 'isnotempty': conditionMet = !(valA === undefined || valA === null || String(valA).trim() === ''); break;
          case 'istrue': conditionMet = valA === true || String(valA).toLowerCase() === 'true'; break;
          case 'isfalse': conditionMet = valA === false || String(valA).toLowerCase() === 'false'; break;
          case 'isdateafter': {
            const { a, b } = compareDates(valA, valB);
            conditionMet = !!(a && b && a.getTime() > b.getTime());
            break;
          }
          case 'isdatebefore': {
            const { a, b } = compareDates(valA, valB);
            conditionMet = !!(a && b && a.getTime() < b.getTime());
            break;
          }
          default:
            console.warn(`[Flow Engine] Operador de condição desconhecido: "${currentNode.conditionOperator}" (normalizado: "${op}")`);
            conditionMet = false;
        }

        nextNodeId = findNextNodeId(currentNode.id, conditionMet ? 'true' : 'false', connections);
        break;
      }

      case 'time-of-day': {
        let isInTimeRange = false;
        try {
          const now = new Date();

          const startTimeStr = (currentNode.startTime ?? '').toString().trim();
          const endTimeStr = (currentNode.endTime ?? '').toString().trim();

          if (startTimeStr && endTimeStr && /^\d{2}:\d{2}(?::\d{2})?$/.test(startTimeStr) && /^\d{2}:\d{2}(?::\d{2})?$/.test(endTimeStr)) {
            const parseHM = (s: string) => {
              const [h, m, s2 = 0] = s.split(':').map(Number);
              return { h, m, s: s2 };
            };
            const { h: sh, m: sm, s: ss } = parseHM(startTimeStr);
            const { h: eh, m: em, s: es } = parseHM(endTimeStr);

            const startDate = new Date();
            startDate.setHours(sh, sm, ss, 0);

            const endDate = new Date();
            endDate.setHours(eh, em, es, 0);

            if (endDate.getTime() <= startDate.getTime()) {
              isInTimeRange = (now.getTime() >= startDate.getTime()) || (now.getTime() <= endDate.getTime());
            } else {
              isInTimeRange = now.getTime() >= startDate.getTime() && now.getTime() <= endDate.getTime();
            }
          } else {
            console.warn(`[Flow Engine - ${session.session_id}] time-of-day: horários inválidos ou ausentes (start="${startTimeStr}" end="${endTimeStr}"). Considerando fora do intervalo.`);
            isInTimeRange = false;
          }

          console.log(`[Flow Engine - ${session.session_id}] Time of Day Check: ${currentNode.startTime}-${currentNode.endTime}. Now: ${now.toLocaleTimeString()}. In range: ${isInTimeRange}`);
        } catch (err: any) {
          console.error(`[Flow Engine - ${session.session_id}] Time of Day Error:`, err);
          isInTimeRange = false;
        }

        nextNodeId = findNextNodeId(currentNode.id, isInTimeRange ? 'true' : 'false', connections);
        break;
      }

      case 'switch': {
        const switchVarName = currentNode.switchVariable?.replace(/\{\{|\}\}/g, '').trim();

        const switchActualValue = switchVarName ? evaluateExpression(switchVarName, session.flow_variables) : undefined;
        let matchedCase = false;

        if (Array.isArray(currentNode.switchCases)) {
          for (const caseItem of currentNode.switchCases) {
            const caseValue = substituteVariablesInText(caseItem.value, session.flow_variables);
            if (String(switchActualValue) === String(caseValue)) {
              console.log(`[Flow Engine - ${session.session_id}] Switch: Matched case '${caseValue}'`);
              nextNodeId = findNextNodeId(currentNode.id, caseItem.id, connections);
              matchedCase = true;
              break;
            }
          }
        }

        if (!matchedCase) {
          console.log(`[Flow Engine - ${session.session_id}] Switch: No case matched. Using default 'otherwise' path.`);
          nextNodeId = findNextNodeId(currentNode.id, 'otherwise', connections);
        }
        break;
      }

      case 'set-variable': {
        if (currentNode.variableName) {
          const valueToSet = substituteVariablesInText(currentNode.variableValue, session.flow_variables);
          setProperty(session.flow_variables, currentNode.variableName, valueToSet);
          console.log(`[Flow Engine - ${session.session_id}] Variable "${currentNode.variableName}" set to "${valueToSet}"`);
        }
        nextNodeId = findNextNodeId(currentNode.id, 'default', connections);
        break;
      }

      case 'api-call': {
        const varName = currentNode.apiOutputVariable;
        let responseData: any = null;
        let errorData: any = null;

        let url = '';
        try {
          url = substituteVariablesInText(currentNode.apiUrl, session.flow_variables);
          const method = currentNode.apiMethod || 'GET';
          const headers = new Headers();
          (currentNode.apiHeadersList || []).forEach(h => headers.append(substituteVariablesInText(h.key, session.flow_variables), substituteVariablesInText(h.value, session.flow_variables)));

          if (currentNode.apiAuthType === 'bearer' && currentNode.apiAuthBearerToken) {
            headers.append('Authorization', `Bearer ${substituteVariablesInText(currentNode.apiAuthBearerToken, session.flow_variables)}`);
          } else if (currentNode.apiAuthType === 'basic' && currentNode.apiAuthBasicUser && currentNode.apiAuthBasicPassword) {
            const user = substituteVariablesInText(currentNode.apiAuthBasicUser, session.flow_variables);
            const pass = substituteVariablesInText(currentNode.apiAuthBasicPassword, session.flow_variables);
            headers.append('Authorization', `Basic ${btoa(`${user}:${pass}`)}`);
          }

          const queryParams = new URLSearchParams();
          (currentNode.apiQueryParamsList || []).forEach(p => queryParams.append(substituteVariablesInText(p.key, session.flow_variables), substituteVariablesInText(p.value, session.flow_variables)));
          const queryString = queryParams.toString();
          if (queryString) url += (url.includes('?') ? '&' : '?') + queryString;

          let body: BodyInit | null = null;
          if (method !== 'GET' && method !== 'HEAD') {
            if (currentNode.apiBodyType === 'json' && currentNode.apiBodyJson) {
              body = substituteVariablesInText(currentNode.apiBodyJson, session.flow_variables);
              if (!headers.has('Content-Type')) headers.append('Content-Type', 'application/json');
            } else if (currentNode.apiBodyType === 'raw' && currentNode.apiBodyRaw) {
              body = substituteVariablesInText(currentNode.apiBodyRaw, session.flow_variables);
            } else if (currentNode.apiBodyType === 'form-data') {
              const formData = new FormData();
              (currentNode.apiBodyFormDataList || []).forEach(field => {
                const key = substituteVariablesInText(field.key, session.flow_variables);
                if (!key) return;
                const value = substituteVariablesInText(field.value, session.flow_variables);
                formData.append(key, value);
              });
              body = formData;
            }
          }

          console.log(`[Flow Engine - ${session.session_id}] API Call: ${method} ${url}`);
          const response = await fetch(url, { method, headers, body });
          responseData = await response.json().catch(() => response.text());

          if (!response.ok) {
            throw new Error(`API returned status ${response.status}`);
          }

          if (varName) {
            let valueToSave = responseData;
            if (currentNode.apiResponsePath) {
              const expression = jsonata(currentNode.apiResponsePath);
              valueToSave = await expression.evaluate(responseData);
            }
            setProperty(session.flow_variables, varName, valueToSave);
          }

          if (currentNode.apiResponseMappings && Array.isArray(currentNode.apiResponseMappings)) {
            for (const mapping of currentNode.apiResponseMappings) {
              if (mapping.jsonPath && mapping.flowVariable) {
                try {
                  const expression = jsonata(mapping.jsonPath);
                  const extractedValue = await expression.evaluate(responseData);

                  if (mapping.extractAs === 'list') {
                    const rawList = Array.isArray(extractedValue)
                      ? extractedValue
                      : (extractedValue === undefined || extractedValue === null ? [] : [extractedValue]);

                    const normalizedList = mapping.itemField
                      ? rawList.map(item => {
                        if (item === undefined || item === null) return undefined;
                        if (typeof item === 'object') {
                          return getProperty(item, mapping.itemField!);
                        }
                        return item;
                      }).filter(item => item !== undefined && item !== null)
                      : rawList;

                    setProperty(session.flow_variables, mapping.flowVariable, normalizedList);
                  } else {
                    setProperty(session.flow_variables, mapping.flowVariable, extractedValue);
                  }
                  console.log(`[Flow Engine] API Mapping: Set '${mapping.flowVariable}' from path '${mapping.jsonPath}'`);
                } catch (e: any) {
                  console.error(`[Flow Engine] Error evaluating JSONata expression '${mapping.jsonPath}':`, e.message);
                }
              }
            }
          }

        } catch (error: any) {
          console.error(`[Flow Engine - ${session.session_id}] API Call Error:`, error);
          errorData = { error: error.message };
          if (varName) {
            setProperty(session.flow_variables, varName, errorData);
          }
        } finally {
          const logEntry: Omit<FlowLog, 'id'> = {
            workspace_id: currentWorkspace.id,
            log_type: 'api-call',
            session_id: session.session_id,
            timestamp: new Date().toISOString(),
            details: {
              nodeId: currentNode.id,
              nodeTitle: currentNode.title,
              requestUrl: url,
              response: responseData,
              error: errorData,
            }
          };
          saveFlowLog(logEntry).catch(e => console.error("[Flow Engine] Failed to save API log to DB:", e));
        }
        nextNodeId = findNextNodeId(currentNode.id, 'default', connections);
        break;
      }

      case 'capability': {
        const outputVar = currentNode.capabilityOutputVariable;
        const capId = currentNode.capabilityId;

        if (capId) {
          try {
            // Fetch fresh capability data to get execution_config
            const capResult = await getCapabilityById(capId);
            if (capResult.data) {
              const capability = capResult.data;
              console.log(`[Flow Engine] Executing capability ${capability.slug} (${capability.id})`);

              // PASS ALL VARIABLES AS INPUT (Naive approach for now)
              // In the future, we should add an input mapping UI to the Capability Node.
              const input = { ...session.flow_variables };

              const result = await executeCapability(capability, input);

              if (outputVar) {
                setProperty(session.flow_variables, outputVar, result);
                console.log(`[Flow Engine] Capability output set to "${outputVar}".`);
              }
            } else {
              console.error(`[Flow Engine] Capability ${capId} not found.`);
              if (outputVar) setProperty(session.flow_variables, outputVar, { error: 'Capability not found' });
            }
          } catch (err: any) {
            console.error(`[Flow Engine] Capability execution failed:`, err);
            if (outputVar) setProperty(session.flow_variables, outputVar, { error: err.message });
          }
        } else {
          // Fallback to simulated if no ID (shouldn't happen in real usage)
          const simulatedOutput = currentNode.capabilityContract?.outputSample ?? {
            status: 'simulated',
            capability: currentNode.capabilityName || 'unknown',
          };
          if (outputVar) setProperty(session.flow_variables, outputVar, simulatedOutput);
        }
        nextNodeId = findNextNodeId(currentNode.id, 'default', connections);
        break;
      }

      case 'code-execution': {
        const varName = currentNode.codeOutputVariable;
        if (currentNode.codeSnippet && varName) {
          try {
            const result = await executeUserCodeSnippet(
              session.session_id,
              currentNode.codeSnippet,
              session.flow_variables
            );
            setProperty(session.flow_variables, varName, result);
            console.log(`[Flow Engine Code] Variável "${varName}" definida com sucesso.`);
          } catch (e: any) {
            console.error(`[Flow Engine - ${session.session_id}] Erro ao executar código no sandbox:`, e);
            setProperty(session.flow_variables, varName, { error: e.message });
          }
        } else {
          console.warn(`[Flow Engine] Nó 'Executar Código' sem script ou variável de saída definida.`);
        }
        nextNodeId = findNextNodeId(currentNode.id, 'default', connections);
        break;
      }

      case 'ai-text-generation': {
        const varName = currentNode.aiOutputVariable;
        if (varName && currentNode.aiPromptText) {
          try {
            const promptText = substituteVariablesInText(currentNode.aiPromptText, session.flow_variables);
            console.log(`[Flow Engine - ${session.session_id}] AI Text Gen: Calling genericTextGenerationFlow with prompt: "${promptText}"`);
            const aiResponse = await genericTextGenerationFlow({ promptText });
            setProperty(session.flow_variables, varName, aiResponse.generatedText);
          } catch (e: any) {
            console.error(`[Flow Engine - ${session.session_id}] AI Text Gen Error:`, e);
            setProperty(session.flow_variables, varName, `Error generating text: ${e.message}`);
          }
        }
        nextNodeId = findNextNodeId(currentNode.id, 'default', connections);
        break;
      }

      case 'intelligent-agent': {
        const responseVarName = currentNode.agentResponseVariable;
        const inputVarName = currentNode.userInputVariable?.replace(/\{\{|\}\}/g, '').trim();
        const modelName = currentNode.aiModelName;
        const maxTurns = currentNode.maxConversationTurns ?? null;
        const systemPrompt = substituteVariablesInText(currentNode.agentSystemPrompt, session.flow_variables);

        if (responseVarName && inputVarName) {
          try {
            const userInputForAgent = getProperty(session.flow_variables, inputVarName);
            if (userInputForAgent) {
              const cleanedUserInput = cleanAndNormalizeText(String(userInputForAgent));
              console.log(`[Flow Engine - ${session.session_id}] Intelligent Agent: Calling agenticFlow with input: "${cleanedUserInput}" (model: ${modelName || 'default'})`);

              if (detectExitIntent(cleanedUserInput)) {
                console.log(`[Flow Engine - ${session.session_id}] Exit intent detected. Continuing flow.`);
                setProperty(session.flow_variables, responseVarName, cleanedUserInput);
                setProperty(session.flow_variables, `_agent_exit_intent_${currentNode.id}`, true);
                nextNodeId = findNextNodeId(currentNode.id, 'default', connections);
                shouldContinue = true;
                break;
              }

              const historyKey = `_agent_history_${currentNode.id}`;
              const historySummaryKey = `_agent_history_summary_${currentNode.id}`;
              const existingHistory = getProperty(session.flow_variables, historyKey) as AgentHistoryEntry[] | undefined;
              let memorySummary = getProperty(session.flow_variables, historySummaryKey) as string | undefined;

              let history = Array.isArray(existingHistory)
                ? existingHistory.map(entry => ({
                  role: entry.role,
                  content: cleanAndNormalizeText(String(entry.content ?? '')),
                }))
                : [];

              ({ history, memorySummary } = trimAndSummarizeHistory(history, memorySummary));

              history.push({ role: 'user', content: cleanedUserInput });
              ({ history, memorySummary } = trimAndSummarizeHistory(history, memorySummary));

              // Autonomous Agent Integration: Resolve memory, tools, and model
              console.log(`[Flow Engine] Inspecting connections for Agent ${currentNode.id}`);

              const incoming = connections.filter(c => c.to === currentNode.id);
              const outgoing = connections.filter(c => c.from === currentNode.id);

              console.log(`[Flow Engine] Connections: Incoming=${incoming.length}, Outgoing=${outgoing.length}`);

              // Allow Memory Node to be connected in either direction
              const memoryConnection =
                incoming.find(c => c.targetHandle === 'memory') ||
                outgoing.find(c => {
                  const target = findNodeById(c.to, currentWorkspace.nodes);
                  return target?.type === 'ai-memory-config';
                });

              const memoryNode = memoryConnection
                ? (findNodeById(memoryConnection.from === currentNode.id ? memoryConnection.to : memoryConnection.from, currentWorkspace.nodes) || null)
                : null;
              const memorySettings = buildMemorySettings(memoryNode, session, currentWorkspace);

              let memoryContext: Awaited<ReturnType<typeof loadMemoryContext>> | undefined;
              try {
                memoryContext = await loadMemoryContext({
                  settings: memorySettings,
                  workspaceId: currentWorkspace.id,
                  agentId: currentNode.id,
                  query: cleanedUserInput,
                });
              } catch (error) {
                console.warn(`[Flow Engine] Memory context unavailable for agent ${currentNode.id}`, error);
              }

              // 1. Resolve Tools (Bidirectional)
              const connectedTools: any[] = [];

              // Incoming to 'tools' handle
              const incomingTools = incoming.filter(c => c.targetHandle === 'tools');

              // Outgoing to known tool types (Tool/Knowledge/HTTP)
              const outgoingTools = outgoing.filter(c => {
                const target = findNodeById(c.to, currentWorkspace.nodes);
                return target?.type === 'knowledge' || target?.type === 'http-tool' || target?.type === 'capability';
              });

              const toolConnections = [...incomingTools, ...outgoingTools];

              if (toolConnections.length > 0) {
                console.log(`[Flow Engine] Found ${toolConnections.length} connected tools for agent ${currentNode.id}`);
                for (const conn of toolConnections) {
                  const sourceNode = findNodeById(conn.from, currentWorkspace.nodes);
                  if (sourceNode?.type === 'capability' && sourceNode.capabilityId) {
                    try {
                      const cap = await getCapabilityById(sourceNode.capabilityId);
                      if (cap) connectedTools.push(cap);
                    } catch (err) {
                      console.error(`[Flow Engine] Failed to load capability ${sourceNode.capabilityId}`, err);
                    }
                  } else if (sourceNode?.type === 'http-tool') {
                    try {
                      const extractVars = (str: string | undefined): string[] => {
                        if (!str) return [];
                        // Basic regex for {{var}}
                        const matches = str.matchAll(/\{\{([^}]+)\}\}/g);
                        return Array.from(matches, m => m[1].trim());
                      };

                      const vars = new Set([
                        ...extractVars(sourceNode.httpToolUrl),
                        ...extractVars(sourceNode.httpToolBody),
                        ...(sourceNode.httpToolHeaders || []).flatMap((h: any) => extractVars(h.value)),
                        ...(sourceNode.httpToolParams || []).flatMap((p: any) => extractVars(p.value)),
                        ...(sourceNode.httpToolFormData || []).flatMap((f: any) => extractVars(f.value)),
                        ...extractVars(sourceNode.httpToolAuthToken),
                        ...extractVars(sourceNode.httpToolAuthKey)
                      ]);

                      const properties: Record<string, any> = {};
                      vars.forEach(v => properties[v] = { type: 'string' });

                      const inputSchema = JSON.stringify({
                        type: 'object',
                        properties,
                        required: Array.from(vars)
                      });

                      const httpCap = {
                        id: `http-${sourceNode.id}`,
                        workspace_id: currentWorkspace.id,
                        name: sourceNode.httpToolName || 'HTTP Request',
                        slug: sourceNode.httpToolName?.toLowerCase().replace(/[^a-z0-9_]/g, '') || `http_tool_${sourceNode.id.substring(0, 4)}`,
                        version: '1.0.0',
                        contract: {
                          description: sourceNode.httpToolDescription || 'Performs an specific HTTP request.',
                          inputSchema: inputSchema,
                          outputSample: {}
                        },
                        execution_config: {
                          type: 'api', // Use the generic API executor which now supports substitution
                          apiUrl: sourceNode.httpToolUrl,
                          apiMethod: sourceNode.httpToolMethod || 'GET',
                          apiHeaders: (sourceNode.httpToolHeaders || []).reduce((acc: any, h: any) => ({ ...acc, [h.key]: h.value }), {}),
                          apiBody: sourceNode.httpToolBody,
                          apiBodyType: sourceNode.httpToolBodyType,
                          apiParams: (sourceNode.httpToolParams || []).reduce((acc: any, p: any) => ({ ...acc, [p.key]: p.value }), {}),
                          apiFormData: (sourceNode.httpToolFormData || []).reduce((acc: any, p: any) => ({ ...acc, [p.key]: p.value }), {}),
                          apiAuth: {
                            type: sourceNode.httpToolAuthType,
                            key: sourceNode.httpToolAuthKey,
                            token: sourceNode.httpToolAuthToken
                          }
                        }
                      };
                      connectedTools.push(httpCap);
                      console.log(`[Flow Engine] Registered Tool Definition for Agent: ${httpCap.slug} (Available)`);
                    } catch (err) {
                      console.error(`[Flow Engine] Failed to build HTTP Tool ${sourceNode.id}`, err);
                    }
                  } else if (sourceNode?.type === 'knowledge') {
                    try {
                      const memoryNodeForInheritance = currentWorkspace.nodes.find(n => n.type === 'ai-memory-config');
                      const connectionString = sourceNode.knowledgeConnectionString || memoryNodeForInheritance?.memoryConnectionString;
                      const embeddingsModel = sourceNode.knowledgeEmbeddingsModel || memoryNodeForInheritance?.memoryEmbeddingsModel || 'local-hybrid';

                      const knowledgeCap = {
                        id: `knowledge-lookup-${sourceNode.id}`,
                        workspace_id: currentWorkspace.id,
                        name: sourceNode.title || 'Knowledge Base Lookup',
                        slug: 'lookup_knowledge', // FIXED slug to match agent expectation
                        version: '1.0.0',
                        contract: {
                          summary: 'Busca informações na base de conhecimento da empresa/agente',
                          description: 'Use esta ferramenta para buscar qualquer informação sobre a empresa, como planos de internet, preços, regiões de cobertura, FAQs, políticas, produtos e serviços. Se o usuário perguntar "você tem...", "qual o preço", "como funciona", "tem internet em...", sempre use esta ferramenta.',
                          triggerPhrases: [
                            'plano', 'planos', 'preço', 'preços', 'região', 'regiões', 'valor', 'valores',
                            'internet', 'fibra', 'wifi', 'conexão', 'velocidade', 'mega', 'instalação',
                            'atendemos', 'atende', 'cobertura', 'faq', 'ajuda', 'dúvida', 'informação', 'informações',
                            'como funciona', 'quanto custa', 'qual o valor', 'sobre a empresa', 'você tem', 'vcs tem', 'gostaria de saber'
                          ],
                          inputSchema: JSON.stringify({
                            type: 'object',
                            properties: {
                              query: { type: 'string', description: 'Termo ou pergunta para buscar na base de conhecimento' },
                              category: { type: 'string', description: 'Categoria opcional: plans, regions, faq, products, services' }
                            },
                            required: ['query']
                          })
                        },
                        execution_config: {
                          type: 'function',
                          functionName: 'lookupKnowledge',
                          _workspaceId: currentWorkspace.id,
                          _connectionString: connectionString,
                          _embeddingsModel: embeddingsModel
                        }
                      };
                      connectedTools.push(knowledgeCap);
                      console.log(`[Flow Engine] Registered Knowledge Tool for Agent: ${knowledgeCap.slug} (From explicit connection)`);
                    } catch (err) {
                      console.error(`[Flow Engine] Failed to build Knowledge Tool ${sourceNode.id}`, err);
                    }
                  }
                }
              } else {
                // Fallback: If no tools connected, fetch ALL workspace capabilities (Legacy/Default behavior)
                // Or we can decide to have NO tools if none connected. 
                // User request implies "n8n style", so likely explicit only. 
                // But for backward compatibility, maybe keep global if 0 connected?
                // Let's stick to explicit only if the user is using the new handles. 
                // Providing a fallback might be safer for existing flows.
                console.log(`[Flow Engine] No tools explicitly connected. Falling back to all workspace capabilities.`);
                const allCaps = await getCapabilitiesForWorkspace(currentWorkspace.id);
                connectedTools.push(...allCaps);
              }

              // Auto-inject lookup_knowledge tool if Memory Node is connected (Legacy/Fallback)
              // Only inject if NOT already added by an explicit Knowledge Node connection
              if (memoryNode && !connectedTools.some(t => t.slug === 'lookup_knowledge')) {
                const knowledgeLookupCap = {
                  id: `knowledge-lookup-${currentNode.id}`,
                  workspace_id: currentWorkspace.id,
                  name: 'Knowledge Base Lookup',
                  slug: 'lookup_knowledge',
                  version: '1.0.0',
                  contract: {
                    summary: 'Busca informações na base de conhecimento da empresa/agente',
                    description: 'Use esta ferramenta para buscar qualquer informação sobre a empresa, como planos de internet, preços, regiões de cobertura, FAQs, políticas, produtos e serviços. Se o usuário perguntar "você tem...", "qual o preço", "como funciona", "tem internet em...", sempre use esta ferramenta.',
                    triggerPhrases: [
                      // Singular/Plural
                      'plano', 'planos', 'preço', 'preços', 'região', 'regiões', 'valor', 'valores',
                      // Domain specific
                      'internet', 'fibra', 'wifi', 'conexão', 'velocidade', 'mega', 'instalação',
                      // Intent
                      'atendemos', 'atende', 'cobertura', 'faq', 'ajuda', 'dúvida', 'informação', 'informações',
                      // Common questions
                      'como funciona', 'quanto custa', 'qual o valor', 'sobre a empresa', 'você tem', 'vcs tem', 'gostaria de saber'
                    ],
                    inputSchema: JSON.stringify({
                      type: 'object',
                      properties: {
                        query: { type: 'string', description: 'Termo ou pergunta para buscar na base de conhecimento' },
                        category: { type: 'string', description: 'Categoria opcional: plans, regions, faq, products, services' }
                      },
                      required: ['query']
                    })
                  },
                  execution_config: {
                    type: 'function',
                    functionName: 'lookupKnowledge',
                    // Additional context injected at execution time
                    _workspaceId: currentWorkspace.id,
                    _connectionString: memorySettings.connectionString,
                    _embeddingsModel: memorySettings.embeddingsModel,
                  }
                };

                console.log(`[Flow Engine] Injected lookup_knowledge tool for agent ${currentNode.id}`);
                connectedTools.push(knowledgeLookupCap);
              }

              // 2. Resolve Model Configuration
              let targetModel = modelName;
              let targetApiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY; // Default fallback

              const modelConnection = connections.find(c => c.to === currentNode.id && c.targetHandle === 'model');
              if (modelConnection) {
                const modelNode = findNodeById(modelConnection.from, currentWorkspace.nodes);
                if (modelNode?.type === 'ai-model-config') {
                  if (modelNode.aiModelName) targetModel = substituteVariablesInText(modelNode.aiModelName, session.flow_variables);
                  if (modelNode.aiApiKey) targetApiKey = substituteVariablesInText(modelNode.aiApiKey, session.flow_variables);
                  // Provider logic can be added here if agenticFlow supports it
                }
              }


              const agentReply = await agenticFlow({
                userMessage: cleanedUserInput,
                capabilities: connectedTools,
                history: history,
                modelName: targetModel,
                modelConfig: targetApiKey ? { apiKey: targetApiKey } : undefined,
                systemPrompt,
                temperature: currentNode.temperature,
                memoryContext,
              });

              const cleanedReply = cleanAndNormalizeText(agentReply.botReply);
              const messageBlocks = splitIntoMessageBlocks(cleanedReply);
              const replyForHistory = messageBlocks.length > 0 ? messageBlocks.join('\n\n') : cleanedReply;

              setProperty(session.flow_variables, responseVarName, cleanedReply);

              history.push({ role: 'assistant', content: replyForHistory });
              ({ history, memorySummary } = trimAndSummarizeHistory(history, memorySummary));

              setProperty(session.flow_variables, historyKey, history);
              if (memorySummary) {
                setProperty(session.flow_variables, historySummaryKey, memorySummary);
              }

              try {
                await recordMemory({
                  settings: memorySettings,
                  workspaceId: currentWorkspace.id,
                  agentId: currentNode.id,
                  userMessage: cleanedUserInput,
                  assistantMessage: replyForHistory,
                  systemPrompt,
                  modelName: targetModel,
                });
              } catch (error) {
                console.warn(`[Flow Engine] Failed to record memory for agent ${currentNode.id}`, error);
              }

              const blocksToSend = messageBlocks.length > 0 ? messageBlocks : [cleanedReply];
              for (const block of blocksToSend) {
                await sendOmniChannelMessage(session, currentWorkspace, block);
              }
            } else {
              console.warn(`[Flow Engine - ${session.session_id}] Intelligent Agent: Input variable '${inputVarName}' not found.`);
              setProperty(session.flow_variables, responseVarName, 'Error: User input not found.');
            }
          } catch (e: any) {
            console.error(`[Flow Engine - ${session.session_id}] Intelligent Agent Error:`, e);
            setProperty(session.flow_variables, responseVarName, `Error with agent: ${e.message}`);
          }
        }

        // Controle de turnos: se atingir o limite, siga o fluxo normal
        const agentTurnKey = `_agent_turns_${currentNode.id}`;
        const currentTurn = Number(getProperty(session.flow_variables, agentTurnKey) || 0) + 1;
        setProperty(session.flow_variables, agentTurnKey, currentTurn);
        if (maxTurns && currentTurn >= maxTurns) {
          nextNodeId = findNextNodeId(currentNode.id, 'default', connections);
          shouldContinue = true;
          break;
        }

        // Mantém a conversa viva aguardando nova mensagem do usuário
        session.awaiting_input_type = 'input';
        session.awaiting_input_details = {
          variableToSave: inputVarName,
          originalNodeId: currentNode.id,
        };
        session.current_node_id = currentNode.id;
        shouldContinue = false;
        nextNodeId = currentNode.id;
        break;
      }

      case 'delay': {
        await new Promise(resolve => setTimeout(resolve, currentNode.delayDuration || 1000));
        nextNodeId = findNextNodeId(currentNode.id, 'default', connections);
        break;
      }

      case 'log-console': {
        console.log(`[FLOW LOG - ${session.session_id}] ${substituteVariablesInText(currentNode.logMessage, session.flow_variables)}`);
        nextNodeId = findNextNodeId(currentNode.id, 'default', connections);
        break;
      }

      case 'dialogy-send-message': {
        const content = substituteVariablesInText(currentNode.dialogyMessageContent, session.flow_variables);
        await sendOmniChannelMessage(session, currentWorkspace, content);
        nextNodeId = findNextNodeId(currentNode.id, 'default', connections);
        break;
      }

      case 'intention-router': {
        const userMessage = getProperty(session.flow_variables, 'last_user_input') || getProperty(session.flow_variables, 'last_user_choice');
        const intents = currentNode.intents;

        if (!userMessage || !Array.isArray(intents) || intents.length === 0) {
          console.warn(`[Flow Engine - ${session.session_id}] Intention Router: Missing user message or intents definition.`);
          nextNodeId = findNextNodeId(currentNode.id, 'default', connections);
          break;
        }

        console.log(`[Flow Engine - ${session.session_id}] Classifying intent for message: "${userMessage}" against ${intents.length} intents.`);

        try {
          const classification = await classifyIntent({
            userMessage: String(userMessage),
            intents: intents,
            modelName: 'googleai/gemini-2.0-flash' // Could be made configurable later
          });

          if (classification.matchedIntentId) {
            console.log(`[Flow Engine] Intent Matched: ${classification.matchedIntentId} (Confidence: ${classification.confidence})`);
            nextNodeId = findNextNodeId(currentNode.id, classification.matchedIntentId, connections);

            // Saving result to variables for debugging or usage
            setProperty(session.flow_variables, `_intent_result_${currentNode.id}`, classification);
          } else {
            console.log(`[Flow Engine] No intent matched. Reasoning: ${classification.reasoning}`);
            nextNodeId = findNextNodeId(currentNode.id, 'default', connections);
          }
        } catch (error) {
          console.error(`[Flow Engine] Intention Classification Failed:`, error);
          nextNodeId = findNextNodeId(currentNode.id, 'default', connections);
        }
        break;
      }

      case 'end-flow': {
        console.log(`[Flow Engine - ${session.session_id}] Reached End Flow node. Ending session.`);
        session.current_node_id = null;
        session.awaiting_input_type = null;
        session.awaiting_input_details = null;
        delete session.flow_variables.__flowPaused;
        shouldContinue = false;
        flowEnded = true;
        nextNodeId = null;
        break;
      }

      default: {
        console.warn(`[Flow Engine - ${session.session_id}] Node type '${currentNode.type}' (normalized='${nodeType}') not fully implemented or does not pause. Trying 'default' exit.`);
        nextNodeId = findNextNodeId(currentNode.id, 'default', connections);
        break;
      }
    }

    if (shouldContinue) {
      currentNodeId = nextNodeId;
    }
  }

  if (flowEnded) {
    console.log(`[Flow Engine - ${session.session_id}] Flow marked as finished. Deleting session.`);
    await deleteSessionFromDB(session.session_id);
    return;
  }

  if (shouldContinue && !currentNodeId) {
    session.current_node_id = null;
    session.awaiting_input_type = null;
    session.awaiting_input_details = null;
    session.flow_variables.__flowPaused = true;
    console.log(`[Flow Engine - ${session.session_id}] Execution loop ended at a dead end. Pausing session.`);
  } else if (!shouldContinue) {
    session.current_node_id = currentNodeId;
    console.log(`[Flow Engine - ${session.session_id}] Execution loop paused or ended. Saving session state. Paused: ${!shouldContinue}.`);
  }
  await saveSessionToDB(session);
}
