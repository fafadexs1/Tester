'use server';
import { getProperty } from 'dot-prop';
import type { NodeData, Connection } from '@/lib/types';

export function findNodeById(nodeId: string, nodes: NodeData[]): NodeData | undefined {
  return nodes.find(n => n.id === nodeId);
}

export function findNextNodeId(fromNodeId: string, sourceHandle: string | undefined, connections: Connection[]): string | null {
  const connection = connections.find(conn => conn.from === fromNodeId && conn.sourceHandle === sourceHandle);
  return connection ? connection.to : null;
}

export function substituteVariablesInText(text: string | undefined, variables: Record<string, any>): string {
  if (text === undefined || text === null) return '';
  let subbedText = String(text);

  const variableRegex = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g;
  subbedText = subbedText.replace(variableRegex, (_full, varNameRaw) => {
    const varName = String(varNameRaw).trim();
    if (varName === 'now') {
      return new Date().toISOString();
    }
    let value: any = getProperty(variables, varName);
    if (value === undefined && !varName.includes('.')) {
      value = variables[varName];
    }
    if (value === undefined || value === null) return '';
    if (typeof value === 'object') {
      try { return JSON.stringify(value, null, 2); }
      catch { return `[Error stringifying ${varName}]`; }
    }
    return String(value);
  });

  return subbedText;
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
