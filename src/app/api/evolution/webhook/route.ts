
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getProperty } from 'dot-prop';
import { sendWhatsAppMessageAction } from '@/app/actions/evolutionApiActions';
import { 
  loadSessionFromDB, 
  saveSessionToDB, 
  deleteSessionFromDB,
  loadActiveWorkspaceFromDB,
  loadWorkspaceFromDB
} from '@/app/actions/databaseActions';
import type { NodeData, Connection, FlowSession, WorkspaceData } from '@/lib/types';
import { genericTextGenerationFlow } from '@/ai/flows/generic-text-generation-flow';
import { simpleChatReply } from '@/ai/flows/simple-chat-reply-flow';

declare global {
  // eslint-disable-next-line no-var
  var evolutionWebhookLogs: Array<any>;
  // eslint-disable-next-line no-var
  var activeFlowSessions: Record<string, FlowSession>;
}

if (!globalThis.evolutionWebhookLogs || !Array.isArray(globalThis.evolutionWebhookLogs)) {
  console.log(`[GLOBAL_INIT in webhook/route.ts] Initializing globalThis.evolutionWebhookLogs as new array.`);
  globalThis.evolutionWebhookLogs = [];
}
const MAX_LOG_ENTRIES = 50;

if (!globalThis.activeFlowSessions) {
  console.log(`[GLOBAL_INIT in webhook/route.ts] Initializing globalThis.activeFlowSessions as new object.`);
  globalThis.activeFlowSessions = {};
}


interface StoredLogEntry {
  timestamp: string;
  method?: string;
  url?: string;
  headers?: Record<string, string>;
  payload?: any;
  ip?: string;
  geo?: { city?: string; country?: string };
  extractedMessage?: string | null;
  webhook_remoteJid?: string | null;
}

interface ApiConfig {
  baseUrl: string;
  apiKey?: string;
  instanceName: string;
}


// --- Helper Functions for Flow Engine ---
function findNodeById(nodeId: string, nodes: NodeData[]): NodeData | undefined {
  return nodes.find(n => n.id === nodeId);
}

function findNextNodeId(fromNodeId: string, sourceHandle: string | undefined, connections: Connection[]): string | null {
  const connection = connections.find(conn => conn.from === fromNodeId && conn.sourceHandle === sourceHandle);
  return connection ? connection.to : null;
}

function substituteVariablesInText(text: string | undefined, variables: Record<string, any>): string {
  if (!text) return '';
  let subbedText = text;
  const regex = /\{\{(.*?)\}\}/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const varName = match[1].trim();
    const value = getProperty(variables, varName);
    if (value !== undefined && value !== null) {
      if (typeof value === 'object' || Array.isArray(value)) {
        subbedText = subbedText.replace(match[0], JSON.stringify(value, null, 2));
      } else {
        subbedText = subbedText.replace(match[0], String(value));
      }
    } else {
      // console.warn(`[Flow Engine] Variable {{${varName}}} not found in flowVariables for substitution.`);
      subbedText = subbedText.replace(match[0], ''); // Replace with empty string if not found
    }
  }
  return subbedText;
}

async function executeFlowStep(
  session: FlowSession, 
  nodes: NodeData[], 
  connections: Connection[],
  apiConfig: ApiConfig
): Promise<void> {
  if (!session.current_node_id) {
    console.log(`[Flow Engine - ${session.session_id}] No current node. Ending flow.`);
    await deleteSessionFromDB(session.session_id);
    return;
  }

  const currentNode = findNodeById(session.current_node_id, nodes);

  if (!currentNode) {
    console.error(`[Flow Engine - ${session.session_id}] Current node ID ${session.current_node_id} not found in flow. Ending.`);
    await deleteSessionFromDB(session.session_id);
    return;
  }

  console.log(`[Flow Engine - ${session.session_id}] Executing Node: ${currentNode.id} (${currentNode.type} - ${currentNode.title})`);
  console.log(`[Flow Engine - ${session.session_id}] Current Variables:`, JSON.stringify(session.flow_variables, null, 2));

  let nextNodeId: string | null = null;
  let shouldContinueRecursive = true;
  let updatedFlowVariables = { ...session.flow_variables };

  switch (currentNode.type) {
    case 'start':
      const firstTrigger = currentNode.triggers?.[0]?.name;
      nextNodeId = findNextNodeId(currentNode.id, firstTrigger || 'default', connections);
      break;

    case 'message':
      const messageText = substituteVariablesInText(currentNode.text, updatedFlowVariables);
      if (messageText) {
        console.log(`[Flow Engine - ${session.session_id}] Sending message: "${messageText}"`);
        await sendWhatsAppMessageAction({
          ...apiConfig,
          recipientPhoneNumber: session.session_id, // senderJid is the sessionId
          messageType: 'text',
          textContent: messageText,
        });
      }
      nextNodeId = findNextNodeId(currentNode.id, 'default', connections);
      break;

    case 'input':
      const promptText = substituteVariablesInText(currentNode.promptText, updatedFlowVariables);
      if (promptText) {
        console.log(`[Flow Engine - ${session.session_id}] Sending input prompt: "${promptText}"`);
        await sendWhatsAppMessageAction({
          ...apiConfig,
          recipientPhoneNumber: session.session_id,
          messageType: 'text',
          textContent: promptText,
        });
      }
      session.awaiting_input_type = 'text';
      session.awaiting_input_details = { variableToSave: currentNode.variableToSaveResponse || 'last_user_input', originalNodeId: currentNode.id };
      shouldContinueRecursive = false; // Pause flow
      break;

    case 'option':
      const questionText = substituteVariablesInText(currentNode.questionText, updatedFlowVariables);
      const optionsList = (currentNode.optionsList || '').split('\n').map(opt => opt.trim()).filter(Boolean);
      if (questionText && optionsList.length > 0) {
        let messageWithOptions = questionText + '\n';
        optionsList.forEach((opt, index) => {
          messageWithOptions += `${index + 1}. ${substituteVariablesInText(opt, updatedFlowVariables)}\n`;
        });
        console.log(`[Flow Engine - ${session.session_id}] Sending options: "${messageWithOptions}"`);
        await sendWhatsAppMessageAction({
          ...apiConfig,
          recipientPhoneNumber: session.session_id,
          messageType: 'text',
          textContent: messageWithOptions.trim(),
        });
        session.awaiting_input_type = 'option';
        session.awaiting_input_details = { 
          variableToSave: currentNode.variableToSaveChoice || 'last_user_choice', 
          options: optionsList,
          originalNodeId: currentNode.id 
        };
        shouldContinueRecursive = false; // Pause flow
      } else {
        console.warn(`[Flow Engine - ${session.session_id}] Option node ${currentNode.id} misconfigured.`);
        nextNodeId = findNextNodeId(currentNode.id, 'default', connections);
      }
      break;

    case 'condition':
      const varNameCond = substituteVariablesInText(currentNode.conditionVariable, updatedFlowVariables).replace(/\{\{|\}\}/g, '');
      const actualValueCond = getProperty(updatedFlowVariables, varNameCond) ?? '';
      const compareValueCond = substituteVariablesInText(currentNode.conditionValue, updatedFlowVariables);
      let conditionMet = false;
      switch (currentNode.conditionOperator) {
        case '==': conditionMet = String(actualValueCond) === String(compareValueCond); break;
        case '!=': conditionMet = String(actualValueCond) !== String(compareValueCond); break;
        case 'contains': conditionMet = String(actualValueCond).includes(String(compareValueCond)); break;
        // TODO: Add other operators from TestChatPanel if needed
        default: conditionMet = false;
      }
      console.log(`[Flow Engine - ${session.session_id}] Condition: ${varNameCond} ('${actualValueCond}') ${currentNode.conditionOperator} '${compareValueCond}' -> ${conditionMet}`);
      nextNodeId = findNextNodeId(currentNode.id, conditionMet ? 'true' : 'false', connections);
      break;

    case 'set-variable':
      if (currentNode.variableName) {
        const valueToSet = substituteVariablesInText(currentNode.variableValue, updatedFlowVariables);
        updatedFlowVariables[currentNode.variableName] = valueToSet;
        session.flow_variables = updatedFlowVariables; // Update session's variables
        console.log(`[Flow Engine - ${session.session_id}] Variable "${currentNode.variableName}" set to "${valueToSet}"`);
      }
      nextNodeId = findNextNodeId(currentNode.id, 'default', connections);
      break;
    
    case 'api-call':
      const apiUrl = substituteVariablesInText(currentNode.apiUrl, updatedFlowVariables);
      const apiInstance = substituteVariablesInText(currentNode.instanceName, updatedFlowVariables) || apiConfig.instanceName;
      let recipientPhone = substituteVariablesInText(currentNode.phoneNumber, updatedFlowVariables);
      if (!recipientPhone && updatedFlowVariables.whatsapp_sender_jid) {
          recipientPhone = updatedFlowVariables.whatsapp_sender_jid;
      }
      
      if (apiUrl.includes('/message/sendText/') && currentNode.apiMethod === 'POST') {
        let textContent = substituteVariablesInText(currentNode.textMessage, updatedFlowVariables);
        if (!textContent && currentNode.apiBodyType === 'json' && currentNode.apiBodyJson) {
          try {
            const bodyData = JSON.parse(substituteVariablesInText(currentNode.apiBodyJson, updatedFlowVariables));
            textContent = bodyData.text || bodyData.textMessage?.text;
          } catch (e) { console.error(`[Flow Engine - ${session.session_id}] API Call: Error parsing JSON body for text`, e); }
        }
        if (recipientPhone && textContent) {
            await sendWhatsAppMessageAction({
              baseUrl: apiConfig.baseUrl, 
              apiKey: apiConfig.apiKey,
              instanceName: apiInstance,
              recipientPhoneNumber: recipientPhone,
              messageType: 'text',
              textContent: textContent,
            });
        } else {
            console.warn(`[Flow Engine - ${session.session_id}] API Call (sendText): Missing number or text for node ${currentNode.id}`);
        }
      } else if (apiUrl.includes('/message/sendMedia/') && currentNode.apiMethod === 'POST') {
        const mediaUrl = substituteVariablesInText(currentNode.mediaUrl, updatedFlowVariables);
        const caption = substituteVariablesInText(currentNode.caption, updatedFlowVariables);
        if (recipientPhone && mediaUrl && currentNode.mediaType) {
          await sendWhatsAppMessageAction({
            baseUrl: apiConfig.baseUrl,
            apiKey: apiConfig.apiKey,
            instanceName: apiInstance,
            recipientPhoneNumber: recipientPhone,
            messageType: currentNode.mediaType,
            mediaUrl: mediaUrl,
            caption: caption,
          });
        } else {
           console.warn(`[Flow Engine - ${session.session_id}] API Call (sendMedia): Missing number, mediaUrl or mediaType for node ${currentNode.id}`);
        }
      } else {
        console.log(`[Flow Engine - ${session.session_id}] Generic API Call to ${apiUrl} (simulation). Output variable: ${currentNode.apiOutputVariable}`);
        if (currentNode.apiOutputVariable) {
          updatedFlowVariables[currentNode.apiOutputVariable] = { success: true, data: "Simulated API response from backend engine" };
          session.flow_variables = updatedFlowVariables;
        }
      }
      nextNodeId = findNextNodeId(currentNode.id, 'default', connections);
      break;

    case 'ai-text-generation':
      const aiPromptText = substituteVariablesInText(currentNode.aiPromptText, updatedFlowVariables);
      if (aiPromptText && currentNode.aiOutputVariable) {
        try {
          console.log(`[Flow Engine - ${session.session_id}] AI Text Gen: Calling genericTextGenerationFlow with prompt: "${aiPromptText}"`);
          const aiResponse = await genericTextGenerationFlow({ promptText: aiPromptText });
          updatedFlowVariables[currentNode.aiOutputVariable] = aiResponse.generatedText;
          session.flow_variables = updatedFlowVariables;
          console.log(`[Flow Engine - ${session.session_id}] AI Text Gen: Output "${aiResponse.generatedText}" set to variable ${currentNode.aiOutputVariable}`);
        } catch (e:any) {
          console.error(`[Flow Engine - ${session.session_id}] AI Text Gen Error:`, e.message);
          updatedFlowVariables[currentNode.aiOutputVariable] = "Erro ao gerar texto com IA.";
          session.flow_variables = updatedFlowVariables;
        }
      } else {
        console.warn(`[Flow Engine - ${session.session_id}] AI Text Gen: Misconfigured node ${currentNode.id} (missing prompt or output variable)`);
      }
      nextNodeId = findNextNodeId(currentNode.id, 'default', connections);
      break;

    case 'intelligent-agent':
      const userInputForAgent = substituteVariablesInText(currentNode.userInputVariable, updatedFlowVariables);
      if (userInputForAgent && currentNode.agentResponseVariable) {
         try {
          console.log(`[Flow Engine - ${session.session_id}] Intelligent Agent: Calling simpleChatReply with input: "${userInputForAgent}"`);
          const agentReply = await simpleChatReply({ userMessage: userInputForAgent });
          updatedFlowVariables[currentNode.agentResponseVariable] = agentReply.botReply;
          session.flow_variables = updatedFlowVariables;
          console.log(`[Flow Engine - ${session.session_id}] Intelligent Agent: Output "${agentReply.botReply}" set to variable ${currentNode.agentResponseVariable}`);
        } catch (e:any) {
          console.error(`[Flow Engine - ${session.session_id}] Intelligent Agent Error:`, e.message);
          updatedFlowVariables[currentNode.agentResponseVariable] = "Erro ao comunicar com agente IA.";
          session.flow_variables = updatedFlowVariables;
        }
      } else {
         console.warn(`[Flow Engine - ${session.session_id}] Intelligent Agent: Misconfigured node ${currentNode.id} (missing user input variable or agent response variable)`);
      }
      nextNodeId = findNextNodeId(currentNode.id, 'default', connections);
      break;

    case 'end-flow':
      console.log(`[Flow Engine - ${session.session_id}] Reached End Flow node. Deleting session.`);
      await deleteSessionFromDB(session.session_id);
      shouldContinueRecursive = false;
      break;

    default:
      console.warn(`[Flow Engine - ${session.session_id}] Node type ${currentNode.type} not fully implemented in backend engine. Trying 'default' exit.`);
      nextNodeId = findNextNodeId(currentNode.id, 'default', connections);
      break;
  }
  
  session.flow_variables = updatedFlowVariables; // Ensure session always has the latest variables

  if (shouldContinueRecursive) {
    if (nextNodeId) {
      session.current_node_id = nextNodeId;
      await saveSessionToDB(session); 
      await executeFlowStep(session, nodes, connections, apiConfig);
    } else {
      console.log(`[Flow Engine - ${session.session_id}] No next node from ${currentNode.id}. Ending flow (or pausing if no end-node).`);
      // If it's not an explicit end-flow node, we might just be at the end of a branch.
      // The session is saved, but no further recursive call.
      // The next user message will try to resume or restart.
      await saveSessionToDB(session); // Save final state before potential implicit end
    }
  } else {
    // Flow paused (e.g. for input) or explicitly ended by end-flow node.
    // Session state was already saved or deleted within the switch case.
    if (currentNode.type !== 'end-flow') { // Avoid double save if end-flow already deleted/saved.
        await saveSessionToDB(session); // Ensure latest state (like awaiting_input_type) is saved
    }
    console.log(`[Flow Engine - ${session.session_id}] Flow paused or ended. Session state for node ${currentNode.id} handled.`);
  }
}
// --- End Helper Functions ---


async function storeRequestDetails(request: NextRequest): Promise<StoredLogEntry | null> {
  const currentTimestamp = new Date().toISOString();
  const { method, url } = request;
  const headers = Object.fromEntries(request.headers.entries());
  const contentType = request.headers.get('content-type'); // Store original content-type
  const ip = request.ip || request.headers.get('x-forwarded-for') || 'unknown IP';
  const geo = request.geo || { city: 'unknown city', country: 'unknown country' };

  console.log(`[Evolution API Webhook Store ENTRY] ${currentTimestamp} - Received ${method} for ${url}`);
  console.log(`[Evolution API Webhook Store DETAILS] IP: ${ip}, Geo: ${JSON.stringify(geo)}, Content-Type: ${contentType}`);

  let payload: any = { message: "Payload not processed or not applicable for this request method." };
  let bodyAsText: string | null = null;
  let extractedMessage: string | null = null;
  let webhookRemoteJid: string | null = null;
  let parsedBodyForExtraction: any = null; 

  if (method !== 'GET' && method !== 'HEAD') {
    try {
      console.log(`[Evolution API Webhook Store] Attempting to read request body as text for ${method}...`);
      bodyAsText = await request.text(); 

      if (bodyAsText && bodyAsText.trim() !== '') {
        console.log(`[Evolution API Webhook Store] Successfully read body as text. Length: ${bodyAsText.length}. Preview: ${bodyAsText.substring(0, 200)}`);
        // Try to parse as JSON if content type suggests it OR if it looks like JSON
        if (contentType && (contentType.includes('application/json')) || (bodyAsText.startsWith('{') && bodyAsText.endsWith('}')) || (bodyAsText.startsWith('[') && bodyAsText.endsWith(']'))) {
          try {
            parsedBodyForExtraction = JSON.parse(bodyAsText);
            payload = parsedBodyForExtraction; 
            console.log(`[Evolution API Webhook Store] Parsed JSON payload for ${method}.`);
          } catch (jsonError: any) {
            console.warn(`[Evolution API Webhook Store] Failed to parse body as JSON for ${method}, storing as raw text. Error: ${jsonError.message}.`);
            payload = { raw_text: bodyAsText, parse_error: jsonError.message, original_content_type: contentType };
          }
        } else {
          payload = { raw_text: bodyAsText, original_content_type: contentType || 'N/A' };
          console.log(`[Evolution API Webhook Store] Stored non-JSON payload as raw_text for ${method}.`);
        }
      } else {
        payload = { message: `Request body was empty or whitespace for ${method}.`, original_content_type: contentType || 'N/A' };
        console.log(`[Evolution API Webhook Store] Request body was empty or whitespace for ${method}.`);
      }
    } catch (error: any) {
      console.error(`[Evolution API Webhook Store] Error reading/processing request body for ${method}:`, error.message);
      const bodyPreview = bodyAsText ? (bodyAsText.substring(0, 200) + (bodyAsText.length > 200 ? '...' : '')) : "Could not read body text before error.";
      payload = {
        error_reading_processing_body: error.message,
        original_content_type: contentType || 'N/A',
        body_preview_on_error: bodyPreview
      };
    }
  } else {
    console.log(`[Evolution API Webhook Store] No payload processed for ${method} request (e.g., GET, HEAD).`);
  }
  
  // Use parsedBodyForExtraction for trying to get specific fields
  if (parsedBodyForExtraction && typeof parsedBodyForExtraction === 'object') {
    let actualPayloadToExtractFrom = parsedBodyForExtraction;
    if (Array.isArray(parsedBodyForExtraction) && parsedBodyForExtraction.length === 1 && typeof parsedBodyForExtraction[0] === 'object') {
      actualPayloadToExtractFrom = parsedBodyForExtraction[0];
    }

    const commonMessagePaths = [
      'body.data.message.conversation', 'data.message.conversation', 
      'message.body', 'message.message.conversation', 
      'body.textMessage.text', 'text', 
      'body.data.message.extendedTextMessage.text', 'data.message.extendedTextMessage.text',
    ];
    for (const path of commonMessagePaths) {
      const msg = getProperty(actualPayloadToExtractFrom, path);
      if (typeof msg === 'string' && msg.trim() !== '') {
        extractedMessage = msg.trim();
        console.log(`[Evolution API Webhook Store] Extracted message using path "${path}" from actualPayload: "${extractedMessage}"`);
        break;
      }
    }
     if (!extractedMessage) {
      console.log(`[Evolution API Webhook Store] Could not extract a simple text message from common JSON paths in actualPayload.`);
    }

    const remoteJidPaths = [
      'body.data.key.remoteJid', 'data.key.remoteJid', 
      'body.sender', 'sender'
    ];
    for (const path of remoteJidPaths) {
      const jid = getProperty(actualPayloadToExtractFrom, path);
      if (typeof jid === 'string' && jid.trim() !== '') {
        webhookRemoteJid = jid.trim();
         console.log(`[Evolution API Webhook Store] Extracted remoteJid using path "${path}" from actualPayload: "${webhookRemoteJid}"`);
        break;
      }
    }
    if (!webhookRemoteJid) {
      console.log(`[Evolution API Webhook Store] Could not extract remoteJid from common JSON paths in actualPayload.`);
    }
  }

  const logEntry: StoredLogEntry = {
    timestamp: currentTimestamp,
    method: method,
    url: url,
    headers: headers,
    payload: payload,
    ip: ip,
    geo: geo,
    extractedMessage: extractedMessage,
    webhook_remoteJid: webhookRemoteJid,
  };
  
  if (!Array.isArray(globalThis.evolutionWebhookLogs)) {
    console.warn('[Evolution API Webhook Store] globalThis.evolutionWebhookLogs is not an array before unshift! Re-initializing.');
    globalThis.evolutionWebhookLogs = [];
  }
  console.log(`[Evolution API Webhook Store] BEFORE UNSHIFT: Current globalThis.evolutionWebhookLogs length: ${globalThis.evolutionWebhookLogs.length}. Type: ${typeof globalThis.evolutionWebhookLogs}. IsArray: ${Array.isArray(globalThis.evolutionWebhookLogs)}`);
  globalThis.evolutionWebhookLogs.unshift(logEntry);
  console.log(`[Evolution API Webhook Store] AFTER UNSHIFT: New globalThis.evolutionWebhookLogs length: ${globalThis.evolutionWebhookLogs.length}. Entry for: ${logEntry.timestamp}, Extracted Msg: ${logEntry.extractedMessage || 'N/A'}, RemoteJID: ${logEntry.webhook_remoteJid || 'N/A'}`);

  if (globalThis.evolutionWebhookLogs.length > MAX_LOG_ENTRIES) {
    const popped = globalThis.evolutionWebhookLogs.pop();
    console.log(`[Evolution API Webhook Store] Popped oldest log entry (timestamp: ${popped?.timestamp}). Logs count: ${globalThis.evolutionWebhookLogs.length}`);
  }
  console.log(`[Evolution API Webhook Store EXIT] Request logged. Total logs in global store: ${globalThis.evolutionWebhookLogs.length}`);
  return logEntry; 
}

export async function POST(request: NextRequest) {
  console.log('[Evolution API Webhook Route] POST request received.');
  
  // Clone a requisição para poder ler o corpo duas vezes se necessário (uma para debug, outra para storeRequestDetails)
  // No entanto, `storeRequestDetails` já tenta ler o corpo. Se ele falhar, o debug abaixo pode não ter corpo.
  // Alternativamente, lemos aqui e passamos para storeRequestDetails, mas storeRequestDetails já é genérico.
  // Vamos confiar que storeRequestDetails fará o log correto.
  // const clonedRequest = request.clone();
  // try {
  //   const rawBody = await clonedRequest.text();
  //   console.log(`[Evolution API Webhook Route - DEBUG] Raw body in POST handler: ${rawBody.substring(0, 500)}...`);
  //   if(!rawBody || rawBody.trim() === '') {
  //        console.warn('[Evolution API Webhook Route - DEBUG] Body appears empty in POST handler.');
  //   }
  // } catch (e: any) {
  //   console.error('[Evolution API Webhook Route - DEBUG] Error reading raw body in POST handler:', e.message);
  // }

  const loggedEntry = await storeRequestDetails(request);

  if (!loggedEntry || !loggedEntry.payload) {
    console.error('[Evolution API Webhook Route] Failed to log/process request details or payload is missing.');
    return NextResponse.json({ error: "Internal server error processing request payload." }, { status: 500 });
  }

  const eventType = getProperty(loggedEntry.payload, 'event') as string;
  const instanceName = getProperty(loggedEntry.payload, 'instance') as string;
  const senderJid = loggedEntry.webhook_remoteJid; 
  const receivedMessageText = loggedEntry.extractedMessage;
  const evolutionApiBaseUrl = getProperty(loggedEntry.payload, 'server_url') as string;
  const evolutionApiKey = getProperty(loggedEntry.payload, 'apikey') as string;

  console.log(`[Evolution API Webhook Route] Parsed data: event='${eventType}', instance='${instanceName}', senderJid='${senderJid}', receivedMessage='${receivedMessageText}', baseUrl='${evolutionApiBaseUrl}', apiKeyExists='${!!evolutionApiKey}'`);

  if (eventType === 'messages.upsert' && senderJid && receivedMessageText && instanceName && evolutionApiBaseUrl) {
    console.log(`[Evolution API Webhook Route - ${senderJid}] 'messages.upsert' event. Processing flow.`);
    try {
      let session = await loadSessionFromDB(senderJid);
      let workspace: WorkspaceData | null = null;
      let nodes: NodeData[] = [];
      let connections: Connection[] = [];

      const apiConfig: ApiConfig = { baseUrl: evolutionApiBaseUrl, apiKey: evolutionApiKey, instanceName };

      if (session) {
        console.log(`[Flow Engine - ${senderJid}] Existing session found: Node ${session.current_node_id}, Awaiting: ${session.awaiting_input_type}`);
        workspace = await loadWorkspaceFromDB(session.workspace_id);
        if (!workspace) {
          console.error(`[Flow Engine - ${senderJid}] Critical: Workspace ${session.workspace_id} for existing session not found. Deleting session.`);
          await deleteSessionFromDB(senderJid);
          session = null; // Force new session creation
        } else {
          nodes = workspace.nodes || [];
          connections = workspace.connections || [];
          
          if (session.awaiting_input_type && session.current_node_id && session.awaiting_input_details) {
            const originalNodeId = session.awaiting_input_details.originalNodeId || session.current_node_id;
            const awaitingNode = findNodeById(originalNodeId, nodes);

            if (awaitingNode) {
              console.log(`[Flow Engine - ${senderJid}] Processing user reply for node: ${awaitingNode.id} (${awaitingNode.type})`);
              if (session.awaiting_input_type === 'text' && session.awaiting_input_details.variableToSave) {
                session.flow_variables[session.awaiting_input_details.variableToSave] = receivedMessageText;
                console.log(`[Flow Engine - ${senderJid}] Saved user text input to: ${session.awaiting_input_details.variableToSave} = "${receivedMessageText}"`);
                session.current_node_id = findNextNodeId(awaitingNode.id, 'default', connections);
              } else if (session.awaiting_input_type === 'option' && session.awaiting_input_details.options) {
                const chosenOptionText = session.awaiting_input_details.options.find(
                  (opt, idx) => opt.toLowerCase() === receivedMessageText.toLowerCase() || String(idx + 1) === receivedMessageText
                );
                if (chosenOptionText) {
                  if (session.awaiting_input_details.variableToSave) {
                    session.flow_variables[session.awaiting_input_details.variableToSave] = chosenOptionText;
                    console.log(`[Flow Engine - ${senderJid}] Saved user option choice to: ${session.awaiting_input_details.variableToSave} = "${chosenOptionText}"`);
                  }
                  session.current_node_id = findNextNodeId(awaitingNode.id, chosenOptionText, connections);
                  console.log(`[Flow Engine - ${senderJid}] User chose option: ${chosenOptionText}. Next node: ${session.current_node_id}`);
                } else {
                  console.log(`[Flow Engine - ${senderJid}] Invalid option: "${receivedMessageText}". Re-prompting.`);
                  await sendWhatsAppMessageAction({...apiConfig, recipientPhoneNumber: senderJid, messageType:'text', textContent: "Opção inválida. Por favor, tente novamente."});
                  session.current_node_id = awaitingNode.id; // Stay on option node to re-prompt (implicit via next executeFlowStep if current_node_id is the same)
                }
              }
              session.awaiting_input_type = null;
              session.awaiting_input_details = null;
            } else {
               console.warn(`[Flow Engine - ${senderJid}] Awaiting node ${originalNodeId} not found. Resetting session.`);
               session = null; // Problem with session or flow, reset
            }
          } else {
             console.log(`[Flow Engine - ${senderJid}] Session exists but was not awaiting input or details missing. Treating as new interaction, might restart.`);
             // Potentially restart flow or handle as out-of-band message. For now, let's reset.
             session = null; 
          }
        }
      }
      
      if (!session) {
        console.log(`[Flow Engine - ${senderJid}] No active session or session was reset. Starting new one.`);
        workspace = await loadActiveWorkspaceFromDB(); 
        if (!workspace || !workspace.nodes || workspace.nodes.length === 0) {
          console.error(`[Flow Engine - ${senderJid}] No active/default workspace found or workspace is empty.`);
          await sendWhatsAppMessageAction({...apiConfig, recipientPhoneNumber: senderJid, messageType:'text', textContent: "Desculpe, não há um fluxo configurado para esta interação no momento."});
          return NextResponse.json({ error: "No active workspace or empty workspace configured." }, { status: 500 });
        }
        nodes = workspace.nodes;
        connections = workspace.connections;
        const startNode = nodes.find(n => n.type === 'start');
        if (!startNode) {
          console.error(`[Flow Engine - ${senderJid}] No start node in workspace ${workspace.id}.`);
           await sendWhatsAppMessageAction({...apiConfig, recipientPhoneNumber: senderJid, messageType:'text', textContent: "Erro: O fluxo não tem um nó de início."});
          return NextResponse.json({ error: "Flow has no start node." }, { status: 500 });
        }
        
        const firstTriggerName = startNode.triggers?.[0]?.name;
        const initialNodeId = findNextNodeId(startNode.id, firstTriggerName || 'default', connections);

        if (!initialNodeId) {
            console.error(`[Flow Engine - ${senderJid}] Start node or its first trigger has no outgoing connection in workspace ${workspace.id}.`);
            await sendWhatsAppMessageAction({...apiConfig, recipientPhoneNumber: senderJid, messageType:'text', textContent: "Erro: O fluxo não está conectado corretamente a partir do início."});
            return NextResponse.json({ error: "Start node is not connected." }, { status: 500 });
        }

        session = {
          session_id: senderJid,
          workspace_id: workspace.id,
          current_node_id: initialNodeId,
          flow_variables: { 
            whatsapp_sender_jid: senderJid, 
            mensagem_whatsapp: receivedMessageText, // User's first message
            webhook_evolution_payload: loggedEntry.payload 
          },
          awaiting_input_type: null,
          awaiting_input_details: null,
        };
        console.log(`[Flow Engine - ${senderJid}] New session created. Starting at node ${initialNodeId}`);
      }
      
      await saveSessionToDB(session);
      if (session.current_node_id) { // Ensure there's a node to execute
        await executeFlowStep(session, nodes, connections, apiConfig);
      } else if (session.awaiting_input_type) {
        // Flow is paused, waiting for input, no further step to execute now. Session already saved.
        console.log(`[Flow Engine - ${senderJid}] Flow is paused, awaiting user input for type: ${session.awaiting_input_type}`);
      } else {
         console.log(`[Flow Engine - ${senderJid}] Session has no current_node_id after processing input/init. Might be end of a branch. Flow effectively paused.`);
         // No explicit end node, but no next node. Session is saved.
      }

    } catch (error: any) {
      console.error(`[Evolution API Webhook Route - ${senderJid}] Exception processing flow:`, error);
       await sendWhatsAppMessageAction({
          ...apiConfig, // Use the apiConfig derived from the webhook if available
          recipientPhoneNumber: senderJid, // senderJid should be defined
          messageType: 'text',
          textContent: "Desculpe, ocorreu um erro interno ao processar sua mensagem.",
        });
    }
  } else {
    console.log(`[Evolution API Webhook Route] POST request logged, but not a 'messages.upsert' event or missing necessary data for flow execution. Event: ${eventType}, Instance: ${instanceName}, Sender: ${senderJid}, Message: ${receivedMessageText}, BaseURL: ${evolutionApiBaseUrl}`);
  }
  return NextResponse.json({ status: "received", message: "Webhook POST event processed." }, { status: 200 });
}

export async function GET(request: NextRequest) { 
  const logEventParam = request.nextUrl.searchParams.get('logEvent');
  if (logEventParam === 'true') {
    console.log('[Evolution API Webhook Route] GET request received (logEvent=true).');
    await storeRequestDetails(request); 
    return NextResponse.json(
      { status: "received_and_logged", message: "Webhook GET event logged as per 'logEvent=true' query parameter." },
      { status: 200 }
    );
  }
  return NextResponse.json(
    { message: "NexusFlow Webhook Endpoint for Evolution API. Accepts POST for events." },
    { status: 200 }
  );
}
export async function PUT(request: NextRequest) { 
  console.log('[Evolution API Webhook Route] PUT request received.');
  await storeRequestDetails(request); 
  return NextResponse.json({ status: "received", message: "Webhook PUT event logged." }, { status: 200 });
}
export async function PATCH(request: NextRequest) { 
  console.log('[Evolution API Webhook Route] PATCH request received.');
  await storeRequestDetails(request); 
  return NextResponse.json({ status: "received", message: "Webhook PATCH event logged." }, { status: 200 });
}
export async function DELETE(request: NextRequest) { 
  console.log('[Evolution API Webhook Route] DELETE request received.');
  await storeRequestDetails(request); 
  return NextResponse.json({ status: "received", message: "Webhook DELETE event logged." }, { status: 200 });
}
