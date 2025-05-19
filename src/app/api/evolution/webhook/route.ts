
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getProperty } from 'dot-prop';
import { sendWhatsAppMessageAction } from '@/app/actions/evolutionApiActions';
import { simpleChatReply, UserMessageInput } from '@/ai/flows/simple-chat-reply-flow';

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
  let parsedBodyForExtraction: any = null; 

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
              payload = parsedBodyForExtraction; 
              console.log(`[Evolution API Webhook Store] Parsed JSON payload for ${method}.`);
            } else {
              payload = { raw_text_form_urlencoded: bodyAsText, original_content_type: contentType };
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

  if (parsedBodyForExtraction && typeof parsedBodyForExtraction === 'object') {
    let actualPayloadToExtractFrom = parsedBodyForExtraction;
    if (Array.isArray(parsedBodyForExtraction) && parsedBodyForExtraction.length === 1 && typeof parsedBodyForExtraction[0] === 'object') {
      actualPayloadToExtractFrom = parsedBodyForExtraction[0];
      console.log('[Evolution API Webhook Store] Payload is an array with one object, using the inner object for extraction.');
    }

    const commonMessagePaths = [
      'data.message.conversation', 'message.body', 'message.message.conversation',
      'textMessage.text', 'text', 'data.message.extendedTextMessage.text',
      'body.data.message.conversation', // For array-wrapped payloads
      'body.message.body',
      'body.data.message.extendedTextMessage.text',
    ];
    for (const path of commonMessagePaths) {
      const msg = getProperty(actualPayloadToExtractFrom, path);
      if (typeof msg === 'string' && msg.trim() !== '') {
        extractedMessage = msg.trim();
        console.log(`[Evolution API Webhook Store] Extracted message using path "${path}" from actualPayload: "${extractedMessage}"`);
        break;
      }
    }
    if (!extractedMessage) {
      console.log(`[Evolution API Webhook Store] Could not extract a simple text message from common JSON paths in actualPayload.`);
    }

    const remoteJidPaths = [
      'data.key.remoteJid', 'sender',
      'body.data.key.remoteJid', // For array-wrapped payloads
      'body.sender'
    ];
    for (const path of remoteJidPaths) {
      const jid = getProperty(actualPayloadToExtractFrom, path);
      if (typeof jid === 'string' && jid.trim() !== '') {
        webhookRemoteJid = jid.trim();
        console.log(`[Evolution API Webhook Store] Extracted remoteJid using path "${path}" from actualPayload: "${webhookRemoteJid}"`);
        break;
      }
    }
    if (!webhookRemoteJid) {
      console.log(`[Evolution API Webhook Store] Could not extract remoteJid from common JSON paths in actualPayload.`);
    }
  }


  const logEntry: StoredLogEntry = {
    timestamp: currentTimestamp,
    method: method,
    url: url,
    headers: headers,
    payload: payload, // Store the original parsed payload
    ip: ip,
    geo: geo,
  };

  if (extractedMessage) {
    logEntry.extractedMessage = extractedMessage;
  }
  if (webhookRemoteJid) {
    logEntry.webhook_remoteJid = webhookRemoteJid;
  }
  
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
  return logEntry; 
}

export async function POST(request: NextRequest) {
  console.log('[Evolution API Webhook Route] POST request received.');
  
  // Clone the request to safely read the body for debugging, then pass original to storeRequestDetails
  const requestCloneForDebug = request.clone();
  try {
    const bodyTextDebug = await requestCloneForDebug.text();
    console.log('[Evolution API Webhook Route - DEBUG] Raw body in POST handler:', bodyTextDebug.substring(0, 500) + (bodyTextDebug.length > 500 ? '...' : ''));
  } catch (e: any) {
    console.error('[Evolution API Webhook Route - DEBUG] Error reading raw body in POST handler:', e.message);
  }

  const loggedEntry = await storeRequestDetails(request);

  if (loggedEntry && loggedEntry.payload && typeof loggedEntry.payload === 'object') {
    // Use the *original* parsed payload from loggedEntry for further processing
    const webhookPayload = loggedEntry.payload; 
    let actualPayload = webhookPayload;
    if (Array.isArray(webhookPayload) && webhookPayload.length === 1 && typeof webhookPayload[0] === 'object') {
      actualPayload = webhookPayload[0]; // Use the inner object if payload is an array of one
    }

    const eventType = getProperty(actualPayload, 'event') as string;
    const instance = getProperty(actualPayload, 'instance') as string;
    const senderJid = loggedEntry.webhook_remoteJid as string; // Use the JID extracted by storeRequestDetails
    const receivedMessageText = loggedEntry.extractedMessage as string; // Use the message extracted by storeRequestDetails
    const evolutionApiBaseUrl = getProperty(actualPayload, 'server_url') as string;
    const evolutionApiKey = getProperty(actualPayload, 'apikey') as string;

    console.log(`[Evolution API Webhook Route] Parsed data: event='${eventType}', instance='${instance}', senderJid='${senderJid}', receivedMessage='${receivedMessageText}', baseUrl='${evolutionApiBaseUrl}', apiKeyExists='${!!evolutionApiKey}'`);

    if (eventType === 'messages.upsert' && receivedMessageText && senderJid && instance && evolutionApiBaseUrl) {
      console.log(`[Evolution API Webhook Route] 'messages.upsert' event detected with required data. Attempting to get AI reply.`);
      
      try {
        const aiInput: UserMessageInput = { userMessage: receivedMessageText };
        console.log('[Evolution API Webhook Route] Calling simpleChatReply with input:', aiInput);
        const aiResponse = await simpleChatReply(aiInput);
        const replyText = aiResponse.botReply;
        console.log('[Evolution API Webhook Route] AI Reply received:', replyText);

        if (replyText) {
          const sendResult = await sendWhatsAppMessageAction({
            baseUrl: evolutionApiBaseUrl,
            apiKey: evolutionApiKey || undefined,
            instanceName: instance,
            recipientPhoneNumber: senderJid,
            messageType: 'text',
            textContent: replyText,
          });

          if (sendResult.success) {
            console.log(`[Evolution API Webhook Route] Successfully sent AI reply to ${senderJid}: ${replyText}. API Response:`, sendResult.data);
          } else {
            console.error(`[Evolution API Webhook Route] Failed to send AI reply to ${senderJid}. Error: ${sendResult.error}. API Response:`, sendResult.data);
          }
        } else {
          console.warn('[Evolution API Webhook Route] AI did not provide a reply. No message sent.');
        }
      } catch (error: any) {
        console.error(`[Evolution API Webhook Route] Exception while trying to get AI reply or send message to ${senderJid}:`, error);
      }
       // TODO: Aqui seria o local para adicionar a lógica de backend mais avançada para:
      // 1. Identificar o Flowise Lite Workspace/Flow para esta 'instance' ou 'senderId' (talvez via config global).
      // 2. Carregar ou criar um estado de conversa (session) para este 'senderId'.
      // 3. Injetar 'extractedMessage', 'senderId', etc. nas variáveis da sessão do fluxo.
      // 4. Acionar o motor de fluxo REAL para processar o nó atual da sessão ou o gatilho de início configurado.
      // 5. Se o fluxo gerar uma resposta, usar evolutionApiActions.ts para enviá-la de volta.
    } else {
        console.log(`[Evolution API Webhook Route] POST request logged, but not a 'messages.upsert' event or missing necessary data for AI auto-reply. Event: ${eventType}, Instance: ${instance}, Sender: ${senderJid}, Message: ${receivedMessageText}, BaseURL: ${evolutionApiBaseUrl}`);
    }
  } else {
    console.log('[Evolution API Webhook Route] POST request logged, but payload was not suitable for AI auto-reply logic (not an object or processing error).');
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
    await storeRequestDetails(request); 
    return NextResponse.json(
      {
        status: "received_and_logged",
        message: "Webhook GET event logged as per 'logEvent=true' query parameter.",
      },
      { status: 200 }
    );
  }

  console.log('[Evolution API Webhook Route] GET request received (informative).');
  return NextResponse.json(
    {
      message: "Flowise Lite Webhook Endpoint for Evolution API.",
      note: "This endpoint is configured to receive events (typically via POST) from your Evolution API instance. Received events are logged to the server console and stored in-memory for viewing in the 'Console' section of the Flowise Lite application. It will also attempt a simple AI-generated reply to 'messages.upsert' events.",
      testInstructions: "To test, configure your Evolution API to send webhooks (e.g., POST requests with JSON payloads for 'messages.upsert') to this URL. You can also send PUT, PATCH, DELETE requests directly to see them logged. Use the 'logEvent=true' query parameter with a GET request if you want to log it as an event."
    },
    { status: 200 }
  );
}

