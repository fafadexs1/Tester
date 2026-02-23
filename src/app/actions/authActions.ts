
'use server';

import { createSession, deleteSession } from '@/lib/auth';
import type { User, Organization } from '@/lib/types';
import { cookies } from 'next/headers';
import { findUserByUsername, findUserByEmail, createUser, createOrganization, getOrganizationsForUser, setCurrentOrganizationForUser, createAuditLog, getUserById } from './databaseActions';
import { createHmac, timingSafeEqual } from 'node:crypto';

// Simulação de hashing de senha. Em um app real, use uma biblioteca como bcrypt.
// AVISO: NÃO USE ISTO EM PRODUÇÃO.
const simpleHash = (pass: string) => `hashed_${pass}`;
const verifyPassword = (pass: string, hash: string) => hash === simpleHash(pass);
const SSO_MAX_AGE_SECONDS = 120;

function normalizeSsoMode(raw: unknown): 'workspace_managed' | 'existing_account' {
    return raw === 'existing_account' ? 'existing_account' : 'workspace_managed';
}

function buildSsoSignature(params: {
    email: string;
    workspaceId: string;
    mode: 'workspace_managed' | 'existing_account';
    issuedAt: number;
    targetUserId?: string;
}, secret: string): string {
    const canonical = [
        params.email.trim().toLowerCase(),
        params.workspaceId,
        params.mode,
        String(params.issuedAt),
        params.targetUserId || '',
    ].join('|');
    return createHmac('sha256', secret).update(canonical).digest('hex');
}

function safeHexEqual(a: string, b: string): boolean {
    const bufA = Buffer.from(a || '', 'hex');
    const bufB = Buffer.from(b || '', 'hex');
    if (bufA.length === 0 || bufB.length === 0 || bufA.length !== bufB.length) {
        return false;
    }
    return timingSafeEqual(bufA, bufB);
}

function verifyDialogySsoPayload(ssoUser: any): { valid: boolean; error?: string } {
    const secret = (process.env.DIALOGY_INTERNAL_SECRET || '').trim();
    if (!secret) {
        return { valid: false, error: 'SSO secret not configured on NexusFlow.' };
    }

    if (!ssoUser || ssoUser.sso_source !== 'dialogy') {
        return { valid: false, error: 'Invalid SSO source.' };
    }

    const issuedAt = Number(ssoUser.sso_issued_at);
    if (!Number.isFinite(issuedAt)) {
        return { valid: false, error: 'Invalid SSO timestamp.' };
    }

    const now = Math.floor(Date.now() / 1000);
    if (issuedAt > now + 30 || now - issuedAt > SSO_MAX_AGE_SECONDS) {
        return { valid: false, error: 'SSO token expired.' };
    }

    const email = String(ssoUser.email || '').trim().toLowerCase();
    const workspaceId = String(ssoUser.workspace_id || '').trim();
    const mode = normalizeSsoMode(ssoUser.nexus_link_mode);
    const targetUserId = String(ssoUser.sso_target_user_id || '').trim();
    const providedSignature = String(ssoUser.sso_signature || '').trim();

    if (!email || !workspaceId || !providedSignature) {
        return { valid: false, error: 'SSO payload missing required fields.' };
    }

    const expectedSignature = buildSsoSignature({
        email,
        workspaceId,
        mode,
        issuedAt,
        targetUserId,
    }, secret);

    if (!safeHexEqual(providedSignature, expectedSignature)) {
        return { valid: false, error: 'Invalid SSO signature.' };
    }

    return { valid: true };
}


export async function loginAction(formData: FormData): Promise<{ success: boolean; error?: string; user?: User }> {
    console.log('[authActions.ts] loginAction: Iniciando...');
    const loginIdentifierRaw = formData.get('username');
    const passwordRaw = formData.get('password');
    const loginIdentifier = typeof loginIdentifierRaw === 'string' ? loginIdentifierRaw.trim() : '';
    const password = typeof passwordRaw === 'string' ? passwordRaw : '';

    if (!loginIdentifier || !password) {
        console.log('[authActions.ts] loginAction: Erro - Campos faltando.');
        return { success: false, error: "Usuario/e-mail e senha sao obrigatorios." };
    }

    try {
        let dbUser: User | null = null;

        if (loginIdentifier.includes('@')) {
            dbUser = await findUserByEmail(loginIdentifier);
        }

        if (!dbUser) {
            dbUser = await findUserByUsername(loginIdentifier);
        }

        if (!dbUser) {
            console.log(`[authActions.ts] loginAction: Identificador '${loginIdentifier}' nao encontrado.`);
            return { success: false, error: "Usuario ou senha invalidos." };
        }

        // A verificacao de senha real deve ser feita com uma biblioteca como bcrypt no futuro.
        const passwordMatches = verifyPassword(password, dbUser.password_hash || '');
        if (!passwordMatches) {
            console.log(`[authActions.ts] loginAction: Senha invalida para o identificador '${loginIdentifier}'.`);
            return { success: false, error: "Usuario ou senha invalidos." };
        }

        // Apos o login bem-sucedido, busca as organizacoes do usuario
        let organizations = await getOrganizationsForUser(dbUser.id);

        if (organizations.length === 0) {
            console.warn(`[authActions.ts] Usuario ${dbUser.username} nao possui organizacoes. Criando uma organizacao padrao...`);
            const orgResult = await createOrganization(`Organizacao de ${dbUser.username}`, dbUser.id);
            if (orgResult.success && orgResult.organization) {
                organizations = await getOrganizationsForUser(dbUser.id);
                console.log(`[authActions.ts] Organizacao padrao criada com sucesso: ${orgResult.organization.name}`);
            } else {
                console.error(`[authActions.ts] Falha critica ao criar organizacao padrao para o usuario ${dbUser.username}.`);
                return { success: false, error: "Falha ao configurar a conta do usuario. Nao foi possivel criar a organizacao inicial." };
            }
        }

        let currentOrganizationId = dbUser.current_organization_id;

        if (!currentOrganizationId && organizations.length > 0) {
            currentOrganizationId = organizations[0].id;
            await setCurrentOrganizationForUser(dbUser.id, currentOrganizationId);
        }

        // Cria a sessao com os dados do usuario, garantindo que o ID da organizacao atual esteja presente.
        const user: User = {
            id: dbUser.id,
            username: dbUser.username,
            email: dbUser.email,
            fullName: dbUser.fullName || (dbUser as User & { full_name?: string }).full_name,
            role: dbUser.role,
            current_organization_id: currentOrganizationId
        };
        await createSession(user);

        if (currentOrganizationId) {
            await createAuditLog(user.id, currentOrganizationId, 'user_login', { method: 'password' });
        } else {
            console.error(`[authActions.ts] loginAction: currentOrganizationId e nulo para o usuario ${user.username}, nao foi possivel criar o log de auditoria.`);
        }

        console.log(`[authActions.ts] loginAction: Sessao criada com sucesso para o usuario: ${user.username}, role: ${user.role}, org: ${user.current_organization_id}`);
        return { success: true, user };

    } catch (error: any) {
        console.error("[authActions.ts] loginAction: Excecao durante a operacao:", error);
        const errorMessage = error instanceof Error ? error.message : "Ocorreu um erro no servidor durante o login.";
        return { success: false, error: errorMessage };
    }
}

export async function registerAction(formData: FormData): Promise<{ success: boolean; error?: string; user?: User }> {
    console.log('[authActions.ts] registerAction: Iniciando...');
    const username = formData.get('username') as string;
    const password = formData.get('password') as string;
    const fullName = formData.get('fullName') as string;
    const email = formData.get('email') as string;

    if (!username || !password || !fullName || !email) {
        return { success: false, error: "Todos os campos são obrigatórios." };
    }

    try {
        const existingUser = await findUserByUsername(username);
        if (existingUser) {
            return { success: false, error: "Este nome de usuário já está em uso." };
        }

        const passwordHash = simpleHash(password);

        // Cria o usuário com a role padrão 'user' e os novos campos
        const createResult = await createUser(username, passwordHash, fullName, email, 'user');

        if (!createResult.success || !createResult.user) {
            return { success: false, error: createResult.error || "Falha ao registrar usuário." };
        }

        const newUser = createResult.user;

        // Cria a primeira organização para o novo usuário
        const orgResult = await createOrganization(`Organização de ${username}`, newUser.id);
        if (!orgResult.success || !orgResult.organization) {
            // Em um cenário real, aqui seria necessário fazer um rollback da criação do usuário ou lidar com o erro
            return { success: false, error: "Falha ao criar la organização inicial do usuário." };
        }

        // Define a organização recém-criada como a atual do usuário
        await setCurrentOrganizationForUser(newUser.id, orgResult.organization.id);

        const finalUser: User = { ...newUser, current_organization_id: orgResult.organization.id };

        // Cria a sessão para o novo usuário
        await createSession(finalUser);
        await createAuditLog(finalUser.id, finalUser.current_organization_id || null, 'user_register');

        console.log(`[authActions.ts] registerAction: Sessão criada com sucesso para o novo usuário: ${finalUser.username}`);
        return { success: true, user: finalUser };

    } catch (error: any) {
        console.error("[authActions.ts] registerAction: Exceção durante o registro:", error);
        const errorMessage = error instanceof Error ? error.message : "Ocorreu um erro no servidor durante o registro.";
        return { success: false, error: errorMessage };
    }
}


export async function logoutAction(): Promise<{ success: boolean }> {
    console.log('[authActions.ts] logoutAction: Deletando sessão...');
    await deleteSession();
    console.log('[authActions.ts] logoutAction: Sessão do usuário deletada.');
    return { success: true };
}

export async function refreshUserSessionAction(userId: string): Promise<{ success: boolean; user?: User; error?: string }> {
    try {
        const user = await getUserById(userId);
        if (!user) {
            return { success: false, error: 'Usuário não encontrado para atualizar a sessão.' };
        }
        await createSession(user);
        return { success: true, user };
    } catch (error: any) {
        return { success: false, error: `Erro ao atualizar a sessão: ${error.message}` };
    }
}

export async function ssoLoginAction(ssoUser: any): Promise<{ success: boolean; error?: string; user?: User }> {
    console.log('[authActions.ts] ssoLoginAction: Iniciando SSO...', ssoUser.email);

    if (!ssoUser || !ssoUser.email) {
        return { success: false, error: "Dados de SSO invalidos." };
    }

    try {
        const ssoValidation = verifyDialogySsoPayload(ssoUser);
        if (!ssoValidation.valid) {
            console.warn('[authActions.ts] SSO payload rejected:', ssoValidation.error);
            return { success: false, error: ssoValidation.error || 'Falha de validacao no SSO.' };
        }

        const requestedLinkMode = normalizeSsoMode(ssoUser.nexus_link_mode);
        const requireExistingAccount = requestedLinkMode === 'existing_account';
        const requestedTargetUserId = String(ssoUser.sso_target_user_id || '').trim();

        let dbUser: User | null = null;
        if (requestedTargetUserId) {
            dbUser = await getUserById(requestedTargetUserId);
            if (dbUser && dbUser.email?.toLowerCase() !== String(ssoUser.email).trim().toLowerCase()) {
                return {
                    success: false,
                    error: 'Conta vinculada invalida: o ID recebido nao corresponde ao e-mail configurado.'
                };
            }
        }
        if (!dbUser) {
            dbUser = await findUserByEmail(String(ssoUser.email).trim().toLowerCase());
        }

        if (!dbUser) {
            if (requireExistingAccount) {
                console.warn(`[authActions.ts] SSO existing-account mode: user not found for ${ssoUser.email}.`);
                return {
                    success: false,
                    error: 'A conta NexusFlow vinculada nao existe. Atualize o e-mail no Dialogy ou crie o usuario no NexusFlow.'
                };
            }

            console.log(`[authActions.ts] Usuario SSO nao encontrado. Criando novo usuario para ${ssoUser.email}...`);
            const randomPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8);
            const passwordHash = simpleHash(randomPassword);

            let username = String(ssoUser.email).split('@')[0];
            const userCheck = await findUserByUsername(username);
            if (userCheck) {
                username = `${username}_${Math.floor(Math.random() * 1000)}`;
            }

            const fullName = ssoUser.full_name || ssoUser.user_metadata?.full_name || username;

            const createResult = await createUser(username, passwordHash, fullName, String(ssoUser.email).trim().toLowerCase(), 'user');
            if (createResult.success && createResult.user) {
                dbUser = createResult.user;

                const orgResult = await createOrganization(`Organizacao de ${username}`, dbUser.id);
                if (orgResult.success && orgResult.organization) {
                    await setCurrentOrganizationForUser(dbUser.id, orgResult.organization.id);
                    dbUser.current_organization_id = orgResult.organization.id;
                }
            } else {
                return { success: false, error: 'Falha ao criar usuario via SSO.' };
            }
        }

        if (dbUser) {
            if (!dbUser.current_organization_id) {
                const organizations = await getOrganizationsForUser(dbUser.id);
                if (organizations.length > 0) {
                    dbUser.current_organization_id = organizations[0].id;
                    await setCurrentOrganizationForUser(dbUser.id, organizations[0].id);
                }
            }

            await createSession(dbUser);
            await createAuditLog(dbUser.id, dbUser.current_organization_id || null, 'user_login_sso');
            console.log(`[authActions.ts] SSO Login bem-sucedido para: ${dbUser.username}`);
            return { success: true, user: dbUser };
        }

        return { success: false, error: 'Erro desconhecido no SSO.' };

    } catch (error: any) {
        console.error('[authActions.ts] ssoLoginAction Error:', error);
        return { success: false, error: error.message };
    }
}

