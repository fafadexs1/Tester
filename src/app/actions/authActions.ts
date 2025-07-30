
'use server';

import { createSession, deleteSession } from '@/lib/auth';
import type { User } from '@/lib/types';
import { cookies } from 'next/headers';

// Em uma aplicação real, você buscaria de um banco de dados aqui.
// Para este exemplo, a validação de senha será feita aqui, no lado do servidor.
// Como não temos um banco de dados real, vamos simular lendo de um "banco" conceitual
// que as ações do lado do cliente escrevem (localStorage). 
// AVISO: Esta abordagem é insegura e apenas para fins de demonstração.
// Em um aplicativo real, use um banco de dados com senhas hasheadas.
async function validateUser(username: string, pass: string): Promise<boolean> {
    // Esta função precisaria de uma forma de acessar os dados do usuário.
    // Como Server Actions não podem ler o localStorage do cliente, esta é uma limitação
    // do nosso setup de demonstração sem banco. 
    // Para contornar isso, temporariamente vamos assumir que a validação é sempre bem-sucedida
    // se o usuário existir, e o erro será tratado se o usuário não existir no registerAction.
    // Em um app real:
    // 1. Busque o hash da senha do usuário no DB pelo `username`.
    // 2. Compare o hash da senha fornecida com o hash do DB.
    // 3. Retorne true se corresponderem.
    // console.log(`[validateUser] Validando usuário: ${username}. Na demo, isso sempre retorna true se o usuário existir.`);
    return true; // Simulação para a demo
}


export async function loginAction(formData: FormData): Promise<{ success: boolean; error?: string; user?: User }> {
  const username = formData.get('username') as string;
  const password = formData.get('password') as string;

  if (!username || !password) {
    return { success: false, error: "Nome de usuário e senha são obrigatórios." };
  }
  
  // Em uma aplicação real, aqui você faria a verificação da senha contra o hash no seu banco de dados.
  // Como estamos simulando, pulamos essa etapa e confiamos na ação do lado do cliente para ter
  // verificado a senha (mesmo que isso seja inseguro para produção).

  try {
    // Aqui você validaria a senha: const isValid = await validateUser(username, password);
    // if (!isValid) {
    //     return { success: false, error: "Usuário ou senha inválidos." };
    // }

    const user: User = { username };
    await createSession(user);
    console.log(`[loginAction] Sessão criada com sucesso para o usuário: ${username}`);
    return { success: true, user };
  } catch (error: any) {
    console.error("[Login Action Error]:", error);
    return { success: false, error: "Ocorreu um erro no servidor durante o login." };
  }
}

export async function registerAction(formData: FormData): Promise<{ success: boolean; error?: string; user?: User }> {
    const username = formData.get('username') as string;
    // O password seria usado aqui para criar um hash e salvar no banco de dados.
    // Como não temos DB, essa lógica fica apenas conceitual.
     if (!username) {
        return { success: false, error: "Nome de usuário é obrigatório." };
    }
    
    // Em um aplicativo real, você primeiro verificaria se o nome de usuário já existe no seu DB.
    // Ex: const existingUser = await db.users.findUnique({ where: { username } });
    // if (existingUser) { return { success: false, error: "Nome de usuário já existe." }; }
    // Depois, você faria o hash da senha e armazenaria o novo registro do usuário.

    try {
        const user: User = { username };
        await createSession(user);
        console.log(`[registerAction] Sessão criada com sucesso para o novo usuário: ${username}`);
        return { success: true, user };
    } catch (error: any) {
        console.error("[Register Action Error]:", error);
        return { success: false, error: "Ocorreu um erro no servidor durante o registro." };
    }
}


export async function logoutAction(): Promise<{ success: boolean }> {
  await deleteSession();
  console.log('[logoutAction] Sessão do usuário deletada.');
  return { success: true };
}
