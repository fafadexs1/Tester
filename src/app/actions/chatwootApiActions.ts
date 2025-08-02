
'use server';

import type { ChatwootInstance } from '@/lib/types';

interface SendChatwootMessageParams {
  baseUrl: string;
  apiAccessToken: string;
  accountId: number;
  conversationId: number;
  content: string;
}

interface ChatwootApiResponse {
  [key: string]: any;
}

export async function sendChatwootMessageAction(
  params: SendChatwootMessageParams
): Promise<{ success: boolean; data?: ChatwootApiResponse; error?: string }> {
  const { baseUrl, apiAccessToken, accountId, conversationId, content } = params;

  if (!baseUrl || !apiAccessToken || !accountId || !conversationId || !content) {
    const missingParams = Object.entries({ baseUrl, apiAccessToken, accountId, conversationId, content })
      .filter(([, value]) => !value)
      .map(([key]) => key)
      .join(', ');
    return { success: false, error: `Parâmetros ausentes para enviar mensagem ao Chatwoot: ${missingParams}` };
  }

  const endpoint = `${baseUrl.replace(/\/$/, '')}/api/v1/accounts/${accountId}/conversations/${conversationId}/messages`;

  const body = {
    content: content,
    message_type: 'outgoing',
    private: false,
  };

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'api_access_token': apiAccessToken,
  };

  console.log(`[Chatwoot API Action] Sending message to conversation ${conversationId}. Endpoint: ${endpoint}, Payload:`, JSON.stringify(body));

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(body),
    });

    const responseData: ChatwootApiResponse = await response.json();

    if (!response.ok) {
      console.error('[Chatwoot API Action] Error response:', responseData);
      const errorMessage = responseData.message || JSON.stringify(responseData);
      return {
        success: false,
        error: `Erro da API Chatwoot: ${response.status} - ${errorMessage}`,
        data: responseData,
      };
    }

    console.log('[Chatwoot API Action] Success response:', responseData);
    return { success: true, data: responseData };
  } catch (error: any) {
    console.error('[Chatwoot API Action] Fetch error:', error);
    return { success: false, error: `Falha ao enviar mensagem para o Chatwoot: ${error.message || 'Erro de rede desconhecido'}` };
  }
}

export async function checkChatwootInstanceStatus(
    baseUrl: string,
    apiAccessToken: string
): Promise<{ status: 'online' | 'offline', error?: string, data?: any }> {
    if (!baseUrl || !apiAccessToken) {
        return { status: 'offline', error: 'URL base ou token de acesso não fornecidos.' };
    }

    const endpoint = `${baseUrl.replace(/\/$/, '')}/api/v1/profile`;
    const headers: HeadersInit = {
        'Content-Type': 'application/json',
        'api_access_token': apiAccessToken,
    };

    try {
        const response = await fetch(endpoint, { method: 'GET', headers: headers });
        const data = await response.json();

        if (!response.ok) {
            return { status: 'offline', error: `Erro da API: ${response.status} - ${data.message || JSON.stringify(data)}` };
        }

        // A resposta esperada para um token válido é o perfil do usuário/agente.
        // Se tivermos um email, por exemplo, consideramos online.
        if (data?.email) {
            return { status: 'online', data: data };
        } else {
            return { status: 'offline', error: 'A resposta da API não continha os dados de perfil esperados.', data: data };
        }
    } catch (error: any) {
        return { status: 'offline', error: `Falha na conexão: ${error.message}` };
    }
}
