import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'

import { cn } from '@/lib/utils'

/**
 * Barra de filtros dentro de la superficie de la tabla (Beautiful UI Filter
 * Table): los controles a la izquierda, el resultado y «Limpiar» a la
 * derecha. Los filtros se aplican al instante y sin animación (frecuencia
 * alta). Va como primera fila de la tarjeta de la tabla, con hairline debajo.
 */
export function BarraFiltros({
  etiqueta,
  resultado,
  alLimpiar,
  hayFiltros = false,
  className,
  children,
}: {
  /** Nombre del grupo de filtros (lector de pantalla). */
  etiqueta: string
  /** Texto de resultado, p. ej. «12 de 48 registros». */
  resultado?: React.ReactNode
  alLimpiar?: () => void
  hayFiltros?: boolean
  className?: string
  children: React.ReactNode
}) {
  const { t } = useTranslation()
  return (
    <div
      role="group"
      aria-label={etiqueta}
      className={cn('flex flex-wrap items-end gap-x-3 border-b border-border px-4 py-3 sm:gap-y-2', className)}
    >
      {/* Bajo 640 px los controles ocupan su fila y «Limpiar» baja a la siguiente:
          en la misma línea, el bloque `shrink-0` les dejaba ~200 px. */}
      <div className="flex min-w-0 flex-1 flex-wrap items-end gap-3 max-sm:basis-full">{children}</div>
      {(resultado || (alLimpiar && hayFiltros)) && (
        // En móvil el resultado puede ser solo para lectores de pantalla: la fila
        // separada solo toma aire cuando lleva «Limpiar» visible.
        <div className={cn('flex shrink-0 items-center gap-3 text-meta text-faint', alLimpiar && hayFiltros && 'max-sm:mt-2')}>
          {resultado && (
            <p aria-live="polite" className="nums">
              {resultado}
            </p>
          )}
          {alLimpiar && hayFiltros && (
            <button
              type="button"
              onClick={alLimpiar}
              className="inline-flex h-11 cursor-pointer items-center gap-1 rounded-(--radius-field) px-2 font-medium text-muted transition-colors duration-(--duration-micro) hover:bg-surface-hover hover:text-foreground sm:h-8 sm:pointer-coarse:h-11"
            >
              <X aria-hidden className="size-3.5" />
              {t('filtros.limpiar')}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
