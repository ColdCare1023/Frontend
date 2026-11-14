import { useTranslation } from 'react-i18next'

import type { TiempoEnRango } from '@/lib/resumenReporte'
import { cn } from '@/lib/utils'
import { textoDuracion, textoPorcentaje } from './formatoReporte'

const TRAMOS = [
  { clave: 'enRango', muestra: 'bg-banda-fuerte shadow-[inset_0_0_0_1px_var(--color-banda-borde)]' },
  { clave: 'fuera', muestra: 'bg-critical-solid' },
  { clave: 'sinDatos', muestra: 'trama-sin-datos' },
] as const

/**
 * Firma «franja» de Reportes: el periodo partido en tiempo dentro de 2–8 °C,
 * fuera y sin datos. El ancho de cada tramo es su tiempo (flex-grow), la
 * leyenda lo dice en texto y «sin datos» lleva trama: nunca solo color.
 */
export function BarraTiempoEnRango({
  tiempo,
  parcial,
  clave,
  compacta = false,
  className,
}: {
  tiempo: TiempoEnRango
  parcial?: boolean
  /** Cambia en cada reporte nuevo: vuelve a revelar la barra. */
  clave?: number
  compacta?: boolean
  className?: string
}) {
  const { t, i18n } = useTranslation()
  const idioma = i18n.resolvedLanguage
  const pct = (k: (typeof TRAMOS)[number]['clave']) => textoPorcentaje(tiempo.porcentajes[k], idioma)

  const barra = (
    <div
      key={clave}
      {...(compacta
        ? { 'aria-hidden': true }
        : {
            role: 'img',
            'aria-label': t('reportes.barraTiempoAria', { enRango: pct('enRango'), fuera: pct('fuera'), sinDatos: pct('sinDatos') }),
          })}
      className={cn(
        'flex gap-px overflow-hidden rounded-full bg-surface-sunken',
        compacta ? 'h-1.5' : 'revelar-x mt-2 h-3',
      )}
    >
      {TRAMOS.map(({ clave: tramo, muestra }) =>
        tiempo[tramo] > 0 ? <span key={tramo} className={cn('h-full min-w-px', muestra)} style={{ flexGrow: tiempo[tramo] }} /> : null,
      )}
    </div>
  )

  if (compacta) return barra

  return (
    <div className={className}>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-body font-medium text-foreground">{t('reportes.tiempoEnRango')}</h3>
        <p className="nums text-title text-foreground">{pct('enRango')}</p>
      </div>
      {barra}
      <ul className="nums mt-2 flex flex-wrap gap-x-4 gap-y-1 text-meta text-muted">
        {TRAMOS.map(({ clave: tramo, muestra }) => (
          <li key={tramo} className="flex items-center gap-1.5">
            <span aria-hidden className={cn('size-2.5 shrink-0 rounded-sm', muestra)} />
            {t('reportes.tramoValor', {
              tramo: t(`reportes.tramos.${tramo}`),
              porcentaje: pct(tramo),
              duracion: textoDuracion(tiempo[tramo]),
            })}
          </li>
        ))}
      </ul>
      {parcial && (
        <p className="mt-1 text-meta text-faint">
          {t('reportes.calculoParcial', {
            desde: new Date(tiempo.desde).toLocaleString(),
            hasta: new Date(tiempo.hasta).toLocaleString(),
          })}
        </p>
      )}
    </div>
  )
}
