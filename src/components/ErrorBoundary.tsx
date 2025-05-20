
"use client";

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    // Atualiza o estado para que a próxima renderização mostre a UI de fallback.
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Você também pode logar o erro para um serviço de reporte de erros
    console.error("Erro não tratado capturado pelo ErrorBoundary:", error, errorInfo);
    this.setState({ error, errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      // Você pode renderizar qualquer UI de fallback customizada
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-background p-6 text-center">
          <AlertTriangle className="w-16 h-16 text-destructive mb-6" />
          <h1 className="text-3xl font-semibold text-destructive mb-3">Oops! Algo deu errado.</h1>
          <p className="text-lg text-muted-foreground mb-6">
            Lamentamos o inconveniente. Nossa equipe foi notificada.
            Por favor, tente recarregar a página.
          </p>
          
          {process.env.NODE_ENV === 'development' && this.state.error && (
            <details className="mb-6 p-4 bg-muted rounded-lg text-left w-full max-w-2xl overflow-auto">
              <summary className="cursor-pointer font-medium text-destructive">Detalhes do Erro (Desenvolvimento)</summary>
              <pre className="mt-2 text-xs whitespace-pre-wrap">
                {this.state.error.toString()}
                {this.state.errorInfo && this.state.errorInfo.componentStack && (
                  `\n\nStack do Componente:\n${this.state.errorInfo.componentStack}`
                )}
              </pre>
            </details>
          )}

          <Button onClick={this.handleReload} size="lg">
            Recarregar Página
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
