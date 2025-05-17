
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getProperty } from 'dot-prop'; // Para facilitar o acesso a caminhos aninhados no JSON

// In-memory store for webhook logs
declare global {
  // eslint-disable-next-line no-var
  var evolutionWebhookLogs: Array<any> | undefined;
}

// Initialize if not already present. This should happen once when the module is loaded.
if (global.evolutionWebhookLogs === undefined) {
  console.log('[Evolution API Webhook Route] Initializing global.evolutionWebhookLogs');
  global.evolutionWebhookLogs = [];
}

const MAX_LOG_ENTRIES = 50; // You can adjust this limit

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

  if (method !== 'GET' && method !== 'HEAD') {
    try {
      console.log(`[Evolution API Webhook Store] Attempting to read request body as text for ${method}...`);
      bodyAsText = await request.text(); 

      if (bodyAsText && bodyAsText.trim() !== '') {
        console.log(`[Evolution API Webhook Store] Successfully read body as text. Length: ${bodyAsText.length}.`);
        if (contentType && contentType.includes('application/json')) {
          try {
            payload = JSON.parse(bodyAsText); 
            console.log(`[Evolution API Webhook Store] Parsed JSON payload for ${method}.`);

            // Tentar extrair a mensagem de caminhos comuns
            const commonMessagePaths = [
              'data.message.conversation',
              'data.message.extendedTextMessage.text',
              'message.body', // Formato comum da API Evolution
              'message.message.conversation', // Outro formato possível
              'body.textMessage.text', // Evolution API sendText
              'text' // Simples chave 'text'
            ];
            for (const path of commonMessagePaths) {
              const msg = getProperty(payload, path);
              if (typeof msg === 'string' && msg.trim() !== '') {
                extractedMessage = msg.trim();
                console.log(`[Evolution API Webhook Store] Extracted message using path "${path}": "${extractedMessage}"`);
                break;
              }
            }
            if (!extractedMessage) {
              console.log(`[Evolution API Webhook Store] Could not extract a simple text message from common paths.`);
            }

          } catch (jsonError: any) {
            console.warn(`[Evolution API Webhook Store] Failed to parse body as JSON for ${method}, storing as raw text. Error: ${jsonError.message}.`);
            payload = { raw_text: bodyAsText, parse_error: jsonError.message, original_content_type: contentType };
          }
        } else {
          payload = { raw_text: bodyAsText, original_content_type: contentType || 'N/A' };
          console.log(`[Evolution API Webhook Store] Stored non-JSON payload as raw_text for ${method}.`);
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
    payload: payload,
    ip: ip,
    geo: geo,
  };

  if (extractedMessage) {
    logEntry.extractedMessage = extractedMessage;
  }

  if (!Array.isArray(global.evolutionWebhookLogs)) {
    console.warn('[Evolution API Webhook Store] global.evolutionWebhookLogs was not an array. Re-initializing.');
    global.evolutionWebhookLogs = [];
  }
  
  console.log(`[Evolution API Webhook Store] Current logs count BEFORE unshift: ${global.evolutionWebhookLogs.length}`);
  global.evolutionWebhookLogs.unshift(logEntry); 
  console.log(`[Evolution API Webhook Store] Log entry unshifted. New logs count: ${global.evolutionWebhookLogs.length}. Extracted Msg: ${extractedMessage || 'N/A'}`);

  if (global.evolutionWebhookLogs.length > MAX_LOG_ENTRIES) {
    global.evolutionWebhookLogs.pop(); 
    console.log(`[Evolution API Webhook Store] Popped oldest log entry. Logs count: ${global.evolutionWebhookLogs.length}`);
  }
  console.log(`[Evolution API Webhook Store EXIT] Request logged. Total logs in global store: ${global.evolutionWebhookLogs.length}`);
}

export async function POST(request: NextRequest) {
  await storeRequestDetails(request);
  return NextResponse.json({ status: "received", message: "Webhook POST event logged." }, { status: 200 });
}

export async function PUT(request: NextRequest) {
  await storeRequestDetails(request);
  return NextResponse.json({ status: "received", message: "Webhook PUT event logged." }, { status: 200 });
}

export async function PATCH(request: NextRequest) {
  await storeRequestDetails(request);
  return NextResponse.json({ status: "received", message: "Webhook PATCH event logged." }, { status: 200 });
}

export async function DELETE(request: NextRequest) {
  await storeRequestDetails(request);
  return NextResponse.json({ status: "received", message: "Webhook DELETE event logged." }, { status: 200 });
}

export async function GET(request: NextRequest) {
  if (request.nextUrl.searchParams.get('logEvent') === 'true') {
      await storeRequestDetails(request);
      return NextResponse.json(
        {
          status: "received_and_logged",
          message: "Webhook GET event logged as per 'logEvent=true' query parameter.",
        },
        { status: 200 }
      );
  }
  
  return NextResponse.json(
    {
      message: "Flowise Lite Webhook Endpoint for Evolution API.",
      note: "This endpoint is configured to receive events (typically via POST) from your Evolution API instance. Received events are logged and can be viewed in the 'Console' section of the Flowise Lite application.",
      testInstructions: "To test, configure your Evolution API to send webhooks to this URL. You can also send POST, PUT, PATCH, DELETE requests directly. Use 'logEvent=true' query param with GET to log a GET request as an event."
    },
    { status: 200 }
  );
}

