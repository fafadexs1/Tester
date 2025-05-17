
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
  const { method, url } = request;
  const headers = Object.fromEntries(request.headers.entries());
  const contentType = request.headers.get('content-type');
  const ip = request.ip || 'unknown IP';
  const geo = request.geo || 'unknown geo';

  console.log(`[Evolution API Webhook Store] ${currentTimestamp} - Received ${method} for ${url}`);
  console.log(`[Evolution API Webhook Store] IP: ${ip}, Geo: ${JSON.stringify(geo)}, Content-Type: ${contentType}`);

  let payload: any = { message: "Payload not processed or not applicable for this request method." };
  let bodyAsText: string | null = null;

  // Try to read body for methods that typically have one
  if (method !== 'GET' && method !== 'HEAD') {
    try {
      console.log(`[Evolution API Webhook Store] Attempting to read request body as text for ${method}...`);
      bodyAsText = await request.text(); 

      if (bodyAsText && bodyAsText.trim() !== '') {
        console.log(`[Evolution API Webhook Store] Successfully read body as text. Length: ${bodyAsText.length}. Content-Type: ${contentType}`);
        if (contentType && contentType.includes('application/json')) {
          try {
            payload = JSON.parse(bodyAsText);
            console.log(`[Evolution API Webhook Store] Parsed JSON payload for ${method}.`);
          } catch (jsonError: any) {
            console.warn(`[Evolution API Webhook Store] Failed to parse body as JSON for ${method}, storing as raw text. Error: ${jsonError.message}. Content-Type: ${contentType}`);
            payload = { raw_text: bodyAsText, parse_error: jsonError.message, original_content_type: contentType };
          }
        } else {
          // Store as raw text if not explicitly JSON or if content type is missing/different
          payload = { raw_text: bodyAsText, original_content_type: contentType || 'N/A' };
          console.log(`[Evolution API Webhook Store] Stored non-JSON payload as raw_text for ${method}. Content-Type: ${contentType || 'N/A'}`);
        }
      } else {
        payload = { message: `Request body was empty or whitespace for ${method}.`, original_content_type: contentType || 'N/A' };
        console.log(`[Evolution API Webhook Store] Request body was empty or whitespace for ${method}. Content-Type: ${contentType || 'N/A'}`);
      }
    } catch (error: any) {
      console.error(`[Evolution API Webhook Store] Error reading/processing request body for ${method}:`, error.message);
      // Log a preview of the body if it was partially read before an error, or state that it couldn't be read
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
  // Log the GET request details if it's intended to be an event
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
