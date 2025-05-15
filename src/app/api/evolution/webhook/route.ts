
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// In-memory store for webhook logs
// Ensure this is declared in a way that persists across requests in a dev server context
// For serverless, this would reset on each invocation. For dev, `global` can work.
declare global {
  // eslint-disable-next-line no-var
  var evolutionWebhookLogs: Array<any> | undefined;
}
if (!global.evolutionWebhookLogs) {
  global.evolutionWebhookLogs = [];
}

const MAX_LOG_ENTRIES = 50; // Limit the number of logs stored in memory

async function logRequestDetails(request: NextRequest) {
  console.log(`[Evolution API Webhook] Received a ${request.method} request.`);

  let payload: any;
  const contentType = request.headers.get('content-type');
  let bodyAttempted = false;

  try {
    if (request.method !== 'GET' && request.method !== 'HEAD') { // Methods that might have a body
      bodyAttempted = true;
      if (contentType && contentType.includes('application/json')) {
        payload = await request.json();
        console.log(`[Evolution API Webhook] Received JSON payload:`, JSON.stringify(payload, null, 2));
      } else {
        const textPayload = await request.text();
        payload = { raw_text: textPayload, received_at_text_parse: new Date().toISOString() };
        console.log(`[Evolution API Webhook] Received non-JSON payload (logged as raw_text):`, textPayload);
      }
    } else {
      payload = { message: `No body expected for ${request.method} request.` };
    }
  } catch (error: any) {
    console.error(`[Evolution API Webhook] Error processing request body for ${request.method}:`, error.message);
    if (bodyAttempted) {
        try {
            const rawBody = await request.text(); 
            console.error('[Evolution API Webhook] Raw request body (on error):', rawBody);
            payload = { error_parsing_body: error.message, raw_body_on_error: rawBody };
        } catch (textError) {
            console.error('[Evolution API Webhook] Could not read raw request body on error.');
            payload = { error_parsing_body: error.message, could_not_read_raw_body: true };
        }
    } else {
        payload = { error_processing_request: error.message };
    }
  }

  // Store the log with a timestamp, method, headers, and payload
  const logEntry = {
    timestamp: new Date().toISOString(),
    method: request.method,
    url: request.url,
    headers: Object.fromEntries(request.headers.entries()),
    payload: payload,
  };

  if (!global.evolutionWebhookLogs) { // defensive check
    global.evolutionWebhookLogs = [];
  }

  global.evolutionWebhookLogs.unshift(logEntry); // Add to the beginning
  if (global.evolutionWebhookLogs.length > MAX_LOG_ENTRIES) {
    global.evolutionWebhookLogs.pop(); // Remove the oldest if limit exceeded
  }
}

export async function POST(request: NextRequest) {
  await logRequestDetails(request);
  return NextResponse.json(
    { status: "received", message: `Webhook POST event logged.` },
    { status: 200 }
  );
}

export async function PUT(request: NextRequest) {
  await logRequestDetails(request);
  return NextResponse.json(
    { status: "received", message: `Webhook PUT event logged.` },
    { status: 200 }
  );
}

export async function PATCH(request: NextRequest) {
  await logRequestDetails(request);
  return NextResponse.json(
    { status: "received", message: `Webhook PATCH event logged.` },
    { status: 200 }
  );
}

export async function DELETE(request: NextRequest) {
  await logRequestDetails(request);
  return NextResponse.json(
    { status: "received", message: `Webhook DELETE event logged.` },
    { status: 200 }
  );
}

// The GET handler remains informational and does not add to the primary event log,
// to avoid cluttering it with simple browser pings or checks.
// If you want GET requests from Evolution API to be logged as events,
// you could modify this or add a separate path for such events.
export async function GET(request: NextRequest) {
  // Log the GET request if you want to trace all interactions,
  // but maybe differentiate it or don't add it to the main `evolutionWebhookLogs`
  // if that log is specifically for events pushed by Evolution API.
  // For now, let's log it for completeness to the server console but not to the in-app log viewer.
  console.log(`[Evolution API Webhook INFO] Received a GET request to webhook endpoint from ${request.ip || 'unknown IP'}.`);
  console.log(`[Evolution API Webhook INFO] URL: ${request.url}`);
  console.log(`[Evolution API Webhook INFO] Headers:`, Object.fromEntries(request.headers.entries()));


  const host = request.nextUrl.host;
  const protocol = request.nextUrl.protocol;

  return NextResponse.json(
    { 
      message: "Informações sobre o endpoint de Webhook da API Evolution para Flowise Lite.",
      webhookEndpoint: `POST ${protocol}//${host}/api/evolution/webhook (suporta também PUT, PATCH, DELETE para logging)`,
      description: "Configure sua instância da API Evolution para enviar eventos (webhooks) para a URL acima. Os payloads recebidos serão logados no console do servidor Next.js e podem ser visualizados na UI do Flowise Lite (Console > Logs de Eventos da API Evolution).",
      status: "Este endpoint está ativo e aguardando requisições."
    },
    { status: 200 }
  );
}
