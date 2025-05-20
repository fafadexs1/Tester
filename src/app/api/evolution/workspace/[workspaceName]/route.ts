
'use server';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getProperty } from 'dot-prop';
import { sendWhatsAppMessageAction } from '@/app/actions/evolutionApiActions';
import { 
  loadSessionFromDB, 
  saveSessionToDB, 
  deleteSessionFromDB,
  loadWorkspaceByNameFromDB, // Alterado de loadActiveWorkspaceFromDB e loadWorkspaceFromDB
} from '@/app/actions/databaseActions';
import type { NodeData, Connection, FlowSession, WorkspaceData } from '@/lib/types';
import { genericTextGenerationFlow } from '@/ai/flows/generic-text-generation-flow';
import { simpleChatReply } from '@/ai/flows/simple-chat-reply-flow';

// Certifique-se de que a variável global para logs é inicializada se não existir
if (!globalThis.evolutionWebhookLogs || !Array.isArray(globalThis.evolutionWebhookLogs)) {
  console.log('[API Evolution WS Route] Initializing globalThis.evolutionWebhookLogs as new array.');
  globalThis.evolutionWebhookLogs = [];
}
const MAX_LOG_ENTRIES = 50; // Definindo o limite de logs

interface ApiConfig {
  baseUrl: string;
  apiKey?: string;
  instanceName: string;
}

// Helper functions (findNodeById, findNextNodeId, substituteVariablesInText)
// Estas funções devem estar aqui ou importadas se forem usadas por executeFlowStep

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
    const varName = match[1].trim();
    let value = getProperty(variables, varName);
    if (value === undefined) value = variables[varName]; // Fallback for simple names

    if (value === undefined || value === null) {
      // console.warn(`[Flow Engine] Variable {{${varName}}} not found for substitution.`);
      subbedText = subbedText.replace(match[0], '');
    } else if (typeof value === 'object' || Array.isArray(value)) {
      try {
        subbedText = subbedText.replace(match[0], JSON.stringify(value, null, 2));
      } catch (e) {
        subbedText = subbedText.replace(match[0], `[Error stringifying ${varName}]`);
      }
    } else {
      subbedText = subbedText.replace(match[0], String(value));
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
  console.log(`[API Evolution WS Execute - ${session.session_id}] Current Variables:`, JSON.stringify(session.flow_variables, null, 2));

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
        console.log(`[API Evolution WS Execute - ${session.session_id}] Sending message: "${messageText}"`);
        await sendWhatsAppMessageAction({
          ...apiConfig,
          recipientPhoneNumber: session.session_id.split("@@")[0], // Extract JID from sessionId
          messageType: 'text',
          textContent: messageText,
        });
      }
      nextNodeId = findNextNodeId(currentNode.id, 'default', connections);
      break;

    case 'input':
      const promptText = substituteVariablesInText(currentNode.promptText, updatedFlowVariables);
      if (promptText) {
        console.log(`[API Evolution WS Execute - ${session.session_id}] Sending input prompt: "${promptText}"`);
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
        let messageWithOptions = questionText + '\n';
        optionsList.forEach((opt, index) => {
          messageWithOptions += `${index + 1}. ${opt}\n`;
        });
        console.log(`[API Evolution WS Execute - ${session.session_id}] Sending options: "${messageWithOptions.trim()}"`);
        await sendWhatsAppMessageAction({
          ...apiConfig,
          recipientPhoneNumber: session.session_id.split("@@")[0],
          messageType: 'text',
          textContent: messageWithOptions.trim(),
        });
        session.awaiting_input_type = 'option';
        session.awaiting_input_details = { 
          variableToSave: currentNode.variableToSaveChoice || 'last_user_choice', 
          options: optionsList, // Store substituted options for matching
          originalNodeId: currentNode.id 
        };
        shouldContinueRecursive = false;
      } else {
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

      if (apiUrl.includes('/message/sendText/') && currentNode.apiMethod === 'POST') {
        let textContentApi = substituteVariablesInText(currentNode.textMessage, updatedFlowVariables);
        if (!textContentApi && currentNode.apiBodyType === 'json' && currentNode.apiBodyJson) {
          try {
            const bodyData = JSON.parse(substituteVariablesInText(currentNode.apiBodyJson, updatedFlowVariables));
            textContentApi = bodyData.text || bodyData.textMessage?.text; // Prioritize 'text'
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
        }
      } else if (apiUrl.includes('/message/sendMedia/') && currentNode.apiMethod === 'POST') {
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
        }
      } else {
        console.log(`[API Evolution WS Execute - ${session.session_id}] Generic API Call to ${apiUrl}. Execution not fully implemented in backend engine.`);
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
          const aiResponse = await genericTextGenerationFlow({ promptText: aiPromptText });
          updatedFlowVariables[currentNode.aiOutputVariable] = aiResponse.generatedText;
          session.flow_variables = updatedFlowVariables;
        } catch (e:any) {
          updatedFlowVariables[currentNode.aiOutputVariable] = "Erro ao gerar texto com IA.";
           session.flow_variables = updatedFlowVariables;
        }
      }
      nextNodeId = findNextNodeId(currentNode.id, 'default', connections);
      break;

    case 'intelligent-agent':
      const userInputForAgent = substituteVariablesInText(currentNode.userInputVariable, updatedFlowVariables); // Ensure this variable exists
      if (userInputForAgent && currentNode.agentResponseVariable) {
         try {
          const agentReply = await simpleChatReply({ userMessage: userInputForAgent });
          updatedFlowVariables[currentNode.agentResponseVariable] = agentReply.botReply;
          session.flow_variables = updatedFlowVariables;
        } catch (e:any) {
          updatedFlowVariables[currentNode.agentResponseVariable] = "Erro ao comunicar com agente IA.";
          session.flow_variables = updatedFlowVariables;
        }
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
  
  session.flow_variables = updatedFlowVariables; 

  if (shouldContinueRecursive) {
    if (nextNodeId) {
      session.current_node_id = nextNodeId;
      await saveSessionToDB(session); 
      await executeFlowStep(session, nodes, connections, apiConfig);
    } else {
      console.log(`[API Evolution WS Execute - ${session.session_id}] No next node from ${currentNode.id}. Ending flow (or pausing if no end-node and not awaiting input).`);
      if (!session.awaiting_input_type) { // If not already paused by input/option
        await deleteSessionFromDB(session.session_id); // End flow if no next node and not awaiting
      } else {
        await saveSessionToDB(session); // Save paused state
      }
    }
  } else {
    if (currentNode.type !== 'end-flow') {
        await saveSessionToDB(session); 
    }
    console.log(`[API Evolution WS Execute - ${session.session_id}] Flow paused or ended. Session state for node ${currentNode.id} handled.`);
  }
}

export async function GET(request: NextRequest, { params }: { params: { workspaceName: string } }) {
  try {
    const decodedWorkspaceName = decodeURIComponent(params.workspaceName);
    console.log(`[API Evolution WS Route - GET] Received request for workspace: "${decodedWorkspaceName}"`);
    const workspace = await loadWorkspaceByNameFromDB(decodedWorkspaceName);

    if (workspace) {
      return NextResponse.json({ message: `Workspace "${decodedWorkspaceName}" found. Ready to receive POST webhooks.`, workspaceId: workspace.id, nodesCount: workspace.nodes?.length || 0 }, { status: 200 });
    } else {
      return NextResponse.json({ error: `Workspace "${decodedWorkspaceName}" not found.` }, { status: 404 });
    }
  } catch (error: any) {
    console.error(`[API Evolution WS Route - GET] Error processing GET for workspace "${params.workspaceName}":`, error);
    return NextResponse.json({ error: "Internal server error while checking workspace." }, { status: 500 });
  }
}


export async function POST(request: NextRequest, { params }: { params: { workspaceName: string } }) {
  let rawBody: string | null = null;
  let parsedBody: any = null;
  let logEntryPayload: any = {};

  try {
    rawBody = await request.text();
    console.log(`[API Evolution WS Route - POST DEBUG] Raw body for workspace "${params.workspaceName}": ${rawBody.substring(0, 300)}...`);
    if (!rawBody || rawBody.trim() === '') {
      console.warn(`[API Evolution WS Route - POST DEBUG] Body for workspace "${params.workspaceName}" is empty.`);
      logEntryPayload = { message: "Request body was empty or whitespace." };
    } else {
      try {
        parsedBody = JSON.parse(rawBody);
        logEntryPayload = parsedBody;
      } catch (jsonError: any) {
        console.warn(`[API Evolution WS Route - POST DEBUG] Failed to parse body as JSON for workspace "${params.workspaceName}", storing as raw text. Error: ${jsonError.message}`);
        logEntryPayload = { raw_text: rawBody, parse_error: jsonError.message };
      }
    }
  } catch (error: any) {
    console.error(`[API Evolution WS Route - POST DEBUG] Error reading/processing request body for workspace "${params.workspaceName}":`, error.message);
    logEntryPayload = { error_reading_body: error.message, body_preview_on_error: rawBody?.substring(0, 200) || "Could not read body."};
  }

  // Store the raw/parsed payload in global logs
  const logEntry = {
    timestamp: new Date().toISOString(),
    workspaceNameParam: params.workspaceName,
    method: request.method,
    url: request.url,
    headers: Object.fromEntries(request.headers.entries()),
    payload: logEntryPayload,
    ip: request.ip || request.headers.get('x-forwarded-for'),
  };
  
  if (!Array.isArray(globalThis.evolutionWebhookLogs)) globalThis.evolutionWebhookLogs = [];
  globalThis.evolutionWebhookLogs.unshift(logEntry);
  if (globalThis.evolutionWebhookLogs.length > MAX_LOG_ENTRIES) globalThis.evolutionWebhookLogs.pop();
  console.log(`[API Evolution WS Route] Logged webhook for workspace "${params.workspaceName}". Total logs: ${globalThis.evolutionWebhookLogs.length}`);
  
  // Now, proceed with flow execution logic if it's a message event
  const eventType = getProperty(parsedBody, 'event') as string;
  const instanceName = getProperty(parsedBody, 'instance') as string;
  const senderJid = getProperty(parsedBody, 'data.key.remoteJid') || getProperty(parsedBody, 'sender');
  const receivedMessageText = getProperty(parsedBody, 'data.message.conversation') || getProperty(parsedBody, 'message.body');
  const evolutionApiBaseUrl = getProperty(parsedBody, 'server_url') as string;
  const evolutionApiKey = getProperty(parsedBody, 'apikey') as string;
  
  const decodedWorkspaceName = decodeURIComponent(params.workspaceName);
  console.log(`[API Evolution WS Route] Processing POST for workspace: "${decodedWorkspaceName}". Event: ${eventType}`);

  if (eventType === 'messages.upsert' && senderJid && instanceName && evolutionApiBaseUrl) {
    const workspace = await loadWorkspaceByNameFromDB(decodedWorkspaceName);

    if (!workspace) {
      console.error(`[API Evolution WS Route] Workspace not found for name: "${decodedWorkspaceName}" during POST. Cannot execute flow.`);
      // Optionally send a generic error message back if possible, though difficult without knowing instance details if parsedBody is faulty
      return NextResponse.json({ error: `Workspace "${decodedWorkspaceName}" not found. Flow not executed.` }, { status: 404 });
    }
    if (!workspace.nodes || workspace.nodes.length === 0) {
        console.error(`[API Evolution WS Route] Workspace "${decodedWorkspaceName}" is empty. Cannot execute flow.`);
        return NextResponse.json({ error: `Workspace "${decodedWorkspaceName}" is empty. Flow not executed.` }, { status: 500 });
    }

    console.log(`[API Evolution WS Route] Workspace "${decodedWorkspaceName}" loaded for execution. Sender: ${senderJid}, Message: "${receivedMessageText}"`);

    const apiConfig: ApiConfig = { baseUrl: evolutionApiBaseUrl, apiKey: evolutionApiKey, instanceName };
    const sessionId = `${senderJid}@@${workspace.id}`; // Unique session per user per workspace
    let session = await loadSessionFromDB(sessionId);

    if (!session) {
      console.log(`[API Evolution WS Route - ${sessionId}] New session. Starting flow for workspace ${workspace.id}.`);
      const startNode = workspace.nodes.find(n => n.type === 'start');
      if (!startNode) {
        console.error(`[API Evolution WS Route - ${sessionId}] No start node in workspace ${workspace.id}.`);
        return NextResponse.json({ error: "Flow has no start node." }, { status: 500 });
      }
      const firstTrigger = startNode.triggers?.[0]?.name;
      const initialNodeId = findNextNodeId(startNode.id, firstTrigger || 'default', workspace.connections);

      if(!initialNodeId){
          console.error(`[API Evolution WS Route - ${sessionId}] Start node or its first trigger has no outgoing connection in workspace ${workspace.id}.`);
          return NextResponse.json({ error: "Start node is not connected." }, { status: 500 });
      }

      session = {
        session_id: sessionId,
        workspace_id: workspace.id,
        current_node_id: initialNodeId,
        flow_variables: { 
          whatsapp_sender_jid: senderJid, 
          mensagem_whatsapp: receivedMessageText || '',
          webhook_payload: parsedBody // Store the full webhook payload
        },
        awaiting_input_type: null,
        awaiting_input_details: null,
      };
      await saveSessionToDB(session);
    } else {
      console.log(`[API Evolution WS Route - ${sessionId}] Existing session found. Current node: ${session.current_node_id}, Awaiting: ${session.awaiting_input_type}`);
      if (session.awaiting_input_type && session.current_node_id && session.awaiting_input_details) {
        const originalNodeId = session.awaiting_input_details.originalNodeId || session.current_node_id;
        const awaitingNode = findNodeById(originalNodeId, workspace.nodes);

        if (awaitingNode) {
          if (session.awaiting_input_type === 'text' && session.awaiting_input_details.variableToSave) {
            session.flow_variables[session.awaiting_input_details.variableToSave] = receivedMessageText || '';
            session.current_node_id = findNextNodeId(awaitingNode.id, 'default', workspace.connections);
          } else if (session.awaiting_input_type === 'option' && session.awaiting_input_details.options) {
            const chosenOptionText = session.awaiting_input_details.options.find(
              (opt, idx) => opt.toLowerCase() === (receivedMessageText || '').toLowerCase() || String(idx + 1) === receivedMessageText
            );
            if (chosenOptionText) {
              if (session.awaiting_input_details.variableToSave) {
                session.flow_variables[session.awaiting_input_details.variableToSave] = chosenOptionText;
              }
              session.current_node_id = findNextNodeId(awaitingNode.id, chosenOptionText, workspace.connections);
            } else {
              await sendWhatsAppMessageAction({...apiConfig, recipientPhoneNumber: senderJid, messageType:'text', textContent: "Opção inválida. Por favor, tente novamente."});
              session.current_node_id = awaitingNode.id; // Stay on option node
            }
          }
          session.awaiting_input_type = null;
          session.awaiting_input_details = null;
          await saveSessionToDB(session);
        } else {
             session.current_node_id = null; // Problem, reset
        }
      } else {
         // Not awaiting input, treat as new start or out-of-band message. For now, try to restart.
         const startNode = workspace.nodes.find(n => n.type === 'start');
         if(startNode){
            const firstTrigger = startNode.triggers?.[0]?.name;
            session.current_node_id = findNextNodeId(startNode.id, firstTrigger || 'default', workspace.connections);
            session.flow_variables.mensagem_whatsapp = receivedMessageText || ''; // Update with new message
            session.flow_variables.webhook_payload = parsedBody;
            await saveSessionToDB(session);
         } else {
             session.current_node_id = null;
         }
      }
    }

    if (session.current_node_id) {
      await executeFlowStep(session, workspace.nodes, workspace.connections, apiConfig);
    } else {
        console.log(`[API Evolution WS Route - ${sessionId}] Session has no current_node_id after processing. Flow might have ended or has an issue.`);
        // Optionally, send a generic "I'm not sure how to proceed" message if flow implicitly ends without an end-node.
    }
    return NextResponse.json({ message: "Webhook processed, flow execution attempted." }, { status: 200 });

  } else {
    console.log(`[API Evolution WS Route] Webhook for workspace "${decodedWorkspaceName}" logged, but not a 'messages.upsert' event or missing necessary data for flow execution. Event: ${eventType}`);
    return NextResponse.json({ message: "Webhook logged, but no flow execution triggered." }, { status: 200 });
  }
}


// Adicionar manipuladores para outros métodos HTTP se necessário, chamando storeRequestDetails
export async function PUT(request: NextRequest, { params }: { params: { workspaceName: string } }) {
  // Similar ao POST, pode logar e opcionalmente processar se fizer sentido
  return POST(request, { params }); // Por enquanto, apenas redireciona para a lógica POST
}
export async function PATCH(request: NextRequest, { params }: { params: { workspaceName: string } }) {
  return POST(request, { params });
}
export async function DELETE(request