
import { NextResponse } from 'next/server';

declare global {
  // eslint-disable-next-line no-var
  var evolutionWebhookLogs: Array<any> | undefined;
}

// Initialize if not already present.
if (global.evolutionWebhookLogs === undefined) {
  console.log('[Evolution API Webhook Logs Route] Initializing global.evolutionWebhookLogs');
  global.evolutionWebhookLogs = [];
}

export async function GET() {
  // Defensive check for the type of global.evolutionWebhookLogs
  if (!Array.isArray(global.evolutionWebhookLogs)) {
     console.warn('[Evolution API Webhook Logs Route] global.evolutionWebhookLogs found but was not an array. Resetting and returning empty array.');
     global.evolutionWebhookLogs = []; // Reset to ensure it's an array
  }
  
  console.log(`[Evolution API Webhook Logs Route] GET request for logs. Returning ${global.evolutionWebhookLogs.length} log entries.`);
  return NextResponse.json(global.evolutionWebhookLogs, { status: 200 });
}
