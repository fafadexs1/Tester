

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
  loadActiveWorkspaceFromDB, // Para fallback se nenhum workspace for encontrado pelo nome
} from '@/app/actions/databaseActions';
import type { NodeData, Connection, FlowSession, StartNodeTrigger } from '@/lib/types';
import { genericTextGenerationFlow } from '@/ai/flows/generic-text-generation-flow';
import { simpleChatReply } from '@/ai/flows/simple-chat-reply-flow';

// Variável global para armazenar logs em memória (apenas para depuração)
if (!globalThis.evolutionWebhookLogs || !Array.isArray(globalThis.evolutionWebhookLogs)) {
  console.log('[API Evolution WS Route INIT] globalThis.evolutionWebhookLogs não existe ou não é um array. Inicializando como novo array.');
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

async function executeFlowStep(
  session: FlowSession,
  nodes: NodeData[],
  connections: Connection[],
  apiConfig: ApiConfig
): Promise<void> {
  console.log(`[API Evolution WS Execute - ${session.session_id}] ENTER executeFlowStep. Node ID: ${session.current_node_id}`);
  if (!session.current_node_id) {
    console.log(`[API Evolution WS Execute - ${session.session_id}] No current_node_id. Ending flow or session implicitly paused.`);
    // Não deleta a sessão aqui, apenas para se não houver próximo nó e não estiver aguardando
    await saveSessionToDB(session); // Salva o estado final (ex: variáveis atualizadas)
    return;
  }

  const currentNode = findNodeById(session.current_node_id, nodes);

  if (!currentNode) {
    console.error(`[API Evolution WS Execute - ${session.session_id}] Critical: Current node ID ${session.current_node_id} not found. Deleting session.`);
    await deleteSessionFromDB(session.session_id);
    return;
  }

  console.log(`[API Evolution WS Execute - ${session.session_id}] Executing Node: ${currentNode.id} (${currentNode.type} - ${currentNode.title})`);
  console.log(`[API Evolution WS Execute - ${session.session_id}] Variables at step start:`, JSON.parse(JSON.stringify(session.flow_variables)));

  let nextNodeId: string | null = null;
  let shouldContinueRecursive = true;
  // let updatedFlowVariables = { ...session.flow_variables }; // As variáveis são modificadas diretamente no objeto session

  switch (currentNode.type) {
    case 'start':
      const firstTrigger = currentNode.triggers?.[0]?.name;
      nextNodeId = findNextNodeId(currentNode.id, firstTrigger || 'default', connections);
      if (!nextNodeId) {
        console.warn(`[API Evolution WS Execute - ${session.session_id}] Start node ${currentNode.id} has no outgoing connection for trigger "${firstTrigger || 'default'}".`);
      }
      break;

    case 'message':
      const messageText = substituteVariablesInText(currentNode.text, session.flow_variables);
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
      const promptText = substituteVariablesInText(currentNode.promptText, session.flow_variables);
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
      const questionText = substituteVariablesInText(currentNode.questionText, session.flow_variables);
      const optionsList = (currentNode.optionsList || '').split('\n').map(opt => substituteVariables(opt.trim(), session.flow_variables)).filter(Boolean);
      
      if (questionText && optionsList.length > 0) {
        let messageWithOptions = questionText + '\n\n';
        optionsList.forEach((opt, index) => {
          messageWithOptions += `${index + 1}. ${opt}\n`;
        });
        messageWithOptions += "\nResponda com o número da opção desejada ou o texto exato da opção.";
        
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
      console.log(`[API Evolution WS Execute - ${session.session_id}] Condition: Var ('${varNameCond}')='${actualValueCond}' ${currentNode.conditionOperator} '${compareValueCond}' -> ${conditionMet}`);
      nextNodeId = findNextNodeId(currentNode.id, conditionMet ? 'true' : 'false', connections);
      break;

    case 'set-variable':
      if (currentNode.variableName) {
        const valueToSet = substituteVariablesInText(currentNode.variableValue, session.flow_variables);
        session.flow_variables[currentNode.variableName] = valueToSet;
        console.log(`[API Evolution WS Execute - ${session.session_id}] Variable "${currentNode.variableName}" set to "${valueToSet}"`);
      }
      nextNodeId = findNextNodeId(currentNode.id, 'default', connections);
      break;
    
    case 'api-call':
      const apiUrl = substituteVariablesInText(currentNode.apiUrl, session.flow_variables);
      let recipientPhoneApi = substituteVariablesInText(currentNode.phoneNumber, session.flow_variables);
      if (!recipientPhoneApi && session.flow_variables.whatsapp_sender_jid) {
          recipientPhoneApi = session.flow_variables.whatsapp_sender_jid;
      }
      const instanceForApi = substituteVariablesInText(currentNode.instanceName, session.flow_variables) || apiConfig.instanceName;

      console.log(`[API Evolution WS Execute - ${session.session_id}] API Call Node: ${currentNode.id} - URL: ${apiUrl}`);

      if (apiUrl?.includes('/message/sendText/') && currentNode.apiMethod === 'POST') {
        let textContentApi = substituteVariablesInText(currentNode.textMessage, session.flow_variables);
        if (!textContentApi && currentNode.apiBodyType === 'json' && currentNode.apiBodyJson) {
          try {
            const bodyData = JSON.parse(substituteVariablesInText(currentNode.apiBodyJson, session.flow_variables));
            textContentApi = bodyData.text || bodyData.textMessage?.text;
          } catch (e) { console.error(`[API Evolution WS Execute - ${session.session_id}] API Call: Error parsing JSON body for text`, e); }
        }
        if (recipientPhoneApi && textContentApi) {
            await sendWhatsAppMessageAction({
              ...apiConfig, // Pass base and global API key
              instanceName: instanceForApi,
              recipientPhoneNumber: recipientPhoneApi,
              messageType: 'text',
              textContent: textContentApi,
            });
        } else {
          console.warn(`[API Evolution WS Execute - ${session.session_id}] API Call (sendText): Missing recipient or text for node ${currentNode.id}`);
        }
      } else if (apiUrl?.includes('/message/sendMedia/') && currentNode.apiMethod === 'POST') {
         const mediaUrlApi = substituteVariablesInText(currentNode.mediaUrl, session.flow_variables);
         const captionApi = substituteVariablesInText(currentNode.caption, session.flow_variables);
        if (recipientPhoneApi && mediaUrlApi && currentNode.mediaType) {
          await sendWhatsAppMessageAction({
            ...apiConfig, // Pass base and global API key
            instanceName: instanceForApi,
            recipientPhoneNumber: recipientPhoneApi,
            messageType: currentNode.mediaType,
            mediaUrl: mediaUrlApi,
            caption: captionApi,
          });
        } else {
           console.warn(`[API Evolution WS Execute - ${session.session_id}] API Call (sendMedia): Missing recipient, mediaUrl or mediaType for node ${currentNode.id}`);
        }
      } else {
        console.log(`[API Evolution WS Execute - ${session.session_id}] Generic API Call to ${apiUrl}. Execution not fully implemented. Output var: ${currentNode.apiOutputVariable}`);
        if (currentNode.apiOutputVariable) {
          session.flow_variables[currentNode.apiOutputVariable] = { success: true, data: "Simulated generic API response" };
        }
      }
      nextNodeId = findNextNodeId(currentNode.id, 'default', connections);
      break;

    case 'ai-text-generation':
      const aiPromptText = substituteVariablesInText(currentNode.aiPromptText, session.flow_variables);
      if (aiPromptText && currentNode.aiOutputVariable) {
        try {
          console.log(`[API Evolution WS Execute - ${session.session_id}] AI Text Gen: Calling genericTextGenerationFlow with: "${aiPromptText}"`);
          const aiResponse = await genericTextGenerationFlow({ promptText: aiPromptText });
          session.flow_variables[currentNode.aiOutputVariable] = aiResponse.generatedText;
          console.log(`[API Evolution WS Execute - ${session.session_id}] AI Text Gen: Output "${aiResponse.generatedText}" set to ${currentNode.aiOutputVariable}`);
        } catch (e:any) {
          console.error(`[API Evolution WS Execute - ${session.session_id}] AI Text Gen Error:`, e.message);
          session.flow_variables[currentNode.aiOutputVariable] = "Erro ao gerar texto com IA.";
        }
      } else {
         console.warn(`[API Evolution WS Execute - ${session.session_id}] AI Text Gen: Misconfigured node ${currentNode.id}`);
      }
      nextNodeId = findNextNodeId(currentNode.id, 'default', connections);
      break;

    case 'intelligent-agent':
      const userInputForAgent = substituteVariablesInText(currentNode.userInputVariable, session.flow_variables);
      if (userInputForAgent && currentNode.agentResponseVariable) {
         try {
          console.log(`[API Evolution WS Execute - ${session.session_id}] Intelligent Agent: Calling simpleChatReply with: "${userInputForAgent}"`);
          const agentReply = await simpleChatReply({ userMessage: userInputForAgent });
          session.flow_variables[currentNode.agentResponseVariable] = agentReply.botReply;
          console.log(`[API Evolution WS Execute - ${session.session_id}] Intelligent Agent: Output "${agentReply.botReply}" set to ${currentNode.agentResponseVariable}`);
        } catch (e:any) {
          console.error(`[API Evolution WS Execute - ${session.session_id}] Intelligent Agent Error:`, e.message);
          session.flow_variables[currentNode.agentResponseVariable] = "Erro ao comunicar com agente IA.";
        }
      } else {
        console.warn(`[API Evolution WS Execute - ${session.session_id}] Intelligent Agent: Misconfigured node ${currentNode.id}`);
      }
      nextNodeId = findNextNodeId(currentNode.id, 'default', connections);
      break;

    case 'end-flow':
      console.log(`[API Evolution WS Execute - ${session.session_id}] Reached End Flow node. Deleting session.`);
      await deleteSessionFromDB(session.session_id);
      shouldContinueRecursive = false;
      break;

    default:
      console.warn(`[API Evolution WS Execute - ${session.session_id}] Node type ${(currentNode as any).type} not fully implemented. Trying 'default' exit.`);
      nextNodeId = findNextNodeId(currentNode.id, 'default', connections);
      break;
  }
  
  if (shouldContinueRecursive) {
    session.current_node_id = nextNodeId; // Atualiza o nó atual na sessão
    if (nextNodeId) {
      await saveSessionToDB(session); // Salva ANTES de executar o próximo
      await executeFlowStep(session, nodes, connections, apiConfig);
    } else {
      console.log(`[API Evolution WS Execute - ${session.session_id}] No next node from ${currentNode.id}. Flow implicitly paused/ended.`);
      await saveSessionToDB(session); // Salva o estado final, incluindo o current_node_id como null
    }
  } else {
    // Fluxo pausou (input/option) ou terminou (end-flow). A sessão já foi salva ou deletada no case.
    // Se não foi um 'end-flow', salvamos aqui para garantir que `awaiting_input_type` seja persistido.
    if (currentNode.type !== 'end-flow') {
      await saveSessionToDB(session);
    }
    console.log(`[API Evolution WS Execute - ${session.session_id}] Flow paused or ended for node ${currentNode.id}. Session state handled.`);
  }
}

// Função para armazenar detalhes da requisição no log global (em memória)
// (Mesma função storeRequestDetails que já tínhamos)
async function storeRequestDetails(
  request: NextRequest,
  parsedPayload: any, 
  rawBodyText: string | null, 
  workspaceNameParam: string
): Promise<any> { 
  const currentTimestamp = new Date().toISOString();
  let extractedMessage: string | null = null;
  let webhookRemoteJid: string | null = null;
  const headers = Object.fromEntries(request.headers.entries());
  const ip = request.ip || headers['x-forwarded-for'] || 'unknown IP';

  let actualPayloadToExtractFrom = parsedPayload;
  if (Array.isArray(parsedPayload) && parsedPayload.length === 1 && typeof parsedPayload[0] === 'object') {
    actualPayloadToExtractFrom = parsedPayload[0];
  }
  
  if (actualPayloadToExtractFrom && typeof actualPayloadToExtractFrom === 'object') {
    const commonMessagePaths = [
      'data.message.conversation', 'message.conversation', 
      'message.body', 'message.textMessage.text', 'text',
      'data.message.extendedTextMessage.text',
    ];
    for (const path of commonMessagePaths) {
      const msg = getProperty(actualPayloadToExtractFrom, path);
      if (typeof msg === 'string' && msg.trim() !== '') {
        extractedMessage = msg.trim();
        console.log(`[Evolution API Webhook Store] Extracted message using path "${path}" from actualPayload: "${extractedMessage}"`);
        break;
      }
    }

    const remoteJidPaths = [
      'data.key.remoteJid', 'sender', 'key.remoteJid',
    ];
    for (const path of remoteJidPaths) {
      const jid = getProperty(actualPayloadToExtractFrom, path);
      if (typeof jid === 'string' && jid.trim() !== '') {
        webhookRemoteJid = jid.trim();
        console.log(`[Evolution API Webhook Store] Extracted remoteJid using path "${path}" from actualPayload: "${webhookRemoteJid}"`);
        break;
      }
    }
  }

  const logEntry: Record<string, any> = {
    timestamp: currentTimestamp,
    workspaceNameParam: workspaceNameParam,
    method: request.method,
    url: request.url,
    headers: headers,
    ip: ip,
    extractedMessage: extractedMessage,
    webhook_remoteJid: webhookRemoteJid,
    payload: parsedPayload || { raw_text: rawBodyText, message: "Payload was not valid JSON or was empty/unreadable" }
  };

  if (!Array.isArray(globalThis.evolutionWebhookLogs)) {
    globalThis.evolutionWebhookLogs = [];
  }
  globalThis.evolutionWebhookLogs.unshift(logEntry);
  if (globalThis.evolutionWebhookLogs.length > MAX_LOG_ENTRIES) {
    globalThis.evolutionWebhookLogs.pop();
  }
  console.log(`[Evolution API Webhook Store] Log entry added. Total logs: ${globalThis.evolutionWebhookLogs.length}.`);
  return logEntry;
}


export async function POST(request: NextRequest, { params }: { params: { workspaceName: string } }) {
  const decodedWorkspaceName = decodeURIComponent(params.workspaceName);
  console.log(`[API Evolution WS Route] POST request received for workspace: "${decodedWorkspaceName}"`);

  let rawBody: string | null = null;
  let parsedBody: any = null;
  let loggedEntry: any = null;

  try {
    console.log(`[API Evolution WS Route - POST DEBUG] Attempting to read raw body for workspace: "${decodedWorkspaceName}"...`);
    rawBody = await request.text();

    if (!rawBody || rawBody.trim() === '') {
      console.warn(`[API Evolution WS Route - POST DEBUG] Raw body for workspace "${decodedWorkspaceName}" is empty.`);
      parsedBody = { message: "Request body was empty.", original_content_type: request.headers.get('content-type') || 'N/A' };
    } else {
      console.log(`[API Evolution WS Route - POST DEBUG] Raw body read (length: ${rawBody.length}). Preview: ${rawBody.substring(0, 300)}`);
      const contentType = request.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        try {
          parsedBody = JSON.parse(rawBody);
          console.log(`[API Evolution WS Route - POST DEBUG] JSON body parsed.`);
        } catch (jsonError: any) {
          parsedBody = { raw_text: rawBody, parse_error: jsonError.message, original_content_type: contentType };
        }
      } else {
        parsedBody = { raw_text: rawBody, original_content_type: contentType || 'N/A' };
      }
    }
    
    loggedEntry = await storeRequestDetails(request, parsedBody, rawBody, decodedWorkspaceName);

    let actualEventPayload = parsedBody;
    if (Array.isArray(parsedBody) && parsedBody.length === 1 && typeof parsedBody[0] === 'object') {
      actualEventPayload = parsedBody[0];
    }
    
    const eventType = getProperty(actualEventPayload, 'event') as string;
    const instanceName = getProperty(actualEventPayload, 'instance') as string;
    const senderJid = loggedEntry.webhook_remoteJid; 
    const receivedMessageText = loggedEntry.extractedMessage;
    const evolutionApiBaseUrl = getProperty(actualEventPayload, 'server_url') as string;
    const evolutionApiKey = getProperty(actualEventPayload, 'apikey') as string;

    console.log(`[API Evolution WS Route] Parsed data for logic: event='${eventType}', instance='${instanceName}', senderJid='${senderJid}', receivedMessage='${receivedMessageText}', baseUrl='${evolutionApiBaseUrl}', apiKeyExists='${!!evolutionApiKey}'`);

    if (eventType === 'messages.upsert' && senderJid && instanceName && evolutionApiBaseUrl) {
      const workspace = await loadWorkspaceByNameFromDB(decodedWorkspaceName);

      if (!workspace || !workspace.nodes || workspace.nodes.length === 0) {
        console.error(`[API Evolution WS Route] Workspace "${decodedWorkspaceName}" not found or empty.`);
        if (senderJid) await sendWhatsAppMessageAction({baseUrl: evolutionApiBaseUrl, apiKey: evolutionApiKey || undefined, instanceName, recipientPhoneNumber: senderJid.split('@')[0], messageType:'text', textContent: `Desculpe, o fluxo de trabalho "${decodedWorkspaceName}" não foi encontrado ou está vazio.`});
        return NextResponse.json({ error: `Workspace "${decodedWorkspaceName}" not found or empty.` }, { status: 404 });
      }
      
      const apiConfig: ApiConfig = { baseUrl: evolutionApiBaseUrl, apiKey: evolutionApiKey || undefined, instanceName };
      const sessionId = `${senderJid.split('@')[0]}@@${workspace.id}`;
      let session = await loadSessionFromDB(sessionId);
      let continueProcessing = true;

      // Check for session timeout
      if (session && session.session_timeout_seconds && session.session_timeout_seconds > 0) {
        const lastInteraction = new Date(session.last_interaction_at || 0).getTime();
        const now = new Date().getTime();
        const secondsSinceLastInteraction = (now - lastInteraction) / 1000;
        if (secondsSinceLastInteraction > session.session_timeout_seconds) {
          console.log(`[API Evolution WS Route - ${sessionId}] Session timed out. Inactive for ${secondsSinceLastInteraction}s (limit: ${session.session_timeout_seconds}s). Deleting old session.`);
          await deleteSessionFromDB(sessionId);
          session = null; // Force creation of a new session
        }
      }


      if (!session) {
        console.log(`[API Evolution WS Route - ${sessionId}] New session for workspace ${workspace.id}.`);
        const startNode = workspace.nodes.find(n => n.type === 'start');
        if (!startNode) {
          console.error(`[API Evolution WS Route - ${sessionId}] No start node in workspace ${workspace.id}.`);
          if (senderJid) await sendWhatsAppMessageAction({...apiConfig, recipientPhoneNumber: senderJid.split('@')[0], messageType:'text', textContent: "Erro: O fluxo não tem um nó de início."});
          return NextResponse.json({ error: "Flow has no start node." }, { status: 500 });
        }
        
        const firstTrigger = startNode.triggers?.[0];
        const initialNodeId = findNextNodeId(startNode.id, firstTrigger?.name || 'default', workspace.connections || []);

        if(!initialNodeId){
            console.error(`[API Evolution WS Route - ${sessionId}] Start node or its first trigger has no outgoing connection.`);
            if (senderJid) await sendWhatsAppMessageAction({...apiConfig, recipientPhoneNumber: senderJid.split('@')[0], messageType:'text', textContent: "Erro: O fluxo não está conectado corretamente a partir do início."});
            return NextResponse.json({ error: "Start node is not connected." }, { status: 500 });
        }
        
        const initialVars: Record<string, any> = {
          whatsapp_sender_jid: senderJid.split('@')[0],
          mensagem_whatsapp: receivedMessageText || '',
        };

        if (firstTrigger?.type === 'webhook' && Array.isArray(firstTrigger.variableMappings)) {
          for (const mapping of firstTrigger.variableMappings) {
            if (mapping.jsonPath && mapping.flowVariable) {
              const value = getProperty(actualEventPayload, mapping.jsonPath);
              if (value !== undefined) {
                initialVars[mapping.flowVariable] = value;
              }
            }
          }
        }

        session = {
          session_id: sessionId,
          workspace_id: workspace.id,
          current_node_id: initialNodeId, 
          flow_variables: initialVars,
          awaiting_input_type: null,
          awaiting_input_details: null,
          session_timeout_seconds: firstTrigger?.sessionTimeoutSeconds || 0,
        };
      } else {
        console.log(`[API Evolution WS Route - ${sessionId}] Existing session. Node: ${session.current_node_id}, Awaiting: ${session.awaiting_input_type}`);
        session.flow_variables.mensagem_whatsapp = receivedMessageText || '';
        
        if (session.awaiting_input_type && session.current_node_id && session.awaiting_input_details) {
          const originalNodeId = session.awaiting_input_details.originalNodeId || session.current_node_id;
          const awaitingNode = findNodeById(originalNodeId, workspace.nodes);

          if (awaitingNode) {
            if (session.awaiting_input_type === 'text' && session.awaiting_input_details.variableToSave) {
              session.flow_variables[session.awaiting_input_details.variableToSave] = receivedMessageText || '';
              session.current_node_id = findNextNodeId(awaitingNode.id, 'default', workspace.connections || []);
            } else if (session.awaiting_input_type === 'option' && Array.isArray(session.awaiting_input_details.options)) {
              const options = session.awaiting_input_details.options;
              const trimmedReceivedMessage = (receivedMessageText || '').trim();
              let chosenOptionText: string | undefined = undefined;

              const numericChoice = parseInt(trimmedReceivedMessage, 10);
              if (!isNaN(numericChoice) && numericChoice > 0 && numericChoice <= options.length) {
                chosenOptionText = options[numericChoice - 1];
              } else {
                chosenOptionText = options.find(opt => opt.toLowerCase() === trimmedReceivedMessage.toLowerCase());
              }

              if (chosenOptionText) {
                if (session.awaiting_input_details.variableToSave) {
                  session.flow_variables[session.awaiting_input_details.variableToSave] = chosenOptionText;
                }
                session.current_node_id = findNextNodeId(awaitingNode.id, chosenOptionText, workspace.connections || []);
                console.log(`[API Evolution WS Route - ${sessionId}] User chose option: "${chosenOptionText}". Next node: ${session.current_node_id}`);
              } else {
                console.log(`[API Evolution WS Route - ${sessionId}] Invalid option: "${trimmedReceivedMessage}". Re-prompting.`);
                await sendWhatsAppMessageAction({...apiConfig, recipientPhoneNumber: senderJid.split('@')[0], messageType:'text', textContent: "Opção inválida. Por favor, tente novamente respondendo com o número ou o texto exato da opção."});
                // Don't change the current node, just save session and stop processing
                // The flow will implicitly stay on the same node.
                continueProcessing = false; 
              }
            }
            session.awaiting_input_type = null;
            session.awaiting_input_details = null;
          } else {
             console.warn(`[API Evolution WS Route - ${sessionId}] Awaiting node ${originalNodeId} not found. Resetting flow.`);
             const startNode = workspace.nodes.find(n => n.type === 'start');
             session.current_node_id = startNode ? findNextNodeId(startNode.id, startNode.triggers?.[0]?.name || 'default', workspace.connections || []) : null;
             session.awaiting_input_type = null;
             session.awaiting_input_details = null;
          }
        } else { 
           const startNode = workspace.nodes.find(n => n.type === 'start');
           if(startNode){
              session.current_node_id = findNextNodeId(startNode.id, startNode.triggers?.[0]?.name || 'default', workspace.connections || []);
              console.log(`[API Evolution WS Route - ${sessionId}] Session not awaiting input, (re)starting flow from: ${session.current_node_id}`);
           } else {
               session.current_node_id = null;
           }
           session.awaiting_input_type = null;
           session.awaiting_input_details = null;
        }
      }
      
      await saveSessionToDB(session);
      if (continueProcessing && session.current_node_id) {
        await executeFlowStep(session, workspace.nodes, workspace.connections || [], apiConfig);
      } else if (continueProcessing && !session.current_node_id && session.awaiting_input_type === null) {
        console.log(`[API Evolution WS Route - ${sessionId}] Session has no current_node_id and not awaiting input. Flow implicitly ended.`);
        await saveSessionToDB(session);
      } else {
        console.log(`[API Evolution WS Route - ${sessionId}] Flow execution paused for session or no current node to execute (Current Node: ${session.current_node_id}, Awaiting: ${session.awaiting_input_type}). Session saved.`);
      }
      return NextResponse.json({ message: "Webhook processed." }, { status: 200 });

    } else {
      let reason = "Not a 'messages.upsert' event or missing critical data.";
      if (eventType === 'messages.upsert') {
        if (!senderJid) reason = "Missing senderJid.";
        else if (!instanceName) reason = "Missing instanceName.";
        else if (!evolutionApiBaseUrl) reason = "Missing server_url.";
      }
      console.log(`[API Evolution WS Route] Webhook for workspace "${decodedWorkspaceName}" logged, but no flow execution triggered. Reason: ${reason}. Event: ${eventType}`);
      return NextResponse.json({ message: `Webhook logged, but no flow execution: ${reason}.` }, { status: 200 });
    }

  } catch (error: any) {
    console.error(`[API Evolution WS Route - POST ERROR HANDLER] Error processing POST for "${decodedWorkspaceName}":`, error.message, error.stack);
    return NextResponse.json({ error: "Internal server error processing webhook.", details: error.message }, { status: 500 });
  }
}

export async function GET(request: NextRequest, { params }: { params: { workspaceName: string } }) {
  const decodedWorkspaceName = decodeURIComponent(params.workspaceName);
  console.log(`[API Evolution WS Route - GET] Request for workspace: "${decodedWorkspaceName}"`);
  try {
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
    console.error(`[API Evolution WS Route - GET ERROR] Error processing GET for "${params.workspaceName}":`, error);
    return NextResponse.json({ error: "Internal server error while checking workspace." }, { status: 500 });
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
  return POST(request, { params });
}
