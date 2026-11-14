import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import type { LecturaTermica } from '@/domain/entities/LecturaTermica'
import { RANGO_TERMICO } from '@/domain/value-objects/NivelRiesgo'
import { resumenTemperatura, submuestrear } from '@/lib/resumenReporte'
import { temperatura } from './formatoReporte'

const ANCHO = 240
const ALTO = 96

/**
 * Mini curva del periodo en SVG (sin ECharts, PERFORMANCE B3): una línea
 * vertical de mínimo a máximo por tramo de tiempo sobre la franja 2–8 °C.
 * Un tramo sin lecturas no se dibuja: el hueco es «sin datos».
 */
export function CurvaMiniReporte({ lecturas, clave }: { lecturas: readonly LecturaTermica[]; clave?: number }) {
  const { t } = useTranslation()
  const { buckets } = useMemo(() => submuestrear(lecturas, ANCHO), [lecturas])
  const resumen = useMemo(() => resumenTemperatura(lecturas), [lecturas])
  if (!resumen || buckets.length === 0) return null

  const bajo = Math.min(0, Math.floor(resumen.minimo) - 1)
  const alto = Math.max(10, Math.ceil(resumen.maximo) + 1)
  const y = (v: number) => ALTO - ((v - bajo) / (alto - bajo)) * ALTO
  const paso = ANCHO / buckets.length
  const valores = { minimo: temperatura(resumen.minimo), promedio: temperatura(resumen.promedio), maximo: temperatura(resumen.maximo) }

  return (
    <figure className="min-w-0">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-3 text-meta text-muted">
        <span>{t('reportes.curvaTitulo')}</span>
        <span className="nums">{t('reportes.curvaResumen', valores)}</span>
      </figcaption>
      <div key={clave} className="revelar-x relative mt-2 pl-4">
        <span aria-hidden className="nums absolute left-0 text-micro text-faint" style={{ top: `calc(${(y(RANGO_TERMICO.maximo) / ALTO) * 100}% - 0.5em)` }}>
          {RANGO_TERMICO.maximo}
        </span>
        <span aria-hidden className="nums absolute left-0 text-micro text-faint" style={{ top: `calc(${(y(RANGO_TERMICO.minimo) / ALTO) * 100}% - 0.5em)` }}>
          {RANGO_TERMICO.minimo}
        </span>
        <svg
          role="img"
          aria-label={t('reportes.curvaAria', valores)}
          viewBox={`0 0 ${ANCHO} ${ALTO}`}
          preserveAspectRatio="none"
          className="h-24 w-full max-sm:h-[72px]"
        >
          <rect
            x={0}
            y={y(RANGO_TERMICO.maximo)}
            width={ANCHO}
            height={y(RANGO_TERMICO.minimo) - y(RANGO_TERMICO.maximo)}
            className="fill-banda"
          />
          {[RANGO_TERMICO.minimo, RANGO_TERMICO.maximo].map((v) => (
            <line
              key={v}
              x1={0}
              x2={ANCHO}
              y1={y(v)}
              y2={y(v)}
              strokeDasharray="3 3"
              vectorEffect="non-scaling-stroke"
              className="stroke-banda-borde"
            />
          ))}
          {buckets.map((b, i) => {
            if (!b) return null
            const fuera = b.min < RANGO_TERMICO.minimo || b.max > RANGO_TERMICO.maximo
            const x = i * paso + paso / 2
            const y1 = y(b.max)
            const y2 = Math.max(y(b.min), y1 + 1)
            return (
              <line
                key={i}
                x1={x}
                x2={x}
                y1={y1}
                y2={y2}
                strokeWidth={1.5}
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
                className={fuera ? 'stroke-critical' : 'stroke-grafica-1'}
              />
            )
          })}
        </svg>
      </div>
    </figure>
  )
}
