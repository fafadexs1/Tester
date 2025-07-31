// Este arquivo está obsoleto e sua funcionalidade foi movida para /api/evolution/trigger/[webhookId]/route.ts
// Pode ser removido do projeto.

import { NextResponse } from 'next/server';

export async function POST() {
  console.warn("[API Evolution Webhook] Este endpoint (/api/evolution/webhook/[username]/[workspaceName]) está obsoleto. Use /api/evolution/trigger/[webhookId] para webhooks da API Evolution.");
  return NextResponse.json(
    { error: "Endpoint obsoleto. Use /api/evolution/trigger/[webhookId]." },
    { status: 410 } // 410 Gone
  );
}

export async function GET() {
  console.warn("[API Evolution Webhook] Este endpoint (/api/evolution/webhook/[username]/[workspaceName]) está obsoleto. Use /api/evolution/trigger/[webhookId] para webhooks da API Evolution.");
  return NextResponse.json(
    { message: "Este endpoint de gatilho está obsoleto. Configure sua API Evolution para usar /api/evolution/trigger/[ID_DO_FLUXO]." },
    { status: 410 }
  );
}
