"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/components/auth/AuthProvider";
import { useToast } from "@/hooks/use-toast";
import type { Capability, CapabilityRiskLevel, WorkspaceData } from "@/lib/types";
import { AlertTriangle, Clock, Database, DollarSign, Loader2, Plus, ShieldCheck, Sparkles, Tag } from "lucide-react";

type ApprovalRole = "operator" | "supervisor" | "admin";

const riskLabel: Record<CapabilityRiskLevel, string> = {
  low: "Baixo",
  medium: "Medio",
  high: "Alto",
};

const statusLabel: Record<Capability["status"], string> = {
  draft: "Rascunho",
  active: "Ativa",
  deprecated: "Deprecated",
};

const riskClass: Record<CapabilityRiskLevel, string> = {
  low: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  medium: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  high: "border-red-500/30 bg-red-500/10 text-red-300",
};

const statusClass: Record<Capability["status"], string> = {
  draft: "border-slate-500/30 bg-slate-500/10 text-slate-300",
  active: "border-violet-500/30 bg-violet-500/10 text-violet-300",
  deprecated: "border-zinc-500/30 bg-zinc-500/10 text-zinc-300",
};

const parseNumber = (value: string) => {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const parseCommaList = (value: string) =>
  value
    .split(",")
    .map(item => item.trim())
    .filter(Boolean);

const parseJsonOptional = (value: string, label: string, toast: ReturnType<typeof useToast>["toast"]) => {
  if (!value.trim()) return undefined;
  try {
    return JSON.parse(value);
  } catch (error: any) {
    toast({
      title: "JSON invalido",
      description: `${label}: ${error.message}`,
      variant: "destructive",
    });
    return null;
  }
};

const formatCost = (value?: number) => {
  if (!value && value !== 0) return "N/A";
  return `$${value.toFixed(3)}`;
};

const formatDuration = (value?: number) => {
  if (!value) return "N/A";
  if (value < 1000) return `${value} ms`;
  return `${(value / 1000).toFixed(1)} s`;
};

const toJsonField = (value: unknown) => {
  if (value === undefined || value === null) return "";
  return JSON.stringify(value, null, 2);
};

const buildFormStateFromCapability = (capability: Capability) => {
  const firstExample = capability.contract.examples?.[0];
  return {
    name: capability.name,
    summary: capability.contract.summary,
    description: capability.contract.description,
    version: capability.version,
    status: capability.status,
    riskLevel: capability.contract.riskLevel,
    dataAccess: (capability.contract.dataAccess ?? []).join(", "),
    triggerPhrases: (capability.contract.triggerPhrases ?? []).join(", "),
    averageDurationMs:
      capability.contract.averageDurationMs !== undefined
        ? String(capability.contract.averageDurationMs)
        : "",
    estimatedCostUsd:
      capability.contract.estimatedCostUsd !== undefined
        ? String(capability.contract.estimatedCostUsd)
        : "",
    inputSchemaJson: toJsonField(capability.contract.inputSchema),
    outputSampleJson: toJsonField(capability.contract.outputSample),
    exampleTitle: firstExample?.title ?? "",
    exampleInputJson: toJsonField(firstExample?.input),
    exampleOutputJson: toJsonField(firstExample?.output),
    idempotent: capability.contract.limits?.idempotent ?? true,
    maxRetries:
      capability.contract.limits?.maxRetries !== undefined
        ? String(capability.contract.limits.maxRetries)
        : "",
    timeoutMs:
      capability.contract.limits?.timeoutMs !== undefined
        ? String(capability.contract.limits.timeoutMs)
        : "",
    safeModeEnabled: capability.contract.safeMode?.enabled ?? true,
    approvalRole: capability.contract.safeMode?.approvalRole ?? "supervisor",
  };
};

const CapabilityDetailsDialog = ({
  capability,
  onOpenChange,
  onEdit,
}: {
  capability: Capability | null;
  onOpenChange: (open: boolean) => void;
  onEdit?: (capability: Capability) => void;
}) => {
  const dataAccess = capability?.contract.dataAccess ?? [];
  const triggerPhrases = capability?.contract.triggerPhrases ?? [];
  const examples = capability?.contract.examples ?? [];

  return (
    <Dialog open={!!capability} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{capability?.name}</DialogTitle>
          <DialogDescription>
            Contrato humano, exemplos e limites da capacidade selecionada.
          </DialogDescription>
        </DialogHeader>
        {capability && (
          <ScrollArea className="h-[70vh] pr-4">
            <div className="space-y-6 text-sm">
              <div className="space-y-2">
                <h4 className="text-base font-semibold text-zinc-100">Resumo</h4>
                <p className="text-zinc-300">{capability.contract.summary}</p>
                <p className="text-zinc-400">{capability.contract.description}</p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-lg border border-white/5 bg-white/5 p-3">
                  <p className="text-xs text-zinc-400">Risco</p>
                  <p className="text-sm text-zinc-100">{riskLabel[capability.contract.riskLevel]}</p>
                </div>
                <div className="rounded-lg border border-white/5 bg-white/5 p-3">
                  <p className="text-xs text-zinc-400">Modo seguro</p>
                  <p className="text-sm text-zinc-100">
                    {capability.contract.safeMode?.enabled ? "Ativado" : "Desativado"}
                    {capability.contract.safeMode?.approvalRole
                      ? ` - Aprovacao: ${capability.contract.safeMode.approvalRole}`
                      : ""}
                  </p>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-lg border border-white/5 bg-white/5 p-3">
                  <p className="text-xs text-zinc-400">Duracao media</p>
                  <p className="text-sm text-zinc-100">{formatDuration(capability.contract.averageDurationMs)}</p>
                </div>
                <div className="rounded-lg border border-white/5 bg-white/5 p-3">
                  <p className="text-xs text-zinc-400">Custo estimado</p>
                  <p className="text-sm text-zinc-100">{formatCost(capability.contract.estimatedCostUsd)}</p>
                </div>
              </div>
              <div className="space-y-2">
                <h4 className="text-base font-semibold text-zinc-100">Dados tocados</h4>
                {dataAccess.length ? (
                  <div className="flex flex-wrap gap-2">
                    {dataAccess.map(item => (
                      <Badge key={item} variant="outline" className="border-white/10 text-zinc-300">
                        {item}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-zinc-500">Nenhum dado informado.</p>
                )}
              </div>
              <div className="space-y-2">
                <h4 className="text-base font-semibold text-zinc-100">Frases gatilho</h4>
                {triggerPhrases.length ? (
                  <div className="flex flex-wrap gap-2">
                    {triggerPhrases.map(item => (
                      <Badge key={item} variant="secondary" className="border-white/10 text-zinc-200">
                        {item}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-zinc-500">Nenhuma frase definida.</p>
                )}
              </div>
              <div className="space-y-2">
                <h4 className="text-base font-semibold text-zinc-100">Limites e idempotencia</h4>
                <p className="text-zinc-400">
                  Idempotente: {capability.contract.limits?.idempotent ? "Sim" : "Nao"}
                </p>
                <p className="text-zinc-400">
                  Retry max: {capability.contract.limits?.maxRetries ?? "N/A"} - Timeout:{" "}
                  {capability.contract.limits?.timeoutMs ?? "N/A"} ms
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="text-base font-semibold text-zinc-100">Exemplos</h4>
                {examples.length ? (
                  <div className="space-y-3">
                    {examples.map(example => (
                      <div key={example.title} className="rounded-lg border border-white/5 bg-white/5 p-3">
                        <p className="text-sm font-semibold text-zinc-100">{example.title}</p>
                        <pre className="mt-2 whitespace-pre-wrap rounded-md bg-black/40 p-2 text-xs text-zinc-300">
{JSON.stringify({ input: example.input, output: example.output }, null, 2)}
                        </pre>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-zinc-500">Nenhum exemplo definido.</p>
                )}
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <h4 className="text-base font-semibold text-zinc-100">Input Schema</h4>
                  <pre className="mt-2 whitespace-pre-wrap rounded-md bg-black/40 p-2 text-xs text-zinc-300">
{capability.contract.inputSchema ? JSON.stringify(capability.contract.inputSchema, null, 2) : "N/A"}
                  </pre>
                </div>
                <div>
                  <h4 className="text-base font-semibold text-zinc-100">Output Sample</h4>
                  <pre className="mt-2 whitespace-pre-wrap rounded-md bg-black/40 p-2 text-xs text-zinc-300">
{capability.contract.outputSample ? JSON.stringify(capability.contract.outputSample, null, 2) : "N/A"}
                  </pre>
                </div>
              </div>
            </div>
          </ScrollArea>
        )}
        <DialogFooter>
          {capability && onEdit && (
            <Button type="button" variant="outline" onClick={() => onEdit(capability)}>
              Editar capacidade
            </Button>
          )}
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Fechar
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const CreateCapabilityDialog = ({
  workspaceId,
  onCreated,
  disabled,
}: {
  workspaceId: string | null;
  onCreated: () => void;
  disabled?: boolean;
}) => {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formState, setFormState] = useState({
    name: "",
    summary: "",
    description: "",
    version: "v1",
    status: "draft" as Capability["status"],
    riskLevel: "low" as CapabilityRiskLevel,
    dataAccess: "",
    triggerPhrases: "",
    averageDurationMs: "",
    estimatedCostUsd: "",
    inputSchemaJson: "",
    outputSampleJson: "",
    exampleTitle: "",
    exampleInputJson: "",
    exampleOutputJson: "",
    idempotent: true,
    maxRetries: "2",
    timeoutMs: "8000",
    safeModeEnabled: true,
    approvalRole: "supervisor" as ApprovalRole,
  });

  const resetForm = useCallback(() => {
    setFormState({
      name: "",
      summary: "",
      description: "",
      version: "v1",
      status: "draft",
      riskLevel: "low",
      dataAccess: "",
      triggerPhrases: "",
      averageDurationMs: "",
      estimatedCostUsd: "",
      inputSchemaJson: "",
      outputSampleJson: "",
      exampleTitle: "",
      exampleInputJson: "",
      exampleOutputJson: "",
      idempotent: true,
      maxRetries: "2",
      timeoutMs: "8000",
      safeModeEnabled: true,
      approvalRole: "supervisor",
    });
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!workspaceId) {
      toast({ title: "Selecione um workspace", description: "Escolha um workspace antes de criar." });
      return;
    }

    if (!formState.name.trim() || !formState.summary.trim() || !formState.description.trim()) {
      toast({ title: "Campos obrigatorios", description: "Nome, resumo e descricao sao necessarios." });
      return;
    }

    const inputSchema = parseJsonOptional(formState.inputSchemaJson, "Input Schema", toast);
    if (inputSchema === null) return;
    const outputSample = parseJsonOptional(formState.outputSampleJson, "Output Sample", toast);
    if (outputSample === null) return;

    let examples: Capability["contract"]["examples"] = [];
    const hasExample = formState.exampleTitle || formState.exampleInputJson || formState.exampleOutputJson;
    if (hasExample) {
      if (!formState.exampleTitle.trim()) {
        toast({ title: "Exemplo incompleto", description: "Informe um titulo para o exemplo." });
        return;
      }
      const exampleInput = parseJsonOptional(formState.exampleInputJson, "Exemplo (input)", toast);
      if (exampleInput === null) return;
      const exampleOutput = parseJsonOptional(formState.exampleOutputJson, "Exemplo (output)", toast);
      if (exampleOutput === null) return;

      examples = [
        {
          title: formState.exampleTitle,
          input: exampleInput ?? "",
          output: exampleOutput ?? "",
        },
      ];
    }

    const payload = {
      name: formState.name,
      version: formState.version || "v1",
      status: formState.status,
      contract: {
        summary: formState.summary,
        description: formState.description,
        dataAccess: parseCommaList(formState.dataAccess),
        riskLevel: formState.riskLevel,
        averageDurationMs: parseNumber(formState.averageDurationMs),
        estimatedCostUsd: parseNumber(formState.estimatedCostUsd),
        inputSchema,
        outputSample,
        examples,
        limits: {
          idempotent: formState.idempotent,
          maxRetries: parseNumber(formState.maxRetries),
          timeoutMs: parseNumber(formState.timeoutMs),
        },
        safeMode: {
          enabled: formState.safeModeEnabled,
          approvalRole: formState.safeModeEnabled ? formState.approvalRole : undefined,
        },
        triggerPhrases: parseCommaList(formState.triggerPhrases),
      },
    };

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/capabilities`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) {
        const message = result?.error || "Nao foi possivel criar a capacidade.";
        toast({ title: "Erro ao criar", description: message, variant: "destructive" });
        return;
      }

      toast({ title: "Capacidade criada", description: "A capacidade foi salva no catalogo." });
      onCreated();
      resetForm();
      setOpen(false);
    } catch (error: any) {
      toast({ title: "Erro de conexao", description: error.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button disabled={disabled}>
          <Plus className="mr-2 h-4 w-4" />
          Nova Capacidade
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Criar Capacidade</DialogTitle>
            <DialogDescription>
              Defina o contrato humano da capacidade: descricao, dados tocados, risco e limites.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[70vh] pr-4">
            <div className="grid gap-4 py-4">
              <div className="grid gap-2 md:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="cap-name">Nome</Label>
                  <Input
                    id="cap-name"
                    value={formState.name}
                    onChange={event => setFormState(prev => ({ ...prev, name: event.target.value }))}
                    placeholder="Gerar PIX e enviar no WhatsApp"
                    required
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="cap-version">Versao</Label>
                  <Input
                    id="cap-version"
                    value={formState.version}
                    onChange={event => setFormState(prev => ({ ...prev, version: event.target.value }))}
                    placeholder="v1"
                  />
                </div>
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label>Risco</Label>
                  <Select
                    value={formState.riskLevel}
                    onValueChange={value => setFormState(prev => ({ ...prev, riskLevel: value as CapabilityRiskLevel }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o nivel" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Baixo</SelectItem>
                      <SelectItem value="medium">Medio</SelectItem>
                      <SelectItem value="high">Alto</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label>Status</Label>
                  <Select
                    value={formState.status}
                    onValueChange={value => setFormState(prev => ({ ...prev, status: value as Capability["status"] }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Rascunho</SelectItem>
                      <SelectItem value="active">Ativa</SelectItem>
                      <SelectItem value="deprecated">Deprecated</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="cap-summary">Resumo curto</Label>
                <Input
                  id="cap-summary"
                  value={formState.summary}
                  onChange={event => setFormState(prev => ({ ...prev, summary: event.target.value }))}
                  placeholder="Gera PIX e envia ao cliente com recibo e historico."
                  required
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="cap-description">Descricao humana</Label>
                <Textarea
                  id="cap-description"
                  value={formState.description}
                  onChange={event => setFormState(prev => ({ ...prev, description: event.target.value }))}
                  placeholder="Explica o que acontece, limites e quando a IA deve pedir confirmacao."
                  required
                />
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="cap-data-access">Dados tocados</Label>
                  <Input
                    id="cap-data-access"
                    value={formState.dataAccess}
                    onChange={event => setFormState(prev => ({ ...prev, dataAccess: event.target.value }))}
                    placeholder="faturas, cliente, contrato"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="cap-trigger">Frases gatilho</Label>
                  <Input
                    id="cap-trigger"
                    value={formState.triggerPhrases}
                    onChange={event => setFormState(prev => ({ ...prev, triggerPhrases: event.target.value }))}
                    placeholder="segunda via, gerar pix, boleto"
                  />
                </div>
              </div>
              <div className="grid gap-2 md:grid-cols-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="cap-duration">Duracao media (ms)</Label>
                  <Input
                    id="cap-duration"
                    value={formState.averageDurationMs}
                    onChange={event => setFormState(prev => ({ ...prev, averageDurationMs: event.target.value }))}
                    placeholder="1200"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="cap-cost">Custo estimado (USD)</Label>
                  <Input
                    id="cap-cost"
                    value={formState.estimatedCostUsd}
                    onChange={event => setFormState(prev => ({ ...prev, estimatedCostUsd: event.target.value }))}
                    placeholder="0.012"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="cap-timeout">Timeout (ms)</Label>
                  <Input
                    id="cap-timeout"
                    value={formState.timeoutMs}
                    onChange={event => setFormState(prev => ({ ...prev, timeoutMs: event.target.value }))}
                    placeholder="8000"
                  />
                </div>
              </div>
              <div className="grid gap-2 md:grid-cols-3">
                <div className="flex items-center justify-between rounded-lg border border-white/5 bg-white/5 px-3 py-2">
                  <div>
                    <p className="text-sm font-medium text-zinc-100">Idempotente</p>
                    <p className="text-xs text-zinc-400">Evita duplicar acoes</p>
                  </div>
                  <Switch
                    checked={formState.idempotent}
                    onCheckedChange={checked => setFormState(prev => ({ ...prev, idempotent: checked }))}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="cap-retries">Retry max</Label>
                  <Input
                    id="cap-retries"
                    value={formState.maxRetries}
                    onChange={event => setFormState(prev => ({ ...prev, maxRetries: event.target.value }))}
                    placeholder="2"
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border border-white/5 bg-white/5 px-3 py-2">
                  <div>
                    <p className="text-sm font-medium text-zinc-100">Modo seguro</p>
                    <p className="text-xs text-zinc-400">Exige confirmacao</p>
                  </div>
                  <Switch
                    checked={formState.safeModeEnabled}
                    onCheckedChange={checked => setFormState(prev => ({ ...prev, safeModeEnabled: checked }))}
                  />
                </div>
              </div>
              {formState.safeModeEnabled && (
                <div className="grid gap-1.5">
                  <Label>Aprovacao minima</Label>
                  <Select
                    value={formState.approvalRole}
                    onValueChange={value => setFormState(prev => ({ ...prev, approvalRole: value as ApprovalRole }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o papel" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="operator">Operador</SelectItem>
                      <SelectItem value="supervisor">Supervisor</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="grid gap-2 md:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="cap-input-schema">Input Schema (JSON)</Label>
                  <Textarea
                    id="cap-input-schema"
                    value={formState.inputSchemaJson}
                    onChange={event => setFormState(prev => ({ ...prev, inputSchemaJson: event.target.value }))}
                    placeholder='{"customer_id":"string","amount":"number"}'
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="cap-output-sample">Output Sample (JSON)</Label>
                  <Textarea
                    id="cap-output-sample"
                    value={formState.outputSampleJson}
                    onChange={event => setFormState(prev => ({ ...prev, outputSampleJson: event.target.value }))}
                    placeholder='{"pix_id":"123","status":"created"}'
                  />
                </div>
              </div>
              <div className="rounded-lg border border-white/5 bg-white/5 p-3">
                <p className="text-sm font-semibold text-zinc-100">Exemplo real</p>
                <p className="text-xs text-zinc-400">Opcional, mas ajuda na clareza do contrato.</p>
                <div className="mt-3 grid gap-2 md:grid-cols-3">
                  <div className="grid gap-1.5 md:col-span-1">
                    <Label htmlFor="cap-example-title">Titulo</Label>
                    <Input
                      id="cap-example-title"
                      value={formState.exampleTitle}
                      onChange={event => setFormState(prev => ({ ...prev, exampleTitle: event.target.value }))}
                      placeholder="Cliente pediu 2a via"
                    />
                  </div>
                  <div className="grid gap-1.5 md:col-span-1">
                    <Label htmlFor="cap-example-input">Input (JSON)</Label>
                    <Textarea
                      id="cap-example-input"
                      value={formState.exampleInputJson}
                      onChange={event => setFormState(prev => ({ ...prev, exampleInputJson: event.target.value }))}
                      placeholder='{"customer_id":"42"}'
                    />
                  </div>
                  <div className="grid gap-1.5 md:col-span-1">
                    <Label htmlFor="cap-example-output">Output (JSON)</Label>
                    <Textarea
                      id="cap-example-output"
                      value={formState.exampleOutputJson}
                      onChange={event => setFormState(prev => ({ ...prev, exampleOutputJson: event.target.value }))}
                      placeholder='{"pix_url":"https://..."}'
                    />
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={isSubmitting}>
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Criar capacidade
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const EditCapabilityDialog = ({
  capability,
  onUpdated,
  onOpenChange,
}: {
  capability: Capability | null;
  onUpdated: () => void;
  onOpenChange: (open: boolean) => void;
}) => {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formState, setFormState] = useState(() =>
    capability ? buildFormStateFromCapability(capability) : buildFormStateFromCapability({
      id: "",
      workspace_id: "",
      name: "",
      slug: "",
      version: "v1",
      status: "draft",
      risk_level: "low",
      contract: {
        summary: "",
        description: "",
        riskLevel: "low",
      },
    } as Capability)
  );

  useEffect(() => {
    if (capability) {
      setFormState(buildFormStateFromCapability(capability));
    }
  }, [capability]);

  if (!capability) return null;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!formState.name.trim() || !formState.summary.trim() || !formState.description.trim()) {
      toast({ title: "Campos obrigatorios", description: "Nome, resumo e descricao sao necessarios." });
      return;
    }

    const inputSchema = parseJsonOptional(formState.inputSchemaJson, "Input Schema", toast);
    if (inputSchema === null) return;
    const outputSample = parseJsonOptional(formState.outputSampleJson, "Output Sample", toast);
    if (outputSample === null) return;

    let examples: Capability["contract"]["examples"] = [];
    const hasExample = formState.exampleTitle || formState.exampleInputJson || formState.exampleOutputJson;
    if (hasExample) {
      if (!formState.exampleTitle.trim()) {
        toast({ title: "Exemplo incompleto", description: "Informe um titulo para o exemplo." });
        return;
      }
      const exampleInput = parseJsonOptional(formState.exampleInputJson, "Exemplo (input)", toast);
      if (exampleInput === null) return;
      const exampleOutput = parseJsonOptional(formState.exampleOutputJson, "Exemplo (output)", toast);
      if (exampleOutput === null) return;

      examples = [
        {
          title: formState.exampleTitle,
          input: exampleInput ?? "",
          output: exampleOutput ?? "",
        },
      ];
    }

    const payload = {
      name: formState.name,
      version: formState.version || "v1",
      status: formState.status,
      contract: {
        summary: formState.summary,
        description: formState.description,
        dataAccess: parseCommaList(formState.dataAccess),
        riskLevel: formState.riskLevel,
        averageDurationMs: parseNumber(formState.averageDurationMs),
        estimatedCostUsd: parseNumber(formState.estimatedCostUsd),
        inputSchema,
        outputSample,
        examples,
        limits: {
          idempotent: formState.idempotent,
          maxRetries: parseNumber(formState.maxRetries),
          timeoutMs: parseNumber(formState.timeoutMs),
        },
        safeMode: {
          enabled: formState.safeModeEnabled,
          approvalRole: formState.safeModeEnabled ? formState.approvalRole : undefined,
        },
        triggerPhrases: parseCommaList(formState.triggerPhrases),
      },
    };

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/capabilities/${capability.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) {
        const message = result?.error || "Nao foi possivel atualizar a capacidade.";
        toast({ title: "Erro ao atualizar", description: message, variant: "destructive" });
        return;
      }

      toast({ title: "Capacidade atualizada", description: "As mudancas foram salvas." });
      onUpdated();
      onOpenChange(false);
    } catch (error: any) {
      toast({ title: "Erro de conexao", description: error.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={!!capability} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Editar Capacidade</DialogTitle>
            <DialogDescription>
              Ajuste contrato, dados tocados e exemplos para esta capacidade.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[70vh] pr-4">
            <div className="grid gap-4 py-4">
              <div className="grid gap-2 md:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="cap-edit-name">Nome</Label>
                  <Input
                    id="cap-edit-name"
                    value={formState.name}
                    onChange={event => setFormState(prev => ({ ...prev, name: event.target.value }))}
                    placeholder="Gerar PIX e enviar no WhatsApp"
                    required
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="cap-edit-version">Versao</Label>
                  <Input
                    id="cap-edit-version"
                    value={formState.version}
                    onChange={event => setFormState(prev => ({ ...prev, version: event.target.value }))}
                    placeholder="v1"
                  />
                </div>
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label>Risco</Label>
                  <Select
                    value={formState.riskLevel}
                    onValueChange={value => setFormState(prev => ({ ...prev, riskLevel: value as CapabilityRiskLevel }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o nivel" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Baixo</SelectItem>
                      <SelectItem value="medium">Medio</SelectItem>
                      <SelectItem value="high">Alto</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label>Status</Label>
                  <Select
                    value={formState.status}
                    onValueChange={value => setFormState(prev => ({ ...prev, status: value as Capability["status"] }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Rascunho</SelectItem>
                      <SelectItem value="active">Ativa</SelectItem>
                      <SelectItem value="deprecated">Deprecated</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="cap-edit-summary">Resumo curto</Label>
                <Input
                  id="cap-edit-summary"
                  value={formState.summary}
                  onChange={event => setFormState(prev => ({ ...prev, summary: event.target.value }))}
                  placeholder="Gera PIX e envia ao cliente com recibo e historico."
                  required
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="cap-edit-description">Descricao humana</Label>
                <Textarea
                  id="cap-edit-description"
                  value={formState.description}
                  onChange={event => setFormState(prev => ({ ...prev, description: event.target.value }))}
                  placeholder="Explica o que acontece, limites e quando a IA deve pedir confirmacao."
                  required
                />
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="cap-edit-data-access">Dados tocados</Label>
                  <Input
                    id="cap-edit-data-access"
                    value={formState.dataAccess}
                    onChange={event => setFormState(prev => ({ ...prev, dataAccess: event.target.value }))}
                    placeholder="faturas, cliente, contrato"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="cap-edit-trigger">Frases gatilho</Label>
                  <Input
                    id="cap-edit-trigger"
                    value={formState.triggerPhrases}
                    onChange={event => setFormState(prev => ({ ...prev, triggerPhrases: event.target.value }))}
                    placeholder="segunda via, gerar pix, boleto"
                  />
                </div>
              </div>
              <div className="grid gap-2 md:grid-cols-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="cap-edit-duration">Duracao media (ms)</Label>
                  <Input
                    id="cap-edit-duration"
                    value={formState.averageDurationMs}
                    onChange={event => setFormState(prev => ({ ...prev, averageDurationMs: event.target.value }))}
                    placeholder="1200"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="cap-edit-cost">Custo estimado (USD)</Label>
                  <Input
                    id="cap-edit-cost"
                    value={formState.estimatedCostUsd}
                    onChange={event => setFormState(prev => ({ ...prev, estimatedCostUsd: event.target.value }))}
                    placeholder="0.012"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="cap-edit-timeout">Timeout (ms)</Label>
                  <Input
                    id="cap-edit-timeout"
                    value={formState.timeoutMs}
                    onChange={event => setFormState(prev => ({ ...prev, timeoutMs: event.target.value }))}
                    placeholder="8000"
                  />
                </div>
              </div>
              <div className="grid gap-2 md:grid-cols-3">
                <div className="flex items-center justify-between rounded-lg border border-white/5 bg-white/5 px-3 py-2">
                  <div>
                    <p className="text-sm font-medium text-zinc-100">Idempotente</p>
                    <p className="text-xs text-zinc-400">Evita duplicar acoes</p>
                  </div>
                  <Switch
                    checked={formState.idempotent}
                    onCheckedChange={checked => setFormState(prev => ({ ...prev, idempotent: checked }))}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="cap-edit-retries">Retry max</Label>
                  <Input
                    id="cap-edit-retries"
                    value={formState.maxRetries}
                    onChange={event => setFormState(prev => ({ ...prev, maxRetries: event.target.value }))}
                    placeholder="2"
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border border-white/5 bg-white/5 px-3 py-2">
                  <div>
                    <p className="text-sm font-medium text-zinc-100">Modo seguro</p>
                    <p className="text-xs text-zinc-400">Exige confirmacao</p>
                  </div>
                  <Switch
                    checked={formState.safeModeEnabled}
                    onCheckedChange={checked => setFormState(prev => ({ ...prev, safeModeEnabled: checked }))}
                  />
                </div>
              </div>
              {formState.safeModeEnabled && (
                <div className="grid gap-1.5">
                  <Label>Aprovacao minima</Label>
                  <Select
                    value={formState.approvalRole}
                    onValueChange={value => setFormState(prev => ({ ...prev, approvalRole: value as ApprovalRole }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o papel" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="operator">Operador</SelectItem>
                      <SelectItem value="supervisor">Supervisor</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="grid gap-2 md:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="cap-edit-input-schema">Input Schema (JSON)</Label>
                  <Textarea
                    id="cap-edit-input-schema"
                    value={formState.inputSchemaJson}
                    onChange={event => setFormState(prev => ({ ...prev, inputSchemaJson: event.target.value }))}
                    placeholder='{"customer_id":"string","amount":"number"}'
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="cap-edit-output-sample">Output Sample (JSON)</Label>
                  <Textarea
                    id="cap-edit-output-sample"
                    value={formState.outputSampleJson}
                    onChange={event => setFormState(prev => ({ ...prev, outputSampleJson: event.target.value }))}
                    placeholder='{"pix_id":"123","status":"created"}'
                  />
                </div>
              </div>
              <div className="rounded-lg border border-white/5 bg-white/5 p-3">
                <p className="text-sm font-semibold text-zinc-100">Exemplo real</p>
                <p className="text-xs text-zinc-400">Opcional, mas ajuda na clareza do contrato.</p>
                <div className="mt-3 grid gap-2 md:grid-cols-3">
                  <div className="grid gap-1.5 md:col-span-1">
                    <Label htmlFor="cap-edit-example-title">Titulo</Label>
                    <Input
                      id="cap-edit-example-title"
                      value={formState.exampleTitle}
                      onChange={event => setFormState(prev => ({ ...prev, exampleTitle: event.target.value }))}
                      placeholder="Cliente pediu 2a via"
                    />
                  </div>
                  <div className="grid gap-1.5 md:col-span-1">
                    <Label htmlFor="cap-edit-example-input">Input (JSON)</Label>
                    <Textarea
                      id="cap-edit-example-input"
                      value={formState.exampleInputJson}
                      onChange={event => setFormState(prev => ({ ...prev, exampleInputJson: event.target.value }))}
                      placeholder='{"customer_id":"42"}'
                    />
                  </div>
                  <div className="grid gap-1.5 md:col-span-1">
                    <Label htmlFor="cap-edit-example-output">Output (JSON)</Label>
                    <Textarea
                      id="cap-edit-example-output"
                      value={formState.exampleOutputJson}
                      onChange={event => setFormState(prev => ({ ...prev, exampleOutputJson: event.target.value }))}
                      placeholder='{"pix_url":"https://..."}'
                    />
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={isSubmitting}>
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar alteracoes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default function CapabilitiesPage() {
  const { currentOrganization } = useAuth();
  const { toast } = useToast();
  const [workspaces, setWorkspaces] = useState<WorkspaceData[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);
  const [capabilities, setCapabilities] = useState<Capability[]>([]);
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(true);
  const [loadingCapabilities, setLoadingCapabilities] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeCapability, setActiveCapability] = useState<Capability | null>(null);
  const [editingCapability, setEditingCapability] = useState<Capability | null>(null);

  const selectedWorkspace = useMemo(
    () => workspaces.find(ws => ws.id === selectedWorkspaceId) || null,
    [workspaces, selectedWorkspaceId]
  );

  const fetchWorkspaces = useCallback(async () => {
    if (!currentOrganization?.id) {
      setWorkspaces([]);
      setSelectedWorkspaceId(null);
      setLoadingWorkspaces(false);
      return;
    }

    setLoadingWorkspaces(true);
    try {
      const response = await fetch(`/api/organizations/${currentOrganization.id}/workspaces`, {
        cache: "no-store",
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result?.error || "Falha ao carregar workspaces.");
      }
      setWorkspaces(result);
      if (result.length > 0) {
        setSelectedWorkspaceId(prev => prev ?? result[0].id);
      } else {
        setSelectedWorkspaceId(null);
      }
    } catch (error: any) {
      toast({ title: "Erro ao carregar workspaces", description: error.message, variant: "destructive" });
      setWorkspaces([]);
      setSelectedWorkspaceId(null);
    } finally {
      setLoadingWorkspaces(false);
    }
  }, [currentOrganization?.id, toast]);

  const fetchCapabilities = useCallback(async (workspaceId: string) => {
    setLoadingCapabilities(true);
    setError(null);
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/capabilities`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result?.error || "Falha ao carregar capacidades.");
      }
      setCapabilities(result);
    } catch (error: any) {
      setCapabilities([]);
      setError(error.message);
    } finally {
      setLoadingCapabilities(false);
    }
  }, []);

  useEffect(() => {
    fetchWorkspaces();
  }, [fetchWorkspaces]);

  useEffect(() => {
    if (selectedWorkspaceId) {
      fetchCapabilities(selectedWorkspaceId);
    } else {
      setCapabilities([]);
    }
  }, [selectedWorkspaceId, fetchCapabilities]);

  const handleRefresh = useCallback(() => {
    if (selectedWorkspaceId) {
      fetchCapabilities(selectedWorkspaceId);
    }
  }, [selectedWorkspaceId, fetchCapabilities]);

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Capacidades</h2>
          <p className="text-muted-foreground mt-1">
            Catalogo MCP do seu workspace: contratos humanos, risco e exemplos prontos para a IA.
          </p>
        </div>
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <div className="min-w-[240px]">
            <Select
              value={selectedWorkspaceId ?? ""}
              onValueChange={value => setSelectedWorkspaceId(value)}
              disabled={loadingWorkspaces || workspaces.length === 0}
            >
              <SelectTrigger>
                <SelectValue placeholder={loadingWorkspaces ? "Carregando workspaces..." : "Selecione um workspace"} />
              </SelectTrigger>
              <SelectContent>
                {workspaces.map(ws => (
                  <SelectItem key={ws.id} value={ws.id}>
                    {ws.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <CreateCapabilityDialog
            workspaceId={selectedWorkspaceId}
            onCreated={handleRefresh}
            disabled={!selectedWorkspaceId}
          />
        </div>
      </div>

      <div className="rounded-2xl border border-white/5 bg-gradient-to-r from-violet-500/10 via-transparent to-fuchsia-500/10 p-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-500/20">
              <Sparkles className="h-5 w-5 text-violet-300" />
            </div>
            <div>
              <p className="text-sm font-semibold text-zinc-100">Workspace selecionado</p>
              <p className="text-xs text-zinc-400">
                {selectedWorkspace ? selectedWorkspace.name : "Nenhum workspace ativo"}
              </p>
            </div>
          </div>
          {selectedWorkspace && (
            <div className="flex items-center gap-2 text-xs text-zinc-400">
              <span className="flex items-center gap-1">
                <Tag className="h-3.5 w-3.5" />
                {capabilities.length} capacidades
              </span>
              <span className="flex items-center gap-1">
                <ShieldCheck className="h-3.5 w-3.5" />
                {capabilities.filter(cap => cap.contract.safeMode?.enabled).length} com modo seguro
              </span>
            </div>
          )}
        </div>
      </div>

      {loadingCapabilities ? (
        <div className="flex items-center justify-center py-16 text-zinc-400">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Carregando capacidades...
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-red-500/40 bg-red-500/10 py-20 text-center">
          <AlertTriangle className="h-10 w-10 text-red-300" />
          <h3 className="mt-3 text-xl font-semibold text-zinc-100">Erro ao carregar</h3>
          <p className="text-sm text-zinc-400 mt-2">{error}</p>
        </div>
      ) : !selectedWorkspace ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/5 py-20 text-center">
          <Database className="h-10 w-10 text-zinc-500" />
          <h3 className="mt-3 text-xl font-semibold text-zinc-100">Escolha um workspace</h3>
          <p className="text-sm text-zinc-400 mt-2 max-w-md">
            Selecione um workspace para ver o catalogo de capacidades MCP.
          </p>
        </div>
      ) : capabilities.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/5 py-20 text-center">
          <Sparkles className="h-10 w-10 text-violet-400" />
          <h3 className="mt-3 text-xl font-semibold text-zinc-100">Nenhuma capacidade ainda</h3>
          <p className="text-sm text-zinc-400 mt-2 max-w-md">
            Crie sua primeira capacidade com contrato humano, exemplos e modo seguro.
          </p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {capabilities.map(capability => {
            const dataAccess = capability.contract.dataAccess ?? [];
            const triggerPhrases = capability.contract.triggerPhrases ?? [];

            return (
              <Card
                key={capability.id}
                className="group flex h-full flex-col border border-white/5 bg-zinc-900/40 backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:border-violet-500/30 hover:shadow-lg hover:shadow-violet-500/10"
              >
                <CardHeader className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className={riskClass[capability.contract.riskLevel]}>
                      Risco {riskLabel[capability.contract.riskLevel]}
                    </Badge>
                    <Badge className={statusClass[capability.status]}>{statusLabel[capability.status]}</Badge>
                    <Badge variant="outline" className="border-white/10 text-zinc-400">
                      {capability.version}
                    </Badge>
                  </div>
                  <div>
                    <CardTitle className="text-lg text-zinc-100">{capability.name}</CardTitle>
                    <CardDescription className="mt-1 text-sm text-zinc-400">
                      {capability.contract.summary}
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 text-sm text-zinc-300">
                  <div className="grid gap-2 md:grid-cols-2">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-violet-300" />
                      {formatDuration(capability.contract.averageDurationMs)}
                    </div>
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-emerald-300" />
                      {formatCost(capability.contract.estimatedCostUsd)}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-zinc-500">
                      <Database className="h-3.5 w-3.5" />
                      Dados tocados
                    </div>
                    {dataAccess.length ? (
                      <div className="flex flex-wrap gap-2">
                        {dataAccess.slice(0, 4).map(item => (
                          <Badge key={item} variant="outline" className="border-white/10 text-zinc-300">
                            {item}
                          </Badge>
                        ))}
                        {dataAccess.length > 4 && (
                          <Badge variant="outline" className="border-white/10 text-zinc-400">
                            +{dataAccess.length - 4}
                          </Badge>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-zinc-500">Nenhum dado informado.</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-zinc-500">
                      <Tag className="h-3.5 w-3.5" />
                      Frases gatilho
                    </div>
                    {triggerPhrases.length ? (
                      <p className="text-sm text-zinc-300 line-clamp-2">
                        {triggerPhrases.join(" - ")}
                      </p>
                    ) : (
                      <p className="text-xs text-zinc-500">Nenhuma frase definida.</p>
                    )}
                  </div>
                </CardContent>
                <CardFooter className="mt-auto flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-zinc-400">
                    <ShieldCheck className="h-4 w-4 text-violet-300" />
                    {capability.contract.safeMode?.enabled ? "Modo seguro ativo" : "Modo seguro desligado"}
                  </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    className="border-white/10 text-zinc-300 hover:text-white"
                    onClick={() => setEditingCapability(capability)}
                  >
                    Editar
                  </Button>
                  <Button
                    variant="ghost"
                    className="text-zinc-300 hover:text-white"
                    onClick={() => setActiveCapability(capability)}
                  >
                    Ver contrato
                  </Button>
                </div>
              </CardFooter>
            </Card>
          );
          })}
        </div>
      )}

      <CapabilityDetailsDialog
        capability={activeCapability}
        onOpenChange={open => {
          if (!open) setActiveCapability(null);
        }}
        onEdit={cap => {
          setActiveCapability(null);
          setEditingCapability(cap);
        }}
      />
      <EditCapabilityDialog
        capability={editingCapability}
        onUpdated={handleRefresh}
        onOpenChange={open => {
          if (!open) setEditingCapability(null);
        }}
      />
    </div>
  );
}
