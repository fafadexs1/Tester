"use client";

import React from 'react';
import { CalendarCheck2, Copy } from 'lucide-react';
import { NodeComponentProps } from '../NodeProps';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { VariableInserter } from '../components/VariableInserter';
import { FlowHandle } from './FlowHandle';
import { useToast } from '@/hooks/use-toast';

export const DialogySGPPaymentPromiseNode: React.FC<NodeComponentProps> = ({ node, onUpdate, renderHandles = true }) => {
  const { toast } = useToast();
  const mode = node.sgpPaymentPromiseDeliveryMode || 'list';
  const resultVariable = `_sgp_payment_promise_${node.id.replace(/[^a-zA-Z0-9_]/g, '_')}`;

  const copyVariable = async () => {
    const value = `{{${resultVariable}}}`;
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard API indisponível');
      await navigator.clipboard.writeText(value);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = value;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      const copied = document.execCommand('copy');
      textarea.remove();
      if (!copied) {
        toast({ title: 'Não foi possível copiar', variant: 'destructive' });
        return;
      }
    }
    toast({ title: 'Variável copiada', description: value });
  };

  return (
    <div className="nodrag nowheel min-w-0 space-y-3" data-no-drag="true">
      <div className="rounded-xl border border-sky-500/15 bg-sky-500/5 p-2 text-[10px] leading-relaxed text-sky-200/80">
        <span className="mb-1 flex items-center gap-1 font-semibold"><CalendarCheck2 className="h-3 w-3" /> Promessa de pagamento</span>
        Consulta os contratos do cliente e registra a promessa com a data do dia no formato AAAA-MM-DD. Endpoint, Token e App vêm da Dialogy.
      </div>

      <div>
        <Label className="mb-1 block text-[10px] text-zinc-400">CPF ou CNPJ</Label>
        <div className="relative">
          <Input
            placeholder="{{cpf_cnpj}}"
            value={node.sgpPaymentPromiseCpfCnpj || ''}
            onChange={event => onUpdate(node.id, { sgpPaymentPromiseCpfCnpj: event.target.value })}
            className="h-7 border-white/5 bg-black/20 pr-7 text-xs"
          />
          <VariableInserter
            fieldName="sgpPaymentPromiseCpfCnpj"
            isIconTrigger
            onInsert={variable => onUpdate(node.id, { sgpPaymentPromiseCpfCnpj: (node.sgpPaymentPromiseCpfCnpj || '') + variable })}
          />
        </div>
      </div>

      <div>
        <Label className="mb-1 block text-[10px] text-zinc-400">Seleção do contrato</Label>
        <Select value={mode} onValueChange={value => onUpdate(node.id, { sgpPaymentPromiseDeliveryMode: value as 'list' | 'legacy' })}>
          <SelectTrigger className="h-7 border-white/5 bg-black/20 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="list">Lista interativa</SelectItem>
            <SelectItem value="legacy">Texto (legacy)</SelectItem>
          </SelectContent>
        </Select>
        <p className="mt-1 text-[9px] text-zinc-500">Com apenas um contrato elegível, a seleção é pulada automaticamente.</p>
      </div>

      <div className="flex min-w-0 items-start gap-1.5 overflow-hidden rounded-xl border border-white/5 bg-black/20 p-2 text-[9px] text-zinc-500">
        <div className="min-w-0 flex-1">
          <span className="block">Resposta automática:</span>
          <code className="block max-w-full break-all text-[8px] leading-3 text-zinc-400">{`{{${resultVariable}}}`}</code>
        </div>
        <Button type="button" variant="ghost" size="icon" title="Copiar variável" className="h-6 w-6 shrink-0" onClick={copyVariable}>
          <Copy className="h-3 w-3" />
        </Button>
      </div>

      <div className="rounded-lg border border-white/5 bg-black/10 p-2 text-[9px] leading-relaxed text-zinc-400">
        <p><span className="text-zinc-200">Status 0:</span> conexão não estava bloqueada.</p>
        <p><span className="text-emerald-300">Status 1:</span> liberação provisória realizada.</p>
        <p><span className="text-amber-300">Status 2:</span> encaminhar ao financeiro.</p>
      </div>

      {renderHandles && (
        <div className="absolute -right-1.5 top-11 z-20 flex flex-col gap-2.5">
          <div className="group/connector flex items-center justify-end gap-1"><span className="text-[8px] text-zinc-300">0</span><FlowHandle id="status-0" title="Status 0: não bloqueado" colorClass="bg-zinc-400" /></div>
          <div className="group/connector flex items-center justify-end gap-1"><span className="text-[8px] text-emerald-300">1</span><FlowHandle id="status-1" title="Status 1: liberado" colorClass="bg-emerald-500" /></div>
          <div className="group/connector flex items-center justify-end gap-1"><span className="text-[8px] text-amber-300">2</span><FlowHandle id="status-2" title="Status 2: financeiro" colorClass="bg-amber-500" /></div>
          <div className="group/connector flex items-center justify-end gap-1"><span className="text-[8px] text-red-400">Erro</span><FlowHandle id="error" title="Falha no SGP" colorClass="bg-red-500" /></div>
        </div>
      )}
    </div>
  );
};
