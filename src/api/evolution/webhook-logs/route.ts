import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getFlowLogsForWorkspace, saveFlowLog } from '@/app/actions/databaseActions';
import type { FlowLog } from '@/lib/types';


export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get('workspaceId');
  const logType = searchParams.get('type') || 'webhook'; // Default to webhook for backward compatibility
  const nodeId = searchParams.get('nodeId');
  const limit = parseInt(searchParams.get('limit') || '50', 10);

  if (!workspaceId) {
    return NextResponse.json({ error: "O parâmetro 'workspaceId' é obrigatório." }, { status: 400 });
  }

  try {
    const logs = await getFlowLogsForWorkspace(workspaceId, {
      logType: logType as 'webhook' | 'api-call',
      nodeId: nodeId || undefined,
      limit: limit,
    });
    
    // Transforma os dados para o formato que a UI espera
    const formattedLogs = logs.map(log => ({
      timestamp: log.timestamp,
      ...log.details
    }));
    
    return NextResponse.json(formattedLogs, { status: 200 });
  } catch (error: any) {
    console.error(`[API Webhook Logs - GET ERROR]`, error.message, error.stack);
    return NextResponse.json({ error: "Erro interno do servidor ao buscar os logs.", details: error.message }, { status: 500 });
  }
}


export async function POST(request: NextRequest) {
  try {
    const logData = await request.json();
    const { workspaceId, type, nodeId, nodeTitle, requestUrl, response, error: logError } = logData;

    if (!workspaceId || !type) {
      return NextResponse.json({ error: "Os parâmetros 'workspaceId' e 'type' são obrigatórios no corpo do log." }, { status: 400 });
    }

    const logEntry: Omit<FlowLog, 'id'> = {
        workspace_id: workspaceId,
        log_type: type,
        timestamp: new Date().toISOString(),
        details: {
            nodeId,
            nodeTitle,
            requestUrl,
            response,
            error: logError
        }
    };
    
    await saveFlowLog(logEntry);

    return NextResponse.json({ message: "Log salvo com sucesso." }, { status: 200 });

  } catch (error: any) {
    console.error(`[API Webhook Logs - POST ERROR]`, error.message, error.stack);
    return NextResponse.json({ error: "Erro interno do servidor ao salvar o log.", details: error.message }, { status: 500 });
  }
}
