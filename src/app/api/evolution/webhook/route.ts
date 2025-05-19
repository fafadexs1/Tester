
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getProperty } from 'dot-prop';

declare global {
  // eslint-disable-next-line no-var
  var evolutionWebhookLogs: Array<any>; // Tornar não opcional após a inicialização
}

// Inicialização robusta da variável global de logs
if (!globalThis.evolutionWebhookLogs || !Array.isArray(globalThis.evolutionWebhookLogs)) {
  console.log(`[GLOBAL_INIT in webhook/route.ts] Initializing globalThis.evolutionWebhookLogs as new array.`);
  globalThis.evolutionWebhookLogs = [];
} else {
  console.log(`[GLOBAL_INIT in webhook/route.ts] globalThis.evolutionWebhookLogs already exists. Length: ${globalThis.evolutionWebhookLogs.length}`);
}

const MAX_LOG_ENTRIES = 50;

async function storeRequestDetails(request: NextRequest) {
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

  if (method !== 'GET' && method !== 'HEAD') {
    try {
      console.log(`[Evolution API Webhook Store] Attempting to read request body as text for ${method}...`);
      bodyAsText = await request.text(); 

      if (bodyAsText && bodyAsText.trim() !== '') {
        console.log(`[Evolution API Webhook Store] Successfully read body as text. Length: ${bodyAsText.length}. Preview: ${bodyAsText.substring(0,200)}`);
        if (contentType && (contentType.includes('application/json') || contentType.includes('application/x-www-form-urlencoded'))) { // Added urlencoded
          try {
            // Para application/x-www-form-urlencoded, o corpo já é texto, não precisa parsear como JSON direto
            // Se for JSON, parseamos. Se não, usamos o texto como está ou um objeto indicando que não é JSON.
            if (contentType.includes('application/json')) {
                payload = JSON.parse(bodyAsText);
                console.log(`[Evolution API Webhook Store] Parsed JSON payload for ${method}.`);
            } else {
                // Se for form-urlencoded, bodyAsText é a string do form. Poderíamos parseá-la,
                // mas para logging genérico, manter como texto é aceitável.
                // Ou, se você quiser sempre um objeto:
                payload = { raw_text_form_urlencoded: bodyAsText, original_content_type: contentType };
                console.log(`[Evolution API Webhook Store] Stored form-urlencoded payload as raw_text for ${method}.`);
            }
            
            // Tentar extrair a mensagem de caminhos comuns, mesmo que o payload principal não seja JSON
            let tempPayloadForExtraction = payload;
            if (contentType.includes('application/json')) { // Só tenta extrair de JSON
                const commonMessagePaths = [
                  'data.message.conversation',
                  'message.body', 
                  'message.message.conversation',
                  'body.textMessage.text', 
                  'text',
                  'data.message.extendedTextMessage.text' // Adicionado
                ];
                for (const path of commonMessagePaths) {
                  const msg = getProperty(tempPayloadForExtraction, path);
                  if (typeof msg === 'string' && msg.trim() !== '') {
                    extractedMessage = msg.trim();
                    console.log(`[Evolution API Webhook Store] Extracted message using path "${path}": "${extractedMessage}"`);
                    break;
                  }
                }
                if (!extractedMessage) {
                  console.log(`[Evolution API Webhook Store] Could not extract a simple text message from common JSON paths.`);
                }

                // Tentar extrair remoteJid
                const remoteJidPath1 = 'data.key.remoteJid';
                const remoteJidPath2 = 'sender';
                let jid = getProperty(tempPayloadForExtraction, remoteJidPath1);
                if (typeof jid === 'string' && jid.trim() !== '') {
                    webhookRemoteJid = jid.trim();
                    console.log(`[Evolution API Webhook Store] Extracted remoteJid using path "${remoteJidPath1}": "${webhookRemoteJid}"`);
                } else {
                    jid = getProperty(tempPayloadForExtraction, remoteJidPath2);
                    if (typeof jid === 'string' && jid.trim() !== '') {
                        webhookRemoteJid = jid.trim();
                        console.log(`[Evolution API Webhook Store] Extracted remoteJid using path "${remoteJidPath2}": "${webhookRemoteJid}"`);
                    }
                }
                 if (!webhookRemoteJid) {
                  console.log(`[Evolution API Webhook Store] Could not extract remoteJid from common JSON paths.`);
                }
            }

          } catch (jsonError: any) {
            console.warn(`[Evolution API Webhook Store] Failed to parse body as JSON for ${method}, storing as raw text. Error: ${jsonError.message}.`);
            payload = { raw_text: bodyAsText, parse_error: jsonError.message, original_content_type: contentType };
          }
        } else { // Não é JSON nem form-urlencoded, ou contentType não especificado
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

  const logEntry: any = {
    timestamp: currentTimestamp,
    method: method,
    url: url,
    headers: headers,
    payload: payload, // Payload pode ser objeto JSON ou objeto {raw_text: ...}
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
}

export async function POST(request: NextRequest) {
  console.log('[Evolution API Webhook Route] POST request received.');
  await storeRequestDetails(request);
  // TODO: Aqui seria o local para adicionar a lógica de backend para:
  // 1. Identificar o Flowise Lite Workspace/Flow para esta 'instance' ou 'senderId'.
  // 2. Carregar ou criar um estado de conversa (session) para este 'senderId'.
  // 3. Injetar 'extractedMessage', 'senderId', 'messageTimestamp' nas variáveis da sessão.
  // 4. Acionar o motor de fluxo para processar o nó atual da sessão ou o gatilho de início configurado.
  // 5. Se o fluxo gerar uma resposta, usar evolutionApiActions.ts para enviá-la de volta.
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
  // Para permitir que um GET também seja logado, se necessário para testes, mas não por padrão
  if (request.nextUrl.searchParams.get('logEvent') === 'true') {
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

    