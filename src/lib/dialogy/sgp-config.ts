import 'server-only';
import { loadDialogyInstanceFromDB } from '@/app/actions/databaseActions';

export interface DialogySGPApplicationConfig {
  endpoint: string;
  paymentPromiseEndpoint: string;
  app: string;
  token: string;
}

export async function loadDialogySGPApplicationConfig(instanceId: string): Promise<{
  success: boolean;
  config?: DialogySGPApplicationConfig;
  error?: string;
}> {
  if (!instanceId) return { success: false, error: 'Instância Dialogy não configurada.' };
  const instance = await loadDialogyInstanceFromDB(instanceId);
  if (!instance) return { success: false, error: 'Instância Dialogy não encontrada.' };

  try {
    const response = await fetch(`${instance.baseUrl.replace(/\/$/, '')}/api/agent/sgp-config`, {
      headers: { 'Authorization': `Bearer ${instance.apiKey}` },
      cache: 'no-store',
    });
    const text = await response.text();
    let data: any = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      return { success: false, error: 'A Dialogy ainda não publicou o endpoint de configuração SGP.' };
    }
    if (!response.ok) return { success: false, error: data?.error || `Erro da API Dialogy: ${response.status}` };
    if (!data?.endpoint || !data?.paymentPromiseEndpoint || !data?.app || !data?.token) {
      return { success: false, error: 'A configuração SGP retornada pela Dialogy está incompleta.' };
    }
    return {
      success: true,
      config: {
        endpoint: data.endpoint,
        paymentPromiseEndpoint: data.paymentPromiseEndpoint,
        app: data.app,
        token: data.token,
      },
    };
  } catch (error: any) {
    return { success: false, error: `Falha ao consultar a configuração SGP da Dialogy: ${error.message || 'Erro de rede'}` };
  }
}
