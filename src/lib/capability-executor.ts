import { Capability, CapabilityExecutionConfig } from '@/lib/types';

// Registry for local function execution
const functionRegistry: Record<string, (input: any) => Promise<any>> = {
    httpRequest: async (input: any) => {
        const { url, method = 'GET', headers = {}, body } = input;

        if (!url) {
            throw new Error('URL is required for http request');
        }

        const fetchOptions: RequestInit = {
            method,
            headers: {
                'Content-Type': 'application/json',
                ...headers,
            },
        };

        if (body && method !== 'GET' && method !== 'HEAD') {
            fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
        }

        console.log(`[httpRequest] ${method} ${url}`);

        try {
            const response = await fetch(url, fetchOptions);
            const contentType = response.headers.get('content-type');
            let data;

            if (contentType && contentType.includes('application/json')) {
                data = await response.json();
            } else {
                data = await response.text();
            }

            return {
                status: response.status,
                statusText: response.statusText,
                headers: Object.fromEntries(response.headers.entries()),
                data: data
            };
        } catch (error: any) {
            console.error(`[httpRequest] Error:`, error);
            return {
                error: error.message || 'Unknown error occurred during HTTP request'
            };
        }
    }
};

export async function executeCapability(capability: Capability, input: Record<string, any>): Promise<any> {
    const config = capability.execution_config;
    if (!config) {
        throw new Error('No execution configuration found for this capability.');
    }

    if (config.type === 'api') {
        return executeApiCapability(config, input);
    } else if (config.type === 'function') {
        const functionName = config.functionName;
        if (!functionName) {
            throw new Error('Function name is missing in execution config');
        }

        const fn = functionRegistry[functionName];
        if (!fn) {
            throw new Error(`Function '${functionName}' not found in registry.`);
        }

        console.log(`[Capability Executor] Executing local function: ${functionName}`);
        return await fn(input);
    } else {
        throw new Error(`Unknown execution type: ${(config as any).type}`);
    }
}

async function executeApiCapability(config: CapabilityExecutionConfig, input: Record<string, any>): Promise<any> {
    const { apiUrl, apiMethod, apiHeaders, apiParams, apiAuth } = config;
    if (!apiUrl) throw new Error("API URL is missing");

    // Helper for substitution
    const substitute = (text: string): string => {
        if (!text) return '';
        return text.replace(/\{\{([^}]+)\}\}/g, (_, key) => {
            const cleanKey = key.trim();
            const val = input[cleanKey];
            console.log(`[Capability Executor] Substituting '{{${cleanKey}}}'. Found in input?`, val !== undefined, 'Value:', val);
            return val !== undefined ? String(val) : `{{${key}}}`;
        });
    };

    console.log(`[Capability Executor] Input keys:`, Object.keys(input));
    let finalUrl = substitute(apiUrl);

    // Process Query Params
    if (apiParams) {
        const urlObj = new URL(finalUrl);
        Object.entries(apiParams).forEach(([k, v]) => {
            const val = substitute(v as string);
            urlObj.searchParams.append(k, val);
        });
        finalUrl = urlObj.toString();
    }

    // Default Headers
    const headers: Record<string, string> = {};

    // Auth handling
    if (apiAuth && apiAuth.type !== 'none') {
        if (apiAuth.type === 'bearer' && apiAuth.token) {
            headers['Authorization'] = `Bearer ${substitute(apiAuth.token)}`;
        } else if (apiAuth.type === 'basic' && apiAuth.key && apiAuth.token) {
            const output = substitute(apiAuth.key) + ':' + substitute(apiAuth.token);
            headers['Authorization'] = `Basic ${btoa(output)}`;
        } else if (apiAuth.type === 'header' && apiAuth.key && apiAuth.token) {
            headers[apiAuth.key] = substitute(apiAuth.token);
        }
    }

    if (apiHeaders) {
        Object.entries(apiHeaders).forEach(([k, v]) => {
            headers[k] = substitute(v);
        });
    }

    // Prepare options
    const options: RequestInit = {
        method: apiMethod || 'POST',
        headers,
    };

    // Body handling
    if (apiMethod !== 'GET' && (apiMethod as string) !== 'HEAD') {
        if (config.apiBodyType === 'form-data' && config.apiFormData) {
            const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
            headers['Content-Type'] = `multipart/form-data; boundary=${boundary}`;

            let bodyParts: string[] = [];
            Object.entries(config.apiFormData).forEach(([key, value]) => {
                const val = substitute(value);
                bodyParts.push(
                    `--${boundary}\r\n` +
                    `Content-Disposition: form-data; name="${key}"\r\n\r\n` +
                    `${val}`
                );
            });
            bodyParts.push(`--${boundary}--`);
            options.body = bodyParts.join('\r\n');

        } else if (config.apiBody && config.apiBodyType !== 'none') {
            options.body = substitute(config.apiBody);
            // Auto set content type if not present
            if (config.apiBodyType === 'json' && !headers['Content-Type']) {
                headers['Content-Type'] = 'application/json';
            } else if (config.apiBodyType === 'text' && !headers['Content-Type']) {
                headers['Content-Type'] = 'text/plain';
            }
        } else if (!config.apiBody) {
            // Fallback: Send full input as JSON if no body defined
            options.body = JSON.stringify(input);
            if (!headers['Content-Type']) headers['Content-Type'] = 'application/json';
        }
    }

    console.log(`[Capability Executor] Fetching: ${finalUrl}`);
    const response = await fetch(finalUrl, options);

    const text = await response.text();
    try {
        return JSON.parse(text);
    } catch (e) {
        return { raw_output: text };
    }
}
