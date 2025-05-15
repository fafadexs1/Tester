
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  console.log('[Evolution API Global Webhook] Received a POST request.');

  try {
    // Try to parse as JSON first
    let payload: any;
    const contentType = request.headers.get('content-type');

    if (contentType && contentType.includes('application/json')) {
      payload = await request.json();
      console.log('[Evolution API Global Webhook] Received JSON payload:', JSON.stringify(payload, null, 2));
    } else {
      // If not JSON, try to read as text (e.g., for form data or plain text)
      const textPayload = await request.text();
      payload = { raw_text: textPayload }; // Wrap in an object for consistent logging structure
      console.log('[Evolution API Global Webhook] Received non-JSON payload (logged as raw_text):', textPayload);
    }


    // Aqui seria o local para uma lógica mais avançada:
    // 1. Validar a origem da requisição (ex: usando um token secreto configurado na Evolution API).
    // 2. Encontrar um fluxo Flowise Lite correspondente (talvez baseado em 'instanceName' ou 'sender' no payload).
    // 3. Iniciar ou continuar a execução desse fluxo com os dados do payload.
    //    - Isso exigiria um "motor de fluxo" no backend, capaz de gerenciar o estado das conversas
    //      e executar os nós do fluxo de forma assíncrona.
    // Por enquanto, apenas logamos e confirmamos o recebimento.

    return NextResponse.json(
      { status: "received", message: "Webhook received successfully by Flowise Lite" },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('[Evolution API Global Webhook] Error processing webhook:', error.message);
    console.error('[Evolution API Global Webhook] Request body might not be valid JSON or another error occurred.');
    
    // Tentar ler o corpo como texto se o JSON.parse falhar, para fins de log
    try {
        const rawBody = await request.text(); // This might be problematic if stream already read
        console.error('[Evolution API Global Webhook] Raw request body (on error):', rawBody);
    } catch (textError) {
        console.error('[Evolution API Global Webhook] Could not read raw request body on error.');
    }

    return NextResponse.json(
      { status: "error", message: "Error processing webhook", error: error.message },
      { status: 400 } // Usar 400 para erro do cliente se o JSON for inválido, ou 500 para erro do servidor
    );
  }
}

// Handler para outros métodos HTTP, se necessário (ex: GET para verificação)
export async function GET(request: NextRequest) {
  console.log('[Evolution API Global Webhook] Received a GET request.');
  return NextResponse.json(
    { message: "Evolution API Webhook Listener is active. Use POST to send events." },
    { status: 200 }
  );
}

