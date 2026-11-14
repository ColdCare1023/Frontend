import { lazy, Suspense } from 'react'

import type { EChartWrapperProps } from '@/infrastructure/charts/EChartWrapper'
import { cn } from '@/lib/utils'
import { Esqueleto } from './ui/esqueleto'

// PERFORMANCE B2: ECharts (~178 KB gzip) va en su propio trozo y se pide al
// montar la gráfica. El resto del monitoreo y del historial se pinta sin
// esperarlo; mientras llega, un esqueleto con el alto final evita saltos.
const EChartWrapper = lazy(() => import('@/infrastructure/charts/EChartWrapper').then((m) => ({ default: m.EChartWrapper })))

/** `EChartWrapper` cargado bajo demanda, con el mismo contrato. */
export function GraficaDiferida(props: EChartWrapperProps) {
  const alto = props.height ?? '300px'
  return (
    <Suspense
      fallback={
        <div role="img" aria-label={props.ariaLabel} aria-busy="true" style={{ height: alto }} className={cn('w-full', props.className)}>
          <Esqueleto className="size-full rounded-(--radius-field)" />
        </div>
      }
    >
      <EChartWrapper {...props} />
    </Suspense>
  )
}
