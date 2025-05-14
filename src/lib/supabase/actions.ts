
'use server';

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Helper function to create a Supabase client instance within server actions
// This client uses the service_role key for elevated privileges needed for schema inspection.
const getSupabaseClient = (supabaseUrl: string, supabaseServiceKey: string): SupabaseClient | null => {
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('[Supabase Actions] URL or Service Key is missing.');
    return null;
  }
  try {
    return createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        // It's good practice to disable auto-refresh for server-side clients
        // if you're not dealing with user sessions directly in these actions.
        autoRefreshToken: false,
        persistSession: false,
      }
    });
  } catch (e: any) {
    console.error('[Supabase Actions] Error creating Supabase client:', e.message);
    return null;
  }
};

export async function fetchSupabaseTablesAction(
  supabaseUrl: string,
  supabaseServiceKey: string
): Promise<{ data?: { name: string }[]; error?: string }> {
  console.log('[Supabase Actions] fetchSupabaseTablesAction called. URL:', supabaseUrl, 'Service Key Exists:', !!supabaseServiceKey);
  const supabase = getSupabaseClient(supabaseUrl, supabaseServiceKey);

  if (!supabase) {
    return { error: 'Falha ao inicializar o cliente Supabase. Verifique as credenciais nas Configurações Globais.' };
  }

  try {
    // This RPC function needs to be created in your Supabase SQL Editor.
    // See instructions in the main response.
    const { data, error } = await supabase.rpc('get_public_tables');

    if (error) {
      console.error('[Supabase Actions] Error fetching tables from RPC:', error);
      if (error.message.includes('function public.get_public_tables() does not exist')) {
        return { error: "Erro: A função 'get_public_tables' não existe no seu banco Supabase. Por favor, crie-a conforme as instruções." };
      }
      return { error: `Erro ao buscar tabelas: ${error.message}` };
    }
    
    console.log('[Supabase Actions] Tables fetched successfully:', data);
    // The RPC returns an array of objects, e.g., [{ table_name: 'users' }, { table_name: 'posts' }]
    // We need to map it to the expected format { name: string }[]
    const formattedData = data?.map((item: any) => ({ name: item.table_name })) || [];
    return { data: formattedData };

  } catch (e: any) {
    console.error('[Supabase Actions] Exception fetching tables:', e);
    return { error: `Exceção ao buscar tabelas: ${e.message}` };
  }
}

export async function fetchSupabaseTableColumnsAction(
  supabaseUrl: string,
  supabaseServiceKey: string,
  tableName: string
): Promise<{ data?: { name: string }[]; error?: string }> {
  console.log(`[Supabase Actions] fetchSupabaseTableColumnsAction called for table: ${tableName}. URL:`, supabaseUrl, 'Service Key Exists:', !!supabaseServiceKey);
  if (!tableName) {
    return { error: 'Nome da tabela não fornecido.' };
  }
  const supabase = getSupabaseClient(supabaseUrl, supabaseServiceKey);

  if (!supabase) {
    return { error: 'Falha ao inicializar o cliente Supabase. Verifique as credenciais nas Configurações Globais.' };
  }

  try {
    // This RPC function needs to be created in your Supabase SQL Editor.
    // See instructions in the main response.
    const { data, error } = await supabase.rpc('get_table_columns', {
      p_table_name: tableName,
    });

    if (error) {
      console.error(`[Supabase Actions] Error fetching columns for table ${tableName} from RPC:`, error);
       if (error.message.includes(`function public.get_table_columns(p_table_name => text) does not exist`)) {
        return { error: "Erro: A função 'get_table_columns' não existe no seu banco Supabase. Por favor, crie-a conforme as instruções." };
      }
      return { error: `Erro ao buscar colunas para ${tableName}: ${error.message}` };
    }
    
    console.log(`[Supabase Actions] Columns for ${tableName} fetched successfully:`, data);
    // The RPC returns an array of objects, e.g., [{ column_name: 'id' }, { column_name: 'name' }]
    // We need to map it to the expected format { name: string }[]
    const formattedData = data?.map((item: any) => ({ name: item.column_name })) || [];
    return { data: formattedData };

  } catch (e: any) {
    console.error(`[Supabase Actions] Exception fetching columns for ${tableName}:`, e);
    return { error: `Exceção ao buscar colunas para ${tableName}: ${e.message}` };
  }
}
