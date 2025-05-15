
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

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

const MAX_LOG_ENTRIES = 50;

async function storeRequestDetails(request: NextRequest) {
  const currentTimestamp = new Date().toISOString();
  console.log(`[Evolution API Webhook Store] ${currentTimestamp} - Received ${request.method} for ${request.url}`);

  let payload: any = { message: "Payload not processed or not applicable." };
  const contentType = request.headers.get('content-type');

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    try {
      const bodyAsText = await request.text(); // Read as text first
      if (bodyAsText) {
        if (contentType && contentType.includes('application/json')) {
          try {
            payload = JSON.parse(bodyAsText);
            console.log(`[Evolution API Webhook Store] Parsed JSON payload.`);
          } catch (jsonError: any) {
            console.warn(`[Evolution API Webhook Store] Failed to parse body as JSON, storing as raw text. Error: ${jsonError.message}`);
            payload = { raw_text: bodyAsText, parse_error: jsonError.message, original_content_type: contentType };
          }
        } else {
          payload = { raw_text: bodyAsText, original_content_type: contentType };
          console.log(`[Evolution API Webhook Store] Stored non-JSON payload as raw_text.`);
        }
      } else {
        payload = { message: "Request body was empty." };
        console.log(`[Evolution API Webhook Store] Request body was empty.`);
      }
    } catch (error: any) {
      console.error(`[Evolution API Webhook Store] Error reading request body for ${request.method}:`, error.message);
      payload = { error_reading_body: error.message };
    }
  }

  const logEntry = {
    timestamp: currentTimestamp,
    method: request.method,
    url: request.url,
    headers: Object.fromEntries(request.headers.entries()),
    payload: payload,
  };

  // Defensive check and initialization for global.evolutionWebhookLogs
  if (!Array.isArray(global.evolutionWebhookLogs)) {
    console.warn('[Evolution API Webhook Store] global.evolutionWebhookLogs was not an array. Re-initializing.');
    global.evolutionWebhookLogs = [];
  }

  global.evolutionWebhookLogs.unshift(logEntry);
  if (global.evolutionWebhookLogs.length > MAX_LOG_ENTRIES) {
    global.evolutionWebhookLogs.pop();
  }
  console.log(`[Evolution API Webhook Store] Log entry stored. Total logs: ${global.evolutionWebhookLogs.length}`);
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

// Informational GET handler - This does NOT store to global.evolutionWebhookLogs
export async function GET(request: NextRequest) {
  const { protocol, host, pathname } = request.nextUrl;
  console.log(`[Evolution API Webhook INFO] Informational GET request to ${pathname} from ${request.ip || 'unknown IP'}`);
  
  return NextResponse.json(
    {
      message: "Flowise Lite - Evolution API Webhook Endpoint Information",
      usage: `Send POST, PUT, PATCH, or DELETE requests to this endpoint (${protocol}//${host}${pathname}) to log webhook events.`,
      log_access_note: `View stored logs (in-memory, development/testing only) by sending a GET request to the route defined in /api/evolution/webhook-logs/route.ts (typically ${protocol}//${host}/api/evolution/webhook-logs).`,
      status: "Endpoint is active. This GET request provides informational data only and is not logged as a webhook event."
    },
    { status: 200 }
  );
}
