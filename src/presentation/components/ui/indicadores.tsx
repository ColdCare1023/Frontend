import type { ComponentType, HTMLAttributes, ReactNode } from 'react'

import { cn } from '@/lib/utils'

export type TonoIndicador = 'neutro' | 'ok' | 'aviso' | 'critico' | 'info'

const TONO: Record<TonoIndicador, string> = {
  neutro: 'text-foreground',
  ok: 'text-success-700',
  aviso: 'text-honey-700',
  critico: 'text-critical',
  info: 'text-primary',
}

/** Línea de indicadores sin tarjetas: una sola lista con separadores finos. */
export function Indicadores({ className, children, ...props }: HTMLAttributes<HTMLDListElement>) {
  return (
    <dl className={cn('indicadores', className)} {...props}>
      {children}
    </dl>
  )
}

/** Un indicador: cifra grande y tabular con su unidad, etiqueta y una línea de contexto opcional. */
export function Indicador({
  etiqueta,
  valor,
  unidad,
  icono: Icono,
  tono = 'neutro',
  detalle,
  grande = false,
  className,
}: {
  etiqueta: ReactNode
  valor: ReactNode
  unidad?: string
  icono?: ComponentType<{ className?: string }>
  /** Acompaña a la cifra, nunca la sustituye. */
  tono?: TonoIndicador
  detalle?: ReactNode
  grande?: boolean
  className?: string
}) {
  return (
    <div className={cn('indicador flex min-w-0 flex-col', className)}>
      <dt className="flex items-center gap-1.5 text-[13px] leading-5 font-medium text-muted">
        {Icono && <Icono aria-hidden className="size-3.5 shrink-0" />}
        {etiqueta}
      </dt>
      <dd className="contents">
        <span
          className={cn(
            'nums mt-0.5 flex items-baseline gap-1 font-semibold',
            grande ? 'text-5xl leading-none tracking-[-0.04em] sm:text-6xl' : 'text-[34px] leading-10 tracking-[-0.03em]',
            TONO[tono],
          )}
        >
          {valor}
          {unidad && <span className={cn('font-medium tracking-normal text-muted', grande ? 'text-xl' : 'text-base')}>{unidad}</span>}
        </span>
        {detalle && <span className="mt-0.5 text-[13px] leading-5 text-muted">{detalle}</span>}
      </dd>
    </div>
  )
}
