
'use server';
import { getProperty } from 'dot-prop';
import type { NextRequest } from 'next/server';
import type { FlowContextType, FlowLog } from '@/lib/types';
import { saveFlowLog } from '@/app/actions/databaseActions';

const IMPORTANT_HEADER_KEYS = new Set([
  'content-type',
  'user-agent',
  'x-forwarded-for',
  'x-real-ip',
  'cf-connecting-ip',
  'x-request-id',
]);

const MAX_LOG_PAYLOAD_CHARS = 20000;

const FALLBACK_PAYLOAD_MESSAGE =
  'Payload indisponível ou não pôde ser serializado. Consulte os logs de origem para detalhes.';

function filterHeadersForLog(headers: Record<string, string>): Record<string, string> {
  const filteredEntries = Object.entries(headers).filter(([key]) =>
    IMPORTANT_HEADER_KEYS.has(key.toLowerCase())
  );
  if (filteredEntries.length > 0) {
    return Object.fromEntries(filteredEntries);
  }
  return Object.fromEntries(Object.entries(headers).slice(0, 6));
}

function buildPayloadSnapshot(payload: any, rawBodyText: string | null): any {
  if (payload && typeof payload === 'object') {
    try {
      const serialized = JSON.stringify(payload);
      if (serialized.length <= MAX_LOG_PAYLOAD_CHARS) {
        return payload;
      }
      return {
        truncated: true,
        preview: serialized.slice(0, MAX_LOG_PAYLOAD_CHARS),
        totalLength: serialized.length,
      };
    } catch (error) {
      console.warn('[Webhook Handler] Failed to serialize payload for logging:', error);
    }
  }

  if (rawBodyText && rawBodyText.length > 0) {
    return rawBodyText.length <= MAX_LOG_PAYLOAD_CHARS
      ? rawBodyText
      : `${rawBodyText.slice(0, MAX_LOG_PAYLOAD_CHARS)}…`;
  }

  return { message: FALLBACK_PAYLOAD_MESSAGE };
}

export async function storeRequestDetails(
  request: NextRequest,
  parsedPayload: any,
  rawBodyText: string | null,
  webhookId: string,
  workspaceExists: boolean
): Promise<any> {
  const currentTimestamp = new Date().toISOString();
  let extractedMessage: string | null = null;
  const headers = Object.fromEntries(request.headers.entries());
  const headersForLog = filterHeadersForLog(headers);
  const ip = (request as any).ip || (headers['x-forwarded-for'] as any) || 'unknown IP';

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
    const evolutionSenderJid = getProperty(actualPayloadToExtractFrom, 'data.key.remoteJid') || getProperty(actualPayloadToExtractFrom, 'sender.identifier');
    const dialogyEvent = getProperty(actualPayloadToExtractFrom, 'event');
    const dialogyConversationId = getProperty(actualPayloadToExtractFrom, 'conversation.id');

    if (chatwootEvent === 'message_created' && chatwootConversationId && chatwootMessageType === 'incoming') {
      flowContext = 'chatwoot';
      sessionKeyIdentifier = `chatwoot_conv_${chatwootConversationId}`;
      extractedMessage = String(chatwootContent || '').trim();
    } else if (dialogyEvent === 'message.created' && dialogyConversationId) {
      flowContext = 'dialogy';
      sessionKeyIdentifier = `dialogy_conv_${dialogyConversationId}`;
      extractedMessage = String(getProperty(actualPayloadToExtractFrom, 'message.content', '') || '').trim();
    } else if (evolutionSenderJid) {
      flowContext = 'evolution';
      sessionKeyIdentifier = `evolution_jid_${evolutionSenderJid}`;
      const commonMessagePaths = ['data.message.conversation', 'message.conversation', 'message.body', 'message.textMessage.text', 'text', 'data.message.extendedTextMessage.text'];
      for (const path of commonMessagePaths) {
        const msg = getProperty(actualPayloadToExtractFrom, path) as string | undefined;
        if (typeof msg === 'string' && msg.trim() !== '') {
          extractedMessage = msg.trim();
          break;
        }
      }
    }
  }

  console.log(`[Webhook Handler] Determined flowContext: "${flowContext}"`);

  const payloadForProcessing =
    parsedPayload || { raw_text: rawBodyText, message: 'Payload was not valid JSON or was empty/unreadable' };
  const payloadSnapshotForLog = buildPayloadSnapshot(parsedPayload, rawBodyText);

  if (workspaceExists) {
    const logEntry: Omit<FlowLog, 'id'> = {
      workspace_id: webhookId,
      log_type: 'webhook',
      session_id: sessionKeyIdentifier,
      timestamp: currentTimestamp,
      details: {
        method: request.method,
        url: request.url,
        headers: headersForLog,
        ip: ip,
        extractedMessage: extractedMessage,
        flowContext: flowContext,
        payload: payloadSnapshotForLog
      }
    };

    try {
      await saveFlowLog(logEntry);
    } catch (e) {
      console.error("[Webhook Handler] Failed to save webhook log to DB:", e);
    }
  } else {
    console.warn(`[Webhook Handler] Workspace with ID "${webhookId}" not found. Skipping log save.`);
  }

  return {
    method: request.method,
    url: request.url,
    headers: headersForLog,
    ip: ip,
    extractedMessage: extractedMessage,
    flowContext: flowContext,
    payload: payloadForProcessing,
    session_key_identifier: sessionKeyIdentifier,
  };
}
