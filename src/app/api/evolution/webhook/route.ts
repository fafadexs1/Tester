
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

  let payload: any = { message: "Payload not processed or not applicable for this request method." };
  const contentType = request.headers.get('content-type');

  // Try to read body for methods that typically have one
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    try {
      const bodyAsText = await request.text(); 
      if (bodyAsText) {
        if (contentType && contentType.includes('application/json')) {
          try {
            payload = JSON.parse(bodyAsText);
            console.log(`[Evolution API Webhook Store] Parsed JSON payload for ${request.method}.`);
          } catch (jsonError: any) {
            console.warn(`[Evolution API Webhook Store] Failed to parse body as JSON for ${request.method}, storing as raw text. Error: ${jsonError.message}`);
            payload = { raw_text: bodyAsText, parse_error: jsonError.message, original_content_type: contentType };
          }
        } else {
          payload = { raw_text: bodyAsText, original_content_type: contentType };
          console.log(`[Evolution API Webhook Store] Stored non-JSON payload as raw_text for ${request.method}.`);
        }
      } else {
        payload = { message: `Request body was empty for ${request.method}.` };
        console.log(`[Evolution API Webhook Store] Request body was empty for ${request.method}.`);
      }
    } catch (error: any) {
      console.error(`[Evolution API Webhook Store] Error reading request body for ${request.method}:`, error.message);
      payload = { error_reading_body: error.message };
    }
  } else {
     console.log(`[Evolution API Webhook Store] No payload processed for ${request.method} request.`);
  }


  const logEntry = {
    timestamp: currentTimestamp,
    method: request.method,
    url: request.url,
    headers: Object.fromEntries(request.headers.entries()),
    payload: payload,
    ip: request.ip || 'unknown IP',
    geo: request.geo || 'unknown geo',
  };

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

export async function GET(request: NextRequest) {
  // Log the GET request details
  await storeRequestDetails(request);
  
  // Respond that the GET request was logged
  return NextResponse.json(
    {
      status: "received",
      message: "Webhook GET event logged. View logs in the application console or server output.",
      note: "This endpoint now logs GET requests. For detailed endpoint usage, refer to documentation or previous informational responses if available.",
    },
    { status: 200 }
  );
}
