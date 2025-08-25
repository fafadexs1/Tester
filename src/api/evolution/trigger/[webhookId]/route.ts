'use server';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getProperty, setProperty } from 'dot-prop';
import {
  loadSessionFromDB,
  saveSessionToDB,
  deleteSessionFromDB,
  loadWorkspaceFromDB,
  loadChatwootInstanceFromDB,
  loadDialogyInstanceFromDB,
  loadWorkspacesForOrganizationFromDB,
} from '@/app/actions/databaseActions';
import { sendChatwootMessageAction } from '@/app/actions/chatwootApiActions';
import { sendDialogyMessageAction } from '@/app/actions/dialogyApiActions';
import { sendWhatsAppMessageAction } from '@/app/actions/evolutionApiActions';
import { executeFlow } from '@/lib/flow-engine/engine';
import { storeRequestDetails } from '@/lib/flow-engine/webhook-handler';
import type { NodeData, Connection, FlowSession, StartNodeTrigger, WorkspaceData, FlowContextType } from '@/lib/types';
import { findNodeById, findNextNodeId } from '@/lib/flow-engine/utils';

// Função auxiliar para criar o sender de forma consistente
async function createMessageSender(
  session: FlowSession, 
  workspace: WorkspaceData | null,
  evolutionApiBaseUrl?: string,
  evolutionApiKey?: string,
  instanceName?: string
): Promise<(content: string) => Promise<void>> {
  // Dialogy
  if (session.flow_context === 'dialogy' && workspace?.dialogy_instance_id) {
    const dialogyInstance = await loadDialogyInstanceFromDB(workspace.dialogy_instance_id);
    const chatId = getProperty(session.flow_variables, 'dialogy_conversation_id');
    if (dialogyInstance && chatId) {
      return async (content: string) => {
        console.log(`[Flow Engine] Sending via Dialogy (chatId=${chatId})`);
        await sendDialogyMessageAction({ 
          baseUrl: dialogyInstance.baseUrl, 
          apiKey: dialogyInstance.apiKey, 
          chatId, 
          content 
        });
      };
    }
  }
  
  // Chatwoot
  if (session.flow_context === 'chatwoot' && workspace?.chatwoot_instance_id) {
    const chatwootInstance = await loadChatwootInstanceFromDB(workspace.chatwoot_instance_id);
    const accountId = getProperty(session.flow_variables, 'chatwoot_account_id');
    const conversationId = getProperty(session.flow_variables, 'chatwoot_conversation_id');
    if (chatwootInstance && accountId && conversationId) {
      return async (content: string) => {
        console.log(`[Flow Engine] Sending via Chatwoot (conv=${conversationId})`);
        await sendChatwootMessageAction({ 
          baseUrl: chatwootInstance.baseUrl, 
          apiAccessToken: chatwootInstance.apiAccessToken, 
          accountId, 
          conversationId, 
          content 
        });
      };
    }
  }
  
  // Fallback: Evolution (WhatsApp)
  const evoRecipient = session.flow_variables.whatsapp_sender_jid || 
                       session.session_id.split('@@')[0].replace('evolution_jid_', '');
  const evoConfig = { 
    baseUrl: evolutionApiBaseUrl || '', 
    apiKey: evolutionApiKey || undefined, 
    instanceName: instanceName || '' 
  };
  
  return async (content: string) => {
    console.log(`[Flow Engine] Sending via Evolution (recipient=${evoRecipient})`);
    await sendWhatsAppMessageAction({ 
      ...evoConfig, 
      recipientPhoneNumber: evoRecipient, 
      messageType: 'text', 
      textContent: content 
    });
  };
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ webhookId: string }> }) {
  const { webhookId } = await params;
  let rawBody: string | null = null;
  let parsedBody: any = null;

  try {
    rawBody = await request.text();
    parsedBody = rawBody ? JSON.parse(rawBody) : { message: "Request body was empty." };
    console.log(`[API Evolution Trigger] Webhook Received for ${webhookId}:`, JSON.stringify(parsedBody, null, 2));

    let loggedEntry: any = await storeRequestDetails(request, parsedBody, rawBody, webhookId);
    let startExecution = false;

    const sessionKeyIdentifier = loggedEntry.session_key_identifier;
    const receivedMessageText = loggedEntry.extractedMessage;
    const flowContext = loggedEntry.flow_context as FlowContextType;

    // Agent intervention checks
    if (flowContext === 'chatwoot') {
      let payloadToCheck = parsedBody;
      if (Array.isArray(payloadToCheck) && payloadToCheck.length > 0) {
        payloadToCheck = payloadToCheck[0];
      }
      if (getProperty(payloadToCheck, 'sender_type') === 'User') {
        console.log(`[API Trigger] Human agent (Chatwoot User) message detected in conversation ${sessionKeyIdentifier}. Pausing automation.`);
        return NextResponse.json({ message: "Automation paused due to human intervention." }, { status: 200 });
      }
    }
    if (flowContext === 'dialogy') {
      const fromMe = getProperty(parsedBody, 'message.from_me');
      const status = getProperty(parsedBody, 'conversation.status');
      if (fromMe === true) {
        console.log(`[API Trigger] Dialogy message from agent (from_me=true) in conversation ${sessionKeyIdentifier}. Ignoring.`);
        return NextResponse.json({ message: "Message from agent, automation ignored." }, { status: 200 });
      }
      if (status === 'atendimentos') {
        console.log(`[API Trigger] Dialogy conversation ${sessionKeyIdentifier} has status 'atendimentos'. Ignoring.`);
        return NextResponse.json({ message: `Conversation in 'atendimentos', automation ignored.` }, { status: 200 });
      }
    }

    const evolutionApiBaseUrl = getProperty(loggedEntry.payload, 'server_url') as string;
    const evolutionApiKey = getProperty(loggedEntry.payload, 'apikey') as string;
    const instanceName = getProperty(loggedEntry.payload, 'instance') as string;
    
    const isApiCallResponse = getProperty(loggedEntry.payload, 'isApiCallResponse') === true;
    const resumeSessionId = getProperty(loggedEntry.payload, 'resume_session_id');

    // Handle resume session
    if (resumeSessionId) {
      console.log(`[API Evolution Trigger] Resume call detected for session ID: ${resumeSessionId}`);
      const sessionToResume = await loadSessionFromDB(resumeSessionId);
      if (sessionToResume) {
        const workspaceForResume = await loadWorkspaceFromDB(sessionToResume.workspace_id);
        if (workspaceForResume && workspaceForResume.nodes) {
          sessionToResume.flow_variables[sessionToResume.awaiting_input_details?.variableToSave || 'external_response_data'] = parsedBody;
          sessionToResume.awaiting_input_type = null;

          const sendMessage = await createMessageSender(
            sessionToResume, 
            workspaceForResume, 
            evolutionApiBaseUrl, 
            evolutionApiKey, 
            instanceName
          );
          
          const transport = { sendMessage };
          await executeFlow(sessionToResume, workspaceForResume.nodes, workspaceForResume.connections || [], transport, workspaceForResume);
          return NextResponse.json({ message: "Flow resumed." }, { status: 200 });
        }
      } else {
        console.error(`[API Evolution Trigger] Could not find session ${resumeSessionId} to resume.`);
        return NextResponse.json({ error: `Session to resume not found: ${resumeSessionId}` }, { status: 404 });
      }
    }

    if (!sessionKeyIdentifier) {
      let reason = "Could not determine a unique session identifier from the payload.";
      console.log(`[API Evolution Trigger] Logged, but no flow execution triggered for webhook ID "${webhookId}". Reason: ${reason}.`);
      return NextResponse.json({ message: `Webhook logged, but no flow execution: ${reason}.` }, { status: 200 });
    }

    let workspace: WorkspaceData | null = null;
    let session: FlowSession | null = await loadSessionFromDB(sessionKeyIdentifier);

    // Timeout logic
    if (session) {
      workspace = await loadWorkspaceFromDB(session.workspace_id);
      if (!workspace) {
        console.error(`[API Evolution Trigger] Session ${session.session_id} exists but its workspace ${session.workspace_id} was not found. Deleting orphan session.`);
        await deleteSessionFromDB(session.session_id);
        session = null;
      } else if (session.session_timeout_seconds && session.session_timeout_seconds > 0 && session.last_interaction_at) {
        const lastInteractionDate = new Date(session.last_interaction_at);
        const timeoutMilliseconds = session.session_timeout_seconds * 1000;
        const expirationTime = lastInteractionDate.getTime() + timeoutMilliseconds;

        if (Date.now() > expirationTime) {
          console.log(`[API Evolution Trigger - ${session.session_id}] Session timed out. Deleting session and starting a new one.`);
          await deleteSessionFromDB(session.session_id);
          session = null;
        }
      }
    }

    // Continue existing session
    if (session && workspace) {
      if (session.current_node_id === null && session.awaiting_input_type === null) {
        console.log(`[API Evolution Trigger - ${session.session_id}] Session is in a paused (dead-end) state. Restarting flow due to new message.`);
        await deleteSessionFromDB(session.session_id);
        session = null;
        workspace = null; // CORREÇÃO: resetar workspace também
      } else {
        const responseValue = isApiCallResponse ? parsedBody : receivedMessageText;
        session.flow_variables.mensagem_whatsapp = isApiCallResponse ? (getProperty(responseValue, 'responseText') || JSON.stringify(responseValue)) : responseValue;
        session.flow_context = flowContext;

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
              } else if (!isApiCallResponse) {
                const sendInvalidOptionMessage = await createMessageSender(
                  session, 
                  workspace, 
                  evolutionApiBaseUrl, 
                  evolutionApiKey, 
                  instanceName
                );
                await sendInvalidOptionMessage("Opção inválida. Por favor, tente novamente.");
                startExecution = false;
              }
            }

            if (nextNode) {
              session.awaiting_input_type = null;
              session.awaiting_input_details = null;
              session.current_node_id = nextNode;
              startExecution = true;
            } else if (!isApiCallResponse && session.awaiting_input_type === 'option') {
              startExecution = false;
            } else {
              session.awaiting_input_type = null;
              session.awaiting_input_details = null;
              session.current_node_id = null;
              startExecution = false;
              await saveSessionToDB(session);
              return NextResponse.json({ message: "Flow paused at dead end." }, { status: 200 });
            }

          } else {
            console.warn(`[API Evolution Trigger - ${session.session_id}] Awaiting node ${originalNodeId} not found, restarting flow.`);
            await deleteSessionFromDB(session.session_id);
            session = null;
          }
        } else {
          console.log(`[API Evolution Trigger - ${session.session_id}] New message received in active session not awaiting input. Restarting flow.`);
          await deleteSessionFromDB(session.session_id);
          session = null;
        }
      }
    }

    // Start new session
    if (!session) {
      if (isApiCallResponse) {
        console.log(`[API Evolution Trigger] API response received but no active session found for ${sessionKeyIdentifier}. Ignoring.`);
        return NextResponse.json({ message: "API response ignored, no active session." }, { status: 200 });
      }
      console.log(`[API Evolution Trigger] No active session or session was reset for ${sessionKeyIdentifier}. Trying to start a new flow.`);

      let workspaceToStart: WorkspaceData | null = null;
      let matchingTrigger: StartNodeTrigger | null = null;
      let startNodeForFlow: NodeData | null = null;
      let matchingKeyword: string | null = null;

      const defaultWorkspace = await loadWorkspaceFromDB(webhookId);

      if (defaultWorkspace?.organization_id) {
        const organizationId = defaultWorkspace.organization_id;
        const allWorkspaces = await loadWorkspacesForOrganizationFromDB(organizationId);

        for (const ws of allWorkspaces) {
          const startNode = ws.nodes.find(n => n.type === 'start');
          if (startNode?.triggers) {
            for (const trigger of startNode.triggers) {
              if (trigger.type === 'webhook' && trigger.enabled && trigger.keyword && receivedMessageText) {
                const keywords = trigger.keyword.split(',').map(k => k.trim().toLowerCase());
                const foundKeyword = keywords.find(kw => kw === receivedMessageText.toLowerCase());
                if (foundKeyword) {
                  workspaceToStart = ws;
                  matchingTrigger = trigger;
                  startNodeForFlow = startNode;
                  matchingKeyword = foundKeyword;
                  break;
                }
              }
            }
          }
          if (workspaceToStart) break;
        }
      }

      if (!workspaceToStart && defaultWorkspace) {
        console.log(`[API Evolution Trigger] No keyword match found. Falling back to default flow from URL: ${webhookId}`);
        workspaceToStart = defaultWorkspace;
        startNodeForFlow = workspaceToStart.nodes.find(n => n.type === 'start');
        matchingTrigger = startNodeForFlow?.triggers?.find(t => t.type === 'webhook' && t.enabled) || null;
      }

      if (!workspaceToStart || !startNodeForFlow || !matchingTrigger) {
        console.log(`[API Evolution Trigger] No matching workspace/start node/trigger found for this request. Default flow ID from URL: ${webhookId}.`);
        return NextResponse.json({ error: `Workspace with ID "${webhookId}" not found or has no enabled webhook trigger.` }, { status: 404 });
      }

      const triggerHandle = matchingKeyword || matchingTrigger.name;
      console.log(`[API Evolution Trigger] Determined to start flow: ${workspaceToStart.name} (ID: ${workspaceToStart.id}) with trigger handle: ${triggerHandle}`);
      const initialNodeId = findNextNodeId(startNodeForFlow.id, triggerHandle, workspaceToStart.connections || []);

      if (!initialNodeId) {
        console.error(`[API Evolution Trigger] Start node trigger handle '${triggerHandle}' is not connected in flow ${workspaceToStart.name}.`);
        return NextResponse.json({ error: `Start node trigger handle '${triggerHandle}' is not connected.` }, { status: 500 });
      }

      let payloadToUse = parsedBody;
      if (Array.isArray(payloadToUse) && payloadToUse.length > 0) {
        payloadToUse = payloadToUse[0];
      }

      const initialVars: Record<string, any> = {
        mensagem_whatsapp: receivedMessageText || '',
        webhook_payload: payloadToUse,
        session_id: sessionKeyIdentifier,
        _triggerHandle: triggerHandle,
      };

      if (flowContext === 'evolution') {
        setProperty(initialVars, 'whatsapp_sender_jid', getProperty(payloadToUse, 'data.key.remoteJid') || getProperty(payloadToUse, 'sender.identifier'));
      } else if (flowContext === 'chatwoot') {
        const chatwootMappings = { 
          chatwoot_conversation_id: 'conversation.id', 
          chatwoot_contact_id: 'sender.id', 
          chatwoot_account_id: 'account.id', 
          chatwoot_inbox_id: 'inbox.id', 
          contact_name: 'sender.name', 
          contact_phone: 'sender.phone_number' 
        };
        for (const [varName, path] of Object.entries(chatwootMappings)) {
          const value = getProperty(payloadToUse, path);
          if (value !== undefined) setProperty(initialVars, varName, value);
        }
      } else if (flowContext === 'dialogy') {
        const dialogyMappings = { 
          dialogy_conversation_id: 'conversation.id', 
          dialogy_contact_id: 'contact.id', 
          dialogy_account_id: 'account.id', 
          contact_name: 'contact.name', 
          contact_phone: 'contact.phone_number' 
        };
        for (const [varName, path] of Object.entries(dialogyMappings)) {
          const value = getProperty(payloadToUse, path);
          if (value !== undefined) setProperty(initialVars, varName, value);
        }
      }

      if (matchingTrigger.variableMappings) {
        matchingTrigger.variableMappings.forEach(mapping => {
          if (mapping.jsonPath && mapping.flowVariable) {
            const value = getProperty(payloadToUse, mapping.jsonPath);
            if (value !== undefined) setProperty(initialVars, mapping.flowVariable, value);
          }
        });
      }

      session = {
        session_id: sessionKeyIdentifier,
        workspace_id: workspaceToStart.id,
        current_node_id: initialNodeId,
        flow_variables: initialVars,
        awaiting_input_type: null,
        awaiting_input_details: null,
        session_timeout_seconds: matchingTrigger.sessionTimeoutSeconds || 0,
        flow_context: flowContext,
      };
      workspace = workspaceToStart;
      startExecution = true;
    }

    // Execute flow if needed
    if (startExecution && session?.current_node_id && workspace) {
      const sendMessage = await createMessageSender(
        session, 
        workspace, 
        evolutionApiBaseUrl, 
        evolutionApiKey, 
        instanceName
      );
      
      const transport = { sendMessage };
      await executeFlow(session, workspace.nodes, workspace.connections || [], transport, workspace);
    } else if (session && !startExecution) {
      await saveSessionToDB(session);
    }

    return NextResponse.json({ message: "Webhook processed." }, { status: 200 });

  } catch (error: any) {
    console.error(`[API Evolution Trigger - POST ERROR] Error for webhook ID "${webhookId}":`, error.message, error.stack);
    return NextResponse.json({ error: "Internal server error processing webhook.", details: error.message }, { status: 500 });
  }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ webhookId: string }> }) {
  const { webhookId } = await params;
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

export async function PUT(request: NextRequest, { params }: { params: Promise<{ webhookId: string }> }) {
  return POST(request, { params });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ webhookId: string }> }) {
  return POST(request, { params });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ webhookId: string }> }) {
  return POST(request, { params });
}
