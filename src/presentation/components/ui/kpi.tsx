import { cn } from '@/lib/utils'

export type TonoKpi = 'neutro' | 'ok' | 'aviso' | 'critico' | 'info'

const CHIP: Record<TonoKpi, string> = {
  neutro: 'bg-cream-200 text-ink-700 ring-border',
  ok: 'bg-success-100 text-success-700 ring-success-600/25',
  aviso: 'bg-honey-100 text-honey-700 ring-honey-600/30',
  critico: 'bg-critical-tint text-critical ring-critical/25',
  info: 'bg-secondary-tint text-glacier-700 ring-glacier-200',
}

const BARRA: Record<TonoKpi, string> = {
  neutro: 'bg-ink-500',
  ok: 'bg-success-600',
  aviso: 'bg-honey-600',
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
        'spotlight flex min-w-0 flex-col rounded-(--radius-card) border border-border bg-surface p-4 shadow-(--shadow-card)',
        destacado && 'sm:p-5',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="truncate text-[13px] leading-5 font-medium text-muted">{etiqueta}</p>
        {Icono && (
          <span aria-hidden className={cn('flex size-8 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset', CHIP[tono])}>
            <Icono className="size-4" />
          </span>
        )}
      </div>
      <p className={cn('nums mt-2 flex items-baseline gap-1 font-semibold tracking-tight text-foreground', destacado ? 'text-4xl sm:text-5xl' : 'text-[26px] leading-8')}>
        <span className="min-w-0 truncate">{valor}</span>
        {unidad && <span className={cn('font-medium text-muted', destacado ? 'text-xl' : 'text-sm')}>{unidad}</span>}
      </p>
      {proporcion !== null && (
        <div aria-hidden className="mt-3 h-1.5 overflow-hidden rounded-full bg-cream-200">
          <div className={cn('h-full rounded-full transition-[width] duration-500 ease-(--ease-out-soft)', BARRA[tono])} style={{ width: `${proporcion * 100}%` }} />
        </div>
      )}
      {detalle && <div className="mt-auto pt-2 text-xs leading-5 text-faint">{detalle}</div>}
      {children}
    </div>
  )
}

/** Fila de indicadores que se reparte sin huecos: 2 por fila en móvil, auto en escritorio. */
export function TiraKpi({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('grid grid-cols-2 gap-3 lg:grid-cols-[repeat(auto-fit,minmax(180px,1fr))]', className)}
      {...props}
    >
      {children}
    </div>
  )
}
