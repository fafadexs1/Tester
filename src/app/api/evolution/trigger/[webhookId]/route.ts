
// Este arquivo está obsoleto e sua funcionalidade foi movida para /api/evolution/workspace/[workspaceName]/route.ts
// Pode ser removido do projeto.

import { NextResponse } from 'next/server';

export async function POST() {
  console.warn("[API Evolution Trigger] Este endpoint (/api/evolution/trigger/[webhookId]) está obsoleto. Use /api/evolution/workspace/[workspaceName] para webhooks da API Evolution.");
  return NextResponse.json(
    { error: "Endpoint obsoleto. Use /api/evolution/workspace/[workspaceName]." },
    { status: 410 } // 410 Gone
  );
}

export async function GET() {
  console.warn("[API Evolution Trigger] Este endpoint (/api/evolution/trigger/[webhookId]) está obsoleto. Use /api/evolution/workspace/[workspaceName] para webhooks da API Evolution.");
  return NextResponse.json(
    { message: "Este endpoint de gatilho está obsoleto. Configure sua API Evolution para usar /api/evolution/workspace/[NOME_DO_SEU_FLUXO]." },
    { status: 410 }
  );
}

    