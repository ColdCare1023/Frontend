import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'

import { cn } from '@/lib/utils'
import { useIndicador } from './indicador'
import { idPanelPestana, idPestana } from './pestanas-ids'

export interface Pestana<T extends string> {
  valor: T
  etiqueta: string
  /** Cifra opcional junto a la etiqueta (p. ej. pendientes). */
  contador?: number | null
}

/**
 * Pestañas WAI-ARIA (tablist/tab/tabpanel) con subrayado que se desliza
 * (movin Facts, Dribbble D1). El subrayado es un `transform` (translateX +
 * scaleX), nunca `left`/`width`. Flechas, Inicio y Fin mueven el foco y
 * activan; activado con el teclado, el cambio es instantáneo.
 *
 * Uso: `<Pestanas …/>` y, debajo, `<PanelPestana id={idPanel(valor)} …>`.
 */
export function Pestanas<T extends string>({
  pestanas,
  valor,
  onCambiar,
  etiqueta,
  idBase,
  className,
}: {
  pestanas: ReadonlyArray<Pestana<T>>
  valor: T
  onCambiar: (valor: T) => void
  etiqueta: string
  /** Prefijo de ids; por defecto uno generado. Usa `idPanelPestana(idBase, valor)` en el panel. */
  idBase?: string
  className?: string
}) {
  const generado = useId()
  const base = idBase ?? generado
  const lista = useRef<HTMLDivElement>(null)
  const [porTeclado, setPorTeclado] = useState(false)
  const { izquierda, ancho, listo } = useIndicador(lista, `${valor}|${pestanas.map((p) => p.etiqueta).join('|')}`)

  const mover = (evento: KeyboardEvent<HTMLButtonElement>, indice: number) => {
    const destino =
      evento.key === 'ArrowRight' ? (indice + 1) % pestanas.length
      : evento.key === 'ArrowLeft' ? (indice - 1 + pestanas.length) % pestanas.length
      : evento.key === 'Home' ? 0
      : evento.key === 'End' ? pestanas.length - 1
      : null
    if (destino === null) return
    evento.preventDefault()
    setPorTeclado(true)
    onCambiar(pestanas[destino].valor)
    lista.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[destino]?.focus()
  }

  return (
    <div
      ref={lista}
      role="tablist"
      aria-label={etiqueta}
      className={cn('relative flex min-w-0 items-end gap-1 overflow-x-auto border-b border-border', className)}
    >
      {pestanas.map((pestana, indice) => {
        const activa = pestana.valor === valor
        return (
          <button
            key={pestana.valor}
            type="button"
            role="tab"
            id={idPestana(base, pestana.valor)}
            aria-selected={activa}
            aria-controls={idPanelPestana(base, pestana.valor)}
            tabIndex={activa ? 0 : -1}
            data-activo={activa || undefined}
            onClick={(evento) => {
              setPorTeclado(evento.detail === 0)
              onCambiar(pestana.valor)
            }}
            onKeyDown={(evento) => mover(evento, indice)}
            className={cn(
              'relative inline-flex h-11 shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap px-3 text-body font-medium transition-colors duration-(--duration-micro) focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring sm:h-10 sm:pointer-coarse:h-11',
              activa ? 'text-foreground' : 'text-muted hover:text-foreground',
            )}
          >
            {pestana.etiqueta}
            {pestana.contador != null && (
              <span className="nums rounded-full bg-neutral-200 px-1.5 text-micro text-subtle">{pestana.contador}</span>
            )}
          </button>
        )
      })}
      <span
        aria-hidden
        data-indicador-pestana
        className={cn(
          'pointer-events-none absolute bottom-0 left-0 h-0.5 w-px origin-left rounded-full bg-primary',
          ancho === 0 && 'opacity-0',
          listo && !porTeclado && 'transition-transform duration-(--duration-ui) ease-(--ease-out)',
        )}
        style={{ transform: `translateX(${izquierda}px) scaleX(${ancho})` }}
      />
    </div>
  )
}

/**
 * Panel de una pestaña. Entra con opacidad y 8 px en la dirección del cambio
 * (eje compartido X, 180 ms); sin animación de salida para no sumar latencia.
 */
export function PanelPestana({
  idBase,
  valor,
  direccion = 1,
  className,
  children,
}: {
  idBase: string
  valor: string
  /** 1 si la pestaña nueva está a la derecha de la anterior; -1 si a la izquierda. */
  direccion?: 1 | -1
  className?: string
  children: ReactNode
}) {
  return (
    <div
      key={valor}
      role="tabpanel"
      id={idPanelPestana(idBase, valor)}
      aria-labelledby={idPestana(idBase, valor)}
      tabIndex={0}
      className={cn('animate-(--animate-pestana) rounded-(--radius-card) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-ring', className)}
      style={{ '--dir': direccion } as React.CSSProperties}
    >
      {children}
    </div>
  )
}
