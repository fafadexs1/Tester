
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// In-memory store for webhook logs (development/testing purposes)
// Ensure this is declared in a way that persists across requests in a dev server context
// For serverless, this would reset on each invocation. For dev, `global` can work.
if (!global.evolutionWebhookLogs) {
  global.evolutionWebhookLogs = [];
}
const MAX_LOG_ENTRIES = 50; // Limit the number of logs stored in memory

export async function POST(request: NextRequest) {
  console.log('[Evolution API Webhook] Received a POST request.');

  try {
    let payload: any;
    const contentType = request.headers.get('content-type');

    if (contentType && contentType.includes('application/json')) {
      payload = await request.json();
      console.log('[Evolution API Webhook] Received JSON payload:', JSON.stringify(payload, null, 2));
    } else {
      const textPayload = await request.text();
      payload = { raw_text: textPayload, received_at_text_parse: new Date().toISOString() };
      console.log('[Evolution API Webhook] Received non-JSON payload (logged as raw_text):', textPayload);
    }

    // Store the log with a timestamp
    const logEntry = {
      timestamp: new Date().toISOString(),
      payload: payload,
    };
    global.evolutionWebhookLogs.unshift(logEntry); // Add to the beginning
    if (global.evolutionWebhookLogs.length > MAX_LOG_ENTRIES) {
      global.evolutionWebhookLogs.pop(); // Remove the oldest if limit exceeded
    }


    return NextResponse.json(
      { status: "received", message: "Webhook received by Flowise Lite." },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('[Evolution API Webhook] Error processing webhook:', error.message);
    try {
        const rawBody = await request.text(); 
        console.error('[Evolution API Webhook] Raw request body (on error):', rawBody);
    } catch (textError) {
        console.error('[Evolution API Webhook] Could not read raw request body on error.');
    }
    
    // Also store error log
     const errorLogEntry = {
      timestamp: new Date().toISOString(),
      error: {
        message: error.message,
        stack: error.stack,
        headers: Object.fromEntries(request.headers.entries()),
      },
    };
    global.evolutionWebhookLogs.unshift(errorLogEntry);
    if (global.evolutionWebhookLogs.length > MAX_LOG_ENTRIES) {
      global.evolutionWebhookLogs.pop();
    }

    return NextResponse.json(
      { status: "error", message: "Error processing webhook", error: error.message },
      { status: 400 } 
    );
  }
}

export async function GET(request: NextRequest) {
  console.log('[Evolution API Webhook INFO] Received a GET request.');
  const host = request.nextUrl.host;
  const protocol = request.nextUrl.protocol;

  return NextResponse.json(
    { 
      message: "Informações sobre o endpoint de Webhook da API Evolution para Flowise Lite.",
      webhookEndpoint: `POST ${protocol}//${host}/api/evolution/webhook`,
      description: "Configure sua instância da API Evolution para enviar eventos (webhooks) para a URL acima. Os payloads recebidos serão logados no console do servidor Next.js e podem ser visualizados na UI do Flowise Lite (Console > Logs de Eventos da API Evolution).",
      status: "Este endpoint está ativo e aguardando requisições POST."
    },
    { status: 200 }
  );
}
