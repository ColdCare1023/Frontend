import type { EChartsCoreOption } from 'echarts/core'

import type { LecturaTermica } from '@/domain/entities/LecturaTermica'
import { RANGO_TERMICO } from '@/domain/value-objects/NivelRiesgo'
import { fechaHora, hora as formatearHora } from '@/lib/formato'
import { temaGrafica } from './temaColdCare'

/**
 * Sin una lectura en este lapso el nodo se considera SIN_DATOS (HU-33): la
 * curva se corta en vez de unir con una recta dos muestras separadas por un
 * apagón, que dibujaría temperaturas que nadie midió.
 */
export const HUECO_SIN_DATOS_MS = 90_000

// Más episodios que esto en pantalla ya no se distinguen entre sí; se marcan
// las franjas igual, pero el marcador de inicio solo en los más recientes.
const MAX_MARCADORES_EPISODIO = 12

export interface EtiquetasCurvaTermica {
  interna: string
  ambiental: string
  rangoEsperado: string
  ahora: string
  excursion: string
  sinDatos: string
}

interface Episodio {
  inicio: number
  fin: number
  temperaturaInicio: number
  /** Empezó antes de la ventana visible: sin marcador de inicio. */
  recortado?: boolean
}

type Punto = [number, number | null]

/** Agrupa lecturas consecutivas con excursión confirmada en episodios. */
export function episodiosDeExcursion(serie: LecturaTermica[]): Episodio[] {
  const episodios: Episodio[] = []
  let actual: Episodio | null = null
  let previoMs: number | null = null
  for (const lectura of serie) {
    const ms = Date.parse(lectura.timestamp)
    const continua = previoMs !== null && ms - previoMs < HUECO_SIN_DATOS_MS
    if (lectura.excursion_confirmada && lectura.temperatura_interna != null) {
      if (actual && continua) {
        actual.fin = ms
      } else {
        // Si ya estaba en curso en la primera lectura cargada, su inicio real
        // queda fuera de lo consultado: no se marca como inicio.
        actual = { inicio: ms, fin: ms, temperaturaInicio: lectura.temperatura_interna, recortado: previoMs === null }
        episodios.push(actual)
      }
    } else {
      actual = null
    }
    previoMs = ms
  }
  return episodios
}

/** Tramos sin lecturas más largos que el umbral de SIN_DATOS. */
export function huecosSinDatos(serie: LecturaTermica[]): Array<[number, number]> {
  const huecos: Array<[number, number]> = []
  for (let i = 1; i < serie.length; i++) {
    const anterior = Date.parse(serie[i - 1].timestamp)
    const siguiente = Date.parse(serie[i].timestamp)
    if (siguiente - anterior >= HUECO_SIN_DATOS_MS) huecos.push([anterior, siguiente])
  }
  return huecos
}

/** Puntos [tiempo, valor] con un `null` en cada hueco para cortar la línea. */
function puntos(serie: LecturaTermica[], valor: (l: LecturaTermica) => number | null | undefined): Punto[] {
  const resultado: Punto[] = []
  let previoMs: number | null = null
  for (const lectura of serie) {
    const ms = Date.parse(lectura.timestamp)
    if (previoMs !== null && ms - previoMs >= HUECO_SIN_DATOS_MS) resultado.push([previoMs + 1, null])
    resultado.push([ms, valor(lectura) ?? null])
    previoMs = ms
  }
  return resultado
}

/**
 * Curva térmica compartida por el dashboard (ventana en vivo que termina en
 * «ahora») y el historial (rango de la consulta).
 *
 * - Eje temporal real: el espaciado refleja el tiempo, no el número de
 *   lecturas, y con `ventana` el borde derecho es el momento actual.
 * - Segmentos rectos entre muestras reales (DESIGN.md) y cortes en los huecos.
 * - Una excursión confirmada se muestra como franja por episodio con un único
 *   marcador al inicio, en lugar de un círculo por lectura.
 */
export function construirOpcionCurvaTermica(
  serie: LecturaTermica[],
  etiquetas: EtiquetasCurvaTermica,
  ventana?: { desde: number; hasta: number },
): EChartsCoreOption {
  const colores = temaGrafica()
  const visible = ventana ? serie.filter((l) => Date.parse(l.timestamp) >= ventana.desde) : serie
  // Los episodios se buscan en toda la serie: uno que empezó antes de la
  // ventana sigue siendo el mismo episodio, no uno nuevo en el borde izquierdo.
  const episodios = episodiosDeExcursion(serie)
    .filter((e) => !ventana || e.fin >= ventana.desde)
    .map((e) => (ventana && e.inicio < ventana.desde ? { ...e, inicio: ventana.desde, recortado: true } : e))
  const huecos = huecosSinDatos(visible)
  // Un episodio que sigue abierto llega hasta la última lectura; con
  // `ventana` se extiende a «ahora» solo si esa lectura es reciente.
  const ultimaMs = visible.length > 0 ? Date.parse(visible[visible.length - 1].timestamp) : null
  const finEpisodio = (e: Episodio) =>
    ventana && e.fin === ultimaMs && ventana.hasta - e.fin < HUECO_SIN_DATOS_MS ? ventana.hasta : e.fin
  const fuente = 'Inter Variable, sans-serif'

  return {
    animation: false,
    textStyle: { fontFamily: fuente, color: colores.foreground },
    grid: { left: 48, right: 44, top: ventana ? 48 : 36, bottom: 28 },
    tooltip: {
      confine: true,
      trigger: 'axis',
      axisPointer: {
        type: 'line',
        lineStyle: { color: colores.border },
        label: { formatter: ({ value }: { value: number }) => fechaHora(new Date(value).toISOString()) },
      },
      backgroundColor: colores.surface,
      borderColor: colores.border,
      textStyle: { color: colores.foreground, fontSize: 12, fontFamily: fuente },
      valueFormatter: (v: unknown) => (typeof v === 'number' ? `${v.toFixed(1)} °C` : '—'),
    },
    legend: {
      data: [etiquetas.interna, etiquetas.ambiental],
      selected: { [etiquetas.ambiental]: false },
      top: 0,
      right: 0,
      icon: 'roundRect',
      itemWidth: 14,
      itemHeight: 3,
      formatter: etiquetaCortaTemperatura,
      textStyle: { color: colores.muted, fontSize: 12, fontFamily: fuente },
    },
    xAxis: {
      type: 'time',
      min: ventana?.desde,
      max: ventana?.hasta,
      axisLine: { lineStyle: { color: colores.border } },
      axisTick: { show: false },
      splitLine: { show: false },
      axisLabel: {
        hideOverlap: true,
        fontSize: 11,
        color: colores.muted,
        fontFamily: fuente,
        formatter: (valor: number) => formatearHora(new Date(valor).toISOString()).replace(/:\d{2}(?=\D*$)/, ''),
      },
    },
    yAxis: {
      type: 'value',
      min: (value: { min: number }) => Math.floor(Math.min(value.min, 0)),
      max: (value: { max: number }) => Math.ceil(Math.max(value.max, 10)),
      splitLine: { lineStyle: { color: colores.grid } },
      axisLabel: { fontSize: 11, color: colores.muted, fontFamily: fuente, formatter: '{value} °C' },
    },
    series: [
      {
        name: etiquetas.interna,
        type: 'line',
        smooth: false,
        symbol: 'none',
        showSymbol: false,
        connectNulls: false,
        // HU-31 criterio 3: LTTB conserva picos y caídas al muestrear ventanas largas.
        sampling: 'lttb',
        data: puntos(visible, (l) => l.temperatura_interna),
        lineStyle: { width: 2, color: colores.primary },
        itemStyle: { color: colores.primary },
        markArea: {
          silent: true,
          itemStyle: { color: colores.safe, opacity: 0.1 },
          label: { show: true, position: 'insideTop', color: colores.safeText, fontSize: 10, fontFamily: fuente, formatter: etiquetas.rangoEsperado },
          data: [[{ yAxis: RANGO_TERMICO.minimo }, { yAxis: RANGO_TERMICO.maximo }]],
        },
        markLine: {
          silent: true,
          symbol: 'none',
          lineStyle: { color: colores.safeText, type: 'dashed', width: 1, opacity: 0.6 },
          label: { color: colores.safeText, fontSize: 10, fontFamily: fuente, formatter: '{c} °C' },
          data: [{ yAxis: RANGO_TERMICO.minimo }, { yAxis: RANGO_TERMICO.maximo }],
        },
        markPoint: {
          symbol: 'circle',
          symbolSize: 9,
          itemStyle: { color: colores.critical, borderColor: colores.surface, borderWidth: 2 },
          label: { show: false },
          tooltip: { show: false },
          data: episodios.filter((e) => !e.recortado).slice(-MAX_MARCADORES_EPISODIO).map((e) => ({
            name: etiquetas.excursion,
            coord: [e.inicio, e.temperaturaInicio],
          })),
        },
      },
      {
        name: etiquetas.ambiental,
        type: 'line',
        smooth: false,
        symbol: 'none',
        showSymbol: false,
        connectNulls: false,
        sampling: 'lttb',
        data: puntos(visible, (l) => l.temperatura_ambiental),
        lineStyle: { width: 1.5, color: colores.secondary, type: 'dashed' },
        itemStyle: { color: colores.secondary },
      },
      {
        // Serie sin datos propios: solo lleva las franjas de contexto
        // (excursiones, huecos y la marca de «ahora») fuera de la leyenda.
        name: '__contexto',
        type: 'line',
        data: [],
        silent: true,
        tooltip: { show: false },
        markArea: {
          silent: true,
          data: [
            ...episodios.map((e) => [
              {
                xAxis: e.inicio,
                itemStyle: { color: colores.critical, opacity: 0.08 },
                label: { show: false },
              },
              { xAxis: finEpisodio(e) },
            ]),
            ...huecos.map(([inicio, fin]) => [
              {
                xAxis: inicio,
                itemStyle: { color: colores.muted, opacity: 0.08 },
                label: {
                  show: true,
                  position: 'insideBottom',
                  color: colores.muted,
                  fontSize: 10,
                  fontFamily: fuente,
                  formatter: etiquetas.sinDatos,
                },
              },
              { xAxis: fin },
            ]),
          ],
        },
        markLine: ventana
          ? {
              silent: true,
              symbol: 'none',
              lineStyle: { color: colores.muted, type: 'solid', width: 1, opacity: 0.5 },
              label: { position: 'end', color: colores.muted, fontSize: 10, fontFamily: fuente, formatter: etiquetas.ahora },
              data: [{ xAxis: ventana.hasta }],
            }
          : undefined,
      },
    ],
  }
}

function etiquetaCortaTemperatura(nombre: string): string {
  return nombre
    .replace(/^temperatura\s+/i, '')
    .replace(/\s+temperature$/i, '')
}
