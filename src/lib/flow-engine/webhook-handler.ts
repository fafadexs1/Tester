
'use server';
import { getProperty } from 'dot-prop';
import type { NextRequest } from 'next/server';
import type { FlowContextType } from '@/lib/types';

export async function storeRequestDetails(
  request: NextRequest,
  parsedPayload: any,
  rawBodyText: string | null,
  webhookId: string 
): Promise<any> {
  const currentTimestamp = new Date().toISOString();
  let extractedMessage: string | null = null;
  const headers = Object.fromEntries(request.headers.entries());
  const ip = request.ip || (headers['x-forwarded-for'] as any) || 'unknown IP';

  let sessionKeyIdentifier: string | null = null;
  let flowContext: FlowContextType = 'evolution';

  let actualPayloadToExtractFrom = parsedPayload;
  if (Array.isArray(parsedPayload) && parsedPayload.length > 0 && typeof parsedPayload[0] === 'object') {
    actualPayloadToExtractFrom = parsedPayload[0];
  }

  if (actualPayloadToExtractFrom && typeof actualPayloadToExtractFrom === 'object') {
    const chatwootEvent = getProperty(actualPayloadToExtractFrom, 'event');
    const chatwootContent = getProperty(actualPayloadToExtractFrom, 'content');
    const chatwootConversationId = getProperty(actualPayloadToExtractFrom, 'conversation.id');
    const chatwootMessageType = getProperty(actualPayloadToExtractFrom, 'message_type');
    const evolutionSenderJid = getProperty(actualPayloadToExtractFrom, 'data.key.remoteJid');
    const dialogyEvent = getProperty(actualPayloadToExtractFrom, 'event');
    const dialogyConversationId = getProperty(actualPayloadToExtractFrom, 'conversation.id');

    if (chatwootEvent === 'message_created' && chatwootConversationId && chatwootMessageType === 'incoming') {
      flowContext = 'chatwoot';
      sessionKeyIdentifier = `chatwoot_conv_${chatwootConversationId}`;
      extractedMessage = String(chatwootContent || '').trim();
    } else if (dialogyEvent === 'message.created' && dialogyConversationId) {
      flowContext = 'dialogy';
      sessionKeyIdentifier = `dialogy_conv_${dialogyConversationId}`;
      extractedMessage = getProperty(actualPayloadToExtractFrom, 'message.content', '').trim();
    } else if (evolutionSenderJid) {
      flowContext = 'evolution';
      sessionKeyIdentifier = `evolution_jid_${evolutionSenderJid}`;
      const commonMessagePaths = ['data.message.conversation', 'message.conversation', 'message.body', 'message.textMessage.text', 'text', 'data.message.extendedTextMessage.text'];
      for (const path of commonMessagePaths) {
        const msg = getProperty(actualPayloadToExtractFrom, path);
        if (typeof msg === 'string' && msg.trim() !== '') {
          extractedMessage = msg.trim();
          break;
        }
      }
    }
  }

  const logEntry: Record<string, any> = {
    workspaceId: webhookId,
    type: 'webhook', // Centralized log type
    timestamp: currentTimestamp,
    method: request.method,
    url: request.url,
    headers: headers,
    ip: ip,
    extractedMessage: extractedMessage,
    session_key_identifier: sessionKeyIdentifier,
    flow_context: flowContext,
    payload: parsedPayload || { raw_text: rawBodyText, message: "Payload was not valid JSON or was empty/unreadable" }
  };

  // Dispara um POST para o endpoint central de logs sem aguardar
  fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/evolution/webhook-logs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(logEntry),
  }).catch(e => console.error("[Webhook Handler] Failed to post webhook log:", e));

  return logEntry;
}

    