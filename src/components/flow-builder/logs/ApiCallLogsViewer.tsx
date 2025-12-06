"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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

interface ApiCallLogsViewerProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
  nodeId?: string;
  nodeTitle?: string;
}

interface ApiCallLogEntry {
  timestamp: string;
  nodeId?: string;
  nodeTitle?: string;
  requestUrl?: string;
  response?: unknown;
  error?: unknown;
}

const formatDate = (isoDate: string) => {
  try {
    return new Date(isoDate).toLocaleString();
  } catch {
    return isoDate;
  }
};

const stringifyData = (value: unknown) => {
  if (value === undefined || value === null) return "Sem conteúdo";
  return JSON.stringify(value, null, 2);
};

export default function ApiCallLogsViewer({
  isOpen,
  onClose,
  workspaceId,
  nodeId,
  nodeTitle,
}: ApiCallLogsViewerProps) {
  const [logs, setLogs] = useState<ApiCallLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resolvedNodeTitle = useMemo(() => {
    if (nodeTitle) return nodeTitle;
    if (logs.length > 0) {
      return logs[0].nodeTitle || logs[0].nodeId || "API Call";
    }
    return "API Call";
  }, [nodeTitle, logs]);

  const fetchLogs = useCallback(async () => {
    if (!workspaceId) {
      setLogs([]);
      setError("Selecione um workspace para visualizar o histórico.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        workspaceId,
      });

      if (nodeId) {
        params.append("nodeId", nodeId);
      }

      const response = await fetch(`/api/api-call-logs?${params.toString()}`, {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Não foi possível buscar o histórico agora.");
      }

      const data = (await response.json()) as ApiCallLogEntry[];
      setLogs(data);
    } catch (err: any) {
      setError(err?.message || "Erro inesperado ao consultar os logs.");
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId, nodeId]);

  useEffect(() => {
    if (isOpen) {
      fetchLogs();
    }
  }, [isOpen, fetchLogs]);

  return (
    <DialogContent className="sm:max-w-4xl">
      <DialogHeader>
        <DialogTitle>Histórico de Chamadas - {resolvedNodeTitle}</DialogTitle>
        <DialogDescription>
          Consulte as últimas execuções desta chamada de API para entender o
          comportamento e depurar eventuais erros.
        </DialogDescription>
      </DialogHeader>

      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Mostrando até 50 chamadas mais recentes.
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
          <AlertTitle>Erro ao carregar o histórico</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <ScrollArea className="max-h-[60vh] pr-4">
        {logs.length === 0 && !error && !isLoading && (
          <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            Ainda não existem logs registrados para este nó.
          </div>
        )}

        <div className="space-y-4 pt-2">
          {logs.map((log, index) => {
            const hasError = Boolean(log.error);
            return (
              <div
                key={`${log.timestamp}-${index}`}
                className="rounded-lg border bg-card p-4 text-sm shadow-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">
                      {log.requestUrl || "URL não informada"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(log.timestamp)}
                    </p>
                  </div>
                  <Badge variant={hasError ? "destructive" : "secondary"}>
                    {hasError ? "Erro" : "Sucesso"}
                  </Badge>
                </div>

                {!!log.response && (
                  <div className="mt-3">
                    <p className="text-xs font-semibold uppercase text-muted-foreground">
                      Resposta
                    </p>
                    <pre className="mt-1 max-h-64 overflow-auto rounded-md bg-muted/50 p-3 text-xs leading-relaxed">
                      {stringifyData(log.response)}
                    </pre>
                  </div>
                )}

                {!!log.error && (
                  <div className="mt-3">
                    <p className="text-xs font-semibold uppercase text-destructive">
                      Erro
                    </p>
                    <pre className="mt-1 max-h-64 overflow-auto rounded-md bg-destructive/10 p-3 text-xs leading-relaxed text-destructive">
                      {stringifyData(log.error)}
                    </pre>
                  </div>
                )}
              </div>
            );
          })}
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
