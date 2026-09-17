import React, { Component, type ErrorInfo, type ReactNode } from "react"
import { AlertTriangle, RefreshCw, RotateCcw } from "lucide-react"
import { Button } from "./button"

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary capturou um erro não tratado:", error, errorInfo)
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  private handleReload = () => {
    window.location.reload()
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="min-h-[50vh] flex flex-col items-center justify-center p-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center mb-4">
            <AlertTriangle className="w-8 h-8 text-destructive" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">
            Algo não saiu como esperado
          </h2>
          <p className="text-sm text-muted-foreground max-w-md mb-6">
            Ocorreu uma falha na renderização deste módulo. Você pode tentar recarregar a tela ou voltar ao início.
          </p>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={this.handleReset}
              className="gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Tentar Novamente
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={this.handleReload}
              className="gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Recarregar Página
            </Button>
          </div>
          {this.state.error && (
            <pre className="mt-6 p-4 rounded-lg bg-muted text-xs text-left max-w-xl overflow-auto text-muted-foreground border">
              {this.state.error.message}
            </pre>
          )}
        </div>
      )
    }

    return this.props.children
  }
}
