import { Capability, CapabilityExecutionConfig } from '@/lib/types';

export async function executeCapability(capability: Capability, input: Record<string, any>): Promise<any> {
    const config = capability.execution_config;
    if (!config) {
        throw new Error('No execution configuration found for this capability.');
    }

    if (config.type === 'api') {
        return executeApiCapability(config, input);
    } else if (config.type === 'function') {
        // For now, local functions are not dynamically loadable safely without a registry.
        // We can simulate or handle specific known functions here.
        throw new Error(`Execution type '${config.type}' not yet implemented for real execution.`);
    } else {
        throw new Error(`Unknown execution type: ${(config as any).type}`);
    }
}

async function executeApiCapability(config: CapabilityExecutionConfig, input: Record<string, any>): Promise<any> {
    const { apiUrl, apiMethod, apiHeaders } = config;
    if (!apiUrl) throw new Error("API URL is missing");

    let finalUrl = apiUrl;
    const headers = {
        'Content-Type': 'application/json',
        ...apiHeaders,
    };

    const options: RequestInit = {
        method: apiMethod || 'POST',
        headers,
    };

    if (apiMethod !== 'GET' && (apiMethod as string) !== 'HEAD') {
        options.body = JSON.stringify(input);
    } else {
        // Simple query param appending
        const urlObj = new URL(finalUrl);
        Object.keys(input).forEach(key =>
            urlObj.searchParams.append(key, String(input[key]))
        );
        finalUrl = urlObj.toString();
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
