
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Esta rota agora é principalmente um placeholder, já que a intenção é mudar para WebSockets
// para recebimento de eventos da Evolution API, o que requer uma arquitetura de backend diferente.

export async function POST(request: NextRequest) {
  console.log('[Evolution API - /api/evolution/webhook - LEGACY] Received a POST request.');
  console.warn('[Evolution API - /api/evolution/webhook - LEGACY] This HTTP webhook endpoint is considered legacy. Prefer configuring Evolution API to connect to a WebSocket endpoint if available in Flowise Lite for real-time events.');

  try {
    let payload: any;
    const contentType = request.headers.get('content-type');

    if (contentType && contentType.includes('application/json')) {
      payload = await request.json();
      console.log('[Evolution API - /api/evolution/webhook - LEGACY] Received JSON payload:', JSON.stringify(payload, null, 2));
    } else {
      const textPayload = await request.text();
      payload = { raw_text: textPayload };
      console.log('[Evolution API - /api/evolution/webhook - LEGACY] Received non-JSON payload (logged as raw_text):', textPayload);
    }

    // Lógica para processar o payload e interagir com os fluxos Flowise Lite
    // seria implementada aqui em um sistema de backend completo.
    // Por agora, apenas logamos e confirmamos.

    return NextResponse.json(
      { status: "received_legacy", message: "Legacy webhook received by Flowise Lite. Consider WebSocket for future integrations." },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('[Evolution API - /api/evolution/webhook - LEGACY] Error processing webhook:', error.message);
    try {
        const rawBody = await request.text(); 
        console.error('[Evolution API - /api/evolution/webhook - LEGACY] Raw request body (on error):', rawBody);
    } catch (textError) {
        console.error('[Evolution API - /api/evolution/webhook - LEGACY] Could not read raw request body on error.');
    }

    return NextResponse.json(
      { status: "error", message: "Error processing legacy webhook", error: error.message },
      { status: 400 }
    );
  }
}

export async function GET(request: NextRequest) {
  console.log('[Evolution API - /api/evolution/webhook - INFO] Received a GET request.');
  const host = request.nextUrl.host;
  const protocol = request.nextUrl.protocol.replace('http','ws'); // Assume ws or wss based on http/https

  return NextResponse.json(
    { 
      message: "Informações sobre a integração com API Evolution.",
      legacyWebhookEndpoint: `POST ${request.nextUrl.protocol}//${host}/api/evolution/webhook`,
      conceptualWebSocketEndpoint: `${protocol}//${host}/api/evolution/ws`,
      status: "Este endpoint HTTP POST é para webhooks legados. Para recebimento de eventos em tempo real, a API Evolution deveria se conectar a um endpoint WebSocket (ws/wss) no Flowise Lite, que precisaria ser implementado no backend do Flowise Lite."
    },
    { status: 200 }
  );
}
