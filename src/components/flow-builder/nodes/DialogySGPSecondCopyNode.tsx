"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { Barcode, Copy, FileKey2, Loader2, QrCode } from 'lucide-react';
import { NodeComponentProps } from '../NodeProps';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { VariableInserter } from '../components/VariableInserter';
import { DialogyTemplateSummary, getDialogyTemplatesForInstanceAction } from '@/app/actions/dialogyApiActions';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { FlowHandle } from './FlowHandle';

export const DialogySGPSecondCopyNode: React.FC<NodeComponentProps> = ({ node, onUpdate, activeWorkspace, renderHandles = true }) => {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<DialogyTemplateSummary[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [templateError, setTemplateError] = useState('');
  const mode = node.sgpSecondCopyDeliveryMode || 'list';
  const instanceId = activeWorkspace?.dialogy_instance_id || '';
  const stateVariable = `_sgp_second_copy_${node.id.replace(/[^a-zA-Z0-9_]/g, '_')}`;
  const codeVariable = `_sgp_payment_code_${node.id.replace(/[^a-zA-Z0-9_]/g, '_')}`;

  const copyVariable = async (variable: string, label: string) => {
    const value = `{{${variable}}}`;
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard API indisponível');
      await navigator.clipboard.writeText(value);
    } catch {
      // The NexusFlow can run inside the Dialogy iframe, where the Clipboard
      // API may be restricted by the browser's permissions policy.
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
    toast({ title: `${label} copiada`, description: value });
  };

  useEffect(() => {
    let active = true;
    if (mode !== 'cloud-template' || !instanceId) return () => { active = false; };
    setLoadingTemplates(true);
    setTemplateError('');
    getDialogyTemplatesForInstanceAction(instanceId)
      .then(result => {
        if (!active) return;
        setTemplates(result.templates);
        if (!result.success) setTemplateError(result.error || 'Não foi possível carregar os templates.');
      })
      .catch(error => { if (active) setTemplateError(error?.message || 'Não foi possível carregar os templates.'); })
      .finally(() => { if (active) setLoadingTemplates(false); });
    return () => { active = false; };
  }, [instanceId, mode]);

  const selectedPixTemplate = useMemo(() => templates.find(template =>
    template.instanceName === node.sgpSecondCopyPixTemplateInstance &&
    template.name === node.sgpSecondCopyPixTemplateName &&
    template.language === node.sgpSecondCopyPixTemplateLanguage
  ), [templates, node.sgpSecondCopyPixTemplateInstance, node.sgpSecondCopyPixTemplateLanguage, node.sgpSecondCopyPixTemplateName]);
  const selectedBoletoTemplate = useMemo(() => templates.find(template =>
    template.instanceName === node.sgpSecondCopyBoletoTemplateInstance &&
    template.name === node.sgpSecondCopyBoletoTemplateName &&
    template.language === node.sgpSecondCopyBoletoTemplateLanguage
  ), [templates, node.sgpSecondCopyBoletoTemplateInstance, node.sgpSecondCopyBoletoTemplateLanguage, node.sgpSecondCopyBoletoTemplateName]);

  const getTemplateValue = (template?: DialogyTemplateSummary) => template
    ? `${template.instanceName}::${template.name}::${template.language}`
    : undefined;

  const handleTemplateChange = (kind: 'pix' | 'boleto', value: string) => {
    const template = templates.find(item => `${item.instanceName}::${item.name}::${item.language}` === value);
    if (!template) return;
    if (kind === 'pix') {
      onUpdate(node.id, {
        sgpSecondCopyPixTemplateInstance: template.instanceName,
        sgpSecondCopyPixTemplateName: template.name,
        sgpSecondCopyPixTemplateLanguage: template.language,
        sgpSecondCopyPixTemplateBodyParameterCount: template.bodyParameterCount,
        sgpSecondCopyPixTemplateBodyParameter: Math.min(
          Math.max(1, node.sgpSecondCopyPixTemplateBodyParameter || 1),
          Math.max(1, template.bodyParameterCount)
        ),
      });
      return;
    }
    onUpdate(node.id, {
      sgpSecondCopyBoletoTemplateInstance: template.instanceName,
      sgpSecondCopyBoletoTemplateName: template.name,
      sgpSecondCopyBoletoTemplateLanguage: template.language,
      sgpSecondCopyBoletoTemplateBodyParameterCount: template.bodyParameterCount,
      sgpSecondCopyBoletoTemplateBodyParameter: Math.min(
        Math.max(1, node.sgpSecondCopyBoletoTemplateBodyParameter || 1),
        Math.max(1, template.bodyParameterCount)
      ),
    });
  };

  const templatesAreEqual = Boolean(
    selectedPixTemplate && selectedBoletoTemplate &&
    getTemplateValue(selectedPixTemplate) === getTemplateValue(selectedBoletoTemplate)
  );

  return (
    <div className="nodrag nowheel min-w-0 space-y-3" data-no-drag="true">
      <div className="rounded-xl border border-emerald-500/15 bg-emerald-500/5 p-2 text-[10px] leading-relaxed text-emerald-200/80">
        Endpoint, Token e App são carregados automaticamente da integração SGP configurada na workspace da Dialogy.
      </div>

      <div>
        <Label className="mb-1 block text-[10px] text-zinc-400">CPF ou CNPJ</Label>
        <div className="relative">
          <Input
            placeholder="{{cpf_cnpj}}"
            value={node.sgpSecondCopyCpfCnpj || ''}
            onChange={event => onUpdate(node.id, { sgpSecondCopyCpfCnpj: event.target.value })}
            className="h-7 border-white/5 bg-black/20 pr-7 text-xs"
          />
          <VariableInserter
            fieldName="sgpSecondCopyCpfCnpj"
            isIconTrigger
            onInsert={variable => onUpdate(node.id, { sgpSecondCopyCpfCnpj: (node.sgpSecondCopyCpfCnpj || '') + variable })}
          />
        </div>
      </div>

      <div>
        <Label className="mb-1 block text-[10px] text-zinc-400">Forma de interação</Label>
        <Select value={mode} onValueChange={value => onUpdate(node.id, { sgpSecondCopyDeliveryMode: value as any })}>
          <SelectTrigger className="h-7 border-white/5 bg-black/20 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="list">Lista interativa</SelectItem>
            <SelectItem value="legacy">Texto (legacy)</SelectItem>
            <SelectItem value="cloud-template">WhatsApp Cloud + template</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {mode === 'cloud-template' && (
        <div className="space-y-2 rounded-xl border border-orange-500/15 bg-orange-500/5 p-2">
          <Label className="flex items-center gap-1 text-[10px] text-orange-300"><FileKey2 className="h-3 w-3" /> Templates da workspace</Label>
          <p className="text-[9px] leading-relaxed text-orange-200/70">PIX e boleto usam templates diferentes. Configure obrigatoriamente um para cada forma de pagamento.</p>
          {loadingTemplates && <p className="flex items-center gap-1 text-[10px] text-zinc-500"><Loader2 className="h-3 w-3 animate-spin" /> Consultando Dialogy</p>}
          {templateError && <p className="text-[10px] text-amber-400">{templateError}</p>}

          <div className="min-w-0 space-y-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-2">
            <Label className="flex items-center gap-1 text-[10px] font-semibold text-emerald-300"><QrCode className="h-3 w-3" /> Template PIX</Label>
            <Select value={getTemplateValue(selectedPixTemplate)} onValueChange={value => handleTemplateChange('pix', value)} disabled={loadingTemplates || templates.length === 0}>
              <SelectTrigger className="h-7 min-w-0 border-white/5 bg-black/30 text-xs">
                <SelectValue placeholder={loadingTemplates ? 'Carregando...' : 'Selecione o template PIX'} />
              </SelectTrigger>
              <SelectContent>
                {templates.map(template => (
                  <SelectItem key={`pix:${template.instanceName}:${template.name}:${template.language}`} value={`${template.instanceName}::${template.name}::${template.language}`}>
                    {template.name} · {template.instanceName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedPixTemplate && selectedPixTemplate.bodyParameterCount > 0 && (
              <div>
                <Label className="mb-1 block text-[10px] text-zinc-400">BODY que receberá o código PIX</Label>
                <Select value={String(node.sgpSecondCopyPixTemplateBodyParameter || 1)} onValueChange={value => onUpdate(node.id, { sgpSecondCopyPixTemplateBodyParameter: Number(value) })}>
                  <SelectTrigger className="h-7 border-white/5 bg-black/30 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: selectedPixTemplate.bodyParameterCount }, (_, index) => (
                      <SelectItem key={index + 1} value={String(index + 1)}>{`{{${index + 1}}}`}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {selectedPixTemplate && selectedPixTemplate.bodyParameterCount === 0 && (
              <p className="text-[9px] text-red-400">Este template não possui variável no BODY para receber o PIX.</p>
            )}
          </div>

          <div className="min-w-0 space-y-2 rounded-lg border border-sky-500/20 bg-sky-500/5 p-2">
            <Label className="flex items-center gap-1 text-[10px] font-semibold text-sky-300"><Barcode className="h-3 w-3" /> Template Boleto</Label>
            <Select value={getTemplateValue(selectedBoletoTemplate)} onValueChange={value => handleTemplateChange('boleto', value)} disabled={loadingTemplates || templates.length === 0}>
              <SelectTrigger className="h-7 min-w-0 border-white/5 bg-black/30 text-xs">
                <SelectValue placeholder={loadingTemplates ? 'Carregando...' : 'Selecione o template boleto'} />
              </SelectTrigger>
              <SelectContent>
                {templates.map(template => (
                  <SelectItem key={`boleto:${template.instanceName}:${template.name}:${template.language}`} value={`${template.instanceName}::${template.name}::${template.language}`}>
                    {template.name} · {template.instanceName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedBoletoTemplate && selectedBoletoTemplate.bodyParameterCount > 0 && (
              <div>
                <Label className="mb-1 block text-[10px] text-zinc-400">BODY que receberá o código do boleto</Label>
              <Select
                  value={String(node.sgpSecondCopyBoletoTemplateBodyParameter || 1)}
                  onValueChange={value => onUpdate(node.id, { sgpSecondCopyBoletoTemplateBodyParameter: Number(value) })}
              >
                <SelectTrigger className="h-7 border-white/5 bg-black/30 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                    {Array.from({ length: selectedBoletoTemplate.bodyParameterCount }, (_, index) => (
                    <SelectItem key={index + 1} value={String(index + 1)}>{`{{${index + 1}}}`}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
            {selectedBoletoTemplate && selectedBoletoTemplate.bodyParameterCount === 0 && (
              <p className="text-[9px] text-red-400">Este template não possui variável no BODY para receber o boleto.</p>
            )}
          </div>
          {templatesAreEqual && <p className="text-[10px] font-medium text-red-400">Escolha templates diferentes para PIX e boleto.</p>}
        </div>
      )}

      <div className="min-w-0 max-w-full space-y-2 overflow-hidden rounded-xl border border-white/5 bg-black/20 p-2 text-[9px] text-zinc-500">
        <div className="flex min-w-0 items-start gap-1.5">
          <div className="min-w-0 flex-1">
            <span className="block">Estado automático:</span>
            <code className="block max-w-full break-all text-[8px] leading-3 text-zinc-400">{`{{${stateVariable}}}`}</code>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            title="Copiar variável de estado"
            className="h-6 w-6 shrink-0 text-zinc-400 hover:text-white"
            onClick={() => copyVariable(stateVariable, 'Variável de estado')}
          >
            <Copy className="h-3 w-3" />
          </Button>
        </div>
        <div className="flex min-w-0 items-start gap-1.5">
          <div className="min-w-0 flex-1">
            <span className="block">Código escolhido:</span>
            <code className="block max-w-full break-all text-[8px] leading-3 text-zinc-400">{`{{${codeVariable}}}`}</code>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            title="Copiar variável do código"
            className="h-6 w-6 shrink-0 text-zinc-400 hover:text-white"
            onClick={() => copyVariable(codeVariable, 'Variável do código')}
          >
            <Copy className="h-3 w-3" />
          </Button>
        </div>
        <p>As variáveis são exclusivas deste bloco e não precisam ser criadas manualmente.</p>
      </div>
      {renderHandles && (
        <div className="absolute -right-1.5 top-11 z-20 flex flex-col gap-3">
          <div className="group/connector flex items-center justify-end gap-1"><span className="text-[8px] font-semibold text-emerald-400">Sucesso</span><FlowHandle id="success" title="Segunda via enviada" colorClass="bg-emerald-500" /></div>
          <div className="group/connector flex items-center justify-end gap-1"><span className="text-[8px] font-semibold text-red-400">Erro</span><FlowHandle id="error" title="Falha na segunda via" colorClass="bg-red-500" /></div>
        </div>
      )}
    </div>
  );
};
