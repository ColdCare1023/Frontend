import { Component, type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'

import i18n from '@/infrastructure/i18n'
import { Button } from './ui/button'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

/**
 * Sin este límite, cualquier excepción durante el render desmonta el árbol
 * entero. La interfaz muestra cómo intentar recuperarse, sin afirmar que los
 * datos del servidor estén a salvo ni revelar detalles internos del error.
 *
 * React no ofrece equivalente en componentes de función: los límites de error
 * siguen requiriendo una clase.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(): void {
    // FE-011: el registro lo hace el `onCaughtError` de la raíz (main.tsx →
    // registrarErrorDeInterfaz): detalle completo en desarrollo, solo el tipo
    // de error en producción. Registrar aquí lo duplicaría con el stack.
  }

  render(): ReactNode {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <span className="flex size-11 items-center justify-center rounded-full bg-clay-100 text-clay-700">
          <AlertTriangle className="size-5" />
        </span>
        <h1 className="font-display text-[28px] leading-[34px] font-bold tracking-tight">
          {i18n.t('comunes.errorPantallaTitulo')}
        </h1>
        <p className="max-w-md text-sm leading-relaxed text-muted">
          {i18n.t('comunes.errorPantallaDetalle')}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button onClick={() => window.location.reload()}>{i18n.t('comunes.recargarPagina')}</Button>
          <Button variant="secondary" onClick={() => this.setState({ error: null })}>
            {i18n.t('comunes.intentarDeNuevo')}
          </Button>
        </div>
      </div>
    )
  }
}
