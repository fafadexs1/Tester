"use client";

import React, { useEffect, useState } from 'react';
import { NodeComponentProps } from '../NodeProps';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DialogyTransferTarget,
  getDialogyTransferTargetsForInstanceAction,
} from '@/app/actions/dialogyApiActions';

type TransferMode = 'team' | 'ai';

const DialogyTransferNode: React.FC<NodeComponentProps & { mode: TransferMode }> = ({
  node,
  onUpdate,
  activeWorkspace,
  mode,
}) => {
  const [targets, setTargets] = useState<DialogyTransferTarget[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [workspaceName, setWorkspaceName] = useState('');
  const instanceId = activeWorkspace?.dialogy_instance_id || '';
  const field = mode === 'team' ? 'dialogyTeamId' : 'dialogySystemAgentId';
  const value = String(node[field] || '');
  const label = mode === 'team' ? 'Equipe de destino' : 'Agente de IA';

  useEffect(() => {
    let active = true;
    if (!instanceId) {
      setTargets([]);
      setWorkspaceName('');
      setError('Configure uma instância Dialogy nas configurações do fluxo.');
      return () => { active = false; };
    }

    setLoading(true);
    setError('');
    getDialogyTransferTargetsForInstanceAction(instanceId)
      .then((result) => {
        if (!active) return;
        setTargets(mode === 'team' ? result.teams : result.intelligentAgents);
        setWorkspaceName(result.workspace?.name || '');
        if (!result.success) setError(result.error || 'Não foi possível carregar os destinos.');
      })
      .catch((loadError) => {
        if (active) setError(loadError?.message || 'Não foi possível carregar os destinos.');
      })
      .finally(() => { if (active) setLoading(false); });

    return () => { active = false; };
  }, [instanceId, mode]);

  const hasTargets = targets.length > 0;

  return (
    <div className="space-y-2" data-no-drag="true">
      <div>
        <Label className="mb-1 block text-[10px] font-medium text-zinc-400">{label}</Label>
        <Select
          value={hasTargets && targets.some(target => target.id === value) ? value : undefined}
          onValueChange={(targetId) => onUpdate(node.id, { [field]: targetId })}
          disabled={loading || !hasTargets}
        >
          <SelectTrigger className="h-7 border-white/5 bg-black/20 text-xs">
            <SelectValue
              placeholder={
                loading
                  ? 'Carregando destinos...'
                  : hasTargets
                    ? `Selecione ${mode === 'team' ? 'uma equipe' : 'uma IA'}`
                    : `Nenhum${mode === 'team' ? 'a equipe' : ' agente de IA'} disponível`
              }
            />
          </SelectTrigger>
          <SelectContent>
            {targets.map(target => <SelectItem key={target.id} value={target.id}>{target.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {error && <p className="text-[10px] text-amber-400">{error}</p>}
      {workspaceName && <p className="text-[10px] text-orange-300">Workspace Dialogy: {workspaceName}</p>}
      <p className="text-[10px] text-muted-foreground">
        A conversa atual da Dialogy será transferida quando o fluxo chegar neste bloco.
      </p>
    </div>
  );
};

export const DialogyTransferTeamNode: React.FC<NodeComponentProps> = (props) => <DialogyTransferNode {...props} mode="team" />;
export const DialogyTransferAiNode: React.FC<NodeComponentProps> = (props) => <DialogyTransferNode {...props} mode="ai" />;
