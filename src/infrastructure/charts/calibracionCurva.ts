import type { EChartsCoreOption } from 'echarts/core'

import { temaGrafica, type TemaGrafica } from './temaColdCare'

/** Tramo de la curva capturado con el certificado de calibración vencido (HU-30 esc. 3). */
export interface TramoCalibracionVencida {
  /** Primer instante sin certificado vigente (ms). */
  desde: number
  /** Borde derecho de la curva (ms): última lectura o «ahora». */
  hasta: number
  etiqueta: string
}

export const SERIE_CALIBRACION = '__calibracion'

/**
 * HU-30 esc. 3: superpone a la curva térmica, sin tocar sus series, el tramo
 * en que las lecturas provienen de un sensor con calibración vencida. Es una
 * condición documental, no un riesgo térmico: velo ámbar tenue con su rótulo
 * (nunca el carmesí de la excursión) y fuera de la leyenda y del tooltip.
 */
export function anotarCalibracionVencida(
  opcion: EChartsCoreOption,
  tramos: readonly TramoCalibracionVencida[],
  tema?: TemaGrafica,
): EChartsCoreOption {
  const validos = tramos.filter((tramo) => Number.isFinite(tramo.desde) && Number.isFinite(tramo.hasta) && tramo.hasta > tramo.desde)
  if (validos.length === 0) return opcion
  const colores = temaGrafica(tema)
  const series = Array.isArray(opcion.series) ? opcion.series : opcion.series ? [opcion.series] : []
  return {
    ...opcion,
    series: [
      ...series,
      {
        name: SERIE_CALIBRACION,
        type: 'line',
        data: [],
        silent: true,
        tooltip: { show: false },
        markArea: {
          silent: true,
          data: validos.map((tramo) => [
            {
              xAxis: tramo.desde,
              itemStyle: { color: colores.warning, opacity: 0.08 },
              label: {
                show: true,
                position: 'insideTopLeft',
                color: colores.warningText,
                fontSize: 11,
                fontFamily: 'Inter Variable, sans-serif',
                formatter: tramo.etiqueta,
              },
            },
            { xAxis: tramo.hasta },
          ]),
        },
        markLine: {
          silent: true,
          symbol: 'none',
          label: { show: false },
          lineStyle: { color: colores.warning, type: 'dashed', width: 1, opacity: 0.9 },
          data: validos.map((tramo) => ({ xAxis: tramo.desde })),
        },
      },
    ],
  }
}
