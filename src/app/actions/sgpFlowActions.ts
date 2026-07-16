'use server';

export interface FetchSGPSecondCopyParams {
  endpoint: string;
  token: string;
  app: string;
  cpfCnpj: string;
}

export interface FetchSGPPaymentPromiseParams {
  endpoint: string;
  token: string;
  app: string;
  contract: string | number;
  promiseDate: string;
}

export async function fetchSGPSecondCopyAction(params: FetchSGPSecondCopyParams): Promise<{
  success: boolean;
  data?: any;
  error?: string;
}> {
  const endpoint = String(params.endpoint || '').trim();
  const token = String(params.token || '').trim();
  const app = String(params.app || '').trim();
  const cpfCnpj = String(params.cpfCnpj || '').trim();

  if (!endpoint || !token || !app || !cpfCnpj) {
    return { success: false, error: 'Endpoint, token, app e CPF/CNPJ são obrigatórios para consultar o SGP.' };
  }

  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return { success: false, error: 'URL do endpoint SGP inválida.' };
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    return { success: false, error: 'O endpoint SGP deve usar HTTP ou HTTPS.' };
  }

  const formData = new FormData();
  formData.set('token', token);
  formData.set('app', app);
  formData.set('cpfcnpj', cpfCnpj);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(url, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
      cache: 'no-store',
    });
    const text = await response.text();
    let data: any;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      return { success: false, error: `O SGP respondeu em formato inválido (${response.status}).` };
    }
    if (!response.ok) {
      return { success: false, error: data?.detail || data?.error || data?.message || `Erro SGP: ${response.status}` };
    }
    return { success: true, data };
  } catch (error: any) {
    if (error?.name === 'AbortError') return { success: false, error: 'A consulta ao SGP excedeu 30 segundos.' };
    return { success: false, error: `Falha ao consultar o SGP: ${error?.message || 'Erro de rede'}` };
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchSGPPaymentPromiseAction(params: FetchSGPPaymentPromiseParams): Promise<{
  success: boolean;
  data?: any;
  error?: string;
}> {
  const endpoint = String(params.endpoint || '').trim();
  const token = String(params.token || '').trim();
  const app = String(params.app || '').trim();
  const contract = String(params.contract ?? '').trim();
  const promiseDate = String(params.promiseDate || '').trim();

  if (!endpoint || !token || !app || !contract || !/^\d{4}-\d{2}-\d{2}$/.test(promiseDate)) {
    return { success: false, error: 'Endpoint, token, app, contrato e data da promessa são obrigatórios.' };
  }

  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return { success: false, error: 'URL do endpoint de promessa SGP inválida.' };
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    return { success: false, error: 'O endpoint SGP deve usar HTTP ou HTTPS.' };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        app,
        token,
        contrato: /^\d+$/.test(contract) ? Number(contract) : contract,
        data_promessa: promiseDate,
      }),
      signal: controller.signal,
      cache: 'no-store',
    });
    const text = await response.text();
    let data: any;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      return { success: false, error: `O SGP respondeu em formato inválido (${response.status}).` };
    }
    if (!response.ok) {
      return { success: false, error: data?.detail || data?.error || data?.message || data?.msg || `Erro SGP: ${response.status}`, data };
    }
    return { success: true, data };
  } catch (error: any) {
    if (error?.name === 'AbortError') return { success: false, error: 'A promessa de pagamento excedeu 30 segundos.' };
    return { success: false, error: `Falha ao registrar promessa no SGP: ${error?.message || 'Erro de rede'}` };
  } finally {
    clearTimeout(timeout);
  }
}
