import { useId, useRef, useState } from 'react'

import { cn } from '@/lib/utils'
import { useIndicador } from './indicador'

interface OpcionSegmento<T> {
  valor: T
  etiqueta: string
  /**
   * Cifra opcional (p. ej. pendientes). Se ve como pastilla a ≥640 px, oculta
   * al lector; se anuncia con `descripcionConteo` vía `aria-describedby`, así
   * el nombre accesible sigue siendo solo la etiqueta.
   */
  conteo?: number | null
  descripcionConteo?: string
}

const PASTILLA = 'nums ml-1.5 hidden min-w-4 justify-center rounded-full bg-surface-sunken px-1.5 text-meta text-muted sm:inline-flex'

const BOTON =
  'relative h-11 min-w-0 cursor-pointer whitespace-nowrap rounded-(--radius-small) px-3 text-[13px] font-medium sm:h-8 sm:pointer-coarse:h-10'

/**
 * Control segmentado con indicador compartido (MOTION 4.10, 21st «Animated
 * Tabs», movin Facts). Encima de los botones va una copia `aria-hidden` con
 * el estilo activo, recortada con `clip-path` a la opción elegida: el
 * recorte se desliza con una transición de 180 ms sin tocar el layout ni
 * usar el motor de layout de motion (antes `layoutId`, en el hilo principal
 * justo mientras la ventana 1h/24h/7d pedía datos).
 *
 * Conserva la semántica previa: un `group` con nombre y botones
 * `aria-pressed`, alcanzables con Tab. Activado con el teclado
 * (`event.detail === 0`), el cambio es instantáneo.
 */
export function Segmentado<T extends string | number>({
  opciones,
  valor,
  onCambiar,
  etiqueta,
  className,
  botonClassName,
}: {
  opciones: Array<OpcionSegmento<T>>
  valor: T
  onCambiar: (valor: T) => void
  etiqueta: string
  className?: string
  botonClassName?: string
}) {
  const pista = useRef<HTMLDivElement>(null)
  const idBase = useId()
  const [porTeclado, setPorTeclado] = useState(false)
  const { izquierda, ancho, total, listo } = useIndicador(
    pista,
    `${String(valor)}|${opciones.map((o) => `${o.etiqueta}${o.conteo ?? ''}`).join('|')}`,
  )
  const derecha = Math.max(0, total - izquierda - ancho)
  const animar = listo && !porTeclado

  return (
    <div
      ref={pista}
      role="group"
      aria-label={etiqueta}
      className={cn(
        'relative inline-flex items-center gap-0.5 rounded-(--radius-field) bg-surface-sunken p-0.5 ring-1 ring-inset ring-border',
        className,
      )}
    >
      {opciones.map((opcion, indice) => {
        const activo = opcion.valor === valor
        const idConteo = opcion.descripcionConteo ? `${idBase}-conteo-${indice}` : undefined
        return (
          <button
            key={String(opcion.valor)}
            type="button"
            aria-pressed={activo}
            aria-describedby={idConteo}
            data-activo={activo || undefined}
            onClick={(evento) => {
              setPorTeclado(evento.detail === 0)
              onCambiar(opcion.valor)
            }}
            className={cn(
              BOTON,
              'text-muted transition-colors duration-(--duration-micro) hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring',
              botonClassName,
            )}
          >
            {opcion.etiqueta}
            {opcion.conteo != null && <span aria-hidden className={PASTILLA}>{opcion.conteo}</span>}
          </button>
        )
      })}
      {/* Descripciones del conteo fuera de los botones: no entran en su nombre. */}
      {opciones.map((opcion, indice) =>
        opcion.descripcionConteo ? (
          <span key={`d-${String(opcion.valor)}`} id={`${idBase}-conteo-${indice}`} className="sr-only">
            {opcion.descripcionConteo}
          </span>
        ) : null,
      )}
      {/* Copia con el estilo activo: solo se ve la parte recortada. */}
      <div
        aria-hidden
        data-indicador-segmentado
        className={cn(
          'pointer-events-none absolute inset-0 flex items-center gap-0.5 p-0.5',
          ancho === 0 && 'opacity-0',
          animar && 'transition-[clip-path] duration-(--duration-ui) ease-(--ease-out)',
        )}
        style={{ clipPath: `inset(2px ${derecha}px 2px ${izquierda}px round 6px)` }}
      >
        <span className="absolute inset-0.5 rounded-(--radius-small) bg-surface-raised shadow-[0_1px_2px_rgb(11_30_58/0.12)] dark:shadow-none" />
        {opciones.map((opcion) => (
          <span key={String(opcion.valor)} className={cn(BOTON, 'inline-flex items-center text-foreground', botonClassName)}>
            {opcion.etiqueta}
            {opcion.conteo != null && <span className={PASTILLA}>{opcion.conteo}</span>}
          </span>
        ))}
      </div>
    </div>
  )
}
