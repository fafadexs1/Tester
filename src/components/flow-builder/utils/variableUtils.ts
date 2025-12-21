import { NodeData, StartNodeTrigger, WorkspaceData } from '@/lib/types';

export type VariableKind = 'array' | 'object' | 'string' | 'number' | 'boolean' | 'value' | 'unknown';
export type VariableOption = { name: string; kind: VariableKind };

export const VARIABLE_KIND_PRIORITY: Record<VariableKind, number> = {
    array: 4,
    object: 3,
    string: 2,
    number: 2,
    boolean: 2,
    value: 1,
    unknown: 0,
};

export const BASE_VARIABLE_KINDS: Record<string, VariableKind> = {
    session_id: 'string',
    mensagem_whatsapp: 'string',
    webhook_payload: 'object',
    chatwoot_conversation_id: 'string',
    chatwoot_contact_id: 'string',
    chatwoot_account_id: 'string',
    chatwoot_inbox_id: 'string',
    contact_name: 'string',
    contact_phone: 'string',
};

export const normalizeVariableNameForHint = (value?: string): string | null => {
    if (!value || typeof value !== 'string') return null;
    const cleaned = value.replace(/\{\{|\}\}/g, '').trim();
    return cleaned || null;
};

export const toSafeJsIdentifier = (rawName: string): string => {
    const cleaned = rawName.replace(/[^\w]/g, '_');
    const prefixed = cleaned.match(/^[0-9]/) ? `_${cleaned}` : cleaned;
    return prefixed || 'variavel';
};

export const describeVariableKind = (kind: VariableKind): string => {
    switch (kind) {
        case 'array':
            return 'lista';
        case 'object':
            return 'objeto';
        case 'string':
            return 'texto';
        case 'number':
            return 'número';
        case 'boolean':
            return 'booleano';
        case 'value':
            return 'valor';
        default:
            return 'desconhecido';
    }
};

export const buildVariableOptions = (availableVariables: string[], workspace?: WorkspaceData | null): VariableOption[] => {
    const typeHints = new Map<string, VariableKind>();

    const registerHint = (rawName: string | undefined, kind: VariableKind) => {
        const name = normalizeVariableNameForHint(rawName);
        if (!name) return;
        const current = typeHints.get(name) || 'unknown';
        if (VARIABLE_KIND_PRIORITY[kind] > VARIABLE_KIND_PRIORITY[current]) {
            typeHints.set(name, kind);
        }
    };

    Object.entries(BASE_VARIABLE_KINDS).forEach(([name, kind]) => typeHints.set(name, kind));

    if (workspace?.nodes) {
        workspace.nodes.forEach(node => {
            if (node.type === 'start' && Array.isArray((node as any).triggers)) {
                ((node as any).triggers as StartNodeTrigger[]).forEach(trigger => {
                    (trigger.variableMappings || []).forEach(mapping => registerHint(mapping.flowVariable, 'value'));
                });
            }

            switch (node.type) {
                case 'input':
                    registerHint(node.variableToSaveResponse, 'string');
                    break;
                case 'option':
                    registerHint(node.variableToSaveChoice, 'string');
                    break;
                case 'date-input':
                    registerHint(node.variableToSaveDate, 'string');
                    break;
                case 'rating-input':
                    registerHint(node.ratingOutputVariable, 'number');
                    break;
                case 'set-variable':
                    registerHint(node.variableName, 'value');
                    break;
                case 'api-call':
                    registerHint(node.apiOutputVariable, 'object');
                    (node.apiResponseMappings || []).forEach(mapping => registerHint(mapping.flowVariable, mapping.extractAs === 'list' ? 'array' : 'value'));
                    break;
                case 'json-transform':
                    registerHint(node.jsonOutputVariable, 'object');
                    break;
                case 'file-upload':
                    registerHint(node.fileUrlVariable, 'string');
                    break;
                case 'ai-text-generation':
                    registerHint(node.aiOutputVariable, 'string');
                    break;
                case 'intelligent-agent':
                    registerHint(node.agentResponseVariable, 'string');
                    break;
                case 'code-execution':
                    registerHint(node.codeOutputVariable, 'value');
                    break;
                case 'supabase-read-row':
                    registerHint(node.supabaseResultVariable, 'array');
                    break;
                case 'supabase-create-row':
                case 'supabase-update-row':
                case 'supabase-delete-row':
                    registerHint(node.supabaseResultVariable, 'object');
                    break;
                default:
                    break;
            }
        });
    }

    return availableVariables.map(name => ({
        name,
        kind: typeHints.get(name) || 'unknown',
    }));
};
