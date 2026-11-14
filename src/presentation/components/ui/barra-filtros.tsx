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
      className={cn('flex flex-wrap items-end gap-x-3 gap-y-2 border-b border-border px-4 py-3', className)}
    >
      <div className="flex min-w-0 flex-1 flex-wrap items-end gap-3">{children}</div>
      {(resultado || (alLimpiar && hayFiltros)) && (
        <div className="flex shrink-0 items-center gap-3 text-meta text-faint">
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
