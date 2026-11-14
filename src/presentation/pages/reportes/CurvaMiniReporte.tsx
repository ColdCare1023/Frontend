import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import type { LecturaTermica } from '@/domain/entities/LecturaTermica'
import { RANGO_TERMICO } from '@/domain/value-objects/NivelRiesgo'
import { curvasPorEquipo, resumenTemperatura, type PuntoCurva } from '@/lib/resumenReporte'
import { temperatura } from './formatoReporte'

const ANCHO = 240
const ALTO = 96
const TRAMOS = 120

/**
 * Trazo por equipo, el mismo vocabulario que la curva de Historial: tinta
 * navy, gris discontinuo, acero punteado. El tipo de línea los distingue sin
 * depender del color; ninguno usa el teal de la franja ni el carmesí.
 */
const TRAZOS = [
  { clase: 'stroke-grafica-1', guiones: undefined },
  { clase: 'stroke-grafica-2', guiones: '4 3' },
  { clase: 'stroke-nodata-700', guiones: '1 3' },
  { clase: 'stroke-faint', guiones: '6 2 1 2' },
] as const

const fuera = (p: PuntoCurva) => p.min < RANGO_TERMICO.minimo || p.max > RANGO_TERMICO.maximo

/**
 * Mini curva del periodo en SVG (sin ECharts, PERFORMANCE B3): una línea por
 * equipo con la media de cada tramo de tiempo sobre la franja 2–8 °C. Donde
 * un tramo salió del rango, un trazo carmesí de su mínimo a su máximo marca
 * la excursión que la media escondería. Un tramo sin lecturas corta la línea:
 * el hueco es «sin datos».
 */
export function CurvaMiniReporte({ lecturas, clave }: { lecturas: readonly LecturaTermica[]; clave?: number }) {
  const { t } = useTranslation()
  const { curvas } = useMemo(() => curvasPorEquipo(lecturas, TRAMOS), [lecturas])
  const resumen = useMemo(() => resumenTemperatura(lecturas), [lecturas])
  if (!resumen || curvas.length === 0) return null

  const bajo = Math.min(0, Math.floor(resumen.minimo) - 1)
  const alto = Math.max(10, Math.ceil(resumen.maximo) + 1)
  const y = (v: number) => ALTO - ((v - bajo) / (alto - bajo)) * ALTO
  const tramos = curvas[0].puntos.length
  const paso = ANCHO / tramos
  const x = (i: number) => i * paso + paso / 2
  const valores = { minimo: temperatura(resumen.minimo), promedio: temperatura(resumen.promedio), maximo: temperatura(resumen.maximo) }

  /** Trayecto con cortes en los huecos; un tramo aislado se dibuja como un guion corto. */
  const trayecto = (puntos: readonly (PuntoCurva | null)[]) => {
    let d = ''
    puntos.forEach((p, i) => {
      if (!p) return
      const anterior = puntos[i - 1]
      const siguiente = puntos[i + 1]
      if (!anterior && !siguiente) d += `M${(x(i) - paso / 2).toFixed(2)} ${y(p.media).toFixed(2)}h${paso.toFixed(2)}`
      else d += `${anterior ? 'L' : 'M'}${x(i).toFixed(2)} ${y(p.media).toFixed(2)}`
    })
    return d
  }

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
          {curvas.map((curva, indice) => {
            const trazo = TRAZOS[indice % TRAZOS.length]
            return (
              <path
                key={curva.device_id}
                d={trayecto(curva.puntos)}
                fill="none"
                strokeWidth={1.5}
                strokeLinejoin="round"
                strokeLinecap="round"
                strokeDasharray={trazo.guiones}
                vectorEffect="non-scaling-stroke"
                className={trazo.clase}
              />
            )
          })}
          {curvas.flatMap((curva) =>
            curva.puntos.map((p, i) =>
              p && fuera(p) ? (
                <line
                  key={`${curva.device_id}-${i}`}
                  x1={x(i)}
                  x2={x(i)}
                  y1={y(p.max)}
                  y2={Math.max(y(p.min), y(p.max) + 1)}
                  strokeWidth={1.5}
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                  className="stroke-critical"
                />
              ) : null,
            ),
          )}
        </svg>
      </div>
      {curvas.length > 1 && (
        <ul aria-label={t('reportes.curvaLeyenda')} className="mt-2 flex flex-wrap gap-x-4 gap-y-1 pl-4 text-meta text-muted">
          {curvas.map((curva, indice) => {
            const trazo = TRAZOS[indice % TRAZOS.length]
            return (
              <li key={curva.device_id} className="inline-flex items-center gap-1.5">
                <svg aria-hidden viewBox="0 0 16 4" className="h-1 w-4 overflow-visible">
                  <line x1={0} x2={16} y1={2} y2={2} strokeWidth={1.5} strokeDasharray={trazo.guiones} className={trazo.clase} />
                </svg>
                <span className="codigo">{curva.device_id}</span>
              </li>
            )
          })}
        </ul>
      )}
    </figure>
  )
}
