

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getFlowLogsForWorkspace } from '@/app/actions/databaseActions';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get('workspaceId');
  const nodeId = searchParams.get('nodeId');

  if (!workspaceId) {
    return NextResponse.json({ error: "O parâmetro 'workspaceId' é obrigatório." }, { status: 400 });
  }

  try {
    const logs = await getFlowLogsForWorkspace(workspaceId, {
      logType: 'api-call',
      nodeId: nodeId || undefined,
      limit: 50
    });
    
    // Transforma os dados para o formato que a UI espera
    const formattedLogs = logs.map(log => ({
      timestamp: log.timestamp,
      ...(log.details || {})
    }));
    
    return NextResponse.json(formattedLogs, { status: 200 });
  } catch (error: any) {
    console.error(`[API API Call Logs - GET ERROR]`, error.message, error.stack);
    return NextResponse.json({ error: "Erro interno do servidor ao buscar os logs.", details: error.message }, { status: 500 });
  }
}
