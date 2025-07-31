
'use server';

import type { FlowSession, WorkspaceData } from '@/lib/types';
import { loadSessionFromDB, saveSessionToDB, deleteSessionFromDB, loadWorkspaceByNameFromDB } from './databaseActions';


interface SendWhatsAppMessageParams {
  baseUrl: string;
  apiKey?: string;
  instanceName: string;
  recipientPhoneNumber: string;
  messageType: 'text' | 'image' | 'video' | 'document' | 'audio';
  textContent?: string;
  mediaUrl?: string;
  caption?: string;
}

interface EvolutionApiResponse {
  [key: string]: any; 
}

export async function sendWhatsAppMessageAction(
  params: SendWhatsAppMessageParams
): Promise<{ success: boolean; data?: EvolutionApiResponse; error?: string }> {
  if (!params.baseUrl || !params.instanceName || !params.recipientPhoneNumber) {
    return { success: false, error: 'URL base, nome da instância ou número do destinatário ausente.' };
  }

  let endpoint = '';
  const body: Record<string, any> = {};

  if (params.messageType === 'text') {
    if (!params.textContent) {
      return { success: false, error: 'Conteúdo do texto ausente para mensagem de texto.' };
    }
    endpoint = `${params.baseUrl.replace(/\/$/, '')}/message/sendText/${params.instanceName}`;
    body.number = params.recipientPhoneNumber.split('@')[0];
    body.options = { presence: 'composing', delay: 1200 };
    // CORREÇÃO: O texto deve estar dentro de um objeto textMessage.
    body.textMessage = { text: params.textContent };
  } else if (['image', 'video', 'document', 'audio'].includes(params.messageType)) {
    if (!params.mediaUrl) {
      return { success: false, error: 'URL da mídia ausente para mensagem de mídia.' };
    }
    endpoint = `${params.baseUrl.replace(/\/$/, '')}/message/sendMedia/${params.instanceName}`;
    body.number = params.recipientPhoneNumber.split('@')[0];
    body.mediaMessage = {
      mediaType: params.messageType,
      url: params.mediaUrl,
      caption: params.caption,
    };
    if (params.messageType === 'document' && params.caption) {
       body.mediaMessage.filename = params.caption;
    }
  } else {
    return { success: false, error: `Tipo de mensagem '${params.messageType}' não suportado.` };
  }

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  if (params.apiKey) {
    headers['apikey'] = params.apiKey;
  }

  console.log(`[EvolutionAPI Action] Sending ${params.messageType} to ${params.recipientPhoneNumber} via ${params.instanceName}`);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(body),
    });

    let responseData: EvolutionApiResponse;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      responseData = await response.json();
    } else {
      const textResponse = await response.text();
      console.warn('[EvolutionAPI Action] Response was not valid JSON, read as text:', textResponse);
      if (!response.ok) {
         return {
          success: false,
          error: `Erro da API Evolution: ${response.status} - ${textResponse || response.statusText}`,
          data: { rawResponse: textResponse } 
        };
      }
      responseData = { rawResponse: textResponse, message: "Success with non-JSON response" };
    }


    if (!response.ok) {
      console.error('[EvolutionAPI Action] Error response:', responseData);
      return {
        success: false,
        error: `Erro da API Evolution: ${response.status} - ${JSON.stringify(responseData) || response.statusText}`,
        data: responseData,
      };
    }
    console.log('[EvolutionAPI Action] Success response:', responseData);
    return { success: true, data: responseData };
  } catch (error: any) {
    console.error('[EvolutionAPI Action] Fetch error:', error);
    return { success: false, error: `Falha ao enviar mensagem: ${error.message || 'Erro de rede desconhecido'}` };
  }
}

export async function checkEvolutionInstanceStatus(
    baseUrl: string,
    instanceName: string,
    apiKey?: string
): Promise<{ status: 'online' | 'offline', error?: string, data?: any }> {
    if (!baseUrl || !instanceName) {
        return { status: 'offline', error: 'URL base ou nome da instância não fornecidos.' };
    }

    const endpoint = `${baseUrl.replace(/\/$/, '')}/instance/connectionState/${instanceName}`;
    const headers: HeadersInit = {
        'Accept': 'application/json',
    };
    if (apiKey) {
        headers['apikey'] = apiKey;
    }

    try {
        const response = await fetch(endpoint, { method: 'GET', headers: headers });
        const data = await response.json();

        if (!response.ok) {
            return { status: 'offline', error: `Erro da API: ${response.status} - ${JSON.stringify(data)}` };
        }

        // A resposta esperada para uma instância conectada é { instance: { state: 'open' } }
        if (data?.instance?.state === 'open') {
            return { status: 'online', data: data };
        } else {
            return { status: 'offline', error: 'A instância não está conectada (state != "open").', data: data };
        }
    } catch (error: any) {
        return { status: 'offline', error: `Falha na conexão: ${error.message}` };
    }
}
    
