import { useRef, useState } from 'react'
import { Check } from 'lucide-react'

import { cn } from '@/lib/utils'

export type EstadoPaso = 'hecho' | 'actual' | 'pendiente'

/**
 * Stepper estático (SmoothUI Animated Stepper, sin animación): una lista
 * ordenada con el paso actual marcado con `aria-current="step"`. Lo usa el
 * paso de éxito del alta de usuarios.
 */
export function StepperEstatico({
  pasos,
  className,
}: {
  pasos: readonly { id: string; titulo: string; detalle?: string; estado: EstadoPaso }[]
  className?: string
}) {
  return (
    <ol className={cn('grid gap-3 sm:grid-cols-3', className)}>
      {pasos.map((paso, i) => (
        <li
          key={paso.id}
          aria-current={paso.estado === 'actual' ? 'step' : undefined}
          data-estado={paso.estado}
          className="flex items-start gap-2.5 sm:flex-col sm:gap-1.5"
        >
          <span
            aria-hidden
            className={cn(
              'nums flex size-7 shrink-0 items-center justify-center rounded-full border text-meta font-semibold',
              paso.estado === 'hecho' && 'border-success-600 bg-success-100 text-success-700',
              paso.estado === 'actual' && 'border-primary bg-primary-tint text-primary-text',
              paso.estado === 'pendiente' && 'border-border-strong bg-surface text-muted',
            )}
          >
            {paso.estado === 'hecho' ? <Check className="size-3.5" /> : i + 1}
          </span>
          <span className="min-w-0">
            <span className="block text-body font-medium text-foreground">{paso.titulo}</span>
            {paso.detalle && <span className="block text-meta text-muted">{paso.detalle}</span>}
          </span>
        </li>
      ))}
    </ol>
  )
}

export type OrigenCambioPaso = 'puntero' | 'teclado'

/**
 * Stepper interactivo (APG Tabs, activación automática): un `tablist` con
 * tabindex itinerante; ←/→ y ↑/↓ mueven, Inicio/Fin van a los extremos. El
 * conector de progreso se llena con `scaleY`/`scaleX` (nunca alto/ancho) y
 * no anima cuando el cambio llega del teclado (MOTION §5).
 */
export function StepperInteractivo({
  pasos,
  valor,
  onCambiar,
  orientacion,
  etiqueta,
  idBase,
  className,
}: {
  pasos: readonly { id: string; titulo: string; resumen?: string }[]
  valor: string
  onCambiar: (id: string, origen: OrigenCambioPaso) => void
  orientacion: 'vertical' | 'horizontal'
  etiqueta: string
  idBase: string
  className?: string
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const [porTeclado, setPorTeclado] = useState(false)
  const actual = Math.max(0, pasos.findIndex((p) => p.id === valor))
  const progreso = pasos.length > 1 ? actual / (pasos.length - 1) : 0
  const vertical = orientacion === 'vertical'

  const mover = (indice: number) => {
    const destino = (indice + pasos.length) % pasos.length
    setPorTeclado(true)
    onCambiar(pasos[destino].id, 'teclado')
    refs.current[destino]?.focus()
  }

  return (
    <div
      role="tablist"
      aria-label={etiqueta}
      aria-orientation={orientacion}
      className={cn('relative', vertical ? 'flex flex-col gap-1' : 'flex justify-between', className)}
      onKeyDown={(e) => {
        const siguiente = e.key === 'ArrowDown' || e.key === 'ArrowRight'
        const anterior = e.key === 'ArrowUp' || e.key === 'ArrowLeft'
        if (siguiente) mover(actual + 1)
        else if (anterior) mover(actual - 1)
        else if (e.key === 'Home') mover(0)
        else if (e.key === 'End') mover(pasos.length - 1)
        else return
        e.preventDefault()
      }}
    >
      {/* Pista y relleno del conector. */}
      <span
        aria-hidden
        className={cn('pointer-events-none absolute bg-border', vertical ? 'top-6 bottom-6 left-[27px] w-px' : 'inset-x-6 top-[22px] h-px')}
      />
      <span
        aria-hidden
        data-progreso={progreso}
        className={cn(
          'pointer-events-none absolute bg-primary',
          vertical ? 'top-6 bottom-6 left-[27px] w-px origin-top' : 'inset-x-6 top-[22px] h-px origin-left',
          !porTeclado && 'transition-transform duration-(--duration-reveal) ease-(--ease-out)',
        )}
        style={{ transform: vertical ? `scaleY(${progreso})` : `scaleX(${progreso})` }}
      />
      {pasos.map((paso, i) => {
        const seleccionado = i === actual
        return (
          <button
            key={paso.id}
            ref={(el) => {
              refs.current[i] = el
            }}
            type="button"
            role="tab"
            id={`${idBase}-tab-${paso.id}`}
            aria-selected={seleccionado}
            aria-controls={`${idBase}-panel-${paso.id}`}
            tabIndex={seleccionado ? 0 : -1}
            onClick={(e) => {
              const teclado = e.detail === 0
              setPorTeclado(teclado)
              onCambiar(paso.id, teclado ? 'teclado' : 'puntero')
            }}
            className={cn(
              'group relative z-10 flex cursor-pointer rounded-(--radius-field) text-left outline-none transition-colors duration-(--duration-micro) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
              vertical
                ? "min-h-14 w-full items-start gap-3 px-3 py-2.5 hover:bg-surface-hover aria-selected:bg-primary-tint before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full before:bg-primary before:opacity-0 before:content-[''] aria-selected:before:opacity-100"
                : 'min-h-11 min-w-11 flex-col items-center gap-1 px-1 py-1.5',
            )}
          >
            <span className="nums flex size-7 shrink-0 items-center justify-center rounded-full border border-border-strong bg-surface text-meta font-semibold text-muted group-aria-selected:border-primary group-aria-selected:text-primary-text">
              {i + 1}
            </span>
            {vertical ? (
              <span className="min-w-0 pt-0.5">
                <span className="block text-body font-medium text-foreground">{paso.titulo}</span>
                {paso.resumen && <span className="block truncate text-meta text-muted">{paso.resumen}</span>}
              </span>
            ) : (
              <span className="max-w-24 text-center text-micro text-muted group-aria-selected:text-foreground max-sm:sr-only">
                {paso.titulo}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
