
'use server';

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
  // Define based on the actual API response structure
  // For example:
  // message: string;
  // status?: string;
  // key?: { remoteJid: string; fromMe: boolean; id: string };
  [key: string]: any; // Allow for other properties
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
    body.number = params.recipientPhoneNumber;
    body.options = { presence: 'composing', delay: 1200 };
    body.textMessage = { text: params.textContent };
  } else if (['image', 'video', 'document', 'audio'].includes(params.messageType)) {
    if (!params.mediaUrl) {
      return { success: false, error: 'URL da mídia ausente para mensagem de mídia.' };
    }
    endpoint = `${params.baseUrl.replace(/\/$/, '')}/message/sendMedia/${params.instanceName}`;
    body.number = params.recipientPhoneNumber;
    body.mediaMessage = {
      mediaType: params.messageType,
      url: params.mediaUrl,
      caption: params.caption,
    };
     // Add other media-specific options if needed, e.g., mimetype, filename
    if (params.messageType === 'document' && params.caption) {
       body.mediaMessage.filename = params.caption; // Often filename is used as caption for docs
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
  console.log(`[EvolutionAPI Action] Endpoint: ${endpoint}`);
  console.log(`[EvolutionAPI Action] Body:`, JSON.stringify(body, null, 2));

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(body),
    });

    const responseData: EvolutionApiResponse = await response.json();

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
    