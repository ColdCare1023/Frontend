import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'

import { Button } from './ui/button'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

/**
 * Sin este límite, cualquier excepción durante el render desmonta el árbol
 * entero y el operador se queda ante una pantalla en blanco, sin saber si el
 * refrigerador sigue monitorizado. Aquí al menos ve qué pasó y puede recuperar.
 *
 * React no ofrece equivalente en componentes de función: los límites de error
 * siguen requiriendo una clase.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Sin servicio de telemetría en este prototipo: queda en consola para que
    // el traza del componente sea recuperable durante la sustentación.
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render(): ReactNode {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <span className="flex size-11 items-center justify-center rounded-full bg-clay-100 text-clay-700">
          <AlertTriangle className="size-5" />
        </span>
        <h1 className="font-display text-[28px] leading-[34px] font-bold tracking-tight">Algo salió mal</h1>
        <p className="max-w-md text-sm leading-relaxed text-muted">
          La aplicación encontró un error inesperado. Los datos registrados no se han visto
          afectados: la información térmica y la cadena de trazabilidad viven en el servidor.
        </p>
        <pre className="max-w-lg overflow-auto rounded-(--radius-field) bg-cream-200 px-3 py-2 text-left text-xs text-clay-700">
          {error.message}
        </pre>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button onClick={() => window.location.reload()}>Recargar la página</Button>
          <Button variant="secondary" onClick={() => this.setState({ error: null })}>
            Reintentar
          </Button>
        </div>
      </div>
    )
  }
}
