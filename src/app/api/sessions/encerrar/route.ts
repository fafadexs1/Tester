'use server';

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { deleteSessionFromDB } from '@/app/actions/databaseActions';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const sessionIdToClose = body.encerrar;

    if (!sessionIdToClose || typeof sessionIdToClose !== 'string') {
      return NextResponse.json(
        { success: false, error: 'A chave "encerrar" contendo o session_id é obrigatória no corpo da requisição.' },
        { status: 400 }
      );
    }

    console.log(`[API /sessions/encerrar] Recebida solicitação para encerrar a sessão: ${sessionIdToClose}`);

    const result = await deleteSessionFromDB(sessionIdToClose);

    if (result.success) {
      console.log(`[API /sessions/encerrar] Sessão ${sessionIdToClose} encerrada com sucesso.`);
      return NextResponse.json(
        { success: true, message: `Sessão ${sessionIdToClose} encerrada com sucesso.` },
        { status: 200 }
      );
    } else {
      // Mesmo que a sessão não seja encontrada, para o requisitante o resultado é o desejado.
      // Retornamos sucesso, mas logamos o aviso.
      console.warn(`[API /sessions/encerrar] Tentativa de encerrar a sessão ${sessionIdToClose}, mas ela não foi encontrada ou já havia sido encerrada. Detalhe: ${result.error}`);
       return NextResponse.json(
        { success: true, message: `Sessão ${sessionIdToClose} não encontrada ou já encerrada.` },
        { status: 200 }
      );
    }

  } catch (error: any) {
    console.error('[API /sessions/encerrar] Erro ao processar a requisição:', error);
     if (error instanceof SyntaxError) {
      return NextResponse.json({ success: false, error: 'Corpo da requisição inválido. Esperado um JSON válido.' }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: 'Erro interno do servidor.' }, { status: 500 });
  }
}
