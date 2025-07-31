// This file is deprecated and its functionality has been moved to /api/evolution/webhook/[username]/[workspaceName]/route.ts
// It can be removed from the project.

import { NextResponse } from 'next/server';

export async function POST() {
  console.warn("[API Evolution Workspace] This endpoint (/api/evolution/workspace/[workspaceName]) is deprecated. Use /api/evolution/webhook/[username]/[workspaceName] for Evolution API webhooks.");
  return NextResponse.json(
    { error: "Endpoint deprecated. Use /api/evolution/webhook/[username]/[workspaceName]." },
    { status: 410 } // 410 Gone
  );
}

export async function GET() {
  console.warn("[API Evolution Workspace] This endpoint (/api/evolution/workspace/[workspaceName]) is deprecated. Use /api/evolution/webhook/[username]/[workspaceName] for Evolution API webhooks.");
  return NextResponse.json(
    { message: "This trigger endpoint is deprecated. Configure your Evolution API to use /api/evolution/webhook/[USERNAME]/[FLOW_NAME]." },
    { status: 410 }
  );
}