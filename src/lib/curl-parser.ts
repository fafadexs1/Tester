export interface CurlParsedData {
    url?: string;
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    headers?: { key: string; value: string }[];
    body?: string;
    authType?: 'none' | 'basic' | 'bearer';
    authKey?: string;
    authToken?: string;
}

export function parseCurl(curlCommand: string): CurlParsedData {
    const result: CurlParsedData = {
        headers: [],
        method: 'GET'
    };

    if (!curlCommand || !curlCommand.trim().toLowerCase().startsWith('curl')) {
        return result; // Invalid or empty
    }

    // cleaning lines usually split by \ \
    const cleanCommand = curlCommand.replace(/\\\n/g, ' ').replace(/[\r\n]+/g, ' ');

    // Extract URL
    // simpler regex to find http/https url inside quotes or plain
    const urlMatch = cleanCommand.match(/['"](https?:\/\/[^'"]+)['"]/) || cleanCommand.match(/(https?:\/\/[^\s]+)/);
    if (urlMatch) {
        result.url = urlMatch[1];
    }

    // Extract Method -X POST or --request POST
    const methodMatch = cleanCommand.match(/-X\s+([A-Z]+)/i) || cleanCommand.match(/--request\s+([A-Z]+)/i);
    if (methodMatch) {
        const m = methodMatch[1].toUpperCase();
        if (['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].includes(m)) {
            result.method = m as any;
        }
    }

    // Extract Headers -H "Key: Value"
    const headerRegex = /-H\s+['"]([^'"]+)['"]/g;
    let headerMatch;
    while ((headerMatch = headerRegex.exec(cleanCommand)) !== null) {
        const [full, content] = headerMatch;
        const parts = content.split(':');
        if (parts.length >= 2) {
            const key = parts.shift()?.trim();
            const value = parts.join(':').trim();
            if (key && value) {
                // Check for Auth headers to populate Auth tab
                if (key.toLowerCase() === 'authorization') {
                    if (value.toLowerCase().startsWith('bearer ')) {
                        result.authType = 'bearer';
                        result.authToken = value.substring(7).trim();
                        continue;
                    } else if (value.toLowerCase().startsWith('basic ')) {
                        // We might decode it, but for now let's just ignore or set as header
                        // Decoding basic auth from base64 to set user/pass is nice to have
                        try {
                            const decoded = atob(value.substring(6).trim());
                            const [user, pass] = decoded.split(':');
                            result.authType = 'basic';
                            result.authKey = user;
                            result.authToken = pass;
                            continue;
                        } catch (e) { }
                    }
                }
                result.headers?.push({ key, value });
            }
        }
    }

    // Extract Body --data "..." or -d "..." or --data-raw "..."
    // This is tricky with multiple data flags or nested quotes.
    // Try simple regex for quoted data first.
    const dataMatch = cleanCommand.match(/(-d|--data|--data-raw)\s+['"]([^'"]+)['"]/);
    if (dataMatch) {
        try {
            // Try to see if it's JSON
            const potentialJson = dataMatch[2];
            // If valid JSON, nice.
            JSON.parse(potentialJson); // check
            result.body = potentialJson;
            if (!result.method || result.method === 'GET') result.method = 'POST';
        } catch (e) {
            result.body = dataMatch[2];
            if (!result.method || result.method === 'GET') result.method = 'POST';
        }
    }

    // Check Content-Type to infer body expectation?
    // If body is present without method, assume POST.

    return result;
}
