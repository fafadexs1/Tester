
'use server';
import { getProperty, setProperty } from 'dot-prop';
import ivm from 'isolated-vm';
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
} from '@/app/actions/databaseActions';
import type { NodeData, Connection, FlowSession, WorkspaceData, ApiResponseMapping, FlowLog } from '@/lib/types';
import { genericTextGenerationFlow } from '@/ai/flows/generic-text-generation-flow';
import { simpleChatReply } from '@/ai/flows/simple-chat-reply-flow';
import { intelligentChoice } from '@/ai/flows/intelligent-choice-flow';
import { findNodeById, findNextNodeId, substituteVariablesInText, coerceToDate, compareDates } from './utils';
import jsonata from 'jsonata';


let sharedIsolate: ivm.Isolate | null = null;
function getSharedIsolate() {
    if (!sharedIsolate || sharedIsolate.isDisposed) {
        console.log('[Flow Engine Code] Creating new shared isolated-vm Isolate.');
        sharedIsolate = new ivm.Isolate({ memoryLimit: 128 });
    }
    return sharedIsolate;
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

  console.log(`[Flow Engine] Starting execution loop. Start Node: ${currentNodeId}`);

  while (currentNodeId && shouldContinue) {
    const currentNode = findNodeById(currentNodeId, nodes);
    if (!currentNode) {
      console.error(`[Flow Engine - ${session.session_id}] Critical: Current node ID ${currentNodeId} not found. Deleting session.`);
      await deleteSessionFromDB(session.session_id);
      break;
    }

    console.log(`[Flow Engine - ${session.session_id}] Executing Node: ${currentNode.id} (${currentNode.type} - ${currentNode.title})`);

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
          const optionsList = (currentNode.optionsList || '')
            .split('\n')
            .map(opt => substituteVariablesInText(opt.trim(), session.flow_variables))
            .filter(Boolean);

          if (q && optionsList.length > 0) {
            let messageWithOptions = q + '\n\n';
            optionsList.forEach((opt, index) => { messageWithOptions += `${index + 1}. ${opt}\n`; });

            let finalMessage = messageWithOptions.trim();
            if (session.flow_context !== 'chatwoot') {
              finalMessage += "\nResponda com o número da opção desejada ou o texto exato da opção.";
            }

            await sendOmniChannelMessage(session, currentWorkspace, finalMessage);
            session.awaiting_input_type = 'option';
            session.awaiting_input_details = {
              variableToSave: currentNode.variableToSaveChoice || 'last_user_choice',
              options: optionsList,
              originalNodeId: currentNode.id
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
          case '==':          conditionMet = (valA as any) == (valB as any); break;
          case '!=':          conditionMet = (valA as any) != (valB as any); break;
          case '>':           conditionMet = (valA as any) >  (valB as any); break;
          case '<':           conditionMet = (valA as any) <  (valB as any); break;
          case '>=':          conditionMet = (valA as any) >= (valB as any); break;
          case '<=':          conditionMet = (valA as any) <= (valB as any); break;
          case 'contains':    conditionMet = String(valA ?? '').toLowerCase().includes(String(valB ?? '').toLowerCase()); break;
          case 'startswith':  conditionMet = String(valA ?? '').toLowerCase().startsWith(String(valB ?? '').toLowerCase()); break;
          case 'endswith':    conditionMet = String(valA ?? '').toLowerCase().endsWith(String(valB ?? '').toLowerCase()); break;
          case 'isempty':     conditionMet = valA === undefined || valA === null || String(valA).trim() === ''; break;
          case 'isnotempty':  conditionMet = !(valA === undefined || valA === null || String(valA).trim() === ''); break;
          case 'istrue':      conditionMet = valA === true || String(valA).toLowerCase() === 'true'; break;
          case 'isfalse':     conditionMet = valA === false || String(valA).toLowerCase() === 'false'; break;
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
              const [h, m, s2 = '0'] = s.split(':').map(Number);
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
        const switchActualValue = switchVarName ? getProperty(session.flow_variables, switchVarName) : undefined;
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
                          
                           if (mapping.extractAs === 'list' && !Array.isArray(extractedValue)) {
                              setProperty(session.flow_variables, mapping.flowVariable, [extractedValue]);
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
      
      case 'code-execution': {
        const varName = currentNode.codeOutputVariable;
        let context: ivm.Context | null = null;
        if (currentNode.codeSnippet && varName) {
            const isolate = getSharedIsolate();
            try {
                console.log('[Flow Engine Code] Criando contexto de execução com isolated-vm.');
                context = await isolate.createContext();
                const jail = context.global;
                await jail.set('global', jail.derefInto());

                const variablesJson = JSON.stringify(session.flow_variables);
                const codeSnippetJson = JSON.stringify(currentNode.codeSnippet);

                await jail.set('variablesJson', variablesJson);
                await jail.set('codeSnippetJson', codeSnippetJson);

                console.log('[Flow Engine Code] Injetando variáveis e código no sandbox.');

                const scriptToRun = `
                    function toJSONSafe(value, seen = new WeakSet()) {
                        if (value === null || value === undefined) return value;
                        const t = typeof value;
                        if (t === 'string' || t === 'number' || t === 'boolean') return value;
                        if (t === 'bigint') return value.toString();
                        if (t === 'function' || t === 'symbol') return undefined;
                        if (value instanceof Date) return value.toISOString();
                        if (value instanceof RegExp) return value.toString();
                        if (typeof value === 'object') {
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
                                return value.map(v => toJSONSafe(v, seen));
                            }
                            const out = {};
                            for (const k in value) {
                                try {
                                    out[k] = toJSONSafe(value[k], seen);
                                } catch (_) {
                                    out[k] = '[Unserializable]';
                                }
                            }
                            return out;
                        }
                        return value;
                    }

                    async function __run__() {
                        const variables = JSON.parse(variablesJson);
                        const userCode = JSON.parse(codeSnippetJson);
                        try {
                            const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
                            const fn = new AsyncFunction('variables', userCode);
                            return await fn(variables);
                        } catch (err) {
                            return JSON.stringify({ __error: (err && err.message) ? String(err.message) : String(err) });
                        }
                    }

                    (async () => {
                        const res = await __run__();
                        const payload = (typeof res === 'string' && (res.startsWith('{') || res.startsWith('[')))
                            ? res
                            : JSON.stringify(toJSONSafe(res));
                        return payload;
                    })();
                `;

                const script = await isolate.compileScript(scriptToRun);
                console.log('[Flow Engine Code] Executando script no sandbox...');
                const raw = await script.run(context, { timeout: 2000, promise: true });

                let parsed: any;
                try {
                    parsed = raw ? JSON.parse(String(raw)) : null;
                } catch {
                    parsed = { value: String(raw) };
                }

                if (parsed && parsed.__error) {
                    throw new Error(parsed.__error);
                }

                setProperty(session.flow_variables, varName, parsed);
                console.log(`[Flow Engine Code] Variável "${varName}" definida com sucesso.`);
            } catch (e: any) {
                console.error(`[Flow Engine - ${session.session_id}] Erro ao executar código com isolated-vm:`, e);
                setProperty(session.flow_variables, varName, { error: e.message });
            } finally {
                if (context) {
                    try { context.release(); } catch {}
                }
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

        if (responseVarName && inputVarName) {
          try {
            const userInputForAgent = getProperty(session.flow_variables, inputVarName);
            if (userInputForAgent) {
              console.log(`[Flow Engine - ${session.session_id}] Intelligent Agent: Calling simpleChatReply with input: "${userInputForAgent}"`);
              const agentReply = await simpleChatReply({ userMessage: String(userInputForAgent) });
              setProperty(session.flow_variables, responseVarName, agentReply.botReply);
            } else {
              console.warn(`[Flow Engine - ${session.session_id}] Intelligent Agent: Input variable '${inputVarName}' not found.`);
              setProperty(session.flow_variables, responseVarName, 'Error: User input not found.');
            }
          } catch (e: any) {
            console.error(`[Flow Engine - ${session.session_id}] Intelligent Agent Error:`, e);
            setProperty(session.flow_variables, responseVarName, `Error with agent: ${e.message}`);
          }
        }
        nextNodeId = findNextNodeId(currentNode.id, 'default', connections);
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

      case 'end-flow': {
        console.log(`[Flow Engine - ${session.session_id}] Reached End Flow node. Pausing session.`);
        session.current_node_id = null;
        session.awaiting_input_type = null;
        session.awaiting_input_details = null;
        session.flow_variables.__flowPaused = true;
        shouldContinue = false;
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
