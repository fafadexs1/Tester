
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getProperty } from 'dot-prop';
import { sendWhatsAppMessageAction } from '@/app/actions/evolutionApiActions';

declare global {
  // eslint-disable-next-line no-var
  var evolutionWebhookLogs: Array<any>;
}

// Robust initialization of global logs variable
if (!globalThis.evolutionWebhookLogs || !Array.isArray(globalThis.evolutionWebhookLogs)) {
  console.log(`[GLOBAL_INIT in webhook/route.ts] Initializing globalThis.evolutionWebhookLogs as new array.`);
  globalThis.evolutionWebhookLogs = [];
} else {
  console.log(`[GLOBAL_INIT in webhook/route.ts] globalThis.evolutionWebhookLogs already exists. Length: ${globalThis.evolutionWebhookLogs.length}`);
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


async function storeRequestDetails(request: NextRequest): Promise<StoredLogEntry | null> {
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
  let parsedBodyForExtraction: any = null; // To store the parsed JSON if successful

  if (method !== 'GET' && method !== 'HEAD') {
    try {
      console.log(`[Evolution API Webhook Store] Attempting to read request body as text for ${method}...`);
      bodyAsText = await request.text();

      if (bodyAsText && bodyAsText.trim() !== '') {
        console.log(`[Evolution API Webhook Store] Successfully read body as text. Length: ${bodyAsText.length}. Preview: ${bodyAsText.substring(0, 200)}`);
        if (contentType && (contentType.includes('application/json') || contentType.includes('application/x-www-form-urlencoded'))) {
          try {
            if (contentType.includes('application/json')) {
              parsedBodyForExtraction = JSON.parse(bodyAsText);
              payload = parsedBodyForExtraction; // Use parsed body for the main payload
              console.log(`[Evolution API Webhook Store] Parsed JSON payload for ${method}.`);
            } else {
              payload = { raw_text_form_urlencoded: bodyAsText, original_content_type: contentType };
              // For form-urlencoded, we might still want to try extracting from a known structure if it's common
              // but generally, it's less structured than JSON. For now, we keep it simple.
              // If specific form fields were expected, one could parse bodyAsText with URLSearchParams.
              console.log(`[Evolution API Webhook Store] Stored form-urlencoded payload as raw_text for ${method}.`);
            }
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

  // Try to extract message and remoteJid if we have a parsed JSON body
  if (parsedBodyForExtraction && typeof parsedBodyForExtraction === 'object') {
    const commonMessagePaths = [
      'data.message.conversation',
      'message.body',
      'message.message.conversation',
      'body.textMessage.text',
      'text',
      'data.message.extendedTextMessage.text',
    ];
    for (const path of commonMessagePaths) {
      const msg = getProperty(parsedBodyForExtraction, path);
      if (typeof msg === 'string' && msg.trim() !== '') {
        extractedMessage = msg.trim();
        console.log(`[Evolution API Webhook Store] Extracted message using path "${path}": "${extractedMessage}"`);
        break;
      }
    }
    if (!extractedMessage) {
      console.log(`[Evolution API Webhook Store] Could not extract a simple text message from common JSON paths.`);
    }

    const remoteJidPath1 = 'data.key.remoteJid';
    const remoteJidPath2 = 'sender';
    let jid = getProperty(parsedBodyForExtraction, remoteJidPath1);
    if (typeof jid === 'string' && jid.trim() !== '') {
      webhookRemoteJid = jid.trim();
      console.log(`[Evolution API Webhook Store] Extracted remoteJid using path "${remoteJidPath1}": "${webhookRemoteJid}"`);
    } else {
      jid = getProperty(parsedBodyForExtraction, remoteJidPath2);
      if (typeof jid === 'string' && jid.trim() !== '') {
        webhookRemoteJid = jid.trim();
        console.log(`[Evolution API Webhook Store] Extracted remoteJid using path "${remoteJidPath2}": "${webhookRemoteJid}"`);
      }
    }
    if (!webhookRemoteJid) {
      console.log(`[Evolution API Webhook Store] Could not extract remoteJid from common JSON paths.`);
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
  };

  if (extractedMessage) {
    logEntry.extractedMessage = extractedMessage;
  }
  if (webhookRemoteJid) {
    logEntry.webhook_remoteJid = webhookRemoteJid;
  }
  
  console.log(`[Evolution API Webhook Store] BEFORE UNSHIFT: Current globalThis.evolutionWebhookLogs length: ${globalThis.evolutionWebhookLogs?.length}. Type: ${typeof globalThis.evolutionWebhookLogs}. IsArray: ${Array.isArray(globalThis.evolutionWebhookLogs)}`);
  if (!Array.isArray(globalThis.evolutionWebhookLogs)) {
    console.warn('[Evolution API Webhook Store] globalThis.evolutionWebhookLogs is not an array before unshift! Re-initializing.');
    globalThis.evolutionWebhookLogs = [];
  }

  globalThis.evolutionWebhookLogs.unshift(logEntry);
  console.log(`[Evolution API Webhook Store] AFTER UNSHIFT: New globalThis.evolutionWebhookLogs length: ${globalThis.evolutionWebhookLogs.length}. Entry for: ${logEntry.timestamp}, Extracted Msg: ${logEntry.extractedMessage || 'N/A'}, RemoteJID: ${logEntry.webhook_remoteJid || 'N/A'}`);


  if (globalThis.evolutionWebhookLogs.length > MAX_LOG_ENTRIES) {
    const popped = globalThis.evolutionWebhookLogs.pop();
    console.log(`[Evolution API Webhook Store] Popped oldest log entry (timestamp: ${popped?.timestamp}). Logs count: ${globalThis.evolutionWebhookLogs.length}`);
  }
  console.log(`[Evolution API Webhook Store EXIT] Request logged. Total logs in global store: ${globalThis.evolutionWebhookLogs.length}`);
  return logEntry; // Return the processed log entry
}

export async function POST(request: NextRequest) {
  console.log('[Evolution API Webhook Route] POST request received.');
  const loggedEntry = await storeRequestDetails(request);

  if (loggedEntry && loggedEntry.payload && typeof loggedEntry.payload === 'object') {
    const webhookBody = loggedEntry.payload; // This is the parsed JSON body if successful

    const instance = webhookBody.instance as string;
    const senderJid = loggedEntry.webhook_remoteJid as string; // Use the extracted one
    const receivedMessageText = loggedEntry.extractedMessage as string; // Use the extracted one
    const evolutionApiBaseUrl = webhookBody.server_url as string;
    const evolutionApiKey = webhookBody.apikey as string;

    if (webhookBody.event === 'messages.upsert' && receivedMessageText && senderJid && instance && evolutionApiBaseUrl) {
      console.log(`[Evolution API Webhook Route] messages.upsert event detected. Attempting to send reply.`);
      console.log(`[Evolution API Webhook Route] Details for reply: instance='${instance}', senderJid='${senderJid}', receivedMessage='${receivedMessageText}', baseUrl='${evolutionApiBaseUrl}', apiKeyExists='${!!evolutionApiKey}'`);
      
      const replyText = `Webhook recebido! Você disse: '${receivedMessageText}'`;

      try {
        const sendResult = await sendWhatsAppMessageAction({
          baseUrl: evolutionApiBaseUrl,
          apiKey: evolutionApiKey || undefined, // Pass undefined if not present
          instanceName: instance,
          recipientPhoneNumber: senderJid,
          messageType: 'text',
          textContent: replyText,
        });

        if (sendResult.success) {
          console.log(`[Evolution API Webhook Route] Successfully sent reply to ${senderJid}: ${replyText}. API Response:`, sendResult.data);
        } else {
          console.error(`[Evolution API Webhook Route] Failed to send reply to ${senderJid}. Error: ${sendResult.error}. API Response:`, sendResult.data);
        }
      } catch (error: any) {
        console.error(`[Evolution API Webhook Route] Exception while trying to send reply to ${senderJid}:`, error);
      }
       // TODO: Aqui seria o local para adicionar a lógica de backend para:
      // 1. Identificar o Flowise Lite Workspace/Flow para esta 'instance' ou 'senderId'.
      // 2. Carregar ou criar um estado de conversa (session) para este 'senderId'.
      // 3. Injetar 'extractedMessage', 'senderId', 'messageTimestamp' nas variáveis da sessão.
      // 4. Acionar o motor de fluxo para processar o nó atual da sessão ou o gatilho de início configurado.
      // 5. Se o fluxo gerar uma resposta, usar evolutionApiActions.ts para enviá-la de volta.
    } else {
        console.log(`[Evolution API Webhook Route] POST request logged, but not a 'messages.upsert' event with all necessary data for auto-reply. Instance: ${instance}, Sender: ${senderJid}, Message: ${receivedMessageText}, BaseURL: ${evolutionApiBaseUrl}`);
    }
  } else {
    console.log('[Evolution API Webhook Route] POST request logged, but payload was not suitable for auto-reply logic.');
  }


  return NextResponse.json({ status: "received", message: "Webhook POST event logged." }, { status: 200 });
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

export async function GET(request: NextRequest) {
  const logEventParam = request.nextUrl.searchParams.get('logEvent');

  if (logEventParam === 'true') {
    console.log('[Evolution API Webhook Route] GET request received (logEvent=true).');
    await storeRequestDetails(request); // Loga o evento GET
    return NextResponse.json(
      {
        status: "received_and_logged",
        message: "Webhook GET event logged as per 'logEvent=true' query parameter.",
      },
      { status: 200 }
    );
  }

  // Resposta informativa padrão para GET
  console.log('[Evolution API Webhook Route] GET request received (informative).');
  return NextResponse.json(
    {
      message: "Flowise Lite Webhook Endpoint for Evolution API.",
      note: "This endpoint is configured to receive events (typically via POST) from your Evolution API instance. Received events are logged to the server console and stored in-memory for viewing in the 'Console' section of the Flowise Lite application.",
      testInstructions: "To test, configure your Evolution API to send webhooks (e.g., POST requests with JSON payloads) to this URL. You can also send PUT, PATCH, DELETE requests directly to see them logged. Use the 'logEvent=true' query parameter with a GET request if you want to log it as an event (useful for simple browser tests)."
    },
    { status: 200 }
  );
}
