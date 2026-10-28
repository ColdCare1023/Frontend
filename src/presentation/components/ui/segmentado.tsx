import { useId, useRef } from 'react'
import { motion, useReducedMotion } from 'motion/react'

import { cn } from '@/lib/utils'
import { useCristalLiquido } from '@/presentation/efectos/cristalLiquido'

interface OpcionSegmento<T> {
  valor: T
  etiqueta: string
}

/**
 * Control segmentado con indicador que se desliza a la opción activa (patrón
 * «Animated Tabs», 21st.dev). Conserva la semántica previa de las pantallas:
 * un `group` con nombre y botones `aria-pressed`, alcanzables con Tab.
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
  const id = useId()
  const reducir = useReducedMotion()
  const refGrupo = useRef<HTMLDivElement>(null)
  useCristalLiquido(refGrupo, { intensidad: 0.6, bisel: 8 })

  return (
    <div
      ref={refGrupo}
      role="group"
      aria-label={etiqueta}
      data-liquid-glass=""
      className={cn('lg-glass relative inline-flex items-center gap-0.5 rounded-xl p-0.5', className)}
    >
      {opciones.map((opcion) => {
        const activo = opcion.valor === valor
        return (
          <button
            key={String(opcion.valor)}
            type="button"
            aria-pressed={activo}
            onClick={() => onCambiar(opcion.valor)}
            className={cn(
              'relative h-11 min-w-0 cursor-pointer whitespace-nowrap rounded-lg px-3 text-[13px] font-medium transition-colors duration-(--duration-micro) focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring sm:h-8 sm:pointer-coarse:h-10',
              activo ? 'text-foreground' : 'text-muted hover:text-foreground',
              botonClassName,
            )}
          >
            {activo && (
              <motion.span
                layoutId={`segmento-${id}`}
                aria-hidden
                transition={reducir ? { duration: 0 } : { type: 'spring', stiffness: 520, damping: 40, mass: 0.7 }}
                className="absolute inset-0 rounded-lg bg-surface-raised shadow-(--shadow-card) ring-1 ring-inset ring-border"
              />
            )}
            <span className="relative">{opcion.etiqueta}</span>
          </button>
        )
      })}
    </div>
  )
}
