import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import type { LecturaTermica } from '@/domain/entities/LecturaTermica'
import { RANGO_TERMICO } from '@/domain/value-objects/NivelRiesgo'
import { curvaPorEquipo, resumenTemperatura, type SerieEquipo } from '@/lib/resumenReporte'
import { temperatura } from './formatoReporte'

const ANCHO = 240
const ALTO = 96

/**
 * Trazo por equipo (el mismo orden y estilo que la curva de Historial):
 * navy, pizarra, teal y gris, con patrón de línea distinto para
 * que no dependa solo del color (WCAG 1.4.1); todos ≥ 3:1 sobre la franja en
 * los dos temas (`grafica-2` claro quedaba en 2.7:1). El rosa de marca no se
 * usa en datos (DIRECTION §3).
 */
const ESTILOS = [
  { trazo: 'stroke-grafica-1', guiones: undefined },
  { trazo: 'stroke-nodata-700', guiones: '4 2' },
  { trazo: 'stroke-banda-borde', guiones: undefined },
  { trazo: 'stroke-faint', guiones: '1 2' },
] as const

const estilo = (indice: number) => ESTILOS[indice % ESTILOS.length]

/** Trazo del promedio por tramo; un tramo sin lecturas corta la línea (sin datos). */
function trazo(serie: SerieEquipo, x: (i: number) => number, y: (v: number) => number): string {
  let d = ''
  let abierto = false
  serie.tramos.forEach((tramo, i) => {
    if (!tramo) {
      abierto = false
      return
    }
    d += `${abierto ? 'L' : 'M'}${x(i).toFixed(2)} ${y(tramo.promedio).toFixed(2)}`
    abierto = true
  })
  return d
}

/**
 * Mini curva del periodo en SVG (sin ECharts, PERFORMANCE B3): una línea por
 * equipo con el promedio de cada tramo, sobre la franja 2–8 °C. Donde un tramo
 * sale del rango se marca su mínimo–máximo en carmesí, así el pico de una
 * excursión no se pierde en el promedio. Un tramo sin lecturas no se dibuja:
 * el hueco es «sin datos».
 */
export function CurvaMiniReporte({ lecturas, clave }: { lecturas: readonly LecturaTermica[]; clave?: number }) {
  const { t } = useTranslation()
  const { series, tramos } = useMemo(() => curvaPorEquipo(lecturas, ANCHO), [lecturas])
  const resumen = useMemo(() => resumenTemperatura(lecturas), [lecturas])
  if (!resumen || series.length === 0) return null

  const bajo = Math.min(0, Math.floor(resumen.minimo) - 1)
  const alto = Math.max(10, Math.ceil(resumen.maximo) + 1)
  const y = (v: number) => ALTO - ((v - bajo) / (alto - bajo)) * ALTO
  const paso = ANCHO / tramos
  const x = (i: number) => i * paso + paso / 2
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
          {series.map((serie, indice) => (
            <path
              key={serie.equipo}
              d={trazo(serie, x, y)}
              fill="none"
              strokeWidth={1.5}
              strokeLinejoin="round"
              strokeLinecap="round"
              strokeDasharray={estilo(indice).guiones}
              vectorEffect="non-scaling-stroke"
              className={estilo(indice).trazo}
            />
          ))}
          {series.flatMap((serie) =>
            serie.tramos.map((tramo, i) => {
              if (!tramo || (tramo.min >= RANGO_TERMICO.minimo && tramo.max <= RANGO_TERMICO.maximo)) return null
              const y1 = y(tramo.max)
              return (
                <line
                  key={`${serie.equipo}-${i}`}
                  x1={x(i)}
                  x2={x(i)}
                  y1={y1}
                  y2={Math.max(y(tramo.min), y1 + 1)}
                  strokeWidth={2}
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                  className="stroke-critical"
                />
              )
            }),
          )}
        </svg>
      </div>
      {series.length > 1 && (
        <ul aria-label={t('reportes.curvaLeyenda')} className="mt-2 flex flex-wrap gap-x-4 gap-y-1 pl-4 text-meta text-muted">
          {series.map((serie, indice) => (
            <li key={serie.equipo} className="inline-flex items-center gap-1.5">
              <svg aria-hidden viewBox="0 0 16 4" className="h-1 w-4 overflow-visible">
                <line x1={0} x2={16} y1={2} y2={2} strokeWidth={1.5} strokeDasharray={estilo(indice).guiones} className={estilo(indice).trazo} />
              </svg>
              <span className="codigo">{serie.equipo}</span>
            </li>
          ))}
        </ul>
      )}
    </figure>
  )
}
