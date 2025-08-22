
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

declare global {
  // eslint-disable-next-line no-var
  var webhookLogsByFlow: Map<string, any[]>; 
}

// Inicialização robusta da variável global de logs
if (!globalThis.webhookLogsByFlow) {
  console.log(`[GLOBAL_INIT in webhook-logs/route.ts] Initializing globalThis.webhookLogsByFlow as new Map.`);
  globalThis.webhookLogsByFlow = new Map<string, any[]>();
}

const MAX_LOG_ENTRIES_PER_FLOW = 50;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get('workspaceId');

  if (!workspaceId) {
    return NextResponse.json({ error: "O parâmetro 'workspaceId' é obrigatório." }, { status: 400 });
  }

  const logs = globalThis.webhookLogsByFlow.get(workspaceId) || [];
  
  return NextResponse.json(logs, { status: 200 });
}

// NOVO: Adiciona a capacidade de postar logs, centralizando a lógica de logging aqui.
export async function POST(request: NextRequest) {
  try {
    const logEntry = await request.json();
    const { workspaceId, type } = logEntry; // 'type' pode ser 'webhook' ou 'api-call'

    if (!workspaceId) {
      return NextResponse.json({ error: "O parâmetro 'workspaceId' é obrigatório no corpo do log." }, { status: 400 });
    }

    if (!globalThis.webhookLogsByFlow.has(workspaceId)) {
        globalThis.webhookLogsByFlow.set(workspaceId, []);
    }

    const logs = globalThis.webhookLogsByFlow.get(workspaceId)!;
    
    // Adiciona o novo log no início do array, garantindo um timestamp
    logs.unshift({ ...logEntry, timestamp: logEntry.timestamp || new Date().toISOString() });

    // Mantém o tamanho do log limitado
    if (logs.length > MAX_LOG_ENTRIES_PER_FLOW) {
        logs.pop();
    }
    
    globalThis.webhookLogsByFlow.set(workspaceId, logs);

    return NextResponse.json({ message: "Log salvo com sucesso." }, { status: 200 });

  } catch (error: any) {
    console.error(`[API Webhook Logs - POST ERROR]`, error.message, error.stack);
    return NextResponse.json({ error: "Erro interno do servidor ao salvar o log.", details: error.message }, { status: 500 });
  }
}

    