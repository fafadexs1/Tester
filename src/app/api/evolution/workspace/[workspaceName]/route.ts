
'use server';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getProperty } from 'dot-prop';
import { sendWhatsAppMessageAction } from '@/app/actions/evolutionApiActions';
import { 
  loadSessionFromDB, 
  saveSessionToDB, 
  deleteSessionFromDB,
  loadWorkspaceByNameFromDB,
  loadActiveWorkspaceFromDB, // Keep for the case where workspace name might not be found or for a fallback
} from '@/app/actions/databaseActions';
import type { NodeData, Connection, FlowSession, WorkspaceData, StartNodeTrigger } from '@/lib/types';
import { genericTextGenerationFlow } from '@/ai/flows/generic-text-generation-flow';
import { simpleChatReply } from '@/ai/flows/simple-chat-reply-flow';

// Certifique-se de que a variável global para logs é inicializada se não existir
if (!globalThis.evolutionWebhookLogs || !Array.isArray(globalThis.evolutionWebhookLogs)) {
  console.log('[API Evolution WS Route] Initializing globalThis.evolutionWebhookLogs as new array.');
  globalThis.evolutionWebhookLogs = [];
}
const MAX_LOG_ENTRIES = 50;

interface ApiConfig {
  baseUrl: string;
  apiKey?: string;
  instanceName: string;
}

// Helper functions
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
  const variableRegex = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g; // Regex para {{variavel.nome_aninhado}}
  let match;

  // Loop para substituir todas as ocorrências
  while ((match = variableRegex.exec(text)) !== null) {
    const fullMatch = match[0]; // ex: {{variavel.nome}}
    const varName = match[1].trim(); // ex: variavel.nome
    
    let value = getProperty(variables, varName);

    // Fallback para nomes simples se getProperty não encontrar (ex: {{variavel}} sem pontos)
    if (value === undefined && !varName.includes('.')) {
      value = variables[varName];
    }

    if (value === undefined || value === null) {
      // console.warn(`[Flow Engine Substitute] Variable {{${varName}}} not found. Substituting with empty string.`);
      subbedText = subbedText.replace(fullMatch, '');
    } else if (typeof value === 'object' || Array.isArray(value)) {
      try {
        subbedText = subbedText.replace(fullMatch, JSON.stringify(value, null, 2));
      } catch (e) {
        // console.error(`[Flow Engine Substitute] Failed to stringify object for variable {{${varName}}}. Error:`, e);
        subbedText = subbedText.replace(fullMatch, `[Error stringifying ${varName}]`);
      }
    } else {
      subbedText = subbedText.replace(fullMatch, String(value));
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
    console.log(`[API Evolution WS Execute - ${session.session_id}] No current node. Ending flow.`);
    await deleteSessionFromDB(session.session_id);
    return;
  }

  const currentNode = findNodeById(session.current_node_id, nodes);

  if (!currentNode) {
    console.error(`[API Evolution WS Execute - ${session.session_id}] Current node ID ${session.current_node_id} not found in flow. Ending.`);
    await deleteSessionFromDB(session.session_id);
    return;
  }

  console.log(`[API Evolution WS Execute - ${session.session_id}] Executing Node: ${currentNode.id} (${currentNode.type} - ${currentNode.title})`);
  // console.log(`[API Evolution WS Execute - ${session.session_id}] Current Variables:`, JSON.stringify(session.flow_variables, null, 2));

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
        console.log(`[API Evolution WS Execute - ${session.session_id}] Sending message: "${messageText}" to ${session.session_id.split("@@")[0]}`);
        await sendWhatsAppMessageAction({
          ...apiConfig,
          recipientPhoneNumber: session.session_id.split("@@")[0],
          messageType: 'text',
          textContent: messageText,
        });
      }
      nextNodeId = findNextNodeId(currentNode.id, 'default', connections);
      break;

    case 'input':
      const promptText = substituteVariablesInText(currentNode.promptText, updatedFlowVariables);
      if (promptText) {
        console.log(`[API Evolution WS Execute - ${session.session_id}] Sending input prompt: "${promptText}" to ${session.session_id.split("@@")[0]}`);
        await sendWhatsAppMessageAction({
          ...apiConfig,
          recipientPhoneNumber: session.session_id.split("@@")[0],
          messageType: 'text',
          textContent: promptText,
        });
      }
      session.awaiting_input_type = 'text';
      session.awaiting_input_details = { variableToSave: currentNode.variableToSaveResponse || 'last_user_input', originalNodeId: currentNode.id };
      shouldContinueRecursive = false; 
      break;

    case 'option':
      const questionText = substituteVariablesInText(currentNode.questionText, updatedFlowVariables);
      const optionsList = (currentNode.optionsList || '').split('\n').map(opt => substituteVariablesInText(opt.trim(), updatedFlowVariables)).filter(Boolean);
      if (questionText && optionsList.length > 0) {
        let messageWithOptions = questionText + '\n\n';
        optionsList.forEach((opt, index) => {
          messageWithOptions += `${index + 1}. ${opt}\n`;
        });
        messageWithOptions += "\nResponda com o número da opção desejada.";
        console.log(`[API Evolution WS Execute - ${session.session_id}] Sending options: "${messageWithOptions.trim()}" to ${session.session_id.split("@@")[0]}`);
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
        shouldContinueRecursive = false;
      } else {
        console.warn(`[API Evolution WS Execute - ${session.session_id}] Option node ${currentNode.id} misconfigured. Trying default output.`);
        nextNodeId = findNextNodeId(currentNode.id, 'default', connections);
      }
      break;

    case 'condition':
      const varNameCond = currentNode.conditionVariable?.replace(/\{\{|\}\}/g, '').trim();
      const actualValueCond = varNameCond ? getProperty(updatedFlowVariables, varNameCond) : '';
      const compareValueCond = substituteVariablesInText(currentNode.conditionValue, updatedFlowVariables);
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
      console.log(`[API Evolution WS Execute - ${session.session_id}] Condition: ${varNameCond} ('${actualValueCond}') ${currentNode.conditionOperator} '${compareValueCond}' -> ${conditionMet}`);
      nextNodeId = findNextNodeId(currentNode.id, conditionMet ? 'true' : 'false');
      break;

    case 'set-variable':
      if (currentNode.variableName) {
        const valueToSet = substituteVariablesInText(currentNode.variableValue, updatedFlowVariables);
        updatedFlowVariables[currentNode.variableName] = valueToSet;
        session.flow_variables = updatedFlowVariables;
        console.log(`[API Evolution WS Execute - ${session.session_id}] Variable "${currentNode.variableName}" set to "${valueToSet}"`);
      }
      nextNodeId = findNextNodeId(currentNode.id, 'default', connections);
      break;
    
    case 'api-call':
      const apiUrl = substituteVariablesInText(currentNode.apiUrl, updatedFlowVariables);
      let recipientPhoneApi = substituteVariablesInText(currentNode.phoneNumber, updatedFlowVariables);
      if (!recipientPhoneApi && updatedFlowVariables.whatsapp_sender_jid) {
          recipientPhoneApi = updatedFlowVariables.whatsapp_sender_jid;
      }
      const instanceForApi = substituteVariablesInText(currentNode.instanceName, updatedFlowVariables) || apiConfig.instanceName;
      
      console.log(`[API Evolution WS Execute - ${session.session_id}] API Call Node: ${currentNode.id} - URL: ${apiUrl}`);

      if (apiUrl?.includes('/message/sendText/') && currentNode.apiMethod === 'POST') {
        let textContentApi = substituteVariablesInText(currentNode.textMessage, updatedFlowVariables);
        if (!textContentApi && currentNode.apiBodyType === 'json' && currentNode.apiBodyJson) {
          try {
            const bodyData = JSON.parse(substituteVariablesInText(currentNode.apiBodyJson, updatedFlowVariables));
            textContentApi = bodyData.text || bodyData.textMessage?.text; 
          } catch (e) { console.error(`[API Evolution WS Execute - ${session.session_id}] API Call: Error parsing JSON body for text`, e); }
        }
        if (recipientPhoneApi && textContentApi) {
            await sendWhatsAppMessageAction({
              baseUrl: apiConfig.baseUrl, 
              apiKey: apiConfig.apiKey,
              instanceName: instanceForApi,
              recipientPhoneNumber: recipientPhoneApi,
              messageType: 'text',
              textContent: textContentApi,
            });
        } else {
          console.warn(`[API Evolution WS Execute - ${session.session_id}] API Call (sendText): Missing recipient phone or text content for node ${currentNode.id}`);
        }
      } else if (apiUrl?.includes('/message/sendMedia/') && currentNode.apiMethod === 'POST') {
         const mediaUrlApi = substituteVariablesInText(currentNode.mediaUrl, updatedFlowVariables);
         const captionApi = substituteVariablesInText(currentNode.caption, updatedFlowVariables);
        if (recipientPhoneApi && mediaUrlApi && currentNode.mediaType) {
          await sendWhatsAppMessageAction({
            baseUrl: apiConfig.baseUrl,
            apiKey: apiConfig.apiKey,
            instanceName: instanceForApi,
            recipientPhoneNumber: recipientPhoneApi,
            messageType: currentNode.mediaType,
            mediaUrl: mediaUrlApi,
            caption: captionApi,
          });
        } else {
          console.warn(`[API Evolution WS Execute - ${session.session_id}] API Call (sendMedia): Missing recipient phone, media URL, or media type for node ${currentNode.id}`);
        }
      } else {
        console.log(`[API Evolution WS Execute - ${session.session_id}] Generic API Call to ${apiUrl}. Execution not fully implemented in backend engine. Output variable: ${currentNode.apiOutputVariable}`);
        if (currentNode.apiOutputVariable) {
          updatedFlowVariables[currentNode.apiOutputVariable] = { success: true, data: "Simulated API response from backend engine (generic call)" };
          session.flow_variables = updatedFlowVariables;
        }
      }
      nextNodeId = findNextNodeId(currentNode.id, 'default', connections);
      break;

    case 'ai-text-generation':
      const aiPromptText = substituteVariablesInText(currentNode.aiPromptText, updatedFlowVariables);
      if (aiPromptText && currentNode.aiOutputVariable) {
        try {
          console.log(`[API Evolution WS Execute - ${session.session_id}] AI Text Gen: Calling genericTextGenerationFlow with prompt: "${aiPromptText}"`);
          const aiResponse = await genericTextGenerationFlow({ promptText: aiPromptText });
          updatedFlowVariables[currentNode.aiOutputVariable] = aiResponse.generatedText;
          session.flow_variables = updatedFlowVariables;
          console.log(`[API Evolution WS Execute - ${session.session_id}] AI Text Gen: Output "${aiResponse.generatedText}" set to variable ${currentNode.aiOutputVariable}`);
        } catch (e:any) {
          console.error(`[API Evolution WS Execute - ${session.session_id}] AI Text Gen Error:`, e.message);
          updatedFlowVariables[currentNode.aiOutputVariable] = "Erro ao gerar texto com IA.";
           session.flow_variables = updatedFlowVariables;
        }
      } else {
         console.warn(`[API Evolution WS Execute - ${session.session_id}] AI Text Gen: Misconfigured node ${currentNode.id} (missing prompt or output variable)`);
      }
      nextNodeId = findNextNodeId(currentNode.id, 'default', connections);
      break;

    case 'intelligent-agent':
      const userInputForAgent = substituteVariablesInText(currentNode.userInputVariable, updatedFlowVariables); 
      if (userInputForAgent && currentNode.agentResponseVariable) {
         try {
          console.log(`[API Evolution WS Execute - ${session.session_id}] Intelligent Agent: Calling simpleChatReply with input: "${userInputForAgent}"`);
          const agentReply = await simpleChatReply({ userMessage: userInputForAgent });
          updatedFlowVariables[currentNode.agentResponseVariable] = agentReply.botReply;
          session.flow_variables = updatedFlowVariables;
          console.log(`[API Evolution WS Execute - ${session.session_id}] Intelligent Agent: Output "${agentReply.botReply}" set to variable ${currentNode.agentResponseVariable}`);
        } catch (e:any) {
          console.error(`[API Evolution WS Execute - ${session.session_id}] Intelligent Agent Error:`, e.message);
          updatedFlowVariables[currentNode.agentResponseVariable] = "Erro ao comunicar com agente IA.";
          session.flow_variables = updatedFlowVariables;
        }
      } else {
        console.warn(`[API Evolution WS Execute - ${session.session_id}] Intelligent Agent: Misconfigured node ${currentNode.id} (missing user input variable or agent response variable)`);
      }
      nextNodeId = findNextNodeId(currentNode.id, 'default', connections);
      break;

    case 'end-flow':
      console.log(`[API Evolution WS Execute - ${session.session_id}] Reached End Flow node. Deleting session.`);
      await deleteSessionFromDB(session.session_id);
      shouldContinueRecursive = false;
      break;

    default:
      console.warn(`[API Evolution WS Execute - ${session.session_id}] Node type ${currentNode.type} not fully implemented in backend engine. Trying 'default' exit.`);
      nextNodeId = findNextNodeId(currentNode.id, 'default', connections);
      break;
  }
  
  session.flow_variables = updatedFlowVariables; // Ensure session object passed around has latest vars

  if (shouldContinueRecursive) {
    if (nextNodeId) {
      session.current_node_id = nextNodeId;
      await saveSessionToDB(session); 
      await executeFlowStep(session, nodes, connections, apiConfig);
    } else {
      console.log(`[API Evolution WS Execute - ${session.session_id}] No next node from ${currentNode.id}. Ending flow (or pausing if no end-node and not awaiting input).`);
      // If not an explicit end-flow node and not awaiting input, it's an implicit end.
      if (currentNode.type !== 'end-flow' && !session.awaiting_input_type) {
        await deleteSessionFromDB(session.session_id); 
      } else {
        // If awaiting input, or explicitly ended, session was already saved/deleted.
        // If it's just end of a branch, make sure to save the final state if not deleted.
        if (currentNode.type !== 'end-flow') {
          await saveSessionToDB(session);
        }
      }
    }
  } else {
    // Flow paused (e.g. for input) or explicitly ended by end-flow node.
    // Session state was already saved or deleted within the switch case.
    if (currentNode.type !== 'end-flow' && currentNode.type !== 'input' && currentNode.type !== 'option' ) {
        // If not an explicit end, input, or option node, but recursion is stopped, save final state.
        // This case might be rare if nextNodeId logic is comprehensive.
        await saveSessionToDB(session); 
    }
    console.log(`[API Evolution WS Execute - ${session.session_id}] Flow paused or ended for node ${currentNode.id}. Session state handled.`);
  }
}

export async function GET(request: NextRequest, { params }: { params: { workspaceName: string } }) {
  try {
    const decodedWorkspaceName = decodeURIComponent(params.workspaceName);
    console.log(`[API Evolution WS Route - GET] Received request for workspace: "${decodedWorkspaceName}"`);
    const workspace = await loadWorkspaceByNameFromDB(decodedWorkspaceName);

    if (workspace) {
      return NextResponse.json({ 
        message: `Workspace "${decodedWorkspaceName}" found. Ready to receive POST webhooks at this endpoint.`, 
        workspaceId: workspace.id, 
        nodesCount: workspace.nodes?.length || 0,
        connectionsCount: workspace.connections?.length || 0,
      }, { status: 200 });
    } else {
      return NextResponse.json({ error: `Workspace "${decodedWorkspaceName}" not found.` }, { status: 404 });
    }
  } catch (error: any) {
    console.error(`[API Evolution WS Route - GET] Error processing GET for workspace "${params.workspaceName}":`, error);
    return NextResponse.json({ error: "Internal server error while checking workspace." }, { status: 500 });
  }
}


export async function POST(request: NextRequest, { params }: { params: { workspaceName: string } }) {
  let rawBodyForLog: string | null = null;
  let parsedBody: any = null;
  let logEntryPayload: any = {};

  try {
    rawBodyForLog = await request.text();
    // console.log(`[API Evolution WS Route - POST DEBUG] Raw body for workspace "${params.workspaceName}": ${rawBodyForLog.substring(0, 300)}...`);
    if (!rawBodyForLog || rawBodyForLog.trim() === '') {
      console.warn(`[API Evolution WS Route - POST DEBUG] Body for workspace "${params.workspaceName}" is empty.`);
      logEntryPayload = { message: "Request body was empty or whitespace." };
    } else {
      try {
        parsedBody = JSON.parse(rawBodyForLog);
        logEntryPayload = parsedBody;
      } catch (jsonError: any) {
        console.warn(`[API Evolution WS Route - POST DEBUG] Failed to parse body as JSON for workspace "${params.workspaceName}", storing as raw text. Error: ${jsonError.message}`);
        logEntryPayload = { raw_text: rawBodyForLog, parse_error: jsonError.message, original_content_type: request.headers.get('content-type') || 'N/A' };
      }
    }
  } catch (error: any) {
    console.error(`[API Evolution WS Route - POST DEBUG] Error reading/processing request body for workspace "${params.workspaceName}":`, error.message);
    logEntryPayload = { error_reading_body: error.message, body_preview_on_error: rawBodyForLog?.substring(0, 200) || "Could not read body.", original_content_type: request.headers.get('content-type') || 'N/A'};
  }

  // --- Store request details in global log ---
  const currentTimestamp = new Date().toISOString();
  let extractedMessage: string | null = null;
  let webhookRemoteJid: string | null = null;
  
  if (parsedBody && typeof parsedBody === 'object') {
    let actualPayloadToExtractFrom = parsedBody;
    if (Array.isArray(parsedBody) && parsedBody.length === 1 && typeof parsedBody[0] === 'object') {
      actualPayloadToExtractFrom = parsedBody[0];
    }
    const commonMessagePaths = ['data.message.conversation', 'message.body', 'message.textMessage.text', 'text', 'data.message.extendedTextMessage.text'];
    for (const path of commonMessagePaths) {
      const msg = getProperty(actualPayloadToExtractFrom, path);
      if (typeof msg === 'string' && msg.trim() !== '') { extractedMessage = msg.trim(); break; }
    }
    const remoteJidPaths = ['data.key.remoteJid', 'sender'];
    for (const path of remoteJidPaths) {
      const jid = getProperty(actualPayloadToExtractFrom, path);
      if (typeof jid === 'string' && jid.trim() !== '') { webhookRemoteJid = jid.trim(); break; }
    }
  }
  
  const logEntry = {
    timestamp: currentTimestamp,
    workspaceNameParam: params.workspaceName,
    method: request.method,
    url: request.url,
    headers: Object.fromEntries(request.headers.entries()),
    payload: logEntryPayload, // This is the potentially parsed or raw body
    ip: request.ip || request.headers.get('x-forwarded-for'),
    extractedMessage,
    webhook_remoteJid,
  };
  
  if (!Array.isArray(globalThis.evolutionWebhookLogs)) globalThis.evolutionWebhookLogs = [];
  globalThis.evolutionWebhookLogs.unshift(logEntry);
  if (globalThis.evolutionWebhookLogs.length > MAX_LOG_ENTRIES) globalThis.evolutionWebhookLogs.pop();
  console.log(`[API Evolution WS Route] Logged webhook for workspace "${params.workspaceName}". Msg: "${extractedMessage || 'N/A'}". Total logs: ${globalThis.evolutionWebhookLogs.length}`);
  // --- End store request details ---
  
  const eventType = getProperty(parsedBody, 'event') as string;
  const instanceName = getProperty(parsedBody, 'instance') as string;
  const senderJid = webhookRemoteJid; // Use the extracted one
  const receivedMessageText = extractedMessage; // Use the extracted one
  const evolutionApiBaseUrl = getProperty(parsedBody, 'server_url') as string;
  const evolutionApiKey = getProperty(parsedBody, 'apikey') as string;
  
  const decodedWorkspaceName = decodeURIComponent(params.workspaceName);
  console.log(`[API Evolution WS Route] Processing POST for workspace: "${decodedWorkspaceName}". Event: ${eventType}, Sender: ${senderJid}, Msg: ${receivedMessageText}`);

  if (eventType === 'messages.upsert' && senderJid && instanceName && evolutionApiBaseUrl) {
    const workspace = await loadWorkspaceByNameFromDB(decodedWorkspaceName);

    if (!workspace) {
      console.error(`[API Evolution WS Route] Workspace not found for name: "${decodedWorkspaceName}" during POST. Cannot execute flow.`);
      return NextResponse.json({ error: `Workspace "${decodedWorkspaceName}" not found. Flow not executed.` }, { status: 404 });
    }
    if (!workspace.nodes || workspace.nodes.length === 0) {
        console.error(`[API Evolution WS Route] Workspace "${decodedWorkspaceName}" is empty. Cannot execute flow.`);
        await sendWhatsAppMessageAction({ baseUrl: evolutionApiBaseUrl, apiKey: evolutionApiKey, instanceName, recipientPhoneNumber: senderJid, messageType:'text', textContent: "Desculpe, o fluxo para esta interação está vazio."});
        return NextResponse.json({ error: `Workspace "${decodedWorkspaceName}" is empty. Flow not executed.` }, { status: 500 });
    }

    const apiConfig: ApiConfig = { baseUrl: evolutionApiBaseUrl, apiKey: evolutionApiKey, instanceName };
    const sessionId = `${senderJid}@@${workspace.id}`; 
    let session = await loadSessionFromDB(sessionId);

    if (!session) {
      console.log(`[API Evolution WS Route - ${sessionId}] New session. Starting flow for workspace ${workspace.id}.`);
      const startNode = workspace.nodes.find(n => n.type === 'start');
      if (!startNode) {
        console.error(`[API Evolution WS Route - ${sessionId}] No start node in workspace ${workspace.id}.`);
        await sendWhatsAppMessageAction({...apiConfig, recipientPhoneNumber: senderJid, messageType:'text', textContent: "Erro: O fluxo não tem um nó de início."});
        return NextResponse.json({ error: "Flow has no start node." }, { status: 500 });
      }
      const firstTriggerName = startNode.triggers?.[0]?.name;
      const initialNodeId = findNextNodeId(startNode.id, firstTriggerName || 'default', workspace.connections || []);

      if(!initialNodeId){
          console.error(`[API Evolution WS Route - ${sessionId}] Start node or its first trigger has no outgoing connection in workspace ${workspace.id}.`);
          await sendWhatsAppMessageAction({...apiConfig, recipientPhoneNumber: senderJid, messageType:'text', textContent: "Erro: O fluxo não está conectado corretamente a partir do início."});
          return NextResponse.json({ error: "Start node is not connected." }, { status: 500 });
      }

      session = {
        session_id: sessionId,
        workspace_id: workspace.id,
        current_node_id: initialNodeId,
        flow_variables: { 
          whatsapp_sender_jid: senderJid, 
          mensagem_whatsapp: receivedMessageText || '', // User's first message
          webhook_payload: parsedBody 
        },
        awaiting_input_type: null,
        awaiting_input_details: null,
      };
    } else {
      console.log(`[API Evolution WS Route - ${sessionId}] Existing session found. Current node: ${session.current_node_id}, Awaiting: ${session.awaiting_input_type}`);
      // Update with the new message, always
      session.flow_variables.mensagem_whatsapp = receivedMessageText || '';
      session.flow_variables.webhook_payload = parsedBody; // Update with latest payload

      if (session.awaiting_input_type && session.current_node_id && session.awaiting_input_details) {
        const originalNodeId = session.awaiting_input_details.originalNodeId || session.current_node_id;
        const awaitingNode = findNodeById(originalNodeId, workspace.nodes);

        if (awaitingNode) {
          if (session.awaiting_input_type === 'text' && session.awaiting_input_details.variableToSave) {
            session.flow_variables[session.awaiting_input_details.variableToSave] = receivedMessageText || '';
            session.current_node_id = findNextNodeId(awaitingNode.id, 'default', workspace.connections || []);
          } else if (session.awaiting_input_type === 'option' && session.awaiting_input_details.options) {
            const options = session.awaiting_input_details.options || [];
            const chosenOptionIndex = options.findIndex(
              (opt, idx) => opt.toLowerCase() === (receivedMessageText || '').toLowerCase() || String(idx + 1) === receivedMessageText
            );
            
            if (chosenOptionIndex !== -1) {
              const chosenOptionText = options[chosenOptionIndex];
              if (session.awaiting_input_details.variableToSave) {
                session.flow_variables[session.awaiting_input_details.variableToSave] = chosenOptionText;
              }
              // Important: findNextNodeId for option should use the optionText as sourceHandle
              session.current_node_id = findNextNodeId(awaitingNode.id, chosenOptionText, workspace.connections || []);
               console.log(`[API Evolution WS Route - ${sessionId}] User chose option "${chosenOptionText}". Next node ID: ${session.current_node_id}`);
            } else {
              await sendWhatsAppMessageAction({...apiConfig, recipientPhoneNumber: senderJid, messageType:'text', textContent: "Opção inválida. Por favor, tente novamente."});
              session.current_node_id = awaitingNode.id; // Stay on option node (or originalNodeId if it's more robust)
            }
          }
          session.awaiting_input_type = null;
          session.awaiting_input_details = null;
        } else {
             console.warn(`[API Evolution WS Route - ${sessionId}] Awaiting node ${originalNodeId} not found. Resetting session for safety.`);
             session.current_node_id = null; // Problem with session or flow, reset to start on next message
        }
      } else {
         // Not awaiting specific input, treat as new interaction or restart.
         // Find start node and proceed from its first trigger/default output.
         const startNode = workspace.nodes.find(n => n.type === 'start');
         if(startNode){
            const firstTriggerName = startNode.triggers?.[0]?.name;
            session.current_node_id = findNextNodeId(startNode.id, firstTriggerName || 'default', workspace.connections || []);
            console.log(`[API Evolution WS Route - ${sessionId}] Session not awaiting input, (re)starting from node: ${session.current_node_id}`);
         } else {
             console.error(`[API Evolution WS Route - ${sessionId}] No start node in workspace ${workspace.id} for restart.`);
             session.current_node_id = null;
         }
      }
    }

    if (session.current_node_id) {
      await saveSessionToDB(session); // Save session before starting execution
      await executeFlowStep(session, workspace.nodes, workspace.connections || [], apiConfig);
    } else {
        console.log(`[API Evolution WS Route - ${sessionId}] Session has no current_node_id after processing. Flow might have ended or has an issue. No execution step.`);
        // If session was reset due to awaitingNode not found, it might get deleted here if not caught by an end-flow node
        if (!session.awaiting_input_type) { // Only delete if not explicitly paused
           const existingSessionInDb = await loadSessionFromDB(sessionId);
           if (existingSessionInDb && !existingSessionInDb.awaiting_input_type) { // Double check it's not paused
             console.log(`[API Evolution WS Route - ${sessionId}] Deleting session as it has no next node and is not awaiting input.`);
             await deleteSessionFromDB(sessionId);
           }
        }
    }
    return NextResponse.json({ message: "Webhook processed, flow execution attempted." }, { status: 200 });

  } else {
    let nonExecutionReason = "Not a 'messages.upsert' event";
    if (eventType === 'messages.upsert') {
      if (!senderJid) nonExecutionReason = "Missing senderJid";
      else if (!instanceName) nonExecutionReason = "Missing instanceName";
      else if (!evolutionApiBaseUrl) nonExecutionReason = "Missing evolutionApiBaseUrl";
    }
    console.log(`[API Evolution WS Route] Webhook for workspace "${decodedWorkspaceName}" logged, but no flow execution triggered. Reason: ${nonExecutionReason}. Event: ${eventType}`);
    return NextResponse.json({ message: `Webhook logged, but no flow execution triggered: ${nonExecutionReason}.` }, { status: 200 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: { workspaceName: string } }) {
  console.log(`[API Evolution WS Route - PUT] Received PUT for workspace: "${params.workspaceName}". Delegating to POST logic.`);
  return POST(request, { params }); 
}
export async function PATCH(request: NextRequest, { params }: { params: { workspaceName: string } }) {
  console.log(`[API Evolution WS Route - PATCH] Received PATCH for workspace: "${params.workspaceName}". Delegating to POST logic.`);
  return POST(request, { params });
}
export async function DELETE(request: NextRequest, { params }: { params: { workspaceName: string } }) {
  console.log(`[API Evolution WS Route - DELETE] Received DELETE for workspace: "${params.workspaceName}". Delegating to POST logic.`);
  return POST(request, { params }); // Or return a method not allowed error
}
