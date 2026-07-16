'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/components/auth/AuthProvider';
import {
  deleteOrganizationGeminiKeyAction,
  getOrganizationGeminiKeysAction,
  saveOrganizationGeminiKeyAction,
  setDefaultOrganizationGeminiKeyAction,
} from '@/app/actions/organizationAiKeysActions';
import type { OrganizationAiKeySummary } from '@/lib/types';
import {
  BotMessageSquare,
  BrainCircuit,
  CheckCircle,
  KeyRound,
  Loader2,
  MessageCircle,
  Pencil,
  ShieldCheck,
  Sparkles,
  Star,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const integrations = [
  {
    id: 'evolution',
    icon: <BotMessageSquare className="h-8 w-8 text-blue-500" />,
    title: 'API Evolution',
    description: 'Conecte-se com a API do WhatsApp para enviar e receber mensagens.',
    badge: 'Instalado',
    verified: true,
    actionLabel: 'Gerenciar',
  },
  {
    id: 'chatwoot',
    icon: <MessageCircle className="h-8 w-8 text-sky-500" />,
    title: 'Chatwoot',
    description: 'Integre com sua plataforma de atendimento ao cliente Chatwoot.',
    badge: 'Instalado',
    verified: true,
    actionLabel: 'Gerenciar',
  },
  {
    id: 'gemini',
    icon: <BrainCircuit className="h-8 w-8 text-rose-500" />,
    title: 'Gemini',
    description: 'Cadastre chaves Gemini nomeadas e reutilize nos blocos do fluxo sem depender de .env.',
    badge: 'Gemini',
    verified: true,
    actionLabel: 'Gerenciar chaves',
  },
];

const badgeClassName = (badge: string) => {
  switch (badge) {
    case 'Instalado':
      return 'border-green-300 bg-green-100 text-green-800';
    case 'Gemini':
      return 'border-rose-300 bg-rose-100 text-rose-800';
    default:
      return 'border-white/10 bg-secondary text-secondary-foreground';
  }
};

export default function IntegrationsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const managerRef = useRef<HTMLDivElement | null>(null);

  const [keys, setKeys] = useState<OrganizationAiKeySummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editingKeyId, setEditingKeyId] = useState<string | null>(null);
  const [keyName, setKeyName] = useState('');
  const [keyValue, setKeyValue] = useState('');
  const [isDefault, setIsDefault] = useState(false);

  const isDeveloper = user?.role === 'desenvolvedor';
  const editingKey = useMemo(
    () => keys.find((item) => item.id === editingKeyId) || null,
    [keys, editingKeyId]
  );

  const loadKeys = useCallback(async () => {
    setIsLoading(true);
    const result = await getOrganizationGeminiKeysAction();
    if (result.success && result.data) {
      setKeys(result.data);
    } else if (!result.success) {
      toast({
        title: 'Erro ao carregar chaves',
        description: result.error,
        variant: 'destructive',
      });
    }
    setIsLoading(false);
  }, [toast]);

  useEffect(() => {
    if (user && user.role !== 'desenvolvedor') {
      router.replace('/');
      return;
    }
    if (user?.current_organization_id) {
      loadKeys();
    }
  }, [user, loadKeys, router]);

  const resetForm = useCallback(() => {
    setEditingKeyId(null);
    setKeyName('');
    setKeyValue('');
    setIsDefault(false);
  }, []);

  const handleEdit = useCallback((item: OrganizationAiKeySummary) => {
    setEditingKeyId(item.id);
    setKeyName(item.name);
    setKeyValue('');
    setIsDefault(item.is_default);
    managerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    const result = await saveOrganizationGeminiKeyAction({
      id: editingKeyId || undefined,
      name: keyName,
      api_key: keyValue || undefined,
      is_default: isDefault,
    });

    if (result.success) {
      toast({
        title: editingKeyId ? 'Chave atualizada' : 'Chave criada',
        description: `A chave "${result.key?.name || keyName}" foi salva com sucesso.`,
      });
      resetForm();
      await loadKeys();
    } else {
      toast({
        title: 'Erro ao salvar chave',
        description: result.error,
        variant: 'destructive',
      });
    }

    setIsSaving(false);
  }, [editingKeyId, isDefault, keyName, keyValue, loadKeys, resetForm, toast]);

  const handleDelete = useCallback(async (item: OrganizationAiKeySummary) => {
    const confirmed = window.confirm(`Excluir a chave "${item.name}"?`);
    if (!confirmed) return;

    const result = await deleteOrganizationGeminiKeyAction(item.id);
    if (result.success) {
      toast({
        title: 'Chave removida',
        description: `A chave "${item.name}" foi excluida.`,
      });
      if (editingKeyId === item.id) {
        resetForm();
      }
      await loadKeys();
    } else {
      toast({
        title: 'Erro ao excluir chave',
        description: result.error,
        variant: 'destructive',
      });
    }
  }, [editingKeyId, loadKeys, resetForm, toast]);

  const handleSetDefault = useCallback(async (item: OrganizationAiKeySummary) => {
    const result = await setDefaultOrganizationGeminiKeyAction(item.id);
    if (result.success) {
      toast({
        title: 'Chave padrao atualizada',
        description: `"${item.name}" agora sera usada como padrao nos blocos Gemini sem selecao explicita.`,
      });
      await loadKeys();
    } else {
      toast({
        title: 'Erro ao definir chave padrao',
        description: result.error,
        variant: 'destructive',
      });
    }
  }, [loadKeys, toast]);

  if (!isDeveloper) {
    return null;
  }

  return (
    <div className="flex-1 space-y-8 p-4 pt-6 md:p-8">
      <div className="space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Extensoes e Integracoes</h2>
        <p className="text-muted-foreground">
          Conecte suas ferramentas favoritas e centralize as chaves Gemini usadas pelos seus fluxos.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {integrations.map((integration) => (
          <Card
            key={integration.id}
            className="flex flex-col border-white/10 bg-zinc-950/60 shadow-[0_24px_80px_-48px_rgba(0,0,0,0.9)]"
          >
            <CardContent className="flex flex-1 flex-col p-6">
              <div className="flex items-start justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
                  {integration.icon}
                </div>
                <Badge className={cn('text-xs', badgeClassName(integration.badge))}>
                  {integration.badge}
                </Badge>
              </div>

              <div className="mt-5 space-y-2">
                <h3 className="flex items-center gap-2 text-lg font-semibold text-white">
                  {integration.verified && <CheckCircle className="h-5 w-5 text-emerald-400" />}
                  {integration.title}
                </h3>
                <p className="min-h-[56px] text-sm leading-6 text-zinc-400">
                  {integration.description}
                </p>
              </div>
            </CardContent>

            <CardFooter className="pt-0">
              <Button
                className="w-full"
                variant={integration.id === 'gemini' ? 'default' : 'secondary'}
                onClick={() => {
                  if (integration.id === 'gemini') {
                    managerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }
                }}
              >
                {integration.actionLabel}
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      <div ref={managerRef} className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="border-rose-500/20 bg-zinc-950/70">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-rose-500/20 bg-rose-500/10">
                <KeyRound className="h-5 w-5 text-rose-300" />
              </div>
              <div>
                <CardTitle>Chaves Gemini da organizacao</CardTitle>
                <CardDescription>
                  Cada chave ganha um nome. Nos blocos do fluxo voce seleciona esse nome e o runtime resolve a API key real.
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-sm text-zinc-400">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-4 w-4 text-emerald-400" />
                <div className="space-y-1">
                  <p className="font-medium text-zinc-200">Como funciona</p>
                  <p>
                    A chave padrao sera usada por qualquer bloco Gemini sem selecao explicita. Se o bloco escolher uma chave pelo nome, essa selecao tem prioridade.
                  </p>
                </div>
              </div>
            </div>

            {isLoading ? (
              <div className="flex min-h-[220px] items-center justify-center rounded-2xl border border-dashed border-white/10">
                <Loader2 className="h-7 w-7 animate-spin text-zinc-500" />
              </div>
            ) : keys.length === 0 ? (
              <div className="flex min-h-[220px] flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-6 text-center">
                <Sparkles className="mb-3 h-7 w-7 text-rose-300" />
                <p className="text-sm font-medium text-zinc-200">Nenhuma chave Gemini cadastrada</p>
                <p className="mt-1 max-w-md text-sm text-zinc-500">
                  Cadastre a primeira chave para parar de depender do .env e liberar a selecao por nome nos blocos.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {keys.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/[0.02] p-4 lg:flex-row lg:items-center lg:justify-between"
                  >
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-zinc-100">{item.name}</span>
                        <Badge variant="outline" className="border-rose-500/20 bg-rose-500/10 text-rose-200">
                          Gemini
                        </Badge>
                        {item.is_default && (
                          <Badge className="bg-amber-200 text-amber-900">
                            <Star className="mr-1 h-3 w-3" />
                            Padrao
                          </Badge>
                        )}
                      </div>
                      <div className="font-mono text-xs text-zinc-500">{item.masked_key}</div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-white/10 bg-transparent"
                        disabled={item.is_default}
                        onClick={() => handleSetDefault(item)}
                      >
                        Definir padrao
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-white/10 bg-transparent"
                        onClick={() => handleEdit(item)}
                      >
                        <Pencil className="mr-2 h-3.5 w-3.5" />
                        Editar
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-red-500/20 bg-transparent text-red-300 hover:bg-red-500/10 hover:text-red-200"
                        onClick={() => handleDelete(item)}
                      >
                        <Trash2 className="mr-2 h-3.5 w-3.5" />
                        Excluir
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-zinc-950/70">
          <CardHeader>
            <CardTitle>{editingKey ? 'Editar chave Gemini' : 'Nova chave Gemini'}</CardTitle>
            <CardDescription>
              O valor real da chave nao volta para a tela depois de salvo. Ao editar, informe uma nova chave apenas se quiser substituir a atual.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="gemini-key-name">Nome de referencia</Label>
              <Input
                id="gemini-key-name"
                value={keyName}
                onChange={(event) => setKeyName(event.target.value)}
                placeholder="Ex.: Gemini Producao"
                className="bg-black/20"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="gemini-key-value">
                {editingKey ? 'Nova API key (opcional)' : 'API key'}
              </Label>
              <Input
                id="gemini-key-value"
                type="password"
                value={keyValue}
                onChange={(event) => setKeyValue(event.target.value)}
                placeholder={editingKey ? 'Deixe em branco para manter a atual' : 'Cole aqui a chave da Gemini'}
                className="bg-black/20"
              />
            </div>

            <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3">
              <div className="space-y-1">
                <p className="text-sm font-medium text-zinc-100">Usar como chave padrao</p>
                <p className="text-xs text-zinc-500">
                  Todo bloco Gemini sem selecao explicita vai usar esta chave.
                </p>
              </div>
              <Switch checked={isDefault} onCheckedChange={setIsDefault} />
            </div>
          </CardContent>

          <CardFooter className="flex flex-col items-stretch gap-3 sm:flex-row sm:justify-between">
            <Button variant="ghost" onClick={resetForm}>
              Limpar
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingKey ? 'Salvar alteracoes' : 'Cadastrar chave'}
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
