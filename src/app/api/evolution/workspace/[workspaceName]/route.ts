
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
  loadActiveWorkspaceFromDB, // Embora não usado diretamente aqui, pode ser útil para um fallback
} from '@/app/actions/databaseActions';
import type { NodeData, Connection, FlowSession, WorkspaceData, StartNodeTrigger } from '@/lib/types';
import { genericTextGenerationFlow } from '@/ai/flows/generic-text-generation-flow';
import { simpleChatReply } from '@/ai/flows/simple-chat-reply-flow';

// Variável global para armazenar logs em memória (apenas para depuração)
if (!globalThis.evolutionWebhookLogs || !Array.isArray(globalThis.evolutionWebhookLogs)) {
  console.log('[API Evolution WS Route] globalThis.evolutionWebhookLogs não existe ou não é um array. Inicializando como novo array.');
  globalThis.evolutionWebhookLogs = [];
}
const MAX_LOG_ENTRIES = 50;


// Funções Auxiliares para o Motor de Fluxo
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
  let subbedText = String(text); // Garante que é uma string
  const variableRegex = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g;
  let match;

  // Loop para substituir todas as ocorrências de variáveis
  while ((match = variableRegex.exec(text)) !== null) {
    const fullMatch = match[0]; // Ex: {{variavel.propriedade}}
    const varName = match[1].trim(); // Ex: variavel.propriedade

    // Tenta obter o valor usando dot-prop
    let value: any = getProperty(variables, varName);

    // Fallback: se não encontrar com dot-prop e não houver ponto no nome, tenta acesso direto
    if (value === undefined && !varName.includes('.')) {
      value = variables[varName];
    }

    // Substituição
    if (value === undefined || value === null) {
      // console.warn(`[Flow Engine] Variable {{${varName}}} not found or null. Substituting with empty string.`);
      subbedText = subbedText.replace(fullMatch, ''); // Substitui por string vazia
    } else if (typeof value === 'object' || Array.isArray(value)) {
      try {
        subbedText = subbedText.replace(fullMatch, JSON.stringify(value, null, 2));
      } catch (e) {
        // console.error(`[Flow Engine] Failed to stringify object/array for {{${varName}}}:`, e);
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
  if (!session.current_node_id) {
    console.log(`[API Evolution WS Execute - ${session.session_id}] No current node. Ending flow or session implicitly paused.`);
    await deleteSessionFromDB(session.session_id); // Limpa a sessão se não houver próximo nó e não estiver aguardando
    return;
  }

  const currentNode = findNodeById(session.current_node_id, nodes);

  if (!currentNode) {
    console.error(`[API Evolution WS Execute - ${session.session_id}] Critical: Current node ID ${session.current_node_id} not found in flow. Ending session.`);
    await deleteSessionFromDB(session.session_id);
    return;
  }

  console.log(`[API Evolution WS Execute - ${session.session_id}] Executing Node: ${currentNode.id} (${currentNode.type} - ${currentNode.title})`);
  console.log(`[API Evolution WS Execute - ${session.session_id}] Variables at step start:`, JSON.parse(JSON.stringify(session.flow_variables)));


  let nextNodeId: string | null = null;
  let shouldContinueRecursive = true;
  let updatedFlowVariables = { ...session.flow_variables }; // Começa com as variáveis da sessão

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
          recipientPhoneNumber: session.session_id.split("@@")[0], // sessionId is senderJid@@workspaceId
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
      shouldContinueRecursive = false; // Pausa o fluxo para aguardar a entrada do usuário
      break;

    case 'option':
      const questionText = substituteVariablesInText(currentNode.questionText, updatedFlowVariables);
      const optionsList = (currentNode.optionsList || '').split('\n').map(opt => substituteVariablesInText(opt.trim(), updatedFlowVariables)).filter(Boolean);
      
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
          options: optionsList, // Armazena as opções como foram enviadas (após substituição de var)
          originalNodeId: currentNode.id 
        };
        shouldContinueRecursive = false; // Pausa o fluxo
      } else {
        console.warn(`[API Evolution WS Execute - ${session.session_id}] Option node ${currentNode.id} misconfigured (no question or options). Trying default output.`);
        nextNodeId = findNextNodeId(currentNode.id, 'default', connections);
      }
      break;

    case 'condition':
      const varNameCond = currentNode.conditionVariable?.replace(/\{\{|\}\}/g, '').trim();
      const actualValueCond = varNameCond ? getProperty(updatedFlowVariables, varNameCond) : undefined;
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
      console.log(`[API Evolution WS Execute - ${session.session_id}] Condition: Var ('${varNameCond}')='${actualValueCond}' ${currentNode.conditionOperator} '${compareValueCond}' -> ${conditionMet}`);
      nextNodeId = findNextNodeId(currentNode.id, conditionMet ? 'true' : 'false', connections);
      break;

    case 'set-variable':
      if (currentNode.variableName) {
        const valueToSet = substituteVariablesInText(currentNode.variableValue, updatedFlowVariables);
        updatedFlowVariables[currentNode.variableName] = valueToSet;
        session.flow_variables = updatedFlowVariables; // Atualiza as variáveis na sessão
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
            textContentApi = bodyData.text || bodyData.textMessage?.text; // Tenta extrair 'text' ou 'textMessage.text'
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
        // Simulação de chamada genérica
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
      shouldContinueRecursive = false; // Finaliza o fluxo aqui
      break;

    default:
      console.warn(`[API Evolution WS Execute - ${session.session_id}] Node type ${currentNode.type} (${currentNode.title}) not fully implemented in backend engine. Trying 'default' exit.`);
      nextNodeId = findNextNodeId(currentNode.id, 'default', connections);
      break;
  }
  
  session.flow_variables = updatedFlowVariables; // Garante que as variáveis da sessão estão atualizadas

  if (shouldContinueRecursive) {
    if (nextNodeId) {
      session.current_node_id = nextNodeId;
      await saveSessionToDB(session); // Salva o estado ANTES de executar o próximo passo
      await executeFlowStep(session, nodes, connections, apiConfig); // Chama recursivamente
    } else {
      console.log(`[API Evolution WS Execute - ${session.session_id}] No next node from ${currentNode.id} (${currentNode.type}). Ending flow (or pausing if no end-node and not awaiting input).`);
      // Se não é um nó de fim explícito e não está aguardando input, pode ser o fim de um galho.
      // Deletar a sessão aqui pode ser prematuro se o fluxo puder ser retomado por outro gatilho
      // ou se um nó de fim não foi alcançado. A sessão já foi salva com seu último estado.
      // Se o fluxo realmente terminou aqui (sem um nó 'end-flow'), a sessão pode ficar "órfã" até expirar ou ser limpa.
      // Para agora, vamos apenas salvar o último estado.
      await saveSessionToDB(session); 
    }
  } else {
    // Fluxo pausou (ex: para input) ou foi explicitamente terminado por um nó 'end-flow'.
    // A sessão já foi salva (ou deletada no caso de 'end-flow') dentro do switch case.
    if (currentNode.type !== 'end-flow') {
      await saveSessionToDB(session); // Garante que o estado de "aguardando input" seja salvo
    }
    console.log(`[API Evolution WS Execute - ${session.session_id}] Flow paused or ended for node ${currentNode.id}. Session state handled.`);
  }
}

// Função para armazenar detalhes da requisição no log global (em memória)
async function storeRequestDetails(
  request: NextRequest,
  parsedPayload: any, // O payload já parseado
  rawBodyText: string | null, // O corpo bruto como texto
  workspaceNameParam: string
): Promise<any> { // Retorna o objeto de log criado
  const currentTimestamp = new Date().toISOString();
  let extractedMessage: string | null = null;
  let webhookRemoteJid: string | null = null;
  const headers = Object.fromEntries(request.headers.entries());
  const ip = request.ip || headers['x-forwarded-for'] || 'unknown IP';

  // Tenta extrair do parsedPayload primeiro
  if (parsedPayload && typeof parsedPayload === 'object') {
    let actualPayloadToExtractFrom = parsedPayload;
    if (Array.isArray(parsedPayload) && parsedPayload.length === 1 && typeof parsedPayload[0] === 'object') {
      actualPayloadToExtractFrom = parsedPayload[0];
    }

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
    workspaceNameParam: workspaceNameParam, // Adiciona o nome do workspace ao log
    method: request.method,
    url: request.url,
    headers: headers,
    ip: ip,
    extractedMessage: extractedMessage,
    webhook_remoteJid: webhookRemoteJid,
    payload: parsedPayload || { raw_text: rawBodyText, message: "Payload was not valid JSON or was empty/unreadable" }
  };

  if (!Array.isArray(globalThis.evolutionWebhookLogs)) {
    console.warn('[Evolution API Webhook Store] globalThis.evolutionWebhookLogs is not an array before unshift! Re-initializing.');
    globalThis.evolutionWebhookLogs = [];
  }
  globalThis.evolutionWebhookLogs.unshift(logEntry);
  if (globalThis.evolutionWebhookLogs.length > MAX_LOG_ENTRIES) {
    globalThis.evolutionWebhookLogs.pop();
  }
  console.log(`[Evolution API Webhook Store] Log entry added. Total logs: ${globalThis.evolutionWebhookLogs.length}.`);
  return logEntry; // Retorna o objeto de log
}


// Manipulador POST principal
export async function POST(request: NextRequest, { params }: { params: { workspaceName: string } }) {
  const decodedWorkspaceName = decodeURIComponent(params.workspaceName);
  console.log(`[API Evolution WS Route] POST request received for workspace: "${decodedWorkspaceName}"`);

  let rawBody: string | null = null;
  let parsedBody: any = null;

  try {
    console.log(`[API Evolution WS Route - POST DEBUG] Attempting to read raw body for workspace: "${decodedWorkspaceName}"...`);
    rawBody = await request.text();

    if (!rawBody || rawBody.trim() === '') {
      console.warn(`[API Evolution WS Route - POST DEBUG] Raw body for workspace "${decodedWorkspaceName}" is empty or whitespace.`);
      parsedBody = { message: "Request body was empty or whitespace.", original_content_type: request.headers.get('content-type') || 'N/A' };
    } else {
      console.log(`[API Evolution WS Route - POST DEBUG] Raw body successfully read (length: ${rawBody.length}) for workspace "${decodedWorkspaceName}". Preview: ${rawBody.substring(0, 300)}...`);
      const contentType = request.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        try {
          console.log(`[API Evolution WS Route - POST DEBUG] Attempting to parse JSON body for workspace "${decodedWorkspaceName}"...`);
          parsedBody = JSON.parse(rawBody);
          console.log(`[API Evolution WS Route - POST DEBUG] JSON body successfully parsed for workspace "${decodedWorkspaceName}".`);
        } catch (jsonError: any) {
          console.warn(`[API Evolution WS Route - POST DEBUG] Failed to parse body as JSON for workspace "${decodedWorkspaceName}", storing raw text. Error: ${jsonError.message}`);
          parsedBody = { raw_text: rawBody, parse_error: jsonError.message, original_content_type: contentType };
        }
      } else {
        console.log(`[API Evolution WS Route - POST DEBUG] Content-Type is not application/json (was: ${contentType}). Storing raw text for workspace "${decodedWorkspaceName}".`);
        parsedBody = { raw_text: rawBody, original_content_type: contentType || 'N/A' };
      }
    }
    
    // Armazena detalhes da requisição, usando parsedBody para extração de dados
    const loggedEntry = await storeRequestDetails(request, parsedBody, rawBody, decodedWorkspaceName);

    // Tenta extrair dados do payload logado (que agora pode ter o payload principal dentro de um array)
    let actualEventPayload = parsedBody;
    if (Array.isArray(parsedBody) && parsedBody.length === 1 && typeof parsedBody[0] === 'object') {
      actualEventPayload = parsedBody[0];
    }
    
    const eventType = getProperty(actualEventPayload, 'event') as string;
    const instanceName = getProperty(actualEventPayload, 'instance') as string;
    const senderJid = loggedEntry.webhook_remoteJid; // Já extraído em storeRequestDetails
    const receivedMessageText = loggedEntry.extractedMessage; // Já extraído em storeRequestDetails
    const evolutionApiBaseUrl = getProperty(actualEventPayload, 'server_url') as string;
    const evolutionApiKey = getProperty(actualEventPayload, 'apikey') as string;

    console.log(`[API Evolution WS Route] Parsed data for logic: event='${eventType}', instance='${instanceName}', senderJid='${senderJid}', receivedMessage='${receivedMessageText}', baseUrl='${evolutionApiBaseUrl}', apiKeyExists='${!!evolutionApiKey}'`);

    if (eventType === 'messages.upsert' && senderJid && instanceName && evolutionApiBaseUrl) {
      const workspace = await loadWorkspaceByNameFromDB(decodedWorkspaceName);

      if (!workspace) {
        console.error(`[API Evolution WS Route] Workspace "${decodedWorkspaceName}" not found. Cannot execute flow.`);
        if (senderJid) {
          await sendWhatsAppMessageAction({
            baseUrl: evolutionApiBaseUrl, apiKey: evolutionApiKey || undefined, instanceName,
            recipientPhoneNumber: senderJid, messageType:'text',
            textContent: `Desculpe, o fluxo de trabalho "${decodedWorkspaceName}" não foi encontrado.`
          });
        }
        return NextResponse.json({ error: `Workspace "${decodedWorkspaceName}" not found.` }, { status: 404 });
      }

      if (!workspace.nodes || workspace.nodes.length === 0) {
          console.error(`[API Evolution WS Route] Workspace "${decodedWorkspaceName}" is empty.`);
          if (senderJid) await sendWhatsAppMessageAction({ baseUrl: evolutionApiBaseUrl, apiKey: evolutionApiKey || undefined, instanceName, recipientPhoneNumber: senderJid, messageType:'text', textContent: `Desculpe, o fluxo "${decodedWorkspaceName}" está vazio.`});
          return NextResponse.json({ error: `Workspace "${decodedWorkspaceName}" is empty.` }, { status: 500 });
      }
      
      const apiConfig: ApiConfig = { baseUrl: evolutionApiBaseUrl, apiKey: evolutionApiKey || undefined, instanceName };
      const sessionId = `${senderJid}@@${workspace.id}`; // Garante que a sessão é única por usuário E por workspace
      let session = await loadSessionFromDB(sessionId);
      let nextNodeToExecute: string | null = null;

      if (!session) {
        console.log(`[API Evolution WS Route - ${sessionId}] New session for workspace ${workspace.id}.`);
        const startNode = workspace.nodes.find(n => n.type === 'start');
        if (!startNode) {
          console.error(`[API Evolution WS Route - ${sessionId}] No start node in workspace ${workspace.id}.`);
          if (senderJid) await sendWhatsAppMessageAction({...apiConfig, recipientPhoneNumber: senderJid, messageType:'text', textContent: "Erro: O fluxo não tem um nó de início."});
          return NextResponse.json({ error: "Flow has no start node." }, { status: 500 });
        }
        
        const firstTrigger = startNode.triggers?.[0];
        nextNodeToExecute = findNextNodeId(startNode.id, firstTrigger?.name || 'default', workspace.connections || []);

        if(!nextNodeToExecute){
            console.error(`[API Evolution WS Route - ${sessionId}] Start node ("${startNode.title}") or its first trigger ("${firstTrigger?.name || 'default'}") has no outgoing connection.`);
            if (senderJid) await sendWhatsAppMessageAction({...apiConfig, recipientPhoneNumber: senderJid, messageType:'text', textContent: "Erro: O fluxo não está conectado corretamente a partir do início."});
            return NextResponse.json({ error: "Start node is not connected." }, { status: 500 });
        }

        session = {
          session_id: sessionId,
          workspace_id: workspace.id,
          current_node_id: nextNodeToExecute, 
          flow_variables: { 
            whatsapp_sender_jid: senderJid, 
            mensagem_whatsapp: receivedMessageText || '', // User's first message
            [firstTrigger?.webhookPayloadVariable || 'webhook_payload']: actualEventPayload, // Store the full (potentially unwrapped) payload
          },
          awaiting_input_type: null,
          awaiting_input_details: null,
        };
      } else {
        console.log(`[API Evolution WS Route - ${sessionId}] Existing session. Node: ${session.current_node_id}, Awaiting: ${session.awaiting_input_type}`);
        session.flow_variables.mensagem_whatsapp = receivedMessageText || ''; // Update with the latest message
        
        // Atualiza o payload do webhook se um nome de variável estiver configurado no gatilho do nó de início
        const startNode = workspace.nodes.find(n => n.type === 'start');
        const relevantTrigger = startNode?.triggers?.find(t => t.type === 'webhook') || startNode?.triggers?.[0];
        session.flow_variables[relevantTrigger?.webhookPayloadVariable || 'webhook_payload'] = actualEventPayload;


        if (session.awaiting_input_type && session.current_node_id && session.awaiting_input_details) {
          const originalNodeId = session.awaiting_input_details.originalNodeId || session.current_node_id;
          const awaitingNode = findNodeById(originalNodeId, workspace.nodes);

          if (awaitingNode) {
            if (session.awaiting_input_type === 'text' && session.awaiting_input_details.variableToSave) {
              session.flow_variables[session.awaiting_input_details.variableToSave] = receivedMessageText || '';
              nextNodeToExecute = findNextNodeId(awaitingNode.id, 'default', workspace.connections || []);
            } else if (session.awaiting_input_type === 'option' && Array.isArray(session.awaiting_input_details.options)) {
              const options = session.awaiting_input_details.options;
              const trimmedReceivedMessage = (receivedMessageText || '').trim();
              let chosenOptionText: string | undefined = undefined;

              const numericChoice = parseInt(trimmedReceivedMessage, 10);
              if (!isNaN(numericChoice) && numericChoice > 0 && numericChoice <= options.length) {
                chosenOptionText = options[numericChoice - 1];
              } else {
                chosenOptionText = options.find(
                  opt => opt.toLowerCase() === trimmedReceivedMessage.toLowerCase()
                );
              }

              if (chosenOptionText) {
                if (session.awaiting_input_details.variableToSave) {
                  session.flow_variables[session.awaiting_input_details.variableToSave] = chosenOptionText;
                }
                nextNodeToExecute = findNextNodeId(awaitingNode.id, chosenOptionText, workspace.connections || []);
                console.log(`[API Evolution WS Route - ${sessionId}] User chose option: "${chosenOptionText}". Next node: ${nextNodeToExecute}`);
              } else {
                if (senderJid) {
                  await sendWhatsAppMessageAction({...apiConfig, recipientPhoneNumber: senderJid, messageType:'text', textContent: "Opção inválida. Por favor, tente novamente respondendo com o número ou o texto exato da opção."});
                }
                nextNodeToExecute = null; // Fica no mesmo nó, não avança, mas também não re-executa o prompt do nó opção daqui
                session.current_node_id = awaitingNode.id; // Garante que a sessão permaneça no nó de opção
              }
            }
            session.awaiting_input_type = null;
            session.awaiting_input_details = null;
            session.current_node_id = nextNodeToExecute; // Atualiza o nó atual da sessão
          } else {
               console.warn(`[API Evolution WS Route - ${sessionId}] Awaiting node ${originalNodeId} not found. Resetting flow to start.`);
               const startNode = workspace.nodes.find(n => n.type === 'start');
               session.current_node_id = startNode ? findNextNodeId(startNode.id, startNode.triggers?.[0]?.name || 'default', workspace.connections || []) : null;
               session.awaiting_input_type = null;
               session.awaiting_input_details = null;
          }
        } else { // Não estava aguardando input, trata como uma nova interação no fluxo (ex: comando, ou reinício implícito)
           const startNode = workspace.nodes.find(n => n.type === 'start');
           if(startNode){
              session.current_node_id = findNextNodeId(startNode.id, startNode.triggers?.[0]?.name || 'default', workspace.connections || []);
              console.log(`[API Evolution WS Route - ${sessionId}] Session not awaiting input, (re)starting flow from: ${session.current_node_id}`);
           } else {
               console.error(`[API Evolution WS Route - ${sessionId}] No start node in workspace ${workspace.id} for restart.`);
               session.current_node_id = null; // Não há para onde ir
           }
           session.awaiting_input_type = null;
           session.awaiting_input_details = null;
        }
      }

      if (session.current_node_id) { // Apenas executa se houver um nó para ir
        await saveSessionToDB(session); // Salva o estado da sessão (novo ou atualizado)
        await executeFlowStep(session, workspace.nodes, workspace.connections || [], apiConfig);
      } else if (session.awaiting_input_type) { // Se pausou para input, mas não há próximo nó (caso raro, mas salva)
        await saveSessionToDB(session);
        console.log(`[API Evolution WS Route - ${sessionId}] Flow paused, awaiting user input for type: ${session.awaiting_input_type}, but no next node after input processing logic. Session saved.`);
      } else {
          console.log(`[API Evolution WS Route - ${sessionId}] Session has no current_node_id after processing input/init. Flow might have ended or has an issue.`);
          const existingSessionInDb = await loadSessionFromDB(sessionId);
          if (existingSessionInDb && !existingSessionInDb.awaiting_input_type) { // Se realmente não está aguardando, pode ser um fim implícito
             console.log(`[API Evolution WS Route - ${sessionId}] Deleting session due to no next node and not awaiting input.`);
             await deleteSessionFromDB(sessionId);
          }
      }
      return NextResponse.json({ message: "Webhook processed by workspace flow." }, { status: 200 });

    } else {
      let nonExecutionReason = "Not a 'messages.upsert' event or missing critical data in payload";
      if (eventType === 'messages.upsert') {
        if (!senderJid) nonExecutionReason = "Missing senderJid for logic";
        else if (!instanceName) nonExecutionReason = "Missing instanceName in payload";
        else if (!evolutionApiBaseUrl) nonExecutionReason = "Missing server_url in payload";
      }
      console.log(`[API Evolution WS Route] Webhook for workspace "${decodedWorkspaceName}" logged, but no flow execution triggered. Reason: ${nonExecutionReason}. Event: ${eventType}, Parsed Body was: ${parsedBody ? 'object' : 'null'}`);
      return NextResponse.json({ message: `Webhook logged, but no flow execution triggered: ${nonExecutionReason}.` }, { status: 200 });
    }

  } catch (error: any) {
    console.error(`[API Evolution WS Route - POST ERROR HANDLER] Error processing POST for "${decodedWorkspaceName}":`, error.message, error.stack);
    return NextResponse.json({ error: "Internal server error processing webhook.", details: error.message }, { status: 500 });
  }
}

// Manipulador GET para verificar se o workspace existe
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
    console.error(`[API Evolution WS Route - GET] Error processing GET for "${params.workspaceName}":`, error);
    return NextResponse.json({ error: "Internal server error while checking workspace." }, { status: 500 });
  }
}

// Outros métodos HTTP podem ser delegados para POST ou retornar método não permitido
export async function PUT(request: NextRequest, { params }: { params: { workspaceName: string } }) {
  console.log(`[API Evolution WS Route - PUT] Received PUT for workspace: "${params.workspaceName}". Delegating to POST logic or logging.`);
  // Por agora, apenas loga e responde como o POST (que também loga).
  // Ou poderia retornar NextResponse.json({ error: "Method Not Allowed" }, { status: 405 });
  return POST(request, { params });
}
export async function PATCH(request: NextRequest, { params }: { params: { workspaceName: string } }) {
  console.log(`[API Evolution WS Route - PATCH] Received PATCH for workspace: "${params.workspaceName}". Delegating to POST logic or logging.`);
  return POST(request, { params });
}
export async function DELETE(request: NextRequest, { params }: { params: { workspaceName: string } }) {
  console.log(`[API Evolution WS Route - DELETE] Received DELETE for workspace: "${params.workspaceName}". Delegating to POST logic or logging.`);
  return POST(request, { params });
}
    