import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

declare global {
  // eslint-disable-next-line no-var
  var apiCallLogsByFlow: Map<string, any[]>;
}

const MAX_LOG_ENTRIES_PER_FLOW = 50;

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


export async function POST(request: NextRequest) {
  try {
    const logEntry = await request.json();
    const { workspaceId } = logEntry;

    if (!workspaceId) {
      return NextResponse.json({ error: "O parâmetro 'workspaceId' é obrigatório no corpo do log." }, { status: 400 });
    }

    if (!globalThis.apiCallLogsByFlow.has(workspaceId)) {
        globalThis.apiCallLogsByFlow.set(workspaceId, []);
    }

    const logs = globalThis.apiCallLogsByFlow.get(workspaceId)!;
    
    // Adiciona o novo log no início do array
    logs.unshift({ ...logEntry, timestamp: new Date().toISOString() });

    // Mantém o tamanho do log limitado
    if (logs.length > MAX_LOG_ENTRIES_PER_FLOW) {
        logs.pop();
    }
    
    globalThis.apiCallLogsByFlow.set(workspaceId, logs);

    return NextResponse.json({ message: "Log salvo com sucesso." }, { status: 200 });

  } catch (error: any) {
    console.error(`[API API Call Logs - POST ERROR]`, error.message, error.stack);
    return NextResponse.json({ error: "Erro interno do servidor ao salvar o log.", details: error.message }, { status: 500 });
  }
}
