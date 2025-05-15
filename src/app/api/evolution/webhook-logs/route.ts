
import { NextResponse } from 'next/server';

// Ensure global.evolutionWebhookLogs is typed if you use it elsewhere,
// or at least acknowledge its potential undefined state.
declare global {
  // eslint-disable-next-line no-var
  var evolutionWebhookLogs: Array<any> | undefined;
}

export async function GET() {
  if (global.evolutionWebhookLogs && Array.isArray(global.evolutionWebhookLogs)) {
    return NextResponse.json(global.evolutionWebhookLogs, { status: 200 });
  }
  return NextResponse.json([], { status: 200 }); // Return empty array if no logs
}
