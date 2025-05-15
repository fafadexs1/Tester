
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  console.log('[Evolution API Webhook] Received a POST request.');

  try {
    let payload: any;
    const contentType = request.headers.get('content-type');

    if (contentType && contentType.includes('application/json')) {
      payload = await request.json();
      console.log('[Evolution API Webhook] Received JSON payload:', JSON.stringify(payload, null, 2));
    } else {
      const textPayload = await request.text();
      payload = { raw_text: textPayload };
      console.log('[Evolution API Webhook] Received non-JSON payload (logged as raw_text):', textPayload);
    }

    // Em uma implementação completa, aqui você processaria o payload
    // para encontrar um fluxo Flowise Lite correspondente e iniciar/continuar sua execução.
    // Por agora, apenas logamos e confirmamos o recebimento.

    return NextResponse.json(
      { status: "received", message: "Webhook received by Flowise Lite." },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('[Evolution API Webhook] Error processing webhook:', error.message);
    try {
        const rawBody = await request.text(); // Tenta ler o corpo cru em caso de erro de parse JSON
        console.error('[Evolution API Webhook] Raw request body (on error):', rawBody);
    } catch (textError) {
        console.error('[Evolution API Webhook] Could not read raw request body on error.');
    }
    return NextResponse.json(
      { status: "error", message: "Error processing webhook", error: error.message },
      { status: 400 } // Use 400 para erro de cliente se o payload for malformado
    );
  }
}

export async function GET(request: NextRequest) {
  console.log('[Evolution API Webhook INFO] Received a GET request.');
  const host = request.nextUrl.host;
  const protocol = request.nextUrl.protocol;

  return NextResponse.json(
    { 
      message: "Informações sobre o endpoint de Webhook da API Evolution para Flowise Lite.",
      webhookEndpoint: `POST ${protocol}//${host}/api/evolution/webhook`,
      description: "Configure sua instância da API Evolution para enviar eventos (webhooks) para a URL acima. Os payloads recebidos serão logados no console do servidor Next.js.",
      status: "Este endpoint está ativo e aguardando requisições POST."
    },
    { status: 200 }
  );
}
