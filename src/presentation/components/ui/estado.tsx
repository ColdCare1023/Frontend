import { cn } from '@/lib/utils'
import { FONDO_ESTADO, ICONO_ESTADO, TEXTO_ESTADO, type TonoEstado } from './estado-tonos'

/**
 * Componentes del vocabulario de estado (constantes en `estado-tonos.ts`).
 *
 * Punto de estado de 8 px. `vivo` añade el pulso del punto «En vivo» (solo
 * conexión, nunca para un crítico: lo crítico es sólido y no parpadea).
 */
export function PuntoEstado({ tono, vivo = false, className }: { tono: TonoEstado; vivo?: boolean; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn('inline-block size-2 shrink-0 rounded-full', FONDO_ESTADO[tono], vivo && tono !== 'critico' && 'pulso-vivo', className)}
    />
  )
}

/**
 * Icono con forma de estado + etiqueta. `soloIcono` oculta el texto a la
 * vista pero lo deja para el lector de pantalla.
 */
export function IndicadorEstado({
  tono,
  etiqueta,
  soloIcono = false,
  className,
}: {
  tono: TonoEstado
  etiqueta: string
  soloIcono?: boolean
  className?: string
}) {
  const Icono = ICONO_ESTADO[tono]
  return (
    <span className={cn('inline-flex min-w-0 items-center gap-1.5 text-meta font-medium', TEXTO_ESTADO[tono], className)}>
      <Icono aria-hidden className="size-3.5 shrink-0" />
      <span className={cn('truncate', soloIcono && 'sr-only')}>{etiqueta}</span>
    </span>
  )
}
