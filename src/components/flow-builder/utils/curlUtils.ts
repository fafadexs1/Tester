import { NodeData } from '@/lib/types';

export type SimpleKeyValue = { key: string; value: string };

export interface ParsedCurlResult {
    url: string;
    method: NodeData['apiMethod'];
    headers: SimpleKeyValue[];
    queryParams: SimpleKeyValue[];
    formData: SimpleKeyValue[];
    bodyType: NodeData['apiBodyType'];
    bodyJson?: string;
    bodyRaw?: string;
    auth?: {
        type: NodeData['apiAuthType'];
        bearerToken?: string;
        basicUser?: string;
        basicPassword?: string;
    };
}

const SUPPORTED_HTTP_METHODS: NodeData['apiMethod'][] = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];

const stripWrappingQuotes = (value: string) => {
    if (!value) return value;
    const trimmed = value.trim();
    if (
        (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
        (trimmed.startsWith("'") && trimmed.endsWith("'"))
    ) {
        return trimmed.slice(1, -1);
    }
    return trimmed;
};

const safeDecodeURIComponent = (value: string) => {
    try {
        return decodeURIComponent(value);
    } catch {
        return value;
    }
};

const parseQueryStringPairs = (query: string): SimpleKeyValue[] => {
    if (!query) return [];
    return query
        .split('&')
        .map(segment => {
            if (!segment) return null;
            const [rawKey, ...rest] = segment.split('=');
            const key = safeDecodeURIComponent(rawKey || '').trim();
            const value = safeDecodeURIComponent(rest.join('='));
            if (!key) return null;
            return { key, value };
        })
        .filter((item): item is SimpleKeyValue => Boolean(item));
};

const splitUrlAndParams = (rawUrl: string) => {
    const questionIndex = rawUrl.indexOf('?');
    if (questionIndex === -1) {
        return { baseUrl: rawUrl, params: [] as SimpleKeyValue[] };
    }
    const baseUrl = rawUrl.slice(0, questionIndex);
    const query = rawUrl.slice(questionIndex + 1);
    return { baseUrl, params: parseQueryStringPairs(query) };
};

const tokenizeCurlCommand = (command: string): string[] => {
    const tokens: string[] = [];
    let current = '';
    let quote: '"' | "'" | null = null;
    let escapeNext = false;

    for (const char of command) {
        if (escapeNext) {
            current += char;
            escapeNext = false;
            continue;
        }

        if (char === '\\' && quote !== "'") {
            escapeNext = true;
            continue;
        }

        if (char === '"' || char === "'") {
            if (quote === char) {
                quote = null;
            } else if (!quote) {
                quote = char;
            } else {
                current += char;
            }
            continue;
        }

        if (!quote && /\s/.test(char)) {
            if (current) {
                tokens.push(current);
                current = '';
            }
            continue;
        }

        current += char;
    }

    if (current) {
        tokens.push(current);
    }

    return tokens.filter(Boolean);
};

const formatJsonIfPossible = (value: string) => {
    try {
        return JSON.stringify(JSON.parse(value), null, 2);
    } catch {
        return null;
    }
};

const parseKeyValueArgument = (value?: string): SimpleKeyValue | null => {
    if (!value) return null;
    const cleaned = stripWrappingQuotes(value);
    const equalsIndex = cleaned.indexOf('=');
    if (equalsIndex === -1) return null;
    const key = cleaned.slice(0, equalsIndex).trim();
    if (!key) return null;
    const rawValue = cleaned.slice(equalsIndex + 1).trim();
    return { key, value: stripWrappingQuotes(rawValue) };
};

const asSupportedMethod = (rawMethod?: string): NodeData['apiMethod'] | undefined => {
    if (!rawMethod) return undefined;
    const normalized = rawMethod.toUpperCase();
    return SUPPORTED_HTTP_METHODS.includes(normalized as NodeData['apiMethod'])
        ? (normalized as NodeData['apiMethod'])
        : undefined;
};

export const parseCurlCommand = (command: string): ParsedCurlResult => {
    const normalized = command
        .replace(/\r/g, '')
        .replace(/\\\s*\n/g, ' ')
        .trim();

    if (!normalized) {
        throw new Error('Cole um comando cURL valido.');
    }

    const tokens = tokenizeCurlCommand(normalized);
    if (!tokens.length) {
        throw new Error('Cole um comando cURL valido.');
    }

    if (tokens[0].toLowerCase() === 'curl') {
        tokens.shift();
    }

    if (!tokens.length) {
        throw new Error('Cole um comando cURL valido.');
    }

    let extractedUrl: string | undefined;
    let method: NodeData['apiMethod'] | undefined;
    const headerEntries: SimpleKeyValue[] = [];
    const queryEntries: SimpleKeyValue[] = [];
    const formEntries: SimpleKeyValue[] = [];
    const bodyChunks: string[] = [];
    let sendDataAsQuery = false;
    let hasBodyPayload = false;
    let hasJsonContentType = false;
    let authType: NodeData['apiAuthType'] | undefined;
    let bearerToken: string | undefined;
    let basicUser: string | undefined;
    let basicPassword: string | undefined;

    const appendQueryPairs = (value?: string) => {
        if (!value) return;
        parseQueryStringPairs(value).forEach(pair => queryEntries.push(pair));
    };

    const handleHeader = (value?: string) => {
        if (!value) return;
        const cleaned = value.trim();
        if (!cleaned) return;
        const separatorIndex = cleaned.indexOf(':');
        if (separatorIndex === -1) return;
        const headerKey = cleaned.slice(0, separatorIndex).trim();
        const headerValue = cleaned.slice(separatorIndex + 1).trim();
        if (!headerKey) return;

        const keyLower = headerKey.toLowerCase();
        if (keyLower === 'content-type' && headerValue.toLowerCase().includes('application/json')) {
            hasJsonContentType = true;
        }

        if (keyLower === 'authorization') {
            const lowerValue = headerValue.toLowerCase();
            if (lowerValue.startsWith('bearer ')) {
                authType = 'bearer';
                bearerToken = headerValue.slice(7).trim();
                return;
            }
            if (lowerValue.startsWith('basic ')) {
                const encoded = headerValue.slice(6).trim();
                try {
                    const decoded = atob(encoded);
                    const [user, ...rest] = decoded.split(':');
                    basicUser = user;
                    basicPassword = rest.join(':');
                    authType = 'basic';
                    return;
                } catch {
                    // If decoding fails we keep the header as-is
                }
            }
        }

        headerEntries.push({ key: headerKey, value: headerValue });
    };

    const handleData = (value?: string) => {
        if (value === undefined) return;
        if (sendDataAsQuery) {
            appendQueryPairs(value);
        } else {
            hasBodyPayload = true;
            bodyChunks.push(value);
        }
    };

    const handleFormEntry = (value?: string) => {
        const parsed = parseKeyValueArgument(value);
        if (!parsed) return;
        formEntries.push(parsed);
        hasBodyPayload = true;
    };

    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        const getNextValue = () => tokens[++i];

        if (token === '-X' || token === '--request') {
            method = asSupportedMethod(getNextValue());
            continue;
        }
        if (token.startsWith('-X') && token.length > 2) {
            method = asSupportedMethod(token.slice(2));
            continue;
        }
        if (token.startsWith('--request=')) {
            method = asSupportedMethod(token.slice(10));
            continue;
        }

        if (token === '-G' || token === '--get') {
            method = 'GET';
            sendDataAsQuery = true;
            continue;
        }

        if (token === '--url') {
            extractedUrl = getNextValue();
            continue;
        }
        if (token.startsWith('--url=')) {
            extractedUrl = token.slice(6);
            continue;
        }

        if (token === '-H' || token === '--header') {
            handleHeader(getNextValue());
            continue;
        }
        if (token.startsWith('-H') && token.length > 2) {
            handleHeader(token.slice(2));
            continue;
        }
        if (token.startsWith('--header=')) {
            handleHeader(token.slice(9));
            continue;
        }

        if (
            token === '-d' ||
            token === '--data' ||
            token === '--data-raw' ||
            token === '--data-binary' ||
            token === '--data-ascii'
        ) {
            handleData(getNextValue());
            continue;
        }
        if (token === '--json') {
            hasJsonContentType = true;
            handleData(getNextValue());
            continue;
        }
        if (token === '--data-urlencode') {
            handleData(getNextValue());
            continue;
        }
        if (token.startsWith('-d') && token.length > 2) {
            handleData(token.slice(2));
            continue;
        }
        if (token.startsWith('--data=')) {
            handleData(token.slice(7));
            continue;
        }
        if (token.startsWith('--data-raw=')) {
            handleData(token.slice(11));
            continue;
        }
        if (token.startsWith('--data-binary=')) {
            handleData(token.slice(14));
            continue;
        }
        if (token.startsWith('--data-urlencode=')) {
            handleData(token.slice(18));
            continue;
        }
        if (token.startsWith('--json=')) {
            hasJsonContentType = true;
            handleData(token.slice(7));
            continue;
        }

        if (token === '-F' || token === '--form' || token === '--form-string') {
            handleFormEntry(getNextValue());
            continue;
        }
        if (token.startsWith('-F') && token.length > 2) {
            handleFormEntry(token.slice(2));
            continue;
        }
        if (token.startsWith('--form=') || token.startsWith('--form-string=')) {
            const equalsIndex = token.indexOf('=');
            handleFormEntry(token.slice(equalsIndex + 1));
            continue;
        }

        if (token === '-u' || token === '--user') {
            const creds = getNextValue() || '';
            const [user, ...rest] = creds.split(':');
            basicUser = user;
            basicPassword = rest.join(':');
            authType = 'basic';
            continue;
        }
        if (token.startsWith('-u') && token.length > 2) {
            const creds = token.slice(2);
            const [user, ...rest] = creds.split(':');
            basicUser = user;
            basicPassword = rest.join(':');
            authType = 'basic';
            continue;
        }
        if (token.startsWith('--user=')) {
            const creds = token.slice(7);
            const [user, ...rest] = creds.split(':');
            basicUser = user;
            basicPassword = rest.join(':');
            authType = 'basic';
            continue;
        }

        if (token.startsWith('--oauth2-bearer=')) {
            authType = 'bearer';
            bearerToken = token.slice(17);
            continue;
        }
        if (token === '--oauth2-bearer' || token === '--bearer') {
            authType = 'bearer';
            bearerToken = getNextValue() || '';
            continue;
        }
        if (token.startsWith('--bearer=')) {
            authType = 'bearer';
            bearerToken = token.slice(9);
            continue;
        }

        if (token.startsWith('-') && token !== '-') {
            continue;
        }

        if (!extractedUrl) {
            extractedUrl = token;
        }
    }

    if (!extractedUrl) {
        throw new Error('Nao encontramos a URL principal no comando cURL.');
    }

    const cleanedUrl = stripWrappingQuotes(extractedUrl);
    const { baseUrl, params } = splitUrlAndParams(cleanedUrl);
    if (params.length) {
        params.forEach(param => queryEntries.push(param));
    }

    let bodyType: NodeData['apiBodyType'] = 'none';
    let bodyJson: string | undefined;
    let bodyRaw: string | undefined;

    if (formEntries.length) {
        bodyType = 'form-data';
    } else if (bodyChunks.length) {
        const rawBody = bodyChunks.join('\n');
        const trimmed = rawBody.trim();
        const treatAsJson = hasJsonContentType || /^[\[{]/.test(trimmed);
        if (trimmed && treatAsJson) {
            bodyType = 'json';
            bodyJson = formatJsonIfPossible(trimmed) ?? trimmed;
        } else {
            bodyType = 'raw';
            bodyRaw = rawBody;
        }
    }

    method = method ?? (hasBodyPayload ? 'POST' : 'GET');

    return {
        url: baseUrl,
        method,
        headers: headerEntries,
        queryParams: queryEntries,
        formData: formEntries,
        bodyType,
        bodyJson,
        bodyRaw,
        auth: authType
            ? {
                type: authType,
                bearerToken,
                basicUser,
                basicPassword,
            }
            : undefined,
    };
};
