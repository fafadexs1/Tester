import { getProperty } from 'dot-prop';
import jsonata from 'jsonata';
import type { NodeData, Connection } from '@/lib/types';

export function findNodeById(nodeId: string, nodes: NodeData[]): NodeData | undefined {
  return nodes.find(n => n.id === nodeId);
}

export function findNextNodeId(fromNodeId: string, sourceHandle: string | undefined, connections: Connection[]): string | null {
  const connection = connections.find(conn => conn.from === fromNodeId && conn.sourceHandle === sourceHandle);
  return connection ? connection.to : null;
}

const EXPRESSION_REGEX = /\{\{\s*([^}]+?)\s*\}\}/g;
const PATH_BRACKET_REGEX = /\[(?:"([^"]+)"|'([^']+)'|([^\]]+))\]/g;

const ALIAS_KEYS = ['$json', '$vars', '$flow', '$data'];

function normalizePathExpression(rawPath: string): string {
  if (!rawPath) return '';
  return rawPath
    .replace(PATH_BRACKET_REGEX, (_match, doubleQuoted, singleQuoted, other) => {
      const candidate = (doubleQuoted ?? singleQuoted ?? other ?? '').trim();
      if (!candidate) return '';
      return `.${candidate}`;
    })
    .replace(/^\./, '');
}

function formatEvaluatedValue(value: any, fallbackLabel?: string): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value, null, 2);
    } catch (err) {
      console.warn(`[Flow Engine] Failed to stringify value for ${fallbackLabel || 'expression'}.`, err);
      return '';
    }
  }
  return String(value);
}

function resolveAliasValue(expression: string, variables: Record<string, any>): { found: boolean; value?: any } {
  for (const alias of ALIAS_KEYS) {
    if (expression === alias) {
      return { found: true, value: variables };
    }
    const aliasWithDot = `${alias}.`;
    if (expression.startsWith(aliasWithDot) || expression.startsWith(`${alias}[`)) {
      const normalized = normalizePathExpression(expression.slice(alias.length));
      const value = normalized ? getProperty(variables, normalized) : variables;
      return { found: true, value };
    }
  }
  return { found: false };
}

function evaluateExpressionSegment(rawExpression: string, variables: Record<string, any>) {
  const expression = rawExpression.trim();
  if (!expression) return '';

  if (expression === 'now') {
    return new Date().toISOString();
  }

  const aliasResult = resolveAliasValue(expression, variables);
  if (aliasResult.found) {
    return aliasResult.value;
  }

  const normalizedPath = normalizePathExpression(expression);
  if (normalizedPath) {
    const pathValue = getProperty(variables, normalizedPath);
    if (pathValue !== undefined) {
      return pathValue;
    }
  } else if (Object.prototype.hasOwnProperty.call(variables, expression)) {
    return variables[expression];
  }

  try {
    const expressionEvaluator = jsonata(expression);
    return expressionEvaluator.evaluate({ vars: variables, json: variables, data: variables });
  } catch (error) {
    console.warn(`[Flow Engine] Failed to evaluate expression "{{${expression}}}":`, error);
    return '';
  }
}

export function substituteVariablesInText(text: string | undefined, variables: Record<string, any>): string {
  if (text === undefined || text === null) return '';
  const source = String(text);
  if (!source.includes('{{')) {
    return source;
  }
  return source.replace(EXPRESSION_REGEX, (_match, expression) =>
    formatEvaluatedValue(evaluateExpressionSegment(String(expression), variables), expression)
  );
}

export function coerceToDate(raw: any): Date | null {
  if (raw === undefined || raw === null) return null;

  if (raw instanceof Date && !isNaN(raw.getTime())) return raw;

  if (typeof raw === 'number' && isFinite(raw)) {
    const ms = raw < 1e11 ? raw * 1000 : raw;
    const d = new Date(ms);
    return isNaN(d.getTime()) ? null : d;
  }

  const str = String(raw).trim();
  if (!str) return null;

  const timeOnly = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(str);
  if (timeOnly) {
    const [_, hh, mm, ss] = timeOnly;
    const d = new Date();
    d.setSeconds(0, 0);
    d.setHours(Number(hh), Number(mm), ss ? Number(ss) : 0, 0);
    return d;
  }

  const d = new Date(str);
  if (!isNaN(d.getTime())) return d;

  const br = /^(\d{2})\/(\d{2})\/(\d{4})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(str);
  if (br) {
    const [, dd, mm, yyyy, hh = '00', mi = '00', ss = '00'] = br;
    const d2 = new Date(
      Number(yyyy),
      Number(mm) - 1,
      Number(dd),
      Number(hh),
      Number(mi),
      Number(ss),
      0
    );
    return isNaN(d2.getTime()) ? null : d2;
  }

  return null;
}

export function compareDates(a: any, b: any): {a: Date|null; b: Date|null} {
  const da = coerceToDate(a);
  const db = coerceToDate(b);
  return { a: da, b: db };
}
