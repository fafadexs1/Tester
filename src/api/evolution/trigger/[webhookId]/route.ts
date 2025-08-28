'use server';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getProperty, setProperty } from 'dot-prop';
import {
  loadSessionFromDB,
  saveSessionToDB,
  deleteSessionFromDB,
  loadWorkspaceFromDB,
  loadWorkspacesForOrganizationFromDB,
} from '@/app/actions/databaseActions';
import { executeFlow } from '@/lib/flow-engine/engine';
import { storeRequestDetails } from '@/lib/flow-engine/webhook-handler';
import { findNodeById } from '@/lib/flow-engine/utils';
import type { NodeData, Connection, FlowSession, StartNodeTrigger, WorkspaceData } from '@/lib/types';

// Helper function to check for nil values (null, undefined, '')
const isNil = (v: any) => v === null || v === undefined || v === '';

// Helper function to robustly determine if a session is paused at a dead-end
const isPausedSession = (s: FlowSession): boolean => {
    // Check for explicit paused flag first
    if (s.flow_variables?.__flowPaused === true) return true;
    // Check for nil values indicating a dead-end state
    return isNil(s.current_node_id) && isNil(s.awaiting_input_type) && !s.awaiting_input_details;
};


export async function POST(request: NextRequest, { params }: { params: Promise<{ webhookId: string }> }) {
  const { webhookId } = await params;
  console.log(`[API Evolution Trigger] POST received for webhook ID: "${webhookId}"`);

  let rawBody: string | null = null;
  let parsedBody: any = null;
  let startExecution = false;

  try {
    const initialWorkspace = await loadWorkspaceFromDB(webhookId);
    if (!initialWorkspace) {
        console.warn(`[API Evolution Trigger] Initial validation failed: Workspace with ID "${webhookId}" not found. Ignoring request.`);
        // Pass false for workspaceExists to prevent log saving attempt for non-existent workspaces
        await storeRequestDetails(request, null, await request.text().catch(() => null), webhookId, false);
        return NextResponse.json({ error: `Workspace with ID "${webhookId}" not found.` }, { status: 404 });
    }

    rawBody = await request.text();
    parsedBody = rawBody ? JSON.parse(rawBody) : { message: "Request body was empty." };
    // Pass true for workspaceExists because we've confirmed it exists.
    const loggedEntry = await storeRequestDetails(request, parsedBody, rawBody, webhookId, true);

    const sessionKeyIdentifier = loggedEntry.session_key_identifier;
    const receivedMessageText = loggedEntry.extractedMessage;
    const flowContext = loggedEntry.flow_context;
    
    console.log(`[DEBUG] Determined Flow Context: ${flowContext}`);
    console.log(`[DEBUG] Determined Session Key Identifier: ${sessionKeyIdentifier}`);
    
    // VERIFICAÇÃO IMEDIATA PARA PAUSAR O FLUXO
    if (flowContext === 'dialogy') {
        const fromMe = getProperty(parsedBody, 'message.from_me');
        const status = getProperty(parsedBody, 'conversation.status');
        console.log(`[IMMEDIATE CHECK] Dialogy Context. from_me: ${fromMe}, status: ${status}`);

        if (fromMe === true) {
            console.log(`[API Trigger] Dialogy message from agent (from_me=true) in conversation ${sessionKeyIdentifier}. Automation ignored.`);
            return NextResponse.json({ message: "Message from agent, automation ignored." }, { status: 200 });
        }
        if (status === 'atendimentos') {
            console.log(`[API Trigger] Dialogy conversation ${sessionKeyIdentifier} has status 'atendimentos'. Automation will be ignored.`);
            return NextResponse.json({ message: `Conversation in 'atendimentos', automation ignored.` }, { status: 200 });
        }
    }


    const isApiCallResponse = getProperty(loggedEntry.payload, 'isApiCallResponse') === true;
    const resumeSessionId = getProperty(loggedEntry.payload, 'resume_session_id');

    if (resumeSessionId) {
      console.log(`[API Evolution Trigger] Resume call detected for session ID: ${resumeSessionId}`);
      const sessionToResume = await loadSessionFromDB(resumeSessionId);
      if (sessionToResume) {
        const workspaceForResume = await loadWorkspaceFromDB(sessionToResume.workspace_id);
        if (workspaceForResume && workspaceForResume.nodes) {
          sessionToResume.flow_variables[sessionToResume.awaiting_input_details?.variableToSave || 'external_response_data'] = parsedBody;
          sessionToResume.awaiting_input_type = null;
          await executeFlow(sessionToResume, workspaceForResume);
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
    
    let payloadToUse = parsedBody;
    if (Array.isArray(payloadToUse) && payloadToUse.length > 0) {
      console.log('[DEBUG] Payload is an array, using first element.');
      payloadToUse = payloadToUse[0];
    }
    console.log('[DEBUG] Final payloadToUse for checks:', JSON.stringify(payloadToUse, null, 2));

    // Agent intervention checks (Chatwoot specific) - a verificação da Dialogy já foi feita acima.
    if (flowContext === 'chatwoot') {
       const senderType = getProperty(payloadToUse, 'sender_type');
       console.log(`[DEBUG Chatwoot Check] Sender Type: ${senderType}`);
      if (senderType === 'User') {
        console.log(`[API Trigger] Human agent (Chatwoot User) message detected in conversation ${sessionKeyIdentifier}. Pausing automation.`);
        return NextResponse.json({ message: "Automation paused due to human intervention." }, { status: 200 });
      }
    }
    
    if (session) {
      workspace = await loadWorkspaceFromDB(session.workspace_id);
      console.log(`[DEBUG] Loaded existing session ${session.session_id} and workspace ${workspace?.id}`);
      
      // Essencial: Atualiza o contexto da sessão existente
      session.flow_context = flowContext;
      if (flowContext === 'dialogy') {
          const convId = getProperty(payloadToUse, 'conversation.id');
          if (convId) {
             console.log(`[DEBUG] Updating dialogy_conversation_id in existing session to ${convId}`);
             setProperty(session.flow_variables, 'dialogy_conversation_id', convId);
          }
      }

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

    if (session && workspace) {
      console.log(`[API Evolution Trigger - ${session.session_id}] Existing session is active. Node: ${session.current_node_id}, Awaiting: ${session.awaiting_input_type}, Context: ${session.flow_context}`);
      
      if (isPausedSession(session)) {
        console.log(`[API Evolution Trigger - ${session.session_id}] Session is in a paused (dead-end) state. Ignoring new message to prevent unwanted restart.`);
        return NextResponse.json({ message: "Flow is paused. New message ignored." }, { status: 200 });
      } else {
        const responseValue = isApiCallResponse ? parsedBody : receivedMessageText;
        session.flow_variables.mensagem_whatsapp = isApiCallResponse ? (getProperty(responseValue, 'responseText') || JSON.stringify(responseValue)) : responseValue;
        
        // Always ensure context is set on existing session
        session.flow_context = flowContext;

        if (session.awaiting_input_type && session.awaiting_input_details) {
          delete session.flow_variables.__flowPaused; // Clear the paused flag as we are resuming
          const originalNodeId = session.awaiting_input_details.originalNodeId;
          const awaitingNode = findNodeById(originalNodeId!, workspace.nodes);

          if (awaitingNode) {
            let nextNodeId: string | null = null;
            if (awaitingNode.apiResponseAsInput && !isApiCallResponse) {
              console.log(`[API Evolution Trigger] Node ${awaitingNode.id} expects API response, but received user message. Ignoring.`);
              return NextResponse.json({ message: "Awaiting API response, user message ignored." }, { status: 200 });
            }

            const findNextNode = (from: string, handle: string, conns: Connection[]) => (conns.find(c => c.from === from && c.sourceHandle === handle) || { to: null }).to;

            if (['input', 'date-input', 'file-upload', 'rating-input'].includes(session.awaiting_input_type) && session.awaiting_input_details.variableToSave) {
              let textToSave = String(responseValue);
              if (isApiCallResponse && awaitingNode.apiResponsePathForValue) {
                const extracted = getProperty(responseValue, awaitingNode.apiResponsePathForValue);
                if (extracted !== undefined) textToSave = String(extracted);
              }
              setProperty(session.flow_variables, session.awaiting_input_details.variableToSave, textToSave);
              nextNodeId = findNextNode(awaitingNode.id, 'default', workspace.connections || []);
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
                nextNodeId = findNextNode(awaitingNode.id, chosenOptionText, workspace.connections || []);
              } else if (!isApiCallResponse) {
                setProperty(session.flow_variables, '_invalidOption', true);
                nextNodeId = awaitingNode.id; 
              }
            }

            if (nextNodeId) {
              session.awaiting_input_type = null;
              session.awaiting_input_details = null;
              session.current_node_id = nextNodeId;
              startExecution = true;
            } else if (!isApiCallResponse && session.awaiting_input_type === 'option') {
              startExecution = true;
            } else {
              session.awaiting_input_type = null;
              session.awaiting_input_details = null;
              session.current_node_id = null;
              session.flow_variables.__flowPaused = true; // Set the persistent paused flag
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
           if (isNil(session.current_node_id)) {
                console.log(`[API Evolution Trigger - ${session.session_id}] No current node (dead-end). Ignoring message.`);
                return NextResponse.json({ message: "Flow is paused. New message ignored." }, { status: 200 });
            }
          console.log(`[API Evolution Trigger - ${session.session_id}] New message received in active session not awaiting input. Restarting flow.`);
          await deleteSessionFromDB(session.session_id);
          session = null;
        }
      }
    }

    if (!session) {
      if (isApiCallResponse) {
        console.log(`[API Evolution Trigger] API response received but no active session found for ${sessionKeyIdentifier}. Ignoring.`);
        return NextResponse.json({ message: "API response ignored, no active session." }, { status: 200 });
      }
      console.log(`[API Evolution Trigger] No active session or session was reset for ${sessionKeyIdentifier}. Trying to start a new flow.`);

      let workspaceToStart: WorkspaceData | null = workspace; // Use already loaded workspace if available from a timeout
      let matchingTrigger: StartNodeTrigger | null = null;
      let startNodeForFlow: NodeData | null = null;
      let matchingKeyword: string | null = null;

      if (!workspaceToStart) {
        console.log(`[API Evolution Trigger] Workspace was null, reloading from webhookId: ${webhookId}`);
        workspaceToStart = await loadWorkspaceFromDB(webhookId);
      }

      if (workspaceToStart?.organization_id) {
          const organizationId = workspaceToStart.organization_id;
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
              if (workspaceToStart && matchingTrigger) break; 
          }
      }
      
      if (!matchingTrigger) {
          console.log(`[API Evolution Trigger] No keyword match found. Falling back to default flow from URL: ${webhookId}`);
          workspaceToStart = await loadWorkspaceFromDB(webhookId);
      }
      
      if (!workspaceToStart) {
        console.log(`[API Evolution Trigger] No matching workspace found for this request. Webhook ID: ${webhookId}.`);
        return NextResponse.json({ error: `Workspace with ID "${webhookId}" not found.` }, { status: 404 });
      }

      startNodeForFlow = workspaceToStart.nodes.find(n => n.type === 'start');
      if (!matchingTrigger) { 
        matchingTrigger = startNodeForFlow?.triggers?.find(t => t.type === 'webhook' && t.enabled) || null;
      }

      if (!startNodeForFlow || !matchingTrigger) {
        console.log(`[API Evolution Trigger] Workspace ${workspaceToStart.name} has no enabled webhook trigger.`);
        return NextResponse.json({ error: `Workspace "${workspaceToStart.name}" has no enabled webhook trigger.` }, { status: 404 });
      }

      const triggerHandle = matchingKeyword || matchingTrigger.name;
      console.log(`[API Evolution Trigger] Determined to start flow: ${workspaceToStart.name} (ID: ${workspaceToStart.id}) with trigger handle: ${triggerHandle}`);
      const findNextNode = (from: string, handle: string, conns: Connection[]) => (conns.find(c => c.from === from && c.sourceHandle === handle) || { to: null }).to;
      const initialNodeId = findNextNode(startNodeForFlow.id, triggerHandle, workspaceToStart.connections || []);

      if (!initialNodeId) {
        console.error(`[API Evolution Trigger] Start node trigger handle '${triggerHandle}' is not connected in flow ${workspaceToStart.name}.`);
        return NextResponse.json({ error: `Start node trigger handle '${triggerHandle}' is not connected.` }, { status: 500 });
      }

      const initialVars: Record<string, any> = {
        mensagem_whatsapp: receivedMessageText || '',
        webhook_payload: payloadToUse,
        session_id: sessionKeyIdentifier,
        _triggerHandle: triggerHandle,
      };

      // Essencial: Adiciona variáveis específicas do Dialogy se o contexto for dialogy
      if (flowContext === 'dialogy') {
          setProperty(initialVars, 'dialogy_conversation_id', getProperty(payloadToUse, 'conversation.id'));
          setProperty(initialVars, 'dialogy_contact_id',      getProperty(payloadToUse, 'contact.id'));
          setProperty(initialVars, 'dialogy_account_id',      getProperty(payloadToUse, 'account.id'));
          setProperty(initialVars, 'contact_name',            getProperty(payloadToUse, 'contact.name'));
          setProperty(initialVars, 'contact_phone',           getProperty(payloadToUse, 'contact.phone_number'));
          console.log('[DEBUG] Auto-injected Dialogy variables:', initialVars);
      } else if (flowContext === 'chatwoot') {
        const chatwootMappings = { chatwoot_conversation_id: 'conversation.id', chatwoot_contact_id: 'sender.id', chatwoot_account_id: 'account.id', chatwoot_inbox_id: 'inbox.id', contact_name: 'sender.name', contact_phone: 'sender.phone_number' };
        for (const [varName, path] of Object.entries(chatwootMappings)) {
          const value = getProperty(payloadToUse, path);
          if (value !== undefined) setProperty(initialVars, varName, value);
        }
      } else if (flowContext === 'evolution') {
        setProperty(initialVars, 'whatsapp_sender_jid', getProperty(payloadToUse, 'data.key.remoteJid') || getProperty(payloadToUse, 'sender.identifier'));
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
      console.log("[API Evolution Trigger] New session created:", JSON.stringify(session, null, 2));
      workspace = workspaceToStart;
      startExecution = true;
    }

    if (startExecution && session?.current_node_id && workspace) {
      delete session.flow_variables.__flowPaused; // Clear paused flag on new execution start
      console.log(`[API Evolution Trigger] Calling executeFlow for session. Context: ${session.flow_context}. Workspace ID: ${workspace.id}`);
      await executeFlow(session, workspace);
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
