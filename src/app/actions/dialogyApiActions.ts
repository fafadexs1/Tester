'use server';

import { loadDialogyInstanceFromDB } from './databaseActions';

interface SendDialogyMessageParams {
  baseUrl: string;
  apiKey: string;
  chatId: string;
  content: string;
}

interface DialogyListRow {
  title: string;
  description?: string;
  rowId: string;
}

interface DialogyListSection {
  title: string;
  rows: DialogyListRow[];
}

interface DialogyListPayload {
  title: string;
  description?: string;
  footerText?: string;
  buttonText: string;
  sections: DialogyListSection[];
  delay?: number;
  quoted?: {
    key?: {
      id?: string;
    };
    message?: {
      conversation?: string;
    };
  };
  mentionsEveryOne?: boolean;
  mentioned?: string[];
}

interface SendDialogyListParams {
  baseUrl: string;
  apiKey: string;
  phoneNumber: string;
  instance: string;
  list: DialogyListPayload;
}

interface TransferDialogyChatParams {
  baseUrl: string;
  apiKey: string;
  chatId: string;
  targetId: string;
}

interface CloseDialogyChatParams {
  baseUrl: string;
  apiKey: string;
  chatId: string;
}

interface SendDialogyTemplateParams {
  baseUrl: string;
  apiKey: string;
  phoneNumber: string;
  instance: string;
  name: string;
  language: string;
  components: any[];
  renderedContent?: string;
}

export interface DialogyTemplateSummary {
  instanceName: string;
  name: string;
  language: string;
  status?: string;
  bodyText?: string;
  bodyParameterCount: number;
}

export interface DialogyTransferTarget {
  id: string;
  name: string;
}

export interface DialogyTransferWorkspace {
  id: string;
  name: string;
}

interface DialogyTransferTargetsResult {
  success: boolean;
  workspace?: DialogyTransferWorkspace;
  teams: DialogyTransferTarget[];
  intelligentAgents: DialogyTransferTarget[];
  error?: string;
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

export async function sendDialogyListMessageAction(
  params: SendDialogyListParams
): Promise<{ success: boolean; data?: DialogyApiResponse; error?: string }> {
  const { baseUrl, apiKey, phoneNumber, instance, list } = params;

  if (
    !baseUrl ||
    !apiKey ||
    !phoneNumber ||
    !instance ||
    !list?.title ||
    !list?.buttonText ||
    !Array.isArray(list?.sections) ||
    list.sections.length === 0
  ) {
    const missingParams = Object.entries({
      baseUrl,
      apiKey,
      phoneNumber,
      instance,
      listTitle: list?.title,
      buttonText: list?.buttonText,
      sections: Array.isArray(list?.sections) ? 'ok' : '',
    })
      .filter(([, value]) => !value)
      .map(([key]) => key)
      .join(', ');
    return { success: false, error: `Parâmetros ausentes para enviar lista ao Dialogy: ${missingParams}` };
  }

  const endpoint = `${baseUrl.replace(/\/$/, '')}/api/agent/messages`;
  const normalizedList: DialogyListPayload = {
    ...list,
    title: String(list.title ?? ''),
    buttonText: String(list.buttonText ?? ''),
    delay: list.delay ?? 1200,
  };

  if (list.description && String(list.description).trim() !== '') {
    normalizedList.description = String(list.description);
  }
  if (list.footerText && String(list.footerText).trim() !== '') {
    normalizedList.footerText = String(list.footerText);
  }
  if (list.mentionsEveryOne !== undefined) {
    normalizedList.mentionsEveryOne = list.mentionsEveryOne;
  }
  if (Array.isArray(list.mentioned) && list.mentioned.length > 0) {
    normalizedList.mentioned = list.mentioned.map((value) => String(value ?? ''));
  }

  normalizedList.sections = list.sections.map((section) => {
    const sectionTitle = String(section.title ?? '').trim();
    return {
      title: sectionTitle.length > 0 ? sectionTitle : '\u200B',
      rows: section.rows.map((row) => {
        const rowDesc = String(row.description ?? '').trim();
        return {
          title: String(row.title ?? ''),
          description: rowDesc.length > 0 ? rowDesc : '\u200B',
          rowId: String(row.rowId ?? ''),
        };
      }),
    };
  });

  const body: Record<string, any> = {
    type: 'list',
    phoneNumber,
    instance,
    list: normalizedList,
  };

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
  };

  console.log(`[Dialogy API Action] Sending list to phone ${phoneNumber}. Endpoint: ${endpoint}, Payload:`, JSON.stringify(body));

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    const responseData: DialogyApiResponse = await response.json();

    if (!response.ok) {
      console.error('[Dialogy API Action] Error response on list send:', responseData);
      const errorMessage = responseData.message || JSON.stringify(responseData);
      return {
        success: false,
        error: `Erro da API Dialogy (lista): ${response.status} - ${errorMessage}`,
        data: responseData,
      };
    }

    console.log('[Dialogy API Action] Success response on list send:', responseData);
    return { success: true, data: responseData };
  } catch (error: any) {
    console.error('[Dialogy API Action] Fetch error on list send:', error);
    return { success: false, error: `Falha ao enviar lista para o Dialogy: ${error.message || 'Erro de rede desconhecido'}` };
  }
}

async function transferDialogyChat(
  params: TransferDialogyChatParams,
  target: 'team' | 'ai'
): Promise<{ success: boolean; data?: DialogyApiResponse; error?: string }> {
  const { baseUrl, apiKey, chatId, targetId } = params;
  if (!baseUrl || !apiKey || !chatId || !targetId) {
    return { success: false, error: 'Parâmetros ausentes para transferir a conversa na Dialogy.' };
  }

  const path = target === 'team' ? 'transfer' : 'transfer-to-ai';
  const endpoint = `${baseUrl.replace(/\/$/, '')}/api/agent/chats/${encodeURIComponent(chatId)}/${path}`;
  const body = target === 'team' ? { teamId: targetId } : { systemAgentId: targetId };

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });
    const data: DialogyApiResponse = await response.json();
    if (!response.ok || data?.success === false) {
      return {
        success: false,
        error: data?.error || data?.message || `Erro da API Dialogy: ${response.status}`,
        data,
      };
    }
    return { success: true, data };
  } catch (error: any) {
    return { success: false, error: `Falha ao transferir conversa na Dialogy: ${error.message || 'Erro de rede'}` };
  }
}

export async function transferDialogyChatToTeamAction(params: TransferDialogyChatParams) {
  return transferDialogyChat(params, 'team');
}

export async function transferDialogyChatToAiAction(params: TransferDialogyChatParams) {
  return transferDialogyChat(params, 'ai');
}

export async function closeDialogyChatAction(
  params: CloseDialogyChatParams
): Promise<{ success: boolean; data?: DialogyApiResponse; error?: string }> {
  const { baseUrl, apiKey, chatId } = params;
  if (!baseUrl || !apiKey || !chatId) {
    return { success: false, error: 'Parâmetros ausentes para encerrar a conversa na Dialogy.' };
  }

  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/api/agent/chats/close`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ chatId }),
    });
    const text = await response.text();
    let data: DialogyApiResponse = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { message: text };
    }
    if (!response.ok || data?.success === false) {
      return {
        success: false,
        error: data?.error || data?.message || `Erro da API Dialogy: ${response.status}`,
        data,
      };
    }
    return { success: true, data };
  } catch (error: any) {
    return { success: false, error: `Falha ao encerrar conversa na Dialogy: ${error.message || 'Erro de rede'}` };
  }
}

export async function sendDialogyTemplateMessageAction(
  params: SendDialogyTemplateParams
): Promise<{ success: boolean; data?: DialogyApiResponse; error?: string }> {
  const { baseUrl, apiKey, phoneNumber, instance, name, language, components, renderedContent } = params;
  if (!baseUrl || !apiKey || !phoneNumber || !instance || !name || !language) {
    return { success: false, error: 'Parâmetros ausentes para enviar template pela Dialogy.' };
  }

  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/api/agent/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        type: 'template',
        phoneNumber,
        instance,
        template: { name, language, components, renderedContent },
      }),
    });
    const text = await response.text();
    const data = text ? JSON.parse(text) : {};
    if (!response.ok || data?.success === false) {
      return { success: false, error: data?.error || data?.message || `Erro da API Dialogy: ${response.status}`, data };
    }
    return { success: true, data };
  } catch (error: any) {
    return { success: false, error: `Falha ao enviar template pela Dialogy: ${error.message || 'Erro de rede'}` };
  }
}

export async function getDialogyTemplatesForInstanceAction(instanceId: string): Promise<{
  success: boolean;
  templates: DialogyTemplateSummary[];
  error?: string;
}> {
  if (!instanceId) return { success: false, templates: [], error: 'Instância Dialogy não configurada.' };
  const instance = await loadDialogyInstanceFromDB(instanceId);
  if (!instance) return { success: false, templates: [], error: 'Instância Dialogy não encontrada.' };

  try {
    const response = await fetch(`${instance.baseUrl.replace(/\/$/, '')}/api/agent/templates`, {
      headers: { 'Authorization': `Bearer ${instance.apiKey}` },
      cache: 'no-store',
    });
    const text = await response.text();
    let data: any = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      return { success: false, templates: [], error: 'A Dialogy ainda não publicou o endpoint de templates do Nexusflow.' };
    }
    if (!response.ok) {
      return { success: false, templates: [], error: data?.error || `Erro da API Dialogy: ${response.status}` };
    }
    return { success: true, templates: Array.isArray(data?.templates) ? data.templates : [] };
  } catch (error: any) {
    return { success: false, templates: [], error: `Falha ao consultar templates da Dialogy: ${error.message || 'Erro de rede'}` };
  }
}

export async function getDialogyTransferTargetsAction(
  baseUrl: string,
  apiKey: string
): Promise<DialogyTransferTargetsResult> {
  if (!baseUrl || !apiKey) {
    return { success: false, teams: [], intelligentAgents: [], error: 'Instância Dialogy não configurada.' };
  }

  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/api/agent/transfer-targets`, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
      cache: 'no-store',
    });
    const data = await response.json();
    if (!response.ok) {
      return {
        success: false,
        teams: [],
        intelligentAgents: [],
        error: data?.error || `Erro da API Dialogy: ${response.status}`,
      };
    }
    return {
      success: true,
      workspace: data?.workspace,
      teams: Array.isArray(data?.teams) ? data.teams : [],
      intelligentAgents: Array.isArray(data?.intelligentAgents) ? data.intelligentAgents : [],
    };
  } catch (error: any) {
    return {
      success: false,
      teams: [],
      intelligentAgents: [],
      error: `Falha ao consultar destinos da Dialogy: ${error.message || 'Erro de rede'}`,
    };
  }
}

export async function getDialogyTransferTargetsForInstanceAction(instanceId: string): Promise<DialogyTransferTargetsResult> {
  if (!instanceId) {
    return { success: false, teams: [], intelligentAgents: [], error: 'Instância Dialogy não configurada.' };
  }
  const instance = await loadDialogyInstanceFromDB(instanceId);
  if (!instance) {
    return { success: false, teams: [], intelligentAgents: [], error: 'Instância Dialogy não encontrada.' };
  }
  return getDialogyTransferTargetsAction(instance.baseUrl, instance.apiKey);
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
