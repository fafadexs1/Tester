
'use server';
import { getProperty, setProperty } from 'dot-prop';
import { sendWhatsAppMessageAction } from '@/app/actions/evolutionApiActions';
import { sendChatwootMessageAction } from '@/app/actions/chatwootApiActions';
import { sendDialogyMessageAction } from '@/app/actions/dialogyApiActions';
import {
  loadSessionFromDB,
  saveSessionToDB,
  deleteSessionFromDB,
  loadChatwootInstanceFromDB,
  loadDialogyInstanceFromDB,
} from '@/app/actions/databaseActions';
import type { NodeData, Connection, FlowSession, WorkspaceData, ApiResponseMapping } from '@/lib/types';
import { genericTextGenerationFlow } from '@/ai/flows/generic-text-generation-flow';
import { simpleChatReply } from '@/ai/flows/simple-chat-reply-flow';
import { findNodeById, findNextNodeId, substituteVariablesInText, coerceToDate, compareDates } from './utils';
import jsonata from 'jsonata';
import { VM } from 'vm2';

interface ApiConfig {
  baseUrl: string;
  apiKey?: string;
  instanceName: string;
}

export async function executeFlow(
  session: FlowSession,
  nodes: NodeData[],
  connections: Connection[],
  apiConfig: ApiConfig,
  workspace: WorkspaceData
): Promise<void> {
  let currentNodeId = session.current_node_id;
  let shouldContinue = true;

  console.log(`[Flow Engine] Starting execution loop. Start Node: ${currentNodeId}`);

  const sendOmniChannelMessage = async (content: string) => {
    if (!content) {
      console.warn(`[Flow Engine - ${session.session_id}] sendOmniChannelMessage called with empty content.`);
      return;
    }

    if (session.flow_context === 'dialogy') {
      const chatId =
        getProperty(session.flow_variables, 'dialogy_conversation_id') ||
        getProperty(session.flow_variables, 'webhook_payload.conversation.id');
      let dialogyInstance = null;
      if (workspace.dialogy_instance_id) {
        dialogyInstance = await loadDialogyInstanceFromDB(workspace.dialogy_instance_id);
      }
      if (dialogyInstance && chatId) {
        await sendDialogyMessageAction({
          baseUrl: dialogyInstance.baseUrl,
          apiKey: dialogyInstance.apiKey,
          chatId: chatId,
          content: content,
        });
      }
      return;
    }

    if (session.flow_context === 'chatwoot') {
      if (workspace.chatwoot_instance_id) {
        const chatwootInstance = await loadChatwootInstanceFromDB(workspace.chatwoot_instance_id);
        if (chatwootInstance && session.flow_variables.chatwoot_account_id && session.flow_variables.chatwoot_conversation_id) {
          await sendChatwootMessageAction({
            baseUrl: chatwootInstance.baseUrl,
            apiAccessToken: chatwootInstance.apiAccessToken,
            accountId: session.flow_variables.chatwoot_account_id,
            conversationId: session.flow_variables.chatwoot_conversation_id,
            content: content
          });
        }
      }
      return;
    }

    const recipientPhoneNumber =
      session.flow_variables.whatsapp_sender_jid ||
      session.session_id.split('@@')[0].replace('evolution_jid_', '');
    await sendWhatsAppMessageAction({
      ...apiConfig,
      recipientPhoneNumber: recipientPhoneNumber,
      messageType: 'text',
      textContent: content,
    });
  };

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
        await sendOmniChannelMessage(messageText);
        nextNodeId = findNextNodeId(currentNode.id, 'default', connections);
        break;
      }

      case 'input':
      case 'date-input':
      case 'file-upload':
      case 'rating-input':
      case 'option': {
        let promptText: string | undefined = '';
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

            await sendOmniChannelMessage(finalMessage);
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

          promptText = substituteVariablesInText(currentNode[promptFieldName], session.flow_variables);
          if (promptText) await sendOmniChannelMessage(promptText);

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
            const logData = {
              workspaceId: workspace.id,
              type: 'api-call',
              nodeId: currentNode.id,
              nodeTitle: currentNode.title,
              requestUrl: url,
              response: responseData,
              error: errorData,
            };
            const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';
            if (appUrl) {
                fetch(`${appUrl}/api/evolution/webhook-logs`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(logData),
                }).catch(e => console.error("[Flow Engine] Failed to post API log:", e));
            } else {
                console.error("[Flow Engine] NEXT_PUBLIC_APP_URL is not set. Cannot post API log.");
            }
        }
        nextNodeId = findNextNodeId(currentNode.id, 'default', connections);
        break;
      }
      
      case 'code-execution': {
        const varName = currentNode.codeOutputVariable;
        if (currentNode.codeSnippet && varName) {
            console.log('[Flow Engine Code] Criando sandbox de execução.');
            const sandbox = { variables: session.flow_variables, console: console };
            console.log('[Flow Engine Code] Injetando variáveis no sandbox:', JSON.stringify(sandbox.variables, null, 2));
            const vm = new VM({
                timeout: 1000,
                sandbox: sandbox,
                eval: false,
                wasm: false,
                allowAsync: true,
            });

            try {
                console.log('[Flow Engine Code] Executando script no sandbox...');
                const result = await vm.run(currentNode.codeSnippet);
                console.log('[Flow Engine Code] Resultado bruto da execução:', result);
                setProperty(session.flow_variables, varName, result);
                console.log(`[Flow Engine Code] Variável "${varName}" definida com sucesso.`);
            } catch (e: any) {
                console.error(`[Flow Engine] Falha ao executar script:`, e);
                setProperty(session.flow_variables, varName, { error: e.message || 'Falha ao executar script.' });
            }
        } else {
            console.warn(`[Flow Engine] Nó 'Executar Código' sem script ou variável de saída definida.`);
        }
        nextNodeId = findNextNodeId(currentNode.id, 'default', connections);
        break;
      }


      case 'whatsapp-text':
      case 'whatsapp-media': {
        const recipientPhoneNumber = substituteVariablesInText(currentNode.phoneNumber, session.flow_variables) || session.session_id.split("@@")[0];
        const instanceName = substituteVariablesInText(currentNode.instanceName, session.flow_variables) || apiConfig.instanceName;

        await sendWhatsAppMessageAction({
          ...apiConfig,
          instanceName,
          recipientPhoneNumber: recipientPhoneNumber.split('@')[0], 
          messageType: nodeType === 'whatsapp-text' ? 'text' : currentNode.mediaType || 'image',
          textContent: nodeType === 'whatsapp-text' ? substituteVariablesInText(currentNode.textMessage, session.flow_variables) : undefined,
          mediaUrl: nodeType === 'whatsapp-media' ? substituteVariablesInText(currentNode.mediaUrl, session.flow_variables) : undefined,
          caption: nodeType === 'whatsapp-media' ? substituteVariablesInText(currentNode.caption, session.flow_variables) : undefined,
        });
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

      case 'end-flow': {
        console.log(`[Flow Engine - ${session.session_id}] Reached End Flow node. Deleting session.`);
        await deleteSessionFromDB(session.session_id);
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
    console.log(`[Flow Engine - ${session.session_id}] Execution loop ended at a dead end. Pausing session silently.`);
    await saveSessionToDB(session);
  } else if (!shouldContinue) {
    session.current_node_id = currentNodeId;
    console.log(`[Flow Engine - ${session.session_id}] Execution loop paused or ended. Saving session state. Paused: ${!!session.current_node_id}.`);
    if (session.current_node_id) {
      await saveSessionToDB(session);
    }
  }
}
