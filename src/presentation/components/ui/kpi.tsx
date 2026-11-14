import { cn } from '@/lib/utils'

export type TonoKpi = 'neutro' | 'ok' | 'aviso' | 'critico' | 'info'

/** Solo los iconos de estado llevan color; sin baldosas detrás (DIRECTION §14). */
const ICONO: Record<TonoKpi, string> = {
  neutro: 'text-faint',
  ok: 'text-success-700',
  aviso: 'text-warning-700',
  critico: 'text-critical',
  info: 'text-faint',
}

const BARRA: Record<TonoKpi, string> = {
  neutro: 'bg-muted',
  ok: 'bg-success-600',
  aviso: 'bg-warning-600',
  critico: 'bg-critical-solid',
  info: 'bg-secondary',
}

/**
 * Indicador clave: etiqueta, valor grande con unidad y una línea de contexto.
 * El tono acompaña al texto (nunca lo sustituye). `medidor` (0–1) dibuja una
 * barra de proporción —llenado del buffer, vigencia, porcentaje—, patrón
 * «Server Card»/«Insight Cards» de 21st.dev.
 */
export function Kpi({
  etiqueta,
  valor,
  unidad,
  icono: Icono,
  tono = 'neutro',
  detalle,
  medidor,
  destacado = false,
  className,
  children,
}: {
  etiqueta: string
  valor: React.ReactNode
  unidad?: string
  icono?: React.ComponentType<{ className?: string }>
  tono?: TonoKpi
  detalle?: React.ReactNode
  medidor?: number | null
  destacado?: boolean
  className?: string
  children?: React.ReactNode
}) {
  const proporcion = medidor == null || Number.isNaN(medidor) ? null : Math.max(0, Math.min(1, medidor))
  return (
    <div
      className={cn(
        'superficie flex min-w-0 flex-col p-4',
        destacado && 'xl:p-5',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="truncate text-meta font-medium text-muted">{etiqueta}</p>
        {Icono && (
          <span aria-hidden className={cn('flex shrink-0', ICONO[tono])}>
            <Icono className="size-4" />
          </span>
        )}
      </div>
      <p className={cn('nums mt-2 flex items-baseline gap-0.5 text-foreground', destacado ? 'text-display' : 'text-metric')}>
        <span className="min-w-0 truncate">{valor}</span>
        {unidad && <span className={cn('font-medium text-muted', destacado ? 'text-title' : 'text-body')}>{unidad}</span>}
      </p>
      {proporcion !== null && (
        <div aria-hidden className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-sunken">
          {/* scaleX, no width: sin layout en cada fotograma (MOTION #13). */}
          <div
            className={cn('h-full origin-left rounded-full transition-transform duration-(--duration-reveal) ease-(--ease-out)', BARRA[tono])}
            style={{ transform: `scaleX(${proporcion})` }}
          />
        </div>
      )}
      {detalle && <div className="mt-auto pt-2 text-meta text-faint">{detalle}</div>}
      {children}
    </div>
  )
}

/**
 * Fila de indicadores: 2 por fila en móvil y columnas de ancho propio en
 * escritorio (nada se estira para llenar, DIRECTION §13.1). Para totales de
 * pantalla prefiere `TiraEstado`.
 */
export function TiraKpi({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('grid grid-cols-2 gap-3 lg:flex lg:flex-wrap lg:[&>*]:min-w-44 lg:[&>*]:flex-[0_1_15rem]', className)}
      {...props}
    >
      {children}
    </div>
  )
}
