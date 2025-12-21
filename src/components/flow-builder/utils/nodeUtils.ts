import { getProperty } from 'dot-prop';
export { getProperty };

export type PreviewResult =
    | { type: 'empty'; message: string }
    | { type: 'no-sample'; message: string }
    | { type: 'not-found'; message: string }
    | { type: 'error'; message: string }
    | { type: 'pending'; message: string }
    | { type: 'success'; value: any };

export const convertIndicesToBracketNotation = (path: string) => path.replace(/\.(\d+)/g, '[$1]');

export const buildVariableNameFromPath = (path: string) => {
    if (!path) return '';
    const cleaned = path
        .replace(/\[(\d+)\]/g, '_$1')
        .split(/[.$]/)
        .filter(Boolean)
        .pop();
    if (!cleaned) return '';
    return cleaned.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').toLowerCase();
};

export const arePropsEqual = (prev: any, next: any) => {
    if (prev.isSelected !== next.isSelected) return false;
    if (prev.node !== next.node) return false;
    if (prev.activeWorkspace?.id !== next.activeWorkspace?.id) return false;
    return true;
};

export const describePreviewValue = (value: any) => {
    if (Array.isArray(value)) return 'lista';
    if (value === null) return 'nulo';
    return typeof value;
};

export const formatPreviewValue = (value: any) => {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (Array.isArray(value)) {
        const serializedItems = value.map(item => {
            if (item === null) return 'null';
            if (item === undefined) return 'undefined';
            if (typeof item === 'object') {
                try {
                    return JSON.stringify(item);
                } catch {
                    return String(item);
                }
            }
            return String(item);
        });
        const joined = serializedItems.join('\n');
        return joined.length > 600 ? `${joined.slice(0, 600)}…` : joined;
    }
    if (typeof value === 'object') {
        try {
            const serialized = JSON.stringify(value, null, 2);
            return serialized.length > 600 ? `${serialized.slice(0, 600)}…` : serialized;
        } catch {
            return String(value);
        }
    }
    const stringified = String(value);
    return stringified.length > 600 ? `${stringified.slice(0, 600)}…` : stringified;
};

export const getWebhookMappingPreview = (path: string, sample: any): PreviewResult => {
    if (!path || path.trim() === '') {
        return { type: 'empty', message: 'Informe o caminho do dado para visualizar o resultado.' };
    }
    if (!sample) {
        return { type: 'no-sample', message: 'Cole ou importe um JSON de exemplo para testar este caminho.' };
    }
    try {
        const value = getProperty(sample, path);
        if (value === undefined) {
            return { type: 'not-found', message: 'Nenhum valor localizado nesse caminho no JSON de exemplo.' };
        }
        return { type: 'success', value };
    } catch (error: any) {
        return { type: 'error', message: error?.message || 'Caminho inválido.' };
    }
};

export const convertPayloadToEditorState = (payload: any) => {
    if (payload === null || payload === undefined) {
        return { text: '', data: null, error: 'Payload vazio. Dispare o webhook novamente para gerar dados.' };
    }
    if (typeof payload === 'string') {
        try {
            const parsed = JSON.parse(payload);
            return { text: JSON.stringify(parsed, null, 2), data: parsed, error: null };
        } catch {
            return {
                text: payload,
                data: null,
                error: 'O payload carregado está em texto plano. Cole/ajuste um JSON válido para habilitar a pré-visualização.',
            };
        }
    }
    try {
        return { text: JSON.stringify(payload, null, 2), data: payload, error: null };
    } catch {
        return {
            text: String(payload),
            data: null,
            error: 'Não foi possível serializar o payload carregado.',
        };
    }
};
