
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getProperty } from 'dot-prop';
import { sendWhatsAppMessageAction } from '@/app/actions/evolutionApiActions';
import { 
  loadSessionFromDB, 
  saveSessionToDB, 
  deleteSessionFromDB,
  loadActiveWorkspaceFromDB, // To get a default flow
  loadWorkspaceFromDB
} from '@/app/actions/databaseActions';
import type { NodeData, Connection, FlowSession, WorkspaceData } from '@/lib/types';
import { genericTextGenerationFlow } from '@/ai/flows/generic-text-generation-flow'; // Assuming this exists
import { simpleChatReply } from '@/ai/flows/simple-chat-reply-flow';


declare global {
  // eslint-disable-next-line no-var
  var evolutionWebhookLogs: Array<any>;
}

if (!globalThis.evolutionWebhookLogs || !Array.isArray(globalThis.evolutionWebhookLogs)) {
  console.log(`[GLOBAL_INIT in webhook/route.ts] Initializing globalThis.evolutionWebhookLogs as new array.`);
  globalThis.evolutionWebhookLogs = [];
}
const MAX_LOG_ENTRIES = 50;

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
  let-subbedText = text;
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

interface ApiConfig {
  baseUrl: string;
  apiKey?: string;
  instanceName: string;
}

async function executeFlowStep(
  session: FlowSession, 
  nodes: NodeData[], 
  connections: Connection[],
  apiConfig: ApiConfig // For sending WhatsApp messages back
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

  switch (currentNode.type) {
    case 'start':
      const firstTrigger = currentNode.triggers?.[0]?.name;
      nextNodeId = findNextNodeId(currentNode.id, firstTrigger || 'default', connections);
      break;

    case 'message':
      const messageText = substituteVariablesInText(currentNode.text, session.flow_variables);
      if (messageText) {
        console.log(`[Flow Engine - ${session.session_id}] Sending message: "${messageText}"`);
        await sendWhatsAppMessageAction({
          baseUrl: apiConfig.baseUrl,
          apiKey: apiConfig.apiKey,
          instanceName: apiConfig.instanceName,
          recipientPhoneNumber: session.session_id, // senderJid is the sessionId
          messageType: 'text',
          textContent: messageText,
        });
      }
      nextNodeId = findNextNodeId(currentNode.id, 'default', connections);
      break;

    case 'input':
      const promptText = substituteVariablesInText(currentNode.promptText, session.flow_variables);
      if (promptText) {
        console.log(`[Flow Engine - ${session.session_id}] Sending input prompt: "${promptText}"`);
        await sendWhatsAppMessageAction({
          baseUrl: apiConfig.baseUrl,
          apiKey: apiConfig.apiKey,
          instanceName: apiConfig.instanceName,
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
      const questionText = substituteVariablesInText(currentNode.questionText, session.flow_variables);
      const optionsList = (currentNode.optionsList || '').split('\n').map(opt => opt.trim()).filter(Boolean);
      if (questionText && optionsList.length > 0) {
        let messageWithOptions = questionText + '\n';
        optionsList.forEach((opt, index) => {
          messageWithOptions += `${index + 1}. ${substituteVariablesInText(opt, session.flow_variables)}\n`;
        });
        console.log(`[Flow Engine - ${session.session_id}] Sending options: "${messageWithOptions}"`);
        await sendWhatsAppMessageAction({
          baseUrl: apiConfig.baseUrl,
          apiKey: apiConfig.apiKey,
          instanceName: apiConfig.instanceName,
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
        nextNodeId = findNextNodeId(currentNode.id, 'default', connections); // Try to fail gracefully
      }
      break;

    case 'condition':
      const varName = substituteVariablesInText(currentNode.conditionVariable, session.flow_variables).replace(/\{\{|\}\}/g, '');
      const actualValue = getProperty(session.flow_variables, varName) ?? '';
      const compareValue = substituteVariablesInText(currentNode.conditionValue, session.flow_variables);
      let conditionMet = false;
      // Simplified condition logic (expand as needed from TestChatPanel)
      switch (currentNode.conditionOperator) {
        case '==': conditionMet = String(actualValue) === String(compareValue); break;
        case '!=': conditionMet = String(actualValue) !== String(compareValue); break;
        case 'contains': conditionMet = String(actualValue).includes(String(compareValue)); break;
        // Add other operators
        default: conditionMet = false;
      }
      console.log(`[Flow Engine - ${session.session_id}] Condition: ${varName} ('${actualValue}') ${currentNode.conditionOperator} '${compareValue}' -> ${conditionMet}`);
      nextNodeId = findNextNodeId(currentNode.id, conditionMet ? 'true' : 'false', connections);
      break;

    case 'set-variable':
      if (currentNode.variableName) {
        const valueToSet = substituteVariablesInText(currentNode.variableValue, session.flow_variables);
        session.flow_variables[currentNode.variableName] = valueToSet;
        console.log(`[Flow Engine - ${session.session_id}] Variable "${currentNode.variableName}" set to "${valueToSet}"`);
      }
      nextNodeId = findNextNodeId(currentNode.id, 'default', connections);
      break;
    
    case 'api-call':
      const apiUrl = substituteVariablesInText(currentNode.apiUrl, session.flow_variables);
      if (apiUrl.includes('/message/sendText/') && currentNode.apiMethod === 'POST') {
        let number = substituteVariablesInText(currentNode.phoneNumber, session.flow_variables);
        if (!number) number = session.flow_variables.whatsapp_sender_jid || session.session_id;
        
        let textContent = substituteVariablesInText(currentNode.textMessage, session.flow_variables);
        if (!textContent && currentNode.apiBodyType === 'json' && currentNode.apiBodyJson) {
          try {
            const bodyData = JSON.parse(substituteVariablesInText(currentNode.apiBodyJson, session.flow_variables));
            textContent = bodyData.text || bodyData.textMessage?.text;
          } catch (e) { console.error(`[Flow Engine - ${session.session_id}] API Call: Error parsing JSON body for text`, e); }
        }

        if (number && textContent) {
            await sendWhatsAppMessageAction({
              baseUrl: apiConfig.baseUrl, // Or use a globally configured one if node.apiUrl is just a path
              apiKey: apiConfig.apiKey,
              instanceName: substituteVariablesInText(currentNode.instanceName, session.flow_variables) || apiConfig.instanceName,
              recipientPhoneNumber: number,
              messageType: 'text',
              textContent: textContent,
            });
        } else {
            console.warn(`[Flow Engine - ${session.session_id}] API Call (sendText): Missing number or text for node ${currentNode.id}`);
        }
      } else {
        // Generic API call simulation or placeholder
        console.log(`[Flow Engine - ${session.session_id}] API Call to ${apiUrl} (simulation)`);
        if (currentNode.apiOutputVariable) {
          session.flow_variables[currentNode.apiOutputVariable] = { success: true, data: "Simulated API response from backend" };
        }
      }
      nextNodeId = findNextNodeId(currentNode.id, 'default', connections);
      break;

    case 'ai-text-generation':
      const aiPrompt = substituteVariablesInText(currentNode.aiPromptText, session.flow_variables);
      if (aiPrompt && currentNode.aiOutputVariable) {
        try {
          const aiResponse = await genericTextGenerationFlow({ promptText: aiPrompt });
          session.flow_variables[currentNode.aiOutputVariable] = aiResponse.generatedText;
          console.log(`[Flow Engine - ${session.session_id}] AI Text Gen: Output set to ${currentNode.aiOutputVariable}`);
        } catch (e:any) {
          console.error(`[Flow Engine - ${session.session_id}] AI Text Gen Error:`, e.message);
           session.flow_variables[currentNode.aiOutputVariable] = "Erro ao gerar texto com IA.";
        }
      }
      nextNodeId = findNextNodeId(currentNode.id, 'default', connections);
      break;

    case 'intelligent-agent':
      const userInputForAgent = substituteVariablesInText(currentNode.userInputVariable, session.flow_variables);
      if (userInputForAgent && currentNode.agentResponseVariable) {
         try {
          const agentReply = await simpleChatReply({ userMessage: userInputForAgent });
          session.flow_variables[currentNode.agentResponseVariable] = agentReply.botReply;
          console.log(`[Flow Engine - ${session.session_id}] Intelligent Agent: Output set to ${currentNode.agentResponseVariable}`);
        } catch (e:any) {
          console.error(`[Flow Engine - ${session.session_id}] Intelligent Agent Error:`, e.message);
           session.flow_variables[currentNode.agentResponseVariable] = "Erro ao comunicar com agente IA.";
        }
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

  if (shouldContinueRecursive) {
    if (nextNodeId) {
      session.current_node_id = nextNodeId;
      await saveSessionToDB(session); // Save before next step
      await executeFlowStep(session, nodes, connections, apiConfig);
    } else {
      console.log(`[Flow Engine - ${session.session_id}] No next node from ${currentNode.id}. Ending flow.`);
      await deleteSessionFromDB(session.session_id); // End session if no next node
    }
  } else {
    // Flow paused (e.g. for input) or ended, session was already saved or deleted.
    await saveSessionToDB(session); // Ensure latest state (like awaiting_input_type) is saved
    console.log(`[Flow Engine - ${session.session_id}] Flow paused or ended. Session state saved for node ${currentNode.id}.`);
  }
}
// --- End Helper Functions ---


async function storeRequestDetails(request: NextRequest): Promise<StoredLogEntry | null> {
  // ... (storeRequestDetails implementation remains largely the same as before) ...
  const currentTimestamp = new Date().toISOString();
  const { method, url } = request;
  const headers = Object.fromEntries(request.headers.entries());
  const contentType = request.headers.get('content-type');
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
      bodyAsText = await request.text(); // Read as text first

      if (bodyAsText && bodyAsText.trim() !== '') {
        console.log(`[Evolution API Webhook Store] Successfully read body as text. Length: ${bodyAsText.length}. Preview: ${bodyAsText.substring(0, 200)}`);
        // Try to parse as JSON if content type suggests it or if it looks like JSON
        if (contentType && (contentType.includes('application/json') || contentType.includes('application/x-www-form-urlencoded')) || (bodyAsText.startsWith('{') && bodyAsText.endsWith('}')) || (bodyAsText.startsWith('[') && bodyAsText.endsWith(']'))) {
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
          console.log(`[Evolution API Webhook Store] Stored non-JSON/non-form-urlencoded payload as raw_text for ${method}.`);
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
      'data.message.conversation', 'message.body', 'message.message.conversation', 'body.message.conversation',
      'textMessage.text', 'text', 'data.message.extendedTextMessage.text', 'body.data.message.extendedTextMessage.text',
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
      'data.key.remoteJid', 'sender', 'body.data.key.remoteJid', 'body.sender'
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
  const loggedEntry = await storeRequestDetails(request);

  if (!loggedEntry || !loggedEntry.payload) {
    console.error('[Evolution API Webhook Route] Failed to log/process request details.');
    return NextResponse.json({ error: "Internal server error processing request." }, { status: 500 });
  }

  const eventType = getProperty(loggedEntry.payload, 'event') as string;
  const instanceName = getProperty(loggedEntry.payload, 'instance') as string;
  const senderJid = loggedEntry.webhook_remoteJid; // Use the JID extracted by storeRequestDetails
  const receivedMessageText = loggedEntry.extractedMessage; // Use the message extracted by storeRequestDetails
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
        console.log(`[Flow Engine - ${senderJid}] Existing session found: Node ${session.current_node_id}`);
        workspace = await loadWorkspaceFromDB(session.workspace_id);
        if (!workspace) {
          console.error(`[Flow Engine - ${senderJid}] Critical: Workspace ${session.workspace_id} for existing session not found.`);
          await deleteSessionFromDB(senderJid); // Clean up bad session
          return NextResponse.json({ error: "Associated workspace not found." }, { status: 500 });
        }
        nodes = workspace.nodes;
        connections = workspace.connections;
        
        // Process user's reply if flow was awaiting input
        if (session.awaiting_input_type && session.current_node_id) {
          const awaitingNode = findNodeById(session.current_node_id, nodes);
          if (awaitingNode) {
            if (session.awaiting_input_type === 'text' && session.awaiting_input_details?.variableToSave) {
              session.flow_variables[session.awaiting_input_details.variableToSave] = receivedMessageText;
              console.log(`[Flow Engine - ${senderJid}] Saved user input to: ${session.awaiting_input_details.variableToSave}`);
              session.current_node_id = findNextNodeId(awaitingNode.id, 'default', connections);
            } else if (session.awaiting_input_type === 'option' && session.awaiting_input_details?.options) {
              const chosenOption = session.awaiting_input_details.options.find(
                (opt, idx) => opt.toLowerCase() === receivedMessageText.toLowerCase() || String(idx + 1) === receivedMessageText
              );
              if (chosenOption) {
                if (session.awaiting_input_details.variableToSave) {
                  session.flow_variables[session.awaiting_input_details.variableToSave] = chosenOption;
                }
                session.current_node_id = findNextNodeId(awaitingNode.id, chosenOption, connections);
                 console.log(`[Flow Engine - ${senderJid}] User chose option: ${chosenOption}`);
              } else {
                console.log(`[Flow Engine - ${senderJid}] Invalid option. Re-prompting or fallback needed (not implemented).`);
                // Re-prompt or handle invalid option (e.g., send original prompt again)
                await sendWhatsAppMessageAction({...apiConfig, recipientPhoneNumber: senderJid, messageType:'text', textContent: "Opção inválida. Por favor, tente novamente."});
                session.current_node_id = awaitingNode.id; // Stay on option node
              }
            }
          }
          session.awaiting_input_type = null;
          session.awaiting_input_details = null;
        } else {
           // Not awaiting input, treat as a new message that might restart or trigger something
           // For now, if session exists but not awaiting, we might just restart or log.
           // Or, if you want messages to always try to trigger the start of a flow:
           console.log(`[Flow Engine - ${senderJid}] Session exists but was not awaiting input. Treating as new interaction.`);
           session = null; // Force re-initialization for this example
        }
      }
      
      if (!session) {
        console.log(`[Flow Engine - ${senderJid}] No active session. Starting new one.`);
        workspace = await loadActiveWorkspaceFromDB(); // Or a specific one mapped to instanceName
        if (!workspace) {
          console.error(`[Flow Engine - ${senderJid}] No active/default workspace found to start flow.`);
           await sendWhatsAppMessageAction({...apiConfig, recipientPhoneNumber: senderJid, messageType:'text', textContent: "Desculpe, não há um fluxo configurado para esta interação no momento."});
          return NextResponse.json({ error: "No active workspace configured for webhook." }, { status: 500 });
        }
        nodes = workspace.nodes;
        connections = workspace.connections;
        const startNode = nodes.find(n => n.type === 'start');
        if (!startNode) {
          console.error(`[Flow Engine - ${senderJid}] No start node in workspace ${workspace.id}.`);
          return NextResponse.json({ error: "Flow has no start node." }, { status: 500 });
        }
        const firstTriggerName = startNode.triggers?.[0]?.name;
        const initialNodeId = findNextNodeId(startNode.id, firstTriggerName || 'default', connections);

        session = {
          session_id: senderJid,
          workspace_id: workspace.id,
          current_node_id: initialNodeId,
          flow_variables: { 
            whatsapp_sender_jid: senderJid, 
            mensagem_whatsapp: receivedMessageText,
            webhook_evolution_payload: loggedEntry.payload // Save the full payload
          },
          awaiting_input_type: null,
          awaiting_input_details: null,
        };
        console.log(`[Flow Engine - ${senderJid}] New session created. Starting at node ${initialNodeId}`);
      }
      
      // Save session state before starting/continuing step execution
      await saveSessionToDB(session);
      if (session.current_node_id) {
        await executeFlowStep(session, nodes, connections, apiConfig);
      } else {
         console.log(`[Flow Engine - ${senderJid}] Session has no current_node_id after processing input. Ending.`);
         await deleteSessionFromDB(senderJid); // Or send a default message
      }

    } catch (error: any) {
      console.error(`[Evolution API Webhook Route - ${senderJid}] Exception processing flow:`, error);
      // Optionally send an error message back to the user
       await sendWhatsAppMessageAction({
          baseUrl: evolutionApiBaseUrl, // These might be undefined if error happened early
          apiKey: evolutionApiKey,
          instanceName: instanceName,
          recipientPhoneNumber: senderJid,
          messageType: 'text',
          textContent: "Desculpe, ocorreu um erro ao processar sua mensagem.",
        });
    }
  } else {
    console.log(`[Evolution API Webhook Route] POST request logged, but not a 'messages.upsert' event or missing necessary data for flow execution. Event: ${eventType}, Instance: ${instanceName}, Sender: ${senderJid}, Message: ${receivedMessageText}, BaseURL: ${evolutionApiBaseUrl}`);
  }
  return NextResponse.json({ status: "received", message: "Webhook POST event processed." }, { status: 200 });
}


// GET, PUT, PATCH, DELETE handlers remain the same, calling storeRequestDetails
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
    { message: "Flowise Lite Webhook Endpoint for Evolution API. Accepts POST for events." },
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
