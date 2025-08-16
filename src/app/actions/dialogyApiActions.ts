'use server';

interface SendDialogyMessageParams {
  baseUrl: string;
  apiKey: string;
  chatId: string;
  content: string;
}

interface DialogyApiResponse {
  [key: string]: any;
}

export async function sendDialogyMessageAction(
  params: SendDialogyMessageParams
): Promise<{ success: boolean; data?: DialogyApiResponse; error?: string }> {
  const { baseUrl, apiKey, chatId, content } = params;

  if (!baseUrl || !apiKey || !chatId || !content) {
    const missingParams = Object.entries({ baseUrl, apiKey, chatId, content })
      .filter(([, value]) => !value)
      .map(([key]) => key)
      .join(', ');
    return { success: false, error: `Parâmetros ausentes para enviar mensagem ao Dialogy: ${missingParams}` };
  }

  // 1. Monta o endpoint da API
  const endpoint = `${baseUrl.replace(/\/$/, '')}/api/agent/messages`;

  // 2. Cria o corpo (payload) da requisição em JSON
  const body = {
    chatId: chatId,
    content: content,
  };

  // 3. Define os cabeçalhos, incluindo o 'Authorization' com o Bearer Token
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
  };

  console.log(`[Dialogy API Action] Sending message to chat ${chatId}. Endpoint: ${endpoint}, Payload:`, JSON.stringify(body));

  try {
    // 4. Executa a chamada `fetch` com o método POST e os dados definidos
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(body),
    });

    const responseData: DialogyApiResponse = await response.json();

    // 5. Trata a resposta da API
    if (!response.ok) {
      console.error('[Dialogy API Action] Error response:', responseData);
      const errorMessage = responseData.message || JSON.stringify(responseData);
      return {
        success: false,
        error: `Erro da API Dialogy: ${response.status} - ${errorMessage}`,
        data: responseData,
      };
    }

    console.log('[Dialogy API Action] Success response:', responseData);
    return { success: true, data: responseData };
  } catch (error: any) {
    console.error('[Dialogy API Action] Fetch error:', error);
    return { success: false, error: `Falha ao enviar mensagem para o Dialogy: ${error.message || 'Erro de rede desconhecido'}` };
  }
}

export async function checkDialogyInstanceStatus(
    baseUrl: string,
    apiKey: string
): Promise<{ status: 'online' | 'offline', error?: string, data?: any }> {
    if (!baseUrl || !apiKey) {
        return { status: 'offline', error: 'URL base ou API Key não fornecidos.' };
    }

    // Usaremos um endpoint que deve retornar dados do agente se o token for válido.
    const endpoint = `${baseUrl.replace(/\/$/, '')}/api/agent/me`;
    const headers: HeadersInit = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
    };

    try {
        const response = await fetch(endpoint, { method: 'GET', headers: headers });
        const data = await response.json();

        if (!response.ok) {
            return { status: 'offline', error: `Erro da API: ${response.status} - ${data.message || JSON.stringify(data)}` };
        }

        // A resposta esperada para um token válido é o perfil do agente.
        // Se tivermos um ID, por exemplo, consideramos online.
        if (data?.id) {
            return { status: 'online', data: data };
        } else {
            return { status: 'offline', error: 'A resposta da API não continha os dados de perfil esperados.', data: data };
        }
    } catch (error: any) {
        return { status: 'offline', error: `Falha na conexão: ${error.message}` };
    }
}
