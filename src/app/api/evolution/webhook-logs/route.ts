
import { NextResponse } from 'next/server';
// Removido NextRequest pois não é usado diretamente aqui

declare global {
  // eslint-disable-next-line no-var
  var evolutionWebhookLogs: Array<any>; 
}

// Inicialização robusta da variável global de logs
if (!globalThis.evolutionWebhookLogs || !Array.isArray(globalThis.evolutionWebhookLogs)) {
  console.log(`[GLOBAL_INIT in webhook-logs/route.ts] Initializing globalThis.evolutionWebhookLogs as new array.`);
  globalThis.evolutionWebhookLogs = [];
} else {
  console.log(`[GLOBAL_INIT in webhook-logs/route.ts] globalThis.evolutionWebhookLogs already exists. Length: ${globalThis.evolutionWebhookLogs.length}`);
}

export async function GET() {
  // Defensiva extra, embora a inicialização no topo do módulo deva cobrir isso.
  if (!globalThis.evolutionWebhookLogs || !Array.isArray(globalThis.evolutionWebhookLogs)) {
     console.warn('[Evolution API Webhook Logs Route - GET] globalThis.evolutionWebhookLogs became invalid before GET. This is unexpected. Resetting.');
     globalThis.evolutionWebhookLogs = [];
  }
  
  console.log(`[Evolution API Webhook Logs Route - GET] Current state of globalThis.evolutionWebhookLogs. Length: ${globalThis.evolutionWebhookLogs.length}, IsArray: ${Array.isArray(globalThis.evolutionWebhookLogs)}`);
  // Para depuração, logar um resumo dos timestamps se houver logs
  if (globalThis.evolutionWebhookLogs.length > 0) {
    console.log(`[Evolution API Webhook Logs Route - GET] Timestamps of stored logs: ${globalThis.evolutionWebhookLogs.map(log => log.timestamp).join(', ')}`);
  }

  return NextResponse.json(globalThis.evolutionWebhookLogs, { status: 200 });
}

    