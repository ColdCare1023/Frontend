import type { EChartsCoreOption } from 'echarts/core'

import type { BucketSerie, SerieTermica } from '@/domain/entities/SerieTermica'
import { fechaHora } from '@/lib/formato'
import { episodiosDeSerie } from '@/lib/resumenSerie'
import {
  baseCurva,
  etiquetaCortaTemperatura,
  FUENTE_GRAFICA,
  iconoTrazo,
  leyenda,
  marcasRango,
  rellenoSinDatos,
  serieFueraDeRango,
  trazoEquipo,
  type ColoresGrafica,
  type EtiquetasCurvaTermica,
} from './curvaTermica'
import { temaGrafica, type TemaGrafica } from './temaColdCare'

/**
 * HU-31 / HU-36: curva del Historial a partir de la serie AGREGADA del
 * backend (un punto por intervalo con mínimo, máximo y promedio), que cubre el
 * periodo completo. Misma gramática visual que la curva en vivo
 * (`curvaTermica.ts`): franja 2–8 °C, tramos fuera de rango en carmesí,
 * episodios con velo tenue y marcador al inicio, y «sin datos» en acero con
 * trama. Con un equipo, una banda mín.–máx. conserva los picos que el
 * promedio suavizaría (HU-31 esc. 3: agregar sin perder la forma real).
 */

export interface EtiquetasSerieTermica extends EtiquetasCurvaTermica {
  /** Leyenda de la banda mín.–máx. de cada intervalo. */
  banda: string
  /** Brecha con causa conocida: buffer LittleFS agotado (HU-48). */
  bufferAgotado: string
  minimo: string
  maximo: string
  lecturas: string
}

const MAX_MARCADORES_EPISODIO = 12
const FRACCION_MINIMA_ETIQUETA_HUECO = 0.04

type Punto = [number, number | null]

interface DatoIntervalo {
  value: Punto
  min: number | null
  max: number | null
  n: number
}

const medio = (b: BucketSerie) => (Date.parse(b.inicio) + Date.parse(b.fin)) / 2

/** Índices de los intervalos tras los que hay que cortar la línea (brecha entre medio y medio). */
function cortes(serie: SerieTermica): Set<number> {
  const resultado = new Set<number>()
  const brechas = serie.brechas.map((b) => [Date.parse(b.desde), Date.parse(b.hasta)] as const)
  for (let i = 0; i + 1 < serie.buckets.length; i++) {
    const a = medio(serie.buckets[i])
    const b = medio(serie.buckets[i + 1])
    if (brechas.some(([desde, hasta]) => desde < b && hasta > a)) resultado.add(i)
  }
  return resultado
}

/** Puntos de una magnitud con un `null` en cada brecha para cortar la línea. */
function puntosDe(serie: SerieTermica, valor: (b: BucketSerie) => number | null, corte: Set<number>): Punto[] {
  const puntos: Punto[] = []
  serie.buckets.forEach((bucket, i) => {
    puntos.push([medio(bucket), valor(bucket)])
    if (corte.has(i)) puntos.push([medio(bucket) + 1, null])
  })
  return puntos
}

type Magnitud = 'temperatura_interna' | 'temperatura_ambiental'

function datosPromedio(serie: SerieTermica, corte: Set<number>, magnitud: Magnitud = 'temperatura_interna'): Array<DatoIntervalo | Punto> {
  const datos: Array<DatoIntervalo | Punto> = []
  serie.buckets.forEach((bucket, i) => {
    const t = bucket[magnitud]
    datos.push({ value: [medio(bucket), t.promedio], min: t.min, max: t.max, n: bucket.lecturas })
    if (corte.has(i)) datos.push([medio(bucket) + 1, null])
  })
  return datos
}

const escapar = (texto: string) =>
  texto.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string)
const grados = (v: number | null | undefined) => (v == null ? '—' : `${v.toFixed(1)} °C`)

/** Tooltip propio: la banda apilada mostraría la diferencia máx.−mín., no un valor medido. */
function formatoTooltip(etiquetas: EtiquetasSerieTermica) {
  return (parametros: unknown) => {
    const lista = (Array.isArray(parametros) ? parametros : [parametros]) as Array<{
      axisValue?: number
      seriesName?: string
      marker?: string
      data?: DatoIntervalo | Punto
      value?: Punto
    }>
    const primero = lista[0]
    const x = Number(primero?.axisValue ?? (primero?.value as Punto | undefined)?.[0])
    const lineas = [Number.isFinite(x) ? escapar(fechaHora(new Date(x).toISOString())) : '']
    for (const p of lista) {
      const dato = p.data
      if (!dato || Array.isArray(dato) || dato.value[1] == null) continue
      lineas.push(
        `${p.marker ?? ''}${escapar(p.seriesName ?? '')}: <b>${grados(dato.value[1])}</b>` +
          `<br/><span style="opacity:.75">${escapar(etiquetas.minimo)} ${grados(dato.min)} · ${escapar(etiquetas.maximo)} ${grados(dato.max)} · ${dato.n} ${escapar(etiquetas.lecturas)}</span>`,
      )
    }
    return lineas.join('<br/>')
  }
}

function marcadoresEpisodio(serie: SerieTermica, colores: ColoresGrafica, etiquetas: EtiquetasSerieTermica) {
  return {
    symbol: 'circle',
    symbolSize: 9,
    itemStyle: { color: colores.critical, borderColor: colores.surface, borderWidth: 2 },
    label: { show: false },
    tooltip: { show: false },
    data: episodiosDeSerie(serie)
      .filter((e) => e.temperaturaInicio != null)
      .slice(-MAX_MARCADORES_EPISODIO)
      .map((e) => ({ name: etiquetas.excursion, coord: [e.inicio, e.temperaturaInicio] })),
  }
}

/** Varios equipos: una línea de promedio por equipo (sin banda, que se superpondría). */
function construirPorEquipo(
  series: readonly SerieTermica[],
  etiquetas: EtiquetasSerieTermica,
  colores: ColoresGrafica,
  ventana: { desde: number; hasta: number },
): EChartsCoreOption {
  const porEquipo = series.map((serie, indice) => {
    const { color, type } = trazoEquipo(colores, indice)
    const corte = cortes(serie)
    const datos = datosPromedio(serie, corte)
    const linea = {
      name: serie.device_id,
      type: 'line',
      symbol: 'none',
      showSymbol: false,
      connectNulls: false,
      data: datos,
      lineStyle: { width: 1.75, color, type },
      itemStyle: { color },
      ...(indice === 0 ? marcasRango(colores, etiquetas) : {}),
      markPoint: marcadoresEpisodio(serie, colores, etiquetas),
    }
    return { linea, fuera: serieFueraDeRango(serie.device_id, puntosDe(serie, (b) => b.temperatura_interna.promedio, corte), colores, type) }
  })
  const base = baseCurva(colores, ventana)
  return {
    ...base,
    tooltip: { ...base.tooltip, formatter: formatoTooltip(etiquetas) },
    legend: leyenda(colores, {
      data: series.map((serie, indice) => ({ name: serie.device_id, icon: iconoTrazo(trazoEquipo(colores, indice).type) })),
    }),
    series: [...porEquipo.map((e) => e.linea), ...porEquipo.flatMap((e) => e.fuera)],
  }
}

/**
 * Opción de ECharts para la serie de uno o varios equipos. `ventana` es el
 * periodo consultado: el eje lo muestra entero, también lo que no tiene datos.
 */
export function construirOpcionSerieTermica(
  series: readonly SerieTermica[],
  etiquetas: EtiquetasSerieTermica,
  ventana: { desde: number; hasta: number },
  tema?: TemaGrafica,
): EChartsCoreOption {
  const colores = temaGrafica(tema)
  const ordenadas = [...series].sort((a, b) => a.device_id.localeCompare(b.device_id))
  if (ordenadas.length > 1) return construirPorEquipo(ordenadas, etiquetas, colores, ventana)
  const serie = ordenadas[0]
  const base = baseCurva(colores, ventana)
  if (!serie) return { ...base, series: [] }

  const corte = cortes(serie)
  const minimos = puntosDe(serie, (b) => b.temperatura_interna.min, corte)
  // Banda apilada: base = mínimo (invisible) y encima el alto máx.−mín.
  const alto = puntosDe(
    serie,
    (b) => (b.temperatura_interna.max != null && b.temperatura_interna.min != null ? b.temperatura_interna.max - b.temperatura_interna.min : null),
    corte,
  )
  const promedios = puntosDe(serie, (b) => b.temperatura_interna.promedio, corte)
  // Extremos de cada intervalo fuera de 2–8 °C: el promedio puede quedar dentro.
  const extremos: Punto[] = serie.buckets.flatMap((b) => {
    const { min, max } = b.temperatura_interna
    const puntos: Punto[] = []
    if (max != null && max > 8) puntos.push([medio(b), max])
    if (min != null && min < 2) puntos.push([medio(b), min])
    return puntos
  })
  const episodios = episodiosDeSerie(serie)
  const lapso = ventana.hasta - ventana.desde
  const trama = serie.brechas.length > 0 ? rellenoSinDatos(colores) : colores.nodata

  return {
    ...base,
    tooltip: { ...base.tooltip, formatter: formatoTooltip(etiquetas) },
    legend: leyenda(colores, {
      data: [
        { name: etiquetas.interna, icon: iconoTrazo('solid') },
        // Icono atenuado: se lee como la franja sombreada, no como otra línea.
        { name: etiquetas.banda, icon: 'rect', itemStyle: { color: colores.primary, opacity: 0.35 } },
        { name: etiquetas.ambiental, icon: iconoTrazo('dashed') },
      ],
      selected: { [etiquetas.ambiental]: false },
      formatter: etiquetaCortaTemperatura,
    }),
    series: [
      {
        id: 'banda-base',
        name: etiquetas.banda,
        type: 'line',
        stack: 'banda-min-max',
        data: minimos,
        symbol: 'none',
        showSymbol: false,
        connectNulls: false,
        silent: true,
        lineStyle: { opacity: 0 },
        itemStyle: { color: colores.primary },
        emphasis: { disabled: true },
      },
      {
        id: 'banda-alto',
        name: etiquetas.banda,
        type: 'line',
        stack: 'banda-min-max',
        data: alto,
        symbol: 'none',
        showSymbol: false,
        connectNulls: false,
        silent: true,
        lineStyle: { opacity: 0 },
        areaStyle: { color: colores.primary, opacity: 0.12 },
        itemStyle: { color: colores.primary },
        emphasis: { disabled: true },
      },
      {
        name: etiquetas.interna,
        type: 'line',
        smooth: false,
        symbol: 'none',
        showSymbol: false,
        connectNulls: false,
        data: datosPromedio(serie, corte),
        lineStyle: { width: 1.75, color: colores.primary },
        itemStyle: { color: colores.primary },
        ...marcasRango(colores, etiquetas),
        markPoint: marcadoresEpisodio(serie, colores, etiquetas),
      },
      {
        name: etiquetas.ambiental,
        type: 'line',
        smooth: false,
        symbol: 'none',
        showSymbol: false,
        connectNulls: false,
        data: datosPromedio(serie, corte, 'temperatura_ambiental'),
        lineStyle: { width: 1.5, color: colores.secondary, type: 'dashed' },
        itemStyle: { color: colores.secondary },
      },
      ...serieFueraDeRango(etiquetas.interna, promedios, colores),
      ...(extremos.length > 0
        ? [
            {
              id: 'extremos-fuera',
              name: etiquetas.banda,
              type: 'scatter',
              data: extremos,
              symbolSize: 4,
              silent: true,
              z: 4,
              tooltip: { show: false },
              itemStyle: { color: colores.critical },
            },
          ]
        : []),
      {
        name: '__contexto',
        type: 'line',
        data: [],
        silent: true,
        tooltip: { show: false },
        markArea: {
          silent: true,
          data: [
            ...episodios.map((e) => [
              { xAxis: e.inicio, itemStyle: { color: colores.critical, opacity: 0.07 }, label: { show: false } },
              { xAxis: e.fin },
            ]),
            ...serie.brechas.map((b) => {
              const inicio = Date.parse(b.desde)
              const fin = Date.parse(b.hasta)
              return [
                {
                  xAxis: inicio,
                  // Sin datos: acero con trama, nunca un riesgo (HU-54).
                  itemStyle: { color: trama, opacity: 1 },
                  label: {
                    show: lapso > 0 && (fin - inicio) / lapso >= FRACCION_MINIMA_ETIQUETA_HUECO,
                    position: 'insideBottom',
                    color: colores.nodataTexto,
                    fontSize: 11,
                    fontFamily: FUENTE_GRAFICA,
                    formatter: b.causa === 'buffer_agotado' ? etiquetas.bufferAgotado : etiquetas.sinDatos,
                  },
                },
                { xAxis: fin },
              ]
            }),
          ],
        },
      },
    ],
  }
}
