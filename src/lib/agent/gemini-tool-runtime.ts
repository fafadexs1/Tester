import { Capability } from '@/lib/types';
import { executeCapability } from '@/lib/capability-executor';

export interface GeminiRuntimePart {
  text?: string;
  functionCall?: {
    name: string;
    args?: Record<string, any>;
  };
  functionResponse?: {
    name: string;
    response?: Record<string, any>;
  };
  [key: string]: any;
}

export interface GeminiRuntimeContent {
  role: 'user' | 'model';
  parts: GeminiRuntimePart[];
}

export interface GeminiRuntimeHistoryEntry {
  role: 'user' | 'assistant' | 'system';
  content: string;
  geminiContents?: GeminiRuntimeContent[];
}

export interface GeminiToolRuntimeInput {
  apiKey?: string;
  model: string;
  userMessage: string;
  systemInstruction?: string;
  temperature?: number;
  capabilities: Capability[];
  history?: GeminiRuntimeHistoryEntry[];
  forcedToolSlugs?: string[];
  shouldRequireToolNames?: string[];
  maxSteps?: number;
}

export interface GeminiToolRuntimeResult {
  text: string;
  toolsCalled: string[];
  geminiContents: GeminiRuntimeContent[];
}

interface ToolDescriptor {
  capability: Capability;
  functionName: string;
  declaration: Record<string, any>;
}

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_MAX_STEPS = 6;
const MAX_TOOL_RESPONSE_CHARS = 6000;
const MAX_TOOL_TEXT_CHARS = 2500;

const isObject = (value: unknown): value is Record<string, any> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const normalizeGeminiModelName = (model: string): string =>
  String(model || 'gemini-2.5-flash').replace(/^googleai\//, '').trim();

const sanitizeToolName = (raw: string): string => {
  const cleaned = String(raw || '')
    .trim()
    .replace(/[^a-zA-Z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

  if (!cleaned) return 'tool';
  if (/^[0-9]/.test(cleaned)) return `tool_${cleaned}`;
  return cleaned.slice(0, 64);
};

const parseSchemaValue = (schema: unknown): Record<string, any> | null => {
  if (!schema) return null;
  if (typeof schema === 'string') {
    try {
      const parsed = JSON.parse(schema);
      return isObject(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
  return isObject(schema) ? schema : null;
};

const normalizeSchemaType = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  return value.toLowerCase();
};

const normalizeGeminiSchema = (schema: unknown, depth = 0): Record<string, any> => {
  if (depth > 6) {
    return { type: 'object', properties: {} };
  }

  const parsed = parseSchemaValue(schema) || {};
  const properties = isObject(parsed.properties) ? parsed.properties : undefined;
  const items = parsed.items;
  const normalizedType = normalizeSchemaType(parsed.type) || (properties ? 'object' : 'string');
  const normalized: Record<string, any> = {
    type: normalizedType,
  };

  if (typeof parsed.description === 'string' && parsed.description.trim()) {
    normalized.description = parsed.description.trim();
  }

  if (Array.isArray(parsed.enum) && parsed.enum.length > 0) {
    normalized.enum = parsed.enum;
  }

  if (normalizedType === 'object') {
    const normalizedProperties: Record<string, any> = {};
    if (properties) {
      for (const [key, value] of Object.entries(properties)) {
        normalizedProperties[key] = normalizeGeminiSchema(value, depth + 1);
      }
    }
    normalized.properties = normalizedProperties;

    if (Array.isArray(parsed.required)) {
      normalized.required = parsed.required.filter((key: unknown) =>
        typeof key === 'string' && key in normalizedProperties
      );
    }
  }

  if (normalizedType === 'array') {
    normalized.items = normalizeGeminiSchema(items || { type: 'string' }, depth + 1);
  }

  return normalized;
};

const toSerializable = (value: unknown, depth = 0): any => {
  if (depth > 8) return '[Depth limit]';
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') {
    return value.length > MAX_TOOL_TEXT_CHARS ? `${value.slice(0, MAX_TOOL_TEXT_CHARS)}...` : value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'bigint') return String(value);
  if (Array.isArray(value)) return value.slice(0, 25).map(item => toSerializable(item, depth + 1));
  if (!isObject(value)) return String(value);

  const output: Record<string, any> = {};
  for (const [key, entry] of Object.entries(value).slice(0, 40)) {
    output[key] = toSerializable(entry, depth + 1);
  }
  return output;
};

const normalizeToolResponse = (value: unknown): Record<string, any> => {
  if (isObject(value)) {
    const serialized = toSerializable(value);
    const raw = JSON.stringify(serialized);
    if (raw.length <= MAX_TOOL_RESPONSE_CHARS) return serialized;
    return {
      ok: serialized.error ? false : true,
      truncated: true,
      preview: raw.slice(0, MAX_TOOL_RESPONSE_CHARS),
    };
  }

  return {
    result: toSerializable(value),
  };
};

const extractTextParts = (parts: GeminiRuntimePart[] | undefined): string => {
  if (!Array.isArray(parts) || parts.length === 0) return '';
  return parts
    .map(part => (typeof part?.text === 'string' ? part.text : ''))
    .filter(Boolean)
    .join('\n')
    .trim();
};

const buildToolDescriptors = (capabilities: Capability[]): ToolDescriptor[] => {
  const usedNames = new Set<string>();

  return capabilities.map((capability, index) => {
    const baseName = sanitizeToolName(capability.slug || capability.name || `tool_${index}`);
    let functionName = baseName;
    let suffix = 1;
    while (usedNames.has(functionName)) {
      functionName = `${baseName}_${suffix++}`;
    }
    usedNames.add(functionName);

    const schema = normalizeGeminiSchema(capability.contract?.inputSchema || {
      type: 'object',
      properties: {},
    });

    const descriptionParts = [
      capability.contract?.summary,
      capability.contract?.description,
      capability.contract?.examples?.length
        ? `Examples: ${capability.contract.examples
          .slice(0, 2)
          .map(example => example.title)
          .filter(Boolean)
          .join('; ')}`
        : '',
    ].filter(Boolean);

    return {
      capability,
      functionName,
      declaration: {
        name: functionName,
        description: descriptionParts.join(' ').slice(0, 1024),
        parameters: schema,
      },
    };
  });
};

const isIdempotentCapability = (capability: Capability): boolean => {
  if (capability.slug === 'finalizar_atendimento') return false;
  if (capability.contract?.limits?.idempotent === false) return false;

  const execution = capability.execution_config;
  if (execution?.type === 'api') {
    const method = String(execution.apiMethod || 'GET').toUpperCase();
    return method === 'GET' || method === 'HEAD';
  }

  return capability.risk_level !== 'high';
};

const flattenGeminiHistory = (history: GeminiRuntimeHistoryEntry[] | undefined): GeminiRuntimeContent[] => {
  if (!Array.isArray(history) || history.length === 0) return [];

  return history.flatMap(entry => {
    if (Array.isArray(entry.geminiContents) && entry.geminiContents.length > 0) {
      return entry.geminiContents
        .filter(content => content?.role && Array.isArray(content.parts) && content.parts.length > 0)
        .map(content => ({
          role: content.role,
          parts: content.parts.map(part => ({ ...part })),
        }));
    }

    const text = String(entry.content || '').trim();
    if (!text) return [];

    if (entry.role === 'assistant') {
      return [{ role: 'model', parts: [{ text }] }];
    }

    if (entry.role === 'user') {
      return [{ role: 'user', parts: [{ text }] }];
    }

    return [];
  });
};

const buildToolConfig = (
  descriptors: ToolDescriptor[],
  forcedToolSlugs: Set<string>,
  requiredToolNames: string[]
): Record<string, any> | undefined => {
  if (descriptors.length === 0) return undefined;

  const explicitlyForced = descriptors
    .filter(descriptor => forcedToolSlugs.has(descriptor.capability.slug))
    .map(descriptor => descriptor.functionName)
    .filter(name => name !== 'finalizar_atendimento');

  const uniqueRequiredNames = Array.from(new Set([...requiredToolNames, ...explicitlyForced]));

  if (uniqueRequiredNames.length === 1) {
    return {
      functionCallingConfig: {
        mode: 'ANY',
        allowedFunctionNames: uniqueRequiredNames,
      },
    };
  }

  return {
    functionCallingConfig: {
      mode: 'AUTO',
    },
  };
};

const callGeminiGenerateContent = async (params: {
  apiKey: string;
  model: string;
  systemInstruction?: string;
  contents: GeminiRuntimeContent[];
  functionDeclarations: Record<string, any>[];
  toolConfig?: Record<string, any>;
  temperature?: number;
}): Promise<any> => {
  const body: Record<string, any> = {
    contents: params.contents,
    tools: params.functionDeclarations.length > 0
      ? [{ functionDeclarations: params.functionDeclarations }]
      : undefined,
    toolConfig: params.toolConfig,
    generationConfig: {
      temperature: typeof params.temperature === 'number' ? params.temperature : 0.2,
    },
  };

  if (params.systemInstruction?.trim()) {
    body.systemInstruction = {
      parts: [{ text: params.systemInstruction.trim() }],
    };
  }

  const response = await fetch(
    `${GEMINI_API_BASE}/${encodeURIComponent(params.model)}:generateContent?key=${encodeURIComponent(params.apiKey)}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }
  );

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const errorText = payload?.error?.message || response.statusText || 'Gemini API error';
    throw new Error(errorText);
  }

  return payload;
};

const extractModelContent = (payload: any): GeminiRuntimeContent => {
  const candidate = payload?.candidates?.[0];
  const content = candidate?.content;
  if (!content || !Array.isArray(content.parts)) {
    return { role: 'model', parts: [] };
  }

  return {
    role: 'model',
    parts: content.parts.map((part: GeminiRuntimePart) => ({ ...part })),
  };
};

const extractFunctionCalls = (content: GeminiRuntimeContent): Array<{ name: string; args: Record<string, any> }> =>
  content.parts
    .filter(part => isObject(part.functionCall) && typeof part.functionCall.name === 'string')
    .map(part => ({
      // Gemini may return args as an object or a JSON string depending on model/runtime path.
      name: String(part.functionCall!.name),
      args: (() => {
        if (isObject(part.functionCall!.args)) return part.functionCall!.args as Record<string, any>;
        if (typeof part.functionCall!.args === 'string') {
          try {
            const parsed = JSON.parse(part.functionCall!.args);
            return isObject(parsed) ? parsed : {};
          } catch {
            return {};
          }
        }
        return {};
      })(),
    }));

const executeToolCall = async (
  functionName: string,
  args: Record<string, any>,
  toolMap: Map<string, ToolDescriptor>
): Promise<GeminiRuntimePart> => {
  const descriptor = toolMap.get(functionName);
  if (!descriptor) {
    return {
      functionResponse: {
        name: functionName,
        response: {
          ok: false,
          error: `Tool ${functionName} is not registered.`,
        },
      },
    };
  }

  try {
    const result = await executeCapability(descriptor.capability, args);
    return {
      functionResponse: {
        name: functionName,
        response: {
          ok: !result?.error,
          data: normalizeToolResponse(result),
        },
      },
    };
  } catch (error: any) {
    return {
      functionResponse: {
        name: functionName,
        response: {
          ok: false,
          error: error?.message || `Tool ${functionName} failed.`,
        },
      },
    };
  }
};

export const runGeminiToolRuntime = async (
  input: GeminiToolRuntimeInput
): Promise<GeminiToolRuntimeResult> => {
  const apiKey = String(
    input.apiKey ||
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.GOOGLE_GENAI_API_KEY ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
    ''
  ).trim();

  if (!apiKey) {
    throw new Error('Gemini API key is missing.');
  }

  const model = normalizeGeminiModelName(input.model);
  const descriptors = buildToolDescriptors(input.capabilities);
  const toolMap = new Map(descriptors.map(descriptor => [descriptor.functionName, descriptor]));
  const requiredToolNames = descriptors
    .filter(descriptor => (input.shouldRequireToolNames || []).includes(descriptor.capability.slug))
    .map(descriptor => descriptor.functionName);

  const toolConfig = buildToolConfig(
    descriptors,
    new Set(input.forcedToolSlugs || []),
    requiredToolNames
  );

  const contents: GeminiRuntimeContent[] = [
    ...flattenGeminiHistory(input.history),
    {
      role: 'user',
      parts: [{ text: input.userMessage }],
    },
  ];

  const geminiContentsForHistory: GeminiRuntimeContent[] = [];
  const toolsCalled = new Set<string>();
  const maxSteps = Math.max(1, Math.min(input.maxSteps || DEFAULT_MAX_STEPS, 10));

  for (let step = 0; step < maxSteps; step += 1) {
    const payload = await callGeminiGenerateContent({
      apiKey,
      model,
      systemInstruction: input.systemInstruction,
      contents,
      functionDeclarations: descriptors.map(descriptor => descriptor.declaration),
      toolConfig,
      temperature: input.temperature,
    });

    const modelContent = extractModelContent(payload);
    contents.push(modelContent);
    geminiContentsForHistory.push(modelContent);

    const functionCalls = extractFunctionCalls(modelContent);
    if (functionCalls.length === 0) {
      const finalText = extractTextParts(modelContent.parts) ||
        geminiContentsForHistory
          .filter(content => content.role === 'model')
          .map(content => extractTextParts(content.parts))
          .filter(Boolean)
          .join('\n')
          .trim();

      return {
        text: finalText,
        toolsCalled: Array.from(toolsCalled),
        geminiContents: geminiContentsForHistory,
      };
    }

    const canRunInParallel = functionCalls.every(call => {
      const descriptor = toolMap.get(call.name);
      return descriptor ? isIdempotentCapability(descriptor.capability) : false;
    });

    const responseParts = canRunInParallel
      ? await Promise.all(functionCalls.map(call => executeToolCall(call.name, call.args, toolMap)))
      : await functionCalls.reduce(async (promise, call) => {
        const accumulator = await promise;
        const responsePart = await executeToolCall(call.name, call.args, toolMap);
        accumulator.push(responsePart);
        return accumulator;
      }, Promise.resolve([] as GeminiRuntimePart[]));

    functionCalls.forEach(call => {
      const descriptor = toolMap.get(call.name);
      toolsCalled.add(descriptor?.capability.slug || call.name);
    });

    const functionResponseContent: GeminiRuntimeContent = {
      role: 'user',
      parts: responseParts,
    };

    contents.push(functionResponseContent);
    geminiContentsForHistory.push(functionResponseContent);
  }

  return {
    text: 'Tive uma instabilidade ao concluir as chamadas de ferramenta. Vamos tentar novamente.',
    toolsCalled: Array.from(toolsCalled),
    geminiContents: geminiContentsForHistory,
  };
};
