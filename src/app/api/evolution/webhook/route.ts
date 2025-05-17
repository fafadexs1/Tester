
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

const MAX_LOG_ENTRIES = 50; // You can adjust this limit

async function storeRequestDetails(request: NextRequest) {
  const currentTimestamp = new Date().toISOString();
  const { method, url } = request;
  const headers = Object.fromEntries(request.headers.entries());
  const contentType = request.headers.get('content-type');
  const ip = request.ip || 'unknown IP';
  const geo = request.geo || 'unknown geo';

  console.log(`[Evolution API Webhook Store ENTRY] ${currentTimestamp} - Received ${method} for ${url}`);
  console.log(`[Evolution API Webhook Store DETAILS] IP: ${ip}, Geo: ${JSON.stringify(geo)}, Content-Type: ${contentType}`);


  let payload: any = { message: "Payload not processed or not applicable for this request method." };
  let bodyAsText: string | null = null;

  if (method !== 'GET' && method !== 'HEAD') {
    try {
      console.log(`[Evolution API Webhook Store] Attempting to read request body as text for ${method}...`);
      bodyAsText = await request.text(); // Read as text first

      if (bodyAsText && bodyAsText.trim() !== '') {
        console.log(`[Evolution API Webhook Store] Successfully read body as text. Length: ${bodyAsText.length}.`);
        if (contentType && contentType.includes('application/json')) {
          try {
            payload = JSON.parse(bodyAsText); // Try to parse if JSON
            console.log(`[Evolution API Webhook Store] Parsed JSON payload for ${method}.`);
          } catch (jsonError: any) {
            console.warn(`[Evolution API Webhook Store] Failed to parse body as JSON for ${method}, storing as raw text. Error: ${jsonError.message}.`);
            // Store as raw text if JSON parsing fails
            payload = { raw_text: bodyAsText, parse_error: jsonError.message, original_content_type: contentType };
          }
        } else {
          // Store as raw text if not JSON
          payload = { raw_text: bodyAsText, original_content_type: contentType || 'N/A' };
          console.log(`[Evolution API Webhook Store] Stored non-JSON payload as raw_text for ${method}.`);
        }
      } else {
        payload = { message: `Request body was empty or whitespace for ${method}.`, original_content_type: contentType || 'N/A' };
        console.log(`[Evolution API Webhook Store] Request body was empty or whitespace for ${method}.`);
      }
    } catch (error: any) {
      console.error(`[Evolution API Webhook Store] Error reading/processing request body for ${method}:`, error.message);
      // Try to provide some context if bodyAsText was partially read or available
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


  const logEntry = {
    timestamp: currentTimestamp,
    method: method,
    url: url,
    headers: headers,
    payload: payload,
    ip: ip,
    geo: geo,
  };

  // Ensure evolutionWebhookLogs is an array before pushing
  if (!Array.isArray(global.evolutionWebhookLogs)) {
    console.warn('[Evolution API Webhook Store] global.evolutionWebhookLogs was not an array. Re-initializing.');
    global.evolutionWebhookLogs = [];
  }
  
  console.log(`[Evolution API Webhook Store] Current logs count BEFORE unshift: ${global.evolutionWebhookLogs.length}`);
  global.evolutionWebhookLogs.unshift(logEntry); // Add to the beginning
  console.log(`[Evolution API Webhook Store] Log entry unshifted. New logs count: ${global.evolutionWebhookLogs.length}`);


  // Cap the number of log entries
  if (global.evolutionWebhookLogs.length > MAX_LOG_ENTRIES) {
    global.evolutionWebhookLogs.pop(); // Remove the oldest
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

// GET requests to this specific webhook path will also be logged as an event
// if they have a specific query parameter, or just return info.
export async function GET(request: NextRequest) {
  // If a specific query param is set, log this GET as an event too (useful for testing via browser)
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
  
  // Default GET response for informational purposes
  return NextResponse.json(
    {
      message: "Flowise Lite Webhook Endpoint. Configured to receive Evolution API events via POST, PUT, PATCH, DELETE.",
      note: "To view received webhook logs, use the 'Console' -> 'Logs de Eventos da API Evolution' in the Flowise Lite application.",
      testInstructions: "You can send POST, PUT, PATCH, DELETE requests to this endpoint. GET requests to this specific URL are informational unless 'logEvent=true' query parameter is used."
    },
    { status: 200 }
  );
}
