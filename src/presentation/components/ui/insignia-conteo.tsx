import { useState } from 'react'

import { cn } from '@/lib/utils'
import { textoConteo } from './formato-cifra'

/**
 * Contador de pendientes (transitions.dev Notification badge, SmoothUI Count
 * Badge). Al subir, el número nuevo entra desde abajo; al bajar, desde
 * arriba; en el primer render no anima. `aria-hidden`: quien lo usa añade el
 * texto para el lector de pantalla (p. ej. «2 alertas sin atender»).
 *
 * Con `null` o 0 no se pinta (un cero se queda quieto, DESIGN.md), salvo que
 * `mostrarCero` lo pida para un layout estable.
 */
export function InsigniaConteo({
  valor,
  critico = false,
  truncado = false,
  tamano = 'md',
  mostrarCero = false,
  className,
}: {
  valor: number | null
  critico?: boolean
  truncado?: boolean
  tamano?: 'sm' | 'md'
  mostrarCero?: boolean
  className?: string
}) {
  // Estado derivado del valor anterior (patrón de React, seguro en StrictMode):
  // la primera cifra que llega no anima; las siguientes, según su dirección.
  const [previo, setPrevio] = useState(valor)
  const [cambio, setCambio] = useState<0 | 1 | -1>(0)
  if (valor !== previo) {
    setPrevio(valor)
    setCambio(previo === null || valor === null ? 0 : valor > previo ? 1 : -1)
  }
  if (valor === null || (valor === 0 && !mostrarCero)) return null

  return (
    <span
      aria-hidden
      data-insignia-conteo
      data-critico={critico || undefined}
      className={cn(
        'nums inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold leading-none',
        tamano === 'md' ? 'h-5 min-w-5 px-1.5 text-micro' : 'h-4 min-w-4 px-1 text-micro',
        critico ? 'bg-critical-solid text-on-critical' : 'bg-neutral-300 text-subtle',
        className,
      )}
    >
      <span
        // Se remonta solo cuando el conteo cambia: el número nuevo entra.
        key={cambio === 0 ? 'fijo' : `${valor}`}
        className={cn(cambio !== 0 && 'inline-block animate-(--animate-insignia)')}
        style={{ '--dir': cambio || 1 } as React.CSSProperties}
      >
        {textoConteo(valor, truncado)}
      </span>
    </span>
  )
}
