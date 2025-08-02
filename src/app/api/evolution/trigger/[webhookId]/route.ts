
'use server';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getProperty, setProperty } from 'dot-prop';
import { sendWhatsAppMessageAction } from '@/app/actions/evolutionApiActions';
import {
  loadSessionFromDB,
  saveSessionToDB,
  deleteSessionFromDB,
  loadWorkspaceFromDB,
} from '@/app/actions/databaseActions';
import type { NodeData, Connection, FlowSession, StartNodeTrigger, WorkspaceData } from '@/lib/types';
import { genericTextGenerationFlow } from '@/ai/flows/generic-text-generation-flow';
import { simpleChatReply } from '@/ai/flows/simple-chat-reply-flow';

// Variável global para armazenar logs em memória (apenas para depuração)
if (!globalThis.evolutionWebhookLogs || !Array.isArray(globalThis.evolutionWebhookLogs)) {
  console.log('[API Evolution Trigger Route INIT] globalThis.evolutionWebhookLogs não existe ou não é um array. Inicializando como novo array.');
  globalThis.evolutionWebhookLogs = [];
}
const MAX_LOG_ENTRIES = 50;

// --- Funções Auxiliares para o Motor de Fluxo ---
function findNodeById(nodeId: string, nodes: NodeData[]): NodeData | undefined {
  return nodes.find(n => n.id === nodeId);
}

function findNextNodeId(fromNodeId: string, sourceHandle: string | undefined, connections: Connection[]): string | null {
  const connection = connections.find(conn => conn.from === fromNodeId && conn.sourceHandle === sourceHandle);
  return connection ? connection.to : null;
}

function substituteVariablesInText(text: string | undefined, variables: Record<string, any>): string {
  if (text === undefined || text === null) {
    return '';
  }
  let subbedText = String(text);
  const variableRegex = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g;
  let match;

  while ((match = variableRegex.exec(text)) !== null) {
    const fullMatch = match[0];
    const varName = match[1].trim();
    let value: any = getProperty(variables, varName);

    if (value === undefined && !varName.includes('.')) {
      value = variables[varName];
    }

    if (value === undefined || value === null) {
      subbedText = subbedText.replace(fullMatch, '');
    } else if (typeof value === 'object' || Array.isArray(value)) {
      try {
        subbedText = subbedText.replace(fullMatch, JSON.stringify(value, null, 2));
      } catch (e) {
        subbedText = subbedText.replace(fullMatch, `[Error stringifying ${varName}]`);
      }
    } else {
      subbedText = subbedText.replace(fullMatch, String(value));
    }
  }
  return subbedText;
}

interface ApiConfig {
  baseUrl: string;
  apiKey?: string;
  instanceName: string;
}

async function executeFlow(
  session: FlowSession,
  nodes: NodeData[],
  connections: Connection[],
  apiConfig: ApiConfig
): Promise<void> {
    let currentNodeId = session.current_node_id;
    let shouldContinue = true;

    console.log(`[Flow Engine] Starting execution loop. Start Node: ${currentNodeId}`);

    while(currentNodeId && shouldContinue) {
        const currentNode = findNodeById(currentNodeId, nodes);
        if (!currentNode) {
            console.error(`[Flow Engine - ${session.session_id}] Critical: Current node ID ${currentNodeId} not found. Deleting session.`);
            await deleteSessionFromDB(session.session_id);
            break;
        }

        console.log(`[Flow Engine - ${session.session_id}] Executing Node: ${currentNode.id} (${currentNode.type} - ${currentNode.title})`);
        
        let nextNodeId: string | null = null;
        session.current_node_id = currentNodeId; // Update session with the node we are currently processing

        switch (currentNode.type) {
            case 'start':
                const firstTrigger = currentNode.triggers?.[0]?.name;
                nextNodeId = findNextNodeId(currentNode.id, firstTrigger || 'default', connections);
                break;

            case 'message': {
                const messageText = substituteVariablesInText(currentNode.text, session.flow_variables);
                if (messageText) {
                    await sendWhatsAppMessageAction({
                        ...apiConfig,
                        recipientPhoneNumber: session.session_id.split("@@")[0],
                        messageType: 'text',
                        textContent: messageText,
                    });
                }
                nextNodeId = findNextNodeId(currentNode.id, 'default', connections);
                break;
            }

            case 'input':
            case 'date-input':
            case 'file-upload':
            case 'rating-input':
                const promptFieldName = 
                    currentNode.type === 'input' ? 'promptText' : 
                    currentNode.type === 'date-input' ? 'dateInputLabel' :
                    currentNode.type === 'file-upload' ? 'uploadPromptText' :
                    'ratingQuestionText';

                const promptText = substituteVariablesInText(currentNode[promptFieldName], session.flow_variables);
                if (promptText) {
                    await sendWhatsAppMessageAction({
                        ...apiConfig,
                        recipientPhoneNumber: session.session_id.split("@@")[0],
                        messageType: 'text',
                        textContent: promptText,
                    });
                }
                session.awaiting_input_type = currentNode.type;
                session.awaiting_input_details = { 
                    variableToSave: 
                        currentNode.variableToSaveResponse || 
                        currentNode.variableToSaveDate ||
                        currentNode.fileUrlVariable ||
                        currentNode.ratingOutputVariable ||
                        'last_user_input', 
                    originalNodeId: currentNode.id 
                };
                shouldContinue = false; // Pause execution
                break;

            case 'option':
                const questionText = substituteVariablesInText(currentNode.questionText, session.flow_variables);
                const optionsList = (currentNode.optionsList || '').split('\n').map(opt => substituteVariablesInText(opt.trim(), session.flow_variables)).filter(Boolean);

                if (questionText && optionsList.length > 0) {
                    let messageWithOptions = questionText + '\n\n';
                    optionsList.forEach((opt, index) => {
                        messageWithOptions += `${index + 1}. ${opt}\n`;
                    });
                    messageWithOptions += "\nResponda com o número da opção desejada ou o texto exato da opção.";

                    await sendWhatsAppMessageAction({
                        ...apiConfig,
                        recipientPhoneNumber: session.session_id.split("@@")[0],
                        messageType: 'text',
                        textContent: messageWithOptions.trim(),
                    });

                    session.awaiting_input_type = 'option';
                    session.awaiting_input_details = {
                        variableToSave: currentNode.variableToSaveChoice || 'last_user_choice',
                        options: optionsList,
                        originalNodeId: currentNode.id
                    };
                    shouldContinue = false; // Pause execution
                } else {
                    console.warn(`[Flow Engine - ${session.session_id}] Option node ${currentNode.id} misconfigured. Trying default output.`);
                    nextNodeId = findNextNodeId(currentNode.id, 'default', connections);
                }
                break;

            case 'condition': {
                const varNameCond = currentNode.conditionVariable?.replace(/\{\{|\}\}/g, '').trim();
                const actualValueCond = varNameCond ? getProperty(session.flow_variables, varNameCond) : undefined;
                const compareValueCond = substituteVariablesInText(currentNode.conditionValue, session.flow_variables);
                let conditionMet = false;

                const valStr = String(actualValueCond ?? '').toLowerCase();
                const compareValStr = String(compareValueCond ?? '').toLowerCase();

                switch (currentNode.conditionOperator) {
                    case '==': conditionMet = valStr === compareValStr; break;
                    case '!=': conditionMet = valStr !== compareValStr; break;
                    case '>': conditionMet = !isNaN(parseFloat(valStr)) && !isNaN(parseFloat(compareValStr)) && parseFloat(valStr) > parseFloat(compareValStr); break;
                    case '<': conditionMet = !isNaN(parseFloat(valStr)) && !isNaN(parseFloat(compareValStr)) && parseFloat(valStr) < parseFloat(compareValStr); break;
                    case 'contains': conditionMet = valStr.includes(compareValStr); break;
                    case 'startsWith': conditionMet = valStr.startsWith(compareValStr); break;
                    case 'endsWith': conditionMet = valStr.endsWith(compareValStr); break;
                    case 'isEmpty': conditionMet = actualValueCond === undefined || actualValueCond === null || String(actualValueCond).trim() === ''; break;
                    case 'isNotEmpty': conditionMet = actualValueCond !== undefined && actualValueCond !== null && String(actualValueCond).trim() !== ''; break;
                    default: conditionMet = false;
                }
                console.log(`[Flow Engine - ${session.session_id}] Condition: Var ('${varNameCond}')='${actualValueCond}' ${currentNode.conditionOperator} '${compareValueCond}' -> ${conditionMet}`);
                nextNodeId = findNextNodeId(currentNode.id, conditionMet ? 'true' : 'false', connections);
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
                try {
                    let url = substituteVariablesInText(currentNode.apiUrl, session.flow_variables);
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
                    if(queryString) url += (url.includes('?') ? '&' : '?') + queryString;

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
                    const responseData = await response.json().catch(() => response.text());
                    
                    if (varName) {
                        let valueToSave = responseData;
                        if (currentNode.apiResponsePath) {
                            const extractedValue = getProperty(responseData, currentNode.apiResponsePath);
                            if (extractedValue !== undefined) {
                                valueToSave = extractedValue;
                            }
                        }
                        setProperty(session.flow_variables, varName, valueToSave);
                    }
                } catch (error: any) {
                    console.error(`[Flow Engine - ${session.session_id}] API Call Error:`, error);
                    if (varName) {
                         setProperty(session.flow_variables, varName, { error: error.message });
                    }
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
                    recipientPhoneNumber: recipientPhoneNumber.split('@')[0], // Garante que apenas o número seja usado
                    messageType: currentNode.type === 'whatsapp-text' ? 'text' : currentNode.mediaType || 'image',
                    textContent: currentNode.type === 'whatsapp-text' ? substituteVariablesInText(currentNode.textMessage, session.flow_variables) : undefined,
                    mediaUrl: currentNode.type === 'whatsapp-media' ? substituteVariablesInText(currentNode.mediaUrl, session.flow_variables) : undefined,
                    caption: currentNode.type === 'whatsapp-media' ? substituteVariablesInText(currentNode.caption, session.flow_variables) : undefined,
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
                    } catch(e:any) {
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

            case 'end-flow':
                console.log(`[Flow Engine - ${session.session_id}] Reached End Flow node. Deleting session.`);
                await deleteSessionFromDB(session.session_id);
                shouldContinue = false;
                nextNodeId = null;
                break;

            default:
                console.warn(`[Flow Engine - ${session.session_id}] Node type ${currentNode.type} not fully implemented or does not pause. Trying 'default' exit.`);
                nextNodeId = findNextNodeId(currentNode.id, 'default', connections);
                break;
        }

        // Prepare for the next loop iteration
        if(shouldContinue) {
            currentNodeId = nextNodeId;
        }
    }
    
    // After the loop finishes (either by pausing or reaching the end), save the final session state.
    if (shouldContinue && !currentNodeId) { // This means the loop finished because currentNodeId is null (a dead end)
        session.current_node_id = null; // Explicitly set to null to indicate a paused/dead-end state
        session.awaiting_input_type = null; // Ensure it's not waiting for input
        session.awaiting_input_details = null;
        console.log(`[Flow Engine - ${session.session_id}] Execution loop ended at a dead end. Pausing session silently.`);
        await saveSessionToDB(session); // Save the paused state
    } else if (!shouldContinue) { // Loop was broken by a node that pauses (e.g., input) or ends the flow
        session.current_node_id = currentNodeId;
        console.log(`[Flow Engine - ${session.session_id}] Execution loop paused or ended. Saving session state. Paused: ${!!session.current_node_id}.`);
        if (session.current_node_id) { // Only save if the session is not deleted
          await saveSessionToDB(session);
        }
    }
}


// Função para armazenar detalhes da requisição no log global (em memória)
async function storeRequestDetails(
  request: NextRequest,
  parsedPayload: any, 
  rawBodyText: string | null, 
  webhookId: string
): Promise<any> { 
  const currentTimestamp = new Date().toISOString();
  let extractedMessage: string | null = null;
  let webhookRemoteJid: string | null = null;
  const headers = Object.fromEntries(request.headers.entries());
  const ip = request.ip || headers['x-forwarded-for'] || 'unknown IP';

  let actualPayloadToExtractFrom = parsedPayload;
  
  // Handle Chatwoot payload which can be an array of a single object
  if (Array.isArray(parsedPayload) && parsedPayload.length > 0 && typeof parsedPayload[0] === 'object') {
    actualPayloadToExtractFrom = parsedPayload[0];
  }
  
  if (actualPayloadToExtractFrom && typeof actualPayloadToExtractFrom === 'object') {
      // Prioritize Chatwoot structure
      const chatwootEvent = getProperty(actualPayloadToExtractFrom, 'event') || getProperty(actualPayloadToExtractFrom, 'body.event');
      const chatwootContent = getProperty(actualPayloadToExtractFrom, 'content') || getProperty(actualPayloadToExtractFrom, 'body.content');
      const chatwootSenderIdentifier = getProperty(actualPayloadToExtractFrom, 'sender.identifier') || getProperty(actualPayloadToExtractFrom, 'body.sender.identifier');
      const chatwootConversationId = getProperty(actualPayloadToExtractFrom, 'conversation.id') || getProperty(actualPayloadToExtractFrom, 'body.conversation.id');

      if (chatwootEvent === 'message_created' && chatwootContent !== undefined) {
          extractedMessage = String(chatwootContent).trim();
          webhookRemoteJid = chatwootSenderIdentifier || `chatwoot_conv_${chatwootConversationId}`;
          console.log(`[storeRequestDetails] Detected Chatwoot payload. Message: "${extractedMessage}", JID: "${webhookRemoteJid}"`);
      } else {
          // Fallback to Evolution API structure
          const commonMessagePaths = [
              'data.message.conversation', 'message.conversation', 
              'message.body', 'message.textMessage.text', 'text',
              'data.message.extendedTextMessage.text',
          ];
          for (const path of commonMessagePaths) {
              const msg = getProperty(actualPayloadToExtractFrom, path);
              if (typeof msg === 'string' && msg.trim() !== '') {
                  extractedMessage = msg.trim();
                  break;
              }
          }
          webhookRemoteJid = getProperty(actualPayloadToExtractFrom, 'data.key.remoteJid');
          if (webhookRemoteJid) console.log(`[storeRequestDetails] Detected Evolution API payload. Message: "${extractedMessage}", JID: "${webhookRemoteJid}"`);
      }
  }

  const logEntry: Record<string, any> = {
    timestamp: currentTimestamp,
    workspaceIdParam: webhookId,
    method: request.method,
    url: request.url,
    headers: headers,
    ip: ip,
    extractedMessage: extractedMessage,
    webhook_remote_jid: webhookRemoteJid,
    payload: parsedPayload || { raw_text: rawBodyText, message: "Payload was not valid JSON or was empty/unreadable" }
  };

  if (!Array.isArray(globalThis.evolutionWebhookLogs)) {
    globalThis.evolutionWebhookLogs = [];
  }
  globalThis.evolutionWebhookLogs.unshift(logEntry);
  if (globalThis.evolutionWebhookLogs.length > MAX_LOG_ENTRIES) {
    globalThis.evolutionWebhookLogs.pop();
  }
  return logEntry;
}

export async function POST(request: NextRequest, context: { params: { webhookId: string } }) {
  const { webhookId } = context.params;

  console.log(`[API Evolution Trigger] POST received for webhook ID: "${webhookId}"`);

  let rawBody: string | null = null;
  let parsedBody: any = null;
  let loggedEntry: any = null;
  let startExecution = false;

  try {
    rawBody = await request.text();
    parsedBody = rawBody ? JSON.parse(rawBody) : { message: "Request body was empty." };
    loggedEntry = await storeRequestDetails(request, parsedBody, rawBody, webhookId);
    
    // Unified variables from different possible sources (Evolution API, Chatwoot, etc.)
    const eventType = getProperty(loggedEntry.payload, 'event') || getProperty(loggedEntry.payload, 'body.event') as string;
    const instanceName = getProperty(loggedEntry.payload, 'instance') as string;
    const senderJid = loggedEntry.webhook_remote_jid; 
    const receivedMessageText = loggedEntry.extractedMessage;
    const evolutionApiBaseUrl = getProperty(loggedEntry.payload, 'server_url') as string;
    const evolutionApiKey = getProperty(loggedEntry.payload, 'apikey') as string;
    
    // Check for API call response flag
    const isApiCallResponse = getProperty(loggedEntry.payload, 'isApiCallResponse') === true;

    // Check if this is a call to resume a flow
    const resumeSessionId = getProperty(loggedEntry.payload, 'resume_session_id');

    if (resumeSessionId) {
       console.log(`[API Evolution Trigger] Resume call detected for session ID: ${resumeSessionId}`);
        const sessionToResume = await loadSessionFromDB(resumeSessionId);
        if (sessionToResume) {
             const workspaceForResume = await loadWorkspaceFromDB(sessionToResume.workspace_id);
             if (workspaceForResume && workspaceForResume.nodes) {
                 // The payload of the resume call becomes the response
                 sessionToResume.flow_variables[sessionToResume.awaiting_input_details?.variableToSave || 'external_response_data'] = parsedBody;
                 sessionToResume.awaiting_input_type = null; 
                 
                 const apiConfigForResume = {
                    baseUrl: workspaceForResume.evolution_instance_id ? (await loadWorkspaceFromDB(workspaceForResume.id))?.evolution_instance_id || '' : evolutionApiBaseUrl || '',
                    apiKey: evolutionApiKey || undefined,
                    instanceName: instanceName || ''
                 };

                 await executeFlow(sessionToResume, workspaceForResume.nodes, workspaceForResume.connections || [], apiConfigForResume);
                 return NextResponse.json({ message: "Flow resumed." }, { status: 200 });
             }
        } else {
            console.error(`[API Evolution Trigger] Could not find session ${resumeSessionId} to resume.`);
            return NextResponse.json({ error: `Session to resume not found: ${resumeSessionId}` }, { status: 404 });
        }
    }


    if (!isApiCallResponse && (eventType !== 'messages.upsert' && eventType !== 'message_created') || !senderJid) {
      let reason = "Event is not a message or sender ID is missing.";
      if (getProperty(loggedEntry.payload, 'data.key.fromMe') === true) {
        reason = "Ignoring message because it is fromMe (sent by the bot itself).";
      }
       if (getProperty(loggedEntry.payload, 'message_type') === 'outgoing') {
        reason = "Ignoring outgoing Chatwoot message.";
      }
      console.log(`[API Evolution Trigger] Logged, but no flow execution triggered for webhook ID "${webhookId}". Reason: ${reason}.`);
      return NextResponse.json({ message: `Webhook logged, but no flow execution: ${reason}.` }, { status: 200 });
    }
    
    const workspace = await loadWorkspaceFromDB(webhookId);

    if (!workspace || !workspace.nodes || workspace.nodes.length === 0) {
      console.error(`[API Evolution Trigger] Workspace with ID "${webhookId}" not found or empty.`);
      if (senderJid && evolutionApiBaseUrl && instanceName) await sendWhatsAppMessageAction({baseUrl: evolutionApiBaseUrl, apiKey: evolutionApiKey || undefined, instanceName, recipientPhoneNumber: senderJid.split('@')[0], messageType:'text', textContent: `Desculpe, o fluxo de trabalho solicitado não foi encontrado ou está vazio.`});
      return NextResponse.json({ error: `Workspace with ID "${webhookId}" not found or empty.` }, { status: 404 });
    }
    
    const apiConfig: ApiConfig = { baseUrl: evolutionApiBaseUrl, apiKey: evolutionApiKey || undefined, instanceName };
    const sessionId = `${senderJid.split('@')[0]}@@${workspace.id}`;
    let session = await loadSessionFromDB(sessionId);
    
    if (session) {
      console.log(`[API Evolution Trigger - ${sessionId}] Existing session found. Last interaction: ${session.last_interaction_at}, Timeout: ${session.session_timeout_seconds}s`);
      if (session.session_timeout_seconds && session.session_timeout_seconds > 0 && session.last_interaction_at) {
          const lastInteractionDate = new Date(session.last_interaction_at);
          const timeoutMilliseconds = session.session_timeout_seconds * 1000;
          const expirationTime = lastInteractionDate.getTime() + timeoutMilliseconds;

          if (Date.now() > expirationTime) {
              console.log(`[API Evolution Trigger - ${sessionId}] Session timed out. Deleting session and starting a new one.`);
              await deleteSessionFromDB(sessionId);
              session = null;
          }
      }
    }

    if (session) {
        console.log(`[API Evolution Trigger - ${sessionId}] Existing session is active. Node: ${session.current_node_id}, Awaiting: ${session.awaiting_input_type}`);
      
      if (session.current_node_id === null && session.awaiting_input_type === null) {
          console.log(`[API Evolution Trigger - ${sessionId}] Session is in a paused (dead-end) state. Checking for keyword triggers to restart...`);
          
          const startNode = workspace.nodes.find(n => n.type === 'start');
          let triggerMatched = false;
          if (startNode?.triggers) {
              for (const trigger of startNode.triggers) {
                  if (trigger.enabled && trigger.keyword && receivedMessageText?.toLowerCase() === trigger.keyword.toLowerCase()) {
                      console.log(`[API Evolution Trigger - ${sessionId}] Paused session re-triggered by keyword: '${trigger.keyword}'. Restarting flow.`);
                      triggerMatched = true;
                      break;
                  }
              }
          }
          
          if (!triggerMatched) {
              console.log(`[API Evolution Trigger - ${sessionId}] No keyword matched. Ignoring message and keeping session paused.`);
              return NextResponse.json({ message: "Session is paused and no trigger keyword was matched." }, { status: 200 });
          }
          session = null;
      } else {
        const responseValue = isApiCallResponse ? parsedBody : receivedMessageText;
        session.flow_variables.mensagem_whatsapp = isApiCallResponse ? (getProperty(responseValue, 'responseText') || JSON.stringify(responseValue)) : responseValue;
        
        if (session.awaiting_input_type && session.awaiting_input_details) {
            const originalNodeId = session.awaiting_input_details.originalNodeId;
            const awaitingNode = findNodeById(originalNodeId!, workspace.nodes);
            
            if (awaitingNode) {
                let nextNode: string | null = null;
                
                if (awaitingNode.apiResponseAsInput && !isApiCallResponse) {
                   console.log(`[API Evolution Trigger] Node ${awaitingNode.id} expects API response, but received user message. Ignoring.`);
                   return NextResponse.json({ message: "Awaiting API response, user message ignored." }, { status: 200 });
                }

                if (['input', 'date-input', 'file-upload', 'rating-input'].includes(session.awaiting_input_type) && session.awaiting_input_details.variableToSave) {
                  let textToSave = String(responseValue);
                  if (isApiCallResponse && awaitingNode.apiResponsePathForValue) {
                      const extracted = getProperty(responseValue, awaitingNode.apiResponsePathForValue);
                      if (extracted !== undefined) textToSave = String(extracted);
                  }
                  setProperty(session.flow_variables, session.awaiting_input_details.variableToSave, textToSave);
                  nextNode = findNextNodeId(awaitingNode.id, 'default', workspace.connections || []);
                } else if (session.awaiting_input_type === 'option' && Array.isArray(session.awaiting_input_details.options)) {
                  const options = session.awaiting_input_details.options;
                  let chosenOptionText: string | undefined = undefined;
                  
                  let valueForOptionMatching = String(responseValue);
                   if (isApiCallResponse && awaitingNode.apiResponsePathForValue) {
                      const extracted = getProperty(responseValue, awaitingNode.apiResponsePathForValue);
                      if (extracted !== undefined) valueForOptionMatching = String(extracted);
                  }
                  
                  const trimmedReceivedMessage = valueForOptionMatching.trim();
                  const numericChoice = parseInt(trimmedReceivedMessage, 10);
                  if (!isNaN(numericChoice) && numericChoice > 0 && numericChoice <= options.length) {
                    chosenOptionText = options[numericChoice - 1];
                  } else {
                    chosenOptionText = options.find(opt => opt.toLowerCase() === trimmedReceivedMessage.toLowerCase());
                  }

                  if (chosenOptionText) {
                    if (session.awaiting_input_details.variableToSave) {
                      setProperty(session.flow_variables, session.awaiting_input_details.variableToSave, chosenOptionText);
                    }
                    nextNode = findNextNodeId(awaitingNode.id, chosenOptionText, workspace.connections || []);
                     if (nextNode) {
                        session.awaiting_input_type = null;
                        session.awaiting_input_details = null;
                        session.current_node_id = nextNode;
                        startExecution = true;
                    } else {
                        session.awaiting_input_type = null;
                        session.awaiting_input_details = null;
                        session.current_node_id = null;
                        startExecution = false;
                        await saveSessionToDB(session);
                        return NextResponse.json({ message: "Flow paused at dead end." }, { status: 200 });
                    }
                  } else {
                    if (!isApiCallResponse && evolutionApiBaseUrl && instanceName) await sendWhatsAppMessageAction({...apiConfig, recipientPhoneNumber: senderJid.split('@')[0], messageType:'text', textContent: "Opção inválida. Por favor, tente novamente."});
                    nextNode = null;
                    startExecution = false;
                  }
                }
                if (nextNode) {
                  session.awaiting_input_type = null;
                  session.awaiting_input_details = null;
                  session.current_node_id = nextNode;
                  startExecution = true;
                }
            } else {
                console.warn(`[API Evolution Trigger - ${sessionId}] Awaiting node ${originalNodeId} not found, restarting flow.`);
                session = null;
            }
        } else {
           session = null;
        }
      }
    }
    
    if (!session) {
      if (isApiCallResponse) {
         console.log(`[API Evolution Trigger] API response received but no active session found for ${senderJid}. Ignoring.`);
         return NextResponse.json({ message: "API response ignored, no active session." }, { status: 200 });
      }
      console.log(`[API Evolution Trigger - ${sessionId}] No active session or session was reset. Looking for a trigger to start a new one.`);
      const startNode = workspace.nodes.find(n => n.type === 'start');
      if (!startNode) {
        return NextResponse.json({ error: "Flow has no start node." }, { status: 500 });
      }
      
      let triggerNameToUse: string | null = null;
      let webhookTrigger: StartNodeTrigger | undefined = undefined;

      if (startNode.triggers && startNode.triggers.length > 0) {
        for (const trigger of startNode.triggers) {
            if (trigger.enabled && trigger.keyword && receivedMessageText?.toLowerCase() === trigger.keyword.toLowerCase()) {
                triggerNameToUse = trigger.name;
                webhookTrigger = trigger;
                break;
            }
        }
        if (!triggerNameToUse) {
            webhookTrigger = startNode.triggers.find(t => t.type === 'webhook' && t.enabled && !t.keyword);
            if (webhookTrigger) {
                triggerNameToUse = webhookTrigger.name;
            }
        }
      }
      
      if (!triggerNameToUse) {
         console.log(`[API Evolution Trigger - ${sessionId}] No matching keyword trigger and no enabled webhook trigger found. Flow will not start.`);
         return NextResponse.json({ message: "No active trigger for this message." }, { status: 200 });
      }

      const initialNodeId = findNextNodeId(startNode.id, triggerNameToUse, workspace.connections || []);

      if(!initialNodeId){
          console.error(`[API Evolution Trigger] Start node trigger '${triggerNameToUse}' is not connected.`);
          return NextResponse.json({ error: `Start node trigger '${triggerNameToUse}' is not connected.` }, { status: 500 });
      }
      
      let payloadToUse = parsedBody;
      if (Array.isArray(payloadToUse) && payloadToUse.length > 0) {
          payloadToUse = payloadToUse[0];
      }

      const initialVars: Record<string, any> = {
        whatsapp_sender_jid: senderJid.split('@')[0],
        mensagem_whatsapp: receivedMessageText || '',
        webhook_payload: payloadToUse,
        session_id: sessionId,
      };

      // Auto-inject Chatwoot variables if it's a Chatwoot payload
      if (getProperty(payloadToUse, 'event') === 'message_created' || getProperty(payloadToUse, 'body.event') === 'message_created') {
        const chatwootMappings = {
            chatwoot_conversation_id: 'body.conversation.id',
            chatwoot_contact_id: 'body.sender.id',
            chatwoot_account_id: 'body.account.id',
            chatwoot_inbox_id: 'body.inbox.id',
            contact_name: 'body.sender.name',
            contact_phone: 'body.sender.phone_number',
        };

        for (const [varName, path] of Object.entries(chatwootMappings)) {
            const value = getProperty(payloadToUse, path);
            if (value !== undefined) {
                setProperty(initialVars, varName, value);
            }
        }
         console.log(`[API Evolution Trigger] Auto-injected Chatwoot variables:`, initialVars);
      }
      
      if (webhookTrigger && webhookTrigger.variableMappings) {
        webhookTrigger.variableMappings.forEach(mapping => {
          if (mapping.jsonPath && mapping.flowVariable) {
            const value = getProperty(payloadToUse, mapping.jsonPath);
            if (value !== undefined) {
              setProperty(initialVars, mapping.flowVariable, value);
            }
          }
        });
      }

      session = {
        session_id: sessionId,
        workspace_id: workspace.id,
        current_node_id: initialNodeId, 
        flow_variables: initialVars,
        awaiting_input_type: null,
        awaiting_input_details: null,
        session_timeout_seconds: webhookTrigger?.sessionTimeoutSeconds || 0,
      };
      startExecution = true;
    }
    
    if (startExecution && session.current_node_id) {
      await executeFlow(session, workspace.nodes, workspace.connections || [], apiConfig);
    } else if (session && !startExecution) {
      await saveSessionToDB(session);
    }

    return NextResponse.json({ message: "Webhook processed." }, { status: 200 });

  } catch (error: any) {
    console.error(`[API Evolution Trigger - POST ERROR] Error for webhook ID "${webhookId}":`, error.message, error.stack);
    return NextResponse.json({ error: "Internal server error processing webhook.", details: error.message }, { status: 500 });
  }
}

export async function GET(request: NextRequest, context: { params: { webhookId: string } }) {
  const { webhookId } = context.params;
  try {
    const workspace = await loadWorkspaceFromDB(webhookId);
    if (workspace) {
      return NextResponse.json({
        message: `Workspace "${workspace.name}" with ID "${webhookId}" found. Ready to receive POST webhooks.`,
        workspaceId: workspace.id,
      }, { status: 200 });
    } else {
      return NextResponse.json({ error: `Workspace with ID "${webhookId}" not found.` }, { status: 404 });
    }
  } catch (error: any) {
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, context: { params: { webhookId: string } }) {
  return POST(request, context);
}
export async function PATCH(request: NextRequest, context: { params: { webhookId: string } }) {
  return POST(request, context);
}
export async function DELETE(request: NextRequest, context: { params: { webhookId: string } }) {
  return POST(request, context);
}
