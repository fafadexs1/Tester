'use server';
import {NextRequest, NextResponse} from 'next/server';
import vm from 'node:vm';

const CODE_EXECUTION_TIMEOUT_MS = 2000;

function createSandboxConsole() {
  return {
    log: (...args: any[]) => console.log('[Test Code Sandbox]', ...args),
    warn: (...args: any[]) => console.warn('[Test Code Sandbox]', ...args),
    error: (...args: any[]) => console.error('[Test Code Sandbox]', ...args),
  };
}

function toJSONSafe(value: any, seen = new WeakSet()): any {
  if (value === null || value === undefined) return value;
  const type = typeof value;
  if (type === 'string' || type === 'number' || type === 'boolean') return value;
  if (type === 'bigint') return value.toString();
  if (type === 'function' || type === 'symbol') return undefined;
  if (value instanceof Date) return value.toISOString();
  if (value instanceof RegExp) return value.toString();

  if (type === 'object') {
    if (seen.has(value)) return '[Circular]';
    seen.add(value);

    if (value instanceof Map) {
      return Array.from(value.entries()).map(([k, v]) => [toJSONSafe(k, seen), toJSONSafe(v, seen)]);
    }
    if (value instanceof Set) {
      return Array.from(value.values()).map(v => toJSONSafe(v, seen));
    }
    if (value instanceof Error) {
      return {name: value.name, message: value.message, stack: value.stack || ''};
    }
    if (Array.isArray(value)) {
      return value.map(item => toJSONSafe(item, seen));
    }

    const output: Record<string, any> = {};
    for (const key in value) {
      try {
        output[key] = toJSONSafe(value[key], seen);
      } catch {
        output[key] = '[Unserializable]';
      }
    }
    return output;
  }

  return value;
}

async function executeSnippet(codeSnippet: string, variables: Record<string, any>) {
  const sandbox = {
    console: createSandboxConsole(),
    variables: JSON.parse(JSON.stringify(variables ?? {})),
    __userCode: codeSnippet,
  };

  const context = vm.createContext(sandbox, {name: 'test-code-execution'});
  const script = new vm.Script(
    `(async () => {
        const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
        const fn = new AsyncFunction('variables', __userCode);
        return await fn(variables);
      })()`,
    {filename: 'test-code-execution.js'}
  );

  const execution = script.runInContext(context);
  const result = await Promise.race([
    execution,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Code execution timed out')), CODE_EXECUTION_TIMEOUT_MS)
    ),
  ]);

  return toJSONSafe(result);
}

export async function POST(request: NextRequest) {
  try {
    const {codeSnippet, variables} = await request.json();
    if (!codeSnippet || typeof codeSnippet !== 'string') {
      return NextResponse.json({error: 'codeSnippet is required'}, {status: 400});
    }
    const safeVariables = typeof variables === 'object' && variables !== null ? variables : {};
    const result = await executeSnippet(codeSnippet, safeVariables);
    return NextResponse.json({result});
  } catch (error: any) {
    console.error('[Test Code Execution] Error:', error);
    return NextResponse.json({error: error?.message || 'Failed to execute code.'}, {status: 500});
  }
}
