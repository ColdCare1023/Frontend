import type { CSSProperties } from 'react'

import { cn } from '@/lib/utils'

/**
 * Fondo negro que cambia de ancho animando solo `transform` (nunca `width`): dos
 * mitades que se recortan en la costura. `izquierda` y `derecha` son las distancias en
 * píxeles desde la costura hasta cada extremo; quien la usa decide dónde va la costura.
 */
export function FormaCapsula({
  izquierda,
  derecha,
  radio,
  className,
}: {
  izquierda: number
  derecha: number
  radio: number
  className?: string
}) {
  return (
    <span
      aria-hidden
      className={cn('forma', className)}
      style={{ '--izq': izquierda, '--der': derecha, '--r': radio } as CSSProperties}
    >
      <span className="forma__mitad forma__mitad--izq">
        <span className="forma__pieza" />
      </span>
      <span className="forma__mitad forma__mitad--der">
        <span className="forma__pieza" />
      </span>
    </span>
  )
}
