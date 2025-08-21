
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

declare global {
  // eslint-disable-next-line no-var
  var apiCallLogsByFlow: Map<string, any[]>; 
}

// Inicialização robusta da variável global de logs
if (!globalThis.apiCallLogsByFlow) {
  console.log(`[GLOBAL_INIT in api-call-logs/route.ts] Initializing globalThis.apiCallLogsByFlow as new Map.`);
  globalThis.apiCallLogsByFlow = new Map<string, any[]>();
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get('workspaceId');

  if (!workspaceId) {
    return NextResponse.json({ error: "O parâmetro 'workspaceId' é obrigatório." }, { status: 400 });
  }

  const logs = globalThis.apiCallLogsByFlow.get(workspaceId) || [];
  
  return NextResponse.json(logs, { status: 200 });
}
