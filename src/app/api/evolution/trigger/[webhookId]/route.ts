
'use server';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getProperty, setProperty } from 'dot-prop';
import {
  loadSessionFromDB,
  saveSessionToDB,
  deleteSessionFromDB,
  loadWorkspaceFromDB,
  listWorkspaceIdsForOrganization,
} from '@/app/actions/databaseActions';
import { executeFlow } from '@/lib/flow-engine/engine';
import { storeRequestDetails } from '@/lib/flow-engine/webhook-handler';
import { findNodeById, findNextNodeId } from '@/lib/flow-engine/utils';
import { classifyIntent } from '@/ai/flows/intention-classification-flow';
import type { NodeData, Connection, FlowSession, StartNodeTrigger, WorkspaceData } from '@/lib/types';

// Helper function to check for nil values (null, undefined, '')
const isNil = (v: any) => v === null || v === undefined || v === '';

// Helper function to robustly determine if a session is paused at a dead-end
const isPausedSession = (s: FlowSession): boolean => {
  if (s.flow_variables?.__flowPaused === true) return true;
  return isNil(s.current_node_id) && isNil(s.awaiting_input_type) && !s.awaiting_input_details;
};

const MAX_SESSION_MESSAGE_LENGTH = 512;

const normalizeIncomingMessage = (value: string | null | undefined): string => {
  if (!value) return '';
  const trimmed = value.trim();
  if (trimmed.length <= MAX_SESSION_MESSAGE_LENGTH) {
    return trimmed;
  }
  return trimmed.slice(0, MAX_SESSION_MESSAGE_LENGTH);
};

const normalizeVariableName = (name: string | null | undefined): string => {
  if (!name) return '';
  return name.replace(/\{\{|\}\}/g, '').trim();
};

async function readRequestPayload(
  request: NextRequest
): Promise<{ parsedBody: any; rawBodyText: string | null }> {
  let rawText: string | null = null;
  try {
    rawText = await request.text();
  } catch (error) {
    console.error('[API Evolution Trigger] Failed to read request body:', error);
  }

  if (!rawText || rawText.trim().length === 0) {
    return { parsedBody: { message: 'Request body was empty.' }, rawBodyText: null };
  }

  try {
    const parsed = JSON.parse(rawText);
    return { parsedBody: parsed, rawBodyText: rawText };
  } catch {
    return { parsedBody: null, rawBodyText: rawText };
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ webhookId: string }> }) {
  const { webhookId } = await params;

  const initialWorkspace = await loadWorkspaceFromDB(webhookId);
  if (!initialWorkspace) {
    console.warn(`[API Evolution Trigger] Initial validation failed: Workspace with ID "${webhookId}" not found. Ignoring request.`);
    const { parsedBody, rawBodyText } = await readRequestPayload(request);
    await storeRequestDetails(request, parsedBody, rawBodyText, webhookId, false);
    return NextResponse.json({ error: `Workspace with ID "${webhookId}" not found.` }, { status: 404 });
  }

  const bodyData = await readRequestPayload(request);
  let parsedBody: any = bodyData.parsedBody;
  let rawBody: string | null = bodyData.rawBodyText;

  // If JSON parsing failed, treat explicit null parsedBody as text if needed or just empty object
  if (!parsedBody) parsedBody = {};

  try {
    const loggedEntry = await storeRequestDetails(request, parsedBody, rawBody, webhookId, true);
    rawBody = null; // release reference as soon as possible

    const sessionKeyIdentifier = loggedEntry.session_key_identifier;
    let receivedMessageText = loggedEntry.extractedMessage;
    const flowContext = loggedEntry.flow_context ?? loggedEntry.flowContext ?? 'evolution';
    if (!receivedMessageText || receivedMessageText === '') {
      receivedMessageText =
        getProperty(parsedBody, 'message.content') ??
        getProperty(parsedBody, 'message.body') ??
        getProperty(parsedBody, 'message.textMessage.text') ??
        getProperty(parsedBody, 'text') ??
        '';
    }
    const normalizeIncomingMessage = (value: string | null | undefined): string => {
      if (!value) return '';
      const trimmed = value.trim();
      if (trimmed.length <= MAX_SESSION_MESSAGE_LENGTH) return trimmed;
      return trimmed.slice(0, MAX_SESSION_MESSAGE_LENGTH);
    };
    const normalizedMessageText = normalizeIncomingMessage(receivedMessageText);
    const lowerCaseMessageText = normalizedMessageText.toLowerCase();

    console.log(`[DEBUG] Determined Flow Context: ${flowContext}`);
    console.log(`[DEBUG] Determined Session Key Identifier: ${sessionKeyIdentifier}`);

    // 2. Verificação IMEDIATA para PAUSAR O FLUXO por intervenção humana
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

    if (flowContext === 'chatwoot') {
      let payloadToCheck = parsedBody;
      if (Array.isArray(payloadToCheck) && payloadToCheck.length > 0) {
        payloadToCheck = payloadToCheck[0];
      }
      const senderType = getProperty(payloadToCheck, 'sender_type');
      console.log(`[DEBUG Chatwoot Check] Sender Type: ${senderType}`);
      if (senderType === 'User') {
        console.log(`[API Trigger] Human agent (Chatwoot User) message detected in conversation ${sessionKeyIdentifier}. Pausing automation.`);
        return NextResponse.json({ message: "Automation paused due to human intervention." }, { status: 200 });
      }
    }

    // 3. Processar chamadas de retomada de fluxo
    const isApiCallResponse = getProperty(loggedEntry.payload, 'isApiCallResponse') === true;
    const resumeSessionId = getProperty(loggedEntry.payload, 'resume_session_id');

    if (resumeSessionId) {
      console.log(`[API Evolution Trigger] Resume call detected for session ID: ${resumeSessionId}`);
      const sessionToResume = await loadSessionFromDB(resumeSessionId);
      if (sessionToResume) {
        const workspaceForResume = await loadWorkspaceFromDB(sessionToResume.workspace_id);
        if (workspaceForResume && workspaceForResume.nodes) {
          const resumeVarName = normalizeVariableName(sessionToResume.awaiting_input_details?.variableToSave) || 'external_response_data';
          sessionToResume.flow_variables[resumeVarName] = parsedBody;
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
      console.log(`[API Evolution Trigger] No session identifier. Ignoring.`);
      return NextResponse.json({ message: "Webhook logged, but no session identifier found." }, { status: 200 });
    }

    let workspace: WorkspaceData | null = null;
    let session: FlowSession | null = await loadSessionFromDB(sessionKeyIdentifier);
    let startExecution = false;

    if (session) {
      workspace = await loadWorkspaceFromDB(session.workspace_id);
      if (!workspace) {
        console.error(`[API Evolution Trigger] Session ${session.session_id} exists but its workspace ${session.workspace_id} was not found. Deleting orphan session.`);
        await deleteSessionFromDB(session.session_id);
        session = null;
      }

      if (session?.session_timeout_seconds && session.session_timeout_seconds > 0 && session.last_interaction_at) {
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

      // 4. Se a sessão está em um beco sem saída, IGNORAR a nova mensagem
      if (isPausedSession(session)) {
        console.log(`[API Evolution Trigger - ${session.session_id}] Session is in a paused (dead-end) state. Ignoring new message to prevent unwanted restart.`);
        return NextResponse.json({ message: "Flow is paused. New message ignored." }, { status: 200 });
      }

      // Se a sessão está aguardando uma entrada, processe-a
      if (session.awaiting_input_type && session.awaiting_input_details) {
        delete session.flow_variables.__flowPaused; // Limpa o flag
        const responseValue = isApiCallResponse ? parsedBody : normalizedMessageText;
        session.flow_variables.mensagem_whatsapp = isApiCallResponse ? (getProperty(responseValue, 'responseText') || JSON.stringify(responseValue)) : responseValue;

        const originalNodeId = session.awaiting_input_details.originalNodeId;
        const awaitingNode = findNodeById(originalNodeId!, workspace.nodes);

        if (awaitingNode) {
          let nextNodeId: string | null = null;
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
            const targetVarName = normalizeVariableName(session.awaiting_input_details.variableToSave);
            if (targetVarName) {
              setProperty(session.flow_variables, targetVarName, textToSave);
            }
            if (awaitingNode.type === 'intelligent-agent') {
              nextNodeId = awaitingNode.id; // Mantém o agente conversando
            } else {
              nextNodeId = findNextNodeId(awaitingNode.id, 'default', workspace.connections || []);
            }
          } else if (session.awaiting_input_type === 'option' && Array.isArray(session.awaiting_input_details.options)) {
            const options = session.awaiting_input_details.options; // Can be string[] or {id, value}[]

            let chosenOptionId: string | undefined = undefined;
            let chosenOptionText: string | undefined = undefined;

            let valueForOptionMatching = String(responseValue);
            if (isApiCallResponse && awaitingNode.apiResponsePathForValue) {
              const extracted = getProperty(responseValue, awaitingNode.apiResponsePathForValue);
              if (extracted !== undefined) valueForOptionMatching = String(extracted);
            }
            const trimmedReceivedMessage = valueForOptionMatching.trim();

            // Helper to get text from option
            const getOptText = (opt: any) => typeof opt === 'string' ? opt : opt.value;
            const getOptId = (opt: any) => typeof opt === 'string' ? opt : opt.id;

            const normalizedOptionLabels = options.map(opt => getOptText(opt).trim().replace(/^[\[\s,]+|[\],\s]+$/g, '').toLowerCase());
            const aiEnabled = !!session.awaiting_input_details.aiEnabled;
            const aiModelName = session.awaiting_input_details.aiModelName;

            if (aiEnabled) {
              try {
                const intents = options.map((opt: any) => ({
                  id: getOptId(opt),
                  label: getOptText(opt) || 'Option',
                  description: getOptText(opt) || ''
                }));

                const aiResult = await classifyIntent({
                  userMessage: trimmedReceivedMessage,
                  intents: intents,
                  modelName: aiModelName || undefined,
                });

                if (aiResult.matchedIntentId) {
                  const match = options.find((o: any) => getOptId(o) === aiResult.matchedIntentId);
                  if (match) {
                    chosenOptionText = getOptText(match);
                    chosenOptionId = getOptId(match);
                  }
                }
              } catch (error) {
                console.error('[API Evolution Trigger] classifyIntent failed, falling back to rule-based matching.', error);
              }
            }

            if (!chosenOptionId) {
              let isNumberMatch = false;
              if (/^\d+$/.test(trimmedReceivedMessage)) {
                const numericChoice = parseInt(trimmedReceivedMessage, 10);
                if (!isNaN(numericChoice) && numericChoice > 0 && numericChoice <= options.length) {
                  const match = options[numericChoice - 1];
                  chosenOptionText = getOptText(match);
                  chosenOptionId = getOptId(match);
                  isNumberMatch = true;
                }
              }

              if (!isNumberMatch) {
                const cleanedMessage = trimmedReceivedMessage.replace(/^[\[\s,]+|[\],\s]+$/g, '').toLowerCase();
                const matchIndex = normalizedOptionLabels.indexOf(cleanedMessage);
                if (matchIndex >= 0) {
                  const match = options[matchIndex];
                  chosenOptionText = getOptText(match);
                  chosenOptionId = getOptId(match);
                } else {
                  const match = options.find((opt: any) => getOptText(opt).trim().toLowerCase() === cleanedMessage);
                  if (match) {
                    chosenOptionText = getOptText(match);
                    chosenOptionId = getOptId(match);
                  }
                }
              }
            }

            if (chosenOptionId) {
              const targetVarName = normalizeVariableName(session.awaiting_input_details.variableToSave);
              if (targetVarName) {
                setProperty(session.flow_variables, targetVarName, chosenOptionText); // Save the TEXT (human readable)
              }
              // Route using ID (for new nodes) or Text (legacy)
              nextNodeId = findNextNodeId(awaitingNode.id, chosenOptionId, workspace.connections || []);

              // Fallback for legacy connections that might still be using value as handle?
              if (!nextNodeId && chosenOptionId !== chosenOptionText) {
                nextNodeId = findNextNodeId(awaitingNode.id, chosenOptionText!, workspace.connections || []);
              }

              if (!nextNodeId) {
                nextNodeId = findNextNodeId(awaitingNode.id, 'default', workspace.connections || []);
              }
              if (!nextNodeId) {
                const fallbackConn = (workspace.connections || []).find(conn => conn.from === awaitingNode.id);
                nextNodeId = fallbackConn?.to || null;
              }
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
            session.flow_variables.__flowPaused = true;
            await saveSessionToDB(session);
            return NextResponse.json({ message: "Flow paused at dead end." }, { status: 200 });
          }
        } else {
          console.warn(`[API Evolution Trigger - ${session.session_id}] Awaiting node ${originalNodeId} not found, restarting flow.`);
          await deleteSessionFromDB(session.session_id);
          session = null;
        }
      } else { // Se não estava esperando input, reinicia o fluxo
        console.log(`[API Evolution Trigger - ${session.session_id}] New message received in active session not awaiting input. Restarting flow.`);
        await deleteSessionFromDB(session.session_id);
        session = null;
      }
    }

    if (!session) {
      if (isApiCallResponse) {
        console.log(`[API Evolution Trigger] API response received but no active session found for ${sessionKeyIdentifier}. Ignoring.`);
        return NextResponse.json({ message: "API response ignored, no active session." }, { status: 200 });
      }

      let workspaceToStart: WorkspaceData | null = null;
      let startNodeForFlow: NodeData | null = null;
      let matchingTrigger: StartNodeTrigger | null = null;
      let matchingKeyword: string | null = null;

      if (initialWorkspace.organization_id && lowerCaseMessageText) {
        const workspaceIds = await listWorkspaceIdsForOrganization(initialWorkspace.organization_id);
        for (const workspaceId of workspaceIds) {
          const ws =
            workspaceId === initialWorkspace.id
              ? initialWorkspace
              : await loadWorkspaceFromDB(workspaceId);
          if (!ws) continue;
          const startNode = ws.nodes.find(n => n.type === 'start');
          if (startNode?.triggers) {
            for (const trigger of startNode.triggers) {
              if (trigger.type === 'webhook' && trigger.enabled && trigger.keyword) {
                const keywords = trigger.keyword.split(',').map(k => k.trim().toLowerCase());
                const foundKeyword = keywords.find(kw => kw === lowerCaseMessageText);
                if (foundKeyword) {
                  workspaceToStart = ws;
                  startNodeForFlow = startNode;
                  matchingTrigger = trigger;
                  matchingKeyword = foundKeyword;
                  break;
                }
              }
            }
          }
          if (workspaceToStart) break;
        }
      }

      if (!workspaceToStart) {
        workspaceToStart = initialWorkspace;
        startNodeForFlow = workspaceToStart.nodes.find(n => n.type === 'start') || null;
        matchingTrigger = startNodeForFlow?.triggers?.find(t => t.type === 'webhook' && t.enabled) || null;
      }

      if (!startNodeForFlow || !matchingTrigger) {
        console.log(`[API Evolution Trigger] Workspace ${workspaceToStart.name} has no enabled webhook trigger.`);
        return NextResponse.json({ error: `Workspace "${workspaceToStart.name}" has no enabled webhook trigger.` }, { status: 404 });
      }

      const triggerHandle = matchingKeyword || matchingTrigger.name;
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
        mensagem_whatsapp: normalizedMessageText,
        webhook_payload: payloadToUse,
        session_id: sessionKeyIdentifier,
        _triggerHandle: triggerHandle,
      };

      if (flowContext === 'dialogy') {
        setProperty(initialVars, 'dialogy_conversation_id', getProperty(payloadToUse, 'conversation.id'));
        setProperty(initialVars, 'dialogy_contact_id', getProperty(payloadToUse, 'contact.id'));
        setProperty(initialVars, 'dialogy_account_id', getProperty(payloadToUse, 'account.id'));
        setProperty(initialVars, 'contact_name', getProperty(payloadToUse, 'contact.name'));
        setProperty(initialVars, 'contact_phone', getProperty(payloadToUse, 'contact.phone_number'));
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
            const targetVarName = normalizeVariableName(mapping.flowVariable);
            if (value !== undefined && targetVarName) setProperty(initialVars, targetVarName, value);
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
        steps: [],
      };
      workspace = workspaceToStart;
      startExecution = true;
    }

    if (startExecution && session?.current_node_id && workspace) {
      delete session.flow_variables.__flowPaused;
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
