"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, RefreshCw } from "lucide-react";

interface WebhookLogsViewerProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
}

interface WebhookLogEntry {
  timestamp: string;
  method?: string;
  url?: string;
  headers?: Record<string, string>;
  ip?: string;
  extractedMessage?: string | null;
  flowContext?: string;
  payload?: unknown;
}

const formatDate = (isoDate: string) => {
  try {
    const parsed = new Date(isoDate);
    return parsed.toLocaleString();
  } catch {
    return isoDate;
  }
};

export default function WebhookLogsViewer({
  isOpen,
  onClose,
  workspaceId,
}: WebhookLogsViewerProps) {
  const [logs, setLogs] = useState<WebhookLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    if (!workspaceId) {
      setLogs([]);
      setError("Selecione um workspace para visualizar os logs.");
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        workspaceId,
        type: "webhook",
        limit: "50",
      });
      const response = await fetch(
        `/api/evolution/webhook-logs?${params.toString()}`,
        {
          cache: "no-store",
        }
      );

      if (!response.ok) {
        throw new Error("Não foi possível carregar os logs mais recentes.");
      }

      const data = (await response.json()) as WebhookLogEntry[];
      setLogs(data);
    } catch (err: any) {
      setError(err?.message || "Erro inesperado ao buscar os logs.");
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    if (isOpen) {
      fetchLogs();
    }
  }, [isOpen, fetchLogs]);

  return (
    <DialogContent className="sm:max-w-4xl">
      <DialogHeader>
        <DialogTitle>Histórico de Webhooks</DialogTitle>
        <DialogDescription>
          Examine as requisições recebidas pelo webhook deste workspace para
          facilitar o debug das integrações.
        </DialogDescription>
      </DialogHeader>

      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Mostrando até 50 eventos recentes.
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchLogs}
          disabled={isLoading || !workspaceId}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Atualizando
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Atualizar
            </>
          )}
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Erro ao carregar os logs</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <ScrollArea className="max-h-[60vh] pr-4">
        {logs.length === 0 && !error && !isLoading && (
          <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            Nenhum log encontrado para este workspace ainda.
          </div>
        )}

        <div className="space-y-4 pt-2">
          {logs.map((log, index) => (
            <div
              key={`${log.timestamp}-${index}`}
              className="rounded-lg border bg-card p-4 text-sm shadow-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="space-y-1">
                  <p className="font-medium">{log.url || "URL desconhecida"}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(log.timestamp)} • IP {log.ip || "desconhecido"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {log.method && (
                    <Badge variant="secondary">{log.method}</Badge>
                  )}
                  {log.flowContext && (
                    <Badge variant="outline">{log.flowContext}</Badge>
                  )}
                </div>
              </div>

              {log.extractedMessage && (
                <div className="mt-3">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">
                    Mensagem extraída
                  </p>
                  <div className="rounded-md bg-muted/50 p-2">
                    <p className="text-sm">{log.extractedMessage}</p>
                  </div>
                </div>
              )}

              {!!log.payload && (
                <div className="mt-3">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">
                    Payload
                  </p>
                  <pre className="mt-1 max-h-64 overflow-auto rounded-md bg-muted/50 p-3 text-xs leading-relaxed">
                    {JSON.stringify(log.payload, null, 2)}
                  </pre>
                </div>
              )}

              {log.headers && (
                <details className="mt-3 rounded-md border bg-muted/30 p-3 text-xs">
                  <summary className="cursor-pointer font-semibold">
                    Headers
                  </summary>
                  <pre className="mt-2 overflow-auto text-[11px]">
                    {JSON.stringify(log.headers, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>

      <DialogFooter>
        <Button type="button" variant="secondary" onClick={onClose}>
          Fechar
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
