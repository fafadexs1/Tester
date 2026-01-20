"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { NodeComponentProps } from '../NodeProps';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertTriangle } from 'lucide-react';
import { VariableInserter } from '../components/VariableInserter';
import type { Capability, CapabilityRiskLevel } from '@/lib/types';

const riskLabel: Record<CapabilityRiskLevel, string> = {
  low: 'Baixo',
  medium: 'Medio',
  high: 'Alto',
};

const riskClass: Record<CapabilityRiskLevel, string> = {
  low: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  medium: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  high: 'border-red-500/30 bg-red-500/10 text-red-300',
};

const formatDuration = (value?: number) => {
  if (!value && value !== 0) return 'N/A';
  if (value < 1000) return `${value} ms`;
  return `${(value / 1000).toFixed(1)} s`;
};

const formatCost = (value?: number) => {
  if (!value && value !== 0) return 'N/A';
  return `$${value.toFixed(3)}`;
};

const stringifyPreview = (value: unknown) => {
  if (value === undefined || value === null) return 'N/A';
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

export const CapabilityNode: React.FC<NodeComponentProps> = ({
  node,
  onUpdate,
  activeWorkspace,
  availableVariables,
}) => {
  const [capabilities, setCapabilities] = useState<Capability[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const workspaceId = activeWorkspace?.id || '';

  useEffect(() => {
    if (!workspaceId) {
      setCapabilities([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    const controller = new AbortController();

    const loadCapabilities = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/workspaces/${workspaceId}/capabilities`, {
          cache: 'no-store',
          signal: controller.signal,
        });
        const result = await response.json();
        if (!response.ok) {
          throw new Error(result?.error || 'Falha ao carregar capacidades.');
        }
        if (isMounted) {
          setCapabilities(result);
        }
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
        if (isMounted) {
          setError(err?.message || 'Erro ao carregar capacidades.');
          setCapabilities([]);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadCapabilities();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [workspaceId]);

  const selectedCapability = useMemo(
    () => capabilities.find(cap => cap.id === node.capabilityId) || null,
    [capabilities, node.capabilityId]
  );

  const contract = selectedCapability?.contract ?? node.capabilityContract;
  const name = selectedCapability?.name ?? node.capabilityName;
  const version = selectedCapability?.version ?? node.capabilityVersion;

  const handleSelectCapability = (value: string) => {
    const selected = capabilities.find(cap => cap.id === value);
    if (!selected) {
      onUpdate(node.id, { capabilityId: value });
      return;
    }
    onUpdate(node.id, {
      capabilityId: selected.id,
      capabilityName: selected.name,
      capabilityVersion: selected.version,
      capabilityContract: selected.contract,
    });
  };

  return (
    <div className="space-y-3" data-no-drag="true">
      <div>
        <div className="flex items-center justify-between">
          <Label htmlFor={`${node.id}-capability`} className="text-[10px] font-medium text-zinc-400 mb-1 block">
            Capacidade MCP
          </Label>
          {isLoading && <Loader2 className="h-3 w-3 animate-spin text-zinc-400" />}
        </div>
        <Select
          value={node.capabilityId || ''}
          onValueChange={handleSelectCapability}
          disabled={!workspaceId || isLoading || capabilities.length === 0}
        >
          <SelectTrigger id={`${node.id}-capability`} className="h-7 text-xs bg-black/20 border-white/5 focus:border-primary/50">
            <SelectValue placeholder={isLoading ? 'Carregando...' : 'Selecione uma capacidade'} />
          </SelectTrigger>
          <SelectContent>
            {capabilities.map(cap => (
              <SelectItem key={cap.id} value={cap.id}>
                {cap.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {!workspaceId && (
          <p className="text-[10px] text-zinc-500 mt-1">Salve o fluxo para carregar o catalogo MCP.</p>
        )}
        {!isLoading && workspaceId && capabilities.length === 0 && !error && (
          <p className="text-[10px] text-zinc-500 mt-1">Nenhuma capacidade disponivel no catalogo.</p>
        )}
        {error && (
          <p className="text-[10px] text-destructive mt-1 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            {error}
          </p>
        )}
      </div>

      {(name || contract) && (
        <div className="rounded-md border border-white/5 bg-black/20 p-2 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            {name && <p className="text-xs font-medium text-zinc-200">{name}</p>}
            {version && (
              <Badge variant="outline" className="text-[10px] border-white/10 text-zinc-300">
                {version}
              </Badge>
            )}
            {contract?.riskLevel && (
              <Badge className={`text-[10px] border ${riskClass[contract.riskLevel]}`}>
                Risco {riskLabel[contract.riskLevel]}
              </Badge>
            )}
          </div>
          {contract?.summary && <p className="text-[10px] text-zinc-400">{contract.summary}</p>}
          {contract?.description && <p className="text-[10px] text-zinc-500">{contract.description}</p>}
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded border border-white/5 bg-black/30 px-2 py-1">
              <p className="text-[10px] text-zinc-500">Modo seguro</p>
              <p className="text-[10px] text-zinc-200">
                {contract?.safeMode?.enabled ? 'Ativo' : 'Desligado'}
                {contract?.safeMode?.approvalRole ? ` (${contract.safeMode.approvalRole})` : ''}
              </p>
            </div>
            <div className="rounded border border-white/5 bg-black/30 px-2 py-1">
              <p className="text-[10px] text-zinc-500">Tempo medio</p>
              <p className="text-[10px] text-zinc-200">{formatDuration(contract?.averageDurationMs)}</p>
            </div>
            <div className="rounded border border-white/5 bg-black/30 px-2 py-1">
              <p className="text-[10px] text-zinc-500">Custo estimado</p>
              <p className="text-[10px] text-zinc-200">{formatCost(contract?.estimatedCostUsd)}</p>
            </div>
            <div className="rounded border border-white/5 bg-black/30 px-2 py-1">
              <p className="text-[10px] text-zinc-500">Idempotente</p>
              <p className="text-[10px] text-zinc-200">{contract?.limits?.idempotent ? 'Sim' : 'Nao'}</p>
            </div>
          </div>
        </div>
      )}

      <div>
        <Label htmlFor={`${node.id}-capability-input`} className="text-[10px] font-medium text-zinc-400 mb-1 block">
          Input (JSON opcional)
        </Label>
        <div className="relative">
          <Textarea
            id={`${node.id}-capability-input`}
            value={node.capabilityInputJson || ''}
            onChange={(e) => onUpdate(node.id, { capabilityInputJson: e.target.value })}
            placeholder='{"invoice_id":"{{invoice_id}}"}'
            rows={3}
            className="text-xs font-mono pr-7 bg-black/20 border-white/5 focus:border-primary/50 resize-none"
          />
          <VariableInserter
            nodeId={node.id}
            data={node}
            onUpdate={onUpdate}
            availableVariables={availableVariables}
            fieldName="capabilityInputJson"
            isTextarea
          />
        </div>
        <p className="text-[10px] text-zinc-500 mt-1">Use {'{{variavel}}'} para mapear dados.</p>
      </div>

      <div>
        <Label htmlFor={`${node.id}-capability-output`} className="text-[10px] font-medium text-zinc-400 mb-1 block">
          Salvar resultado em variavel
        </Label>
        <Input
          id={`${node.id}-capability-output`}
          value={node.capabilityOutputVariable || ''}
          onChange={(e) => onUpdate(node.id, { capabilityOutputVariable: e.target.value })}
          placeholder="resultado_capacidade"
          className="h-7 text-xs bg-black/20 border-white/5 focus:border-primary/50"
        />
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <Label className="text-[10px] font-medium text-zinc-400 mb-1 block">Input Schema</Label>
          <pre className="max-h-32 overflow-auto rounded-md bg-black/30 p-2 text-[10px] text-zinc-300 whitespace-pre-wrap">
            {stringifyPreview(contract?.inputSchema)}
          </pre>
        </div>
        <div>
          <Label className="text-[10px] font-medium text-zinc-400 mb-1 block">Output Sample</Label>
          <pre className="max-h-32 overflow-auto rounded-md bg-black/30 p-2 text-[10px] text-zinc-300 whitespace-pre-wrap">
            {stringifyPreview(contract?.outputSample ?? node.capabilityContract?.outputSample)}
          </pre>
        </div>
      </div>
    </div>
  );
};
