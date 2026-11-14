import type { EChartsCoreOption } from 'echarts/core'

import type { LecturaTermica } from '@/domain/entities/LecturaTermica'
import { RANGO_TERMICO } from '@/domain/value-objects/NivelRiesgo'
import { fechaHora, hora as formatearHora } from '@/lib/formato'
import { temaGrafica, type TemaGrafica } from './temaColdCare'

/**
 * Sin una lectura en este lapso el nodo se considera SIN_DATOS (HU-33): la
 * curva se corta en vez de unir con una recta dos muestras separadas por un
 * apagón, que dibujaría temperaturas que nadie midió.
 */
export const HUECO_SIN_DATOS_MS = 90_000

// Más episodios que esto en pantalla ya no se distinguen entre sí; se marcan
// las franjas igual, pero el marcador de inicio solo en los más recientes.
const MAX_MARCADORES_EPISODIO = 12

// Un hueco es un intervalo bastante mayor que la cadencia habitual de la serie.
const FACTOR_CADENCIA_HUECO = 2.5

// Por debajo de esta fracción del eje la etiqueta «Sin datos» no cabe y solo
// se superpone a las vecinas; la franja sombreada se mantiene igual.
const FRACCION_MINIMA_ETIQUETA_HUECO = 0.04

/**
 * Umbral efectivo de hueco: el de SIN_DATOS (HU-33) mientras la serie llegue
 * con la cadencia del nodo (30 s). Si llega remuestreada a un paso mayor —la
 * demo genera una lectura cada 10 min— cada intervalo superaba los 90 s y la
 * curva entera se cortaba en puntos sueltos que no se dibujaban. Se usa el
 * percentil 25 de los intervalos para que los propios huecos no lo inflen.
 */
export function umbralHueco(serie: LecturaTermica[]): number {
  const pasos: number[] = []
  for (let i = 1; i < serie.length; i++) {
    const paso = Date.parse(serie[i].timestamp) - Date.parse(serie[i - 1].timestamp)
    if (paso > 0) pasos.push(paso)
  }
  if (pasos.length === 0) return HUECO_SIN_DATOS_MS
  pasos.sort((a, b) => a - b)
  const cadencia = pasos[Math.floor((pasos.length - 1) * 0.25)]
  return Math.max(HUECO_SIN_DATOS_MS, cadencia * FACTOR_CADENCIA_HUECO)
}

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
export function episodiosDeExcursion(serie: LecturaTermica[], umbralMs = umbralHueco(serie)): Episodio[] {
  const episodios: Episodio[] = []
  let actual: Episodio | null = null
  let previoMs: number | null = null
  for (const lectura of serie) {
    const ms = Date.parse(lectura.timestamp)
    const continua = previoMs !== null && ms - previoMs < umbralMs
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
export function huecosSinDatos(serie: LecturaTermica[], umbralMs = umbralHueco(serie)): Array<[number, number]> {
  const huecos: Array<[number, number]> = []
  for (let i = 1; i < serie.length; i++) {
    const anterior = Date.parse(serie[i - 1].timestamp)
    const siguiente = Date.parse(serie[i].timestamp)
    if (siguiente - anterior >= umbralMs) huecos.push([anterior, siguiente])
  }
  return huecos
}

/** Puntos [tiempo, valor] con un `null` en cada hueco para cortar la línea. */
function puntos(
  serie: LecturaTermica[],
  valor: (l: LecturaTermica) => number | null | undefined,
  umbralMs: number,
): Punto[] {
  const resultado: Punto[] = []
  let previoMs: number | null = null
  for (const lectura of serie) {
    const ms = Date.parse(lectura.timestamp)
    if (previoMs !== null && ms - previoMs >= umbralMs) resultado.push([previoMs + 1, null])
    resultado.push([ms, valor(lectura) ?? null])
    previoMs = ms
  }
  return resultado
}

const FUENTE_GRAFICA = 'Inter Variable, sans-serif'

type ColoresGrafica = ReturnType<typeof temaGrafica>

/**
 * Tramos de la curva fuera de 2–8 °C, para pintarlos en carmesí encima del
 * trazo navy (DIRECTION §4: «los tramos fuera de rango van en carmesí»).
 * Cada tramo empieza y termina exactamente en la cota que cruza, así el color
 * cambia en 2 o 8 °C y no en la muestra siguiente. Sin `visualMap`: no suma
 * kilobytes al trozo de ECharts (PERFORMANCE §2).
 */
export function tramosFueraDeRango(datos: readonly Punto[], minimo = RANGO_TERMICO.minimo, maximo = RANGO_TERMICO.maximo): Punto[] {
  const resultado: Punto[] = []
  const fuera = (v: number) => v < minimo || v > maximo
  const cortar = (x: number) => {
    if (resultado.length > 0 && resultado[resultado.length - 1][1] !== null) resultado.push([x, null])
  }
  const cruce = (x0: number, v0: number, x1: number, v1: number, cota: number): number =>
    v1 === v0 ? x0 : x0 + ((cota - v0) / (v1 - v0)) * (x1 - x0)
  let previo: [number, number] | null = null
  for (const [x, v] of datos) {
    if (v === null) {
      cortar(x)
      previo = null
      continue
    }
    if (previo === null) {
      if (fuera(v)) resultado.push([x, v])
      previo = [x, v]
      continue
    }
    const [x0, v0] = previo
    const cotaSalida = v0 > maximo ? maximo : minimo
    const cotaEntrada = v > maximo ? maximo : minimo
    if (!fuera(v0) && fuera(v)) {
      resultado.push([cruce(x0, v0, x, v, cotaEntrada), cotaEntrada], [x, v])
    } else if (fuera(v0) && !fuera(v)) {
      const xc = cruce(x0, v0, x, v, cotaSalida)
      resultado.push([xc, cotaSalida])
      cortar(xc)
    } else if (fuera(v0) && fuera(v) && v0 > maximo !== v > maximo) {
      // Salta de un lado al otro del rango entre dos muestras.
      const xs = cruce(x0, v0, x, v, cotaSalida)
      resultado.push([xs, cotaSalida])
      cortar(xs)
      resultado.push([cruce(x0, v0, x, v, cotaEntrada), cotaEntrada], [x, v])
    } else if (fuera(v)) {
      resultado.push([x, v])
    }
    previo = [x, v]
  }
  return resultado
}

/**
 * Serie superpuesta con los tramos fuera de rango, o nada si no los hay.
 * Lleva el MISMO nombre que su línea: la leyenda los oculta y muestra juntos
 * y toma el icono de la primera (la navy).
 */
function serieFueraDeRango(nombre: string, datos: readonly Punto[], colores: ColoresGrafica, tipo: TipoTrazo = 'solid') {
  const tramos = tramosFueraDeRango(datos)
  if (tramos.length === 0) return []
  return [
    {
      name: nombre,
      type: 'line',
      data: tramos,
      symbol: 'none',
      showSymbol: false,
      connectNulls: false,
      silent: true,
      z: 3,
      tooltip: { show: false },
      emphasis: { disabled: true },
      lineStyle: { width: 1.75, color: colores.critical, type: tipo },
      itemStyle: { color: colores.critical },
    },
  ]
}

/**
 * Trama de «sin datos» (la misma de `.trama-sin-datos`) como patrón de
 * canvas. Sin canvas (pruebas en jsdom) queda el fondo liso.
 */
function rellenoSinDatos(colores: ColoresGrafica): string | { image: HTMLCanvasElement; repeat: 'repeat' } {
  if (typeof document === 'undefined' || (typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent))) return colores.nodata
  const lado = 6
  const lienzo = document.createElement('canvas')
  lienzo.width = lado
  lienzo.height = lado
  const ctx = lienzo.getContext('2d')
  if (!ctx) return colores.nodata
  ctx.fillStyle = colores.nodata
  ctx.fillRect(0, 0, lado, lado)
  ctx.strokeStyle = colores.nodataTrama
  ctx.lineWidth = 1.5
  ctx.beginPath()
  // Tres diagonales para que el mosaico empalme sin costuras.
  for (const desplazamiento of [-lado, 0, lado]) {
    ctx.moveTo(desplazamiento, lado)
    ctx.lineTo(desplazamiento + lado, 0)
  }
  ctx.stroke()
  return { image: lienzo, repeat: 'repeat' }
}

/** Ejes, rejilla y tooltip comunes a la curva de un equipo y a la de varios. */
function baseCurva(colores: ColoresGrafica, ventana?: { desde: number; hasta: number }) {
  const fuente = FUENTE_GRAFICA
  const guia = { color: colores.muted, type: 'dashed', width: 1 }
  return {
    animation: false,
    textStyle: { fontFamily: fuente, color: colores.foreground },
    grid: { left: 48, right: 44, top: ventana ? 48 : 36, bottom: 28 },
    tooltip: {
      confine: true,
      trigger: 'axis',
      // Crosshair (Finance Bento): sigue al puntero sin transición (MOTION #15).
      transitionDuration: 0,
      axisPointer: {
        type: 'cross',
        lineStyle: guia,
        crossStyle: guia,
        label: {
          backgroundColor: colores.foreground,
          color: colores.surface,
          fontFamily: fuente,
          fontSize: 11,
          padding: [3, 6],
          borderRadius: 4,
          formatter: ({ value, axisDimension }: { value: number; axisDimension?: string }) =>
            axisDimension === 'y' ? `${Number(value).toFixed(1)} °C` : fechaHora(new Date(value).toISOString()),
        },
      },
      // Lo que flota lleva la única sombra del sistema (DIRECTION §8).
      extraCssText: 'box-shadow: var(--shadow-float); border-radius: var(--radius-field);',
      backgroundColor: colores.raised,
      borderColor: colores.border,
      borderWidth: 1,
      padding: [8, 12],
      textStyle: { color: colores.foreground, fontSize: 12, fontFamily: fuente },
      valueFormatter: (v: unknown) => (typeof v === 'number' ? `${v.toFixed(1)} °C` : '—'),
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
  }
}

/**
 * Franja 2–8 °C (la firma, DIRECTION §4): área `banda` con cotas
 * discontinuas `banda-borde`. Fuera del rango no se tiñe nada: lo que sale de
 * la franja se dibuja en carmesí en el propio trazo (HU-31 esc. 1: el rango
 * se ve como zona y lo que queda fuera, en rojo).
 */
function marcasRango(colores: ColoresGrafica, etiquetas: EtiquetasCurvaTermica) {
  const fuente = FUENTE_GRAFICA
  return {
    markArea: {
      silent: true,
      itemStyle: { color: colores.banda, opacity: 1 },
      label: { show: true, position: 'insideTop', color: colores.safeText, fontSize: 11, fontFamily: fuente, formatter: etiquetas.rangoEsperado },
      data: [[{ yAxis: RANGO_TERMICO.minimo }, { yAxis: RANGO_TERMICO.maximo }]],
    },
    markLine: {
      silent: true,
      symbol: 'none',
      lineStyle: { color: colores.safe, type: 'dashed', width: 1, opacity: 1 },
      label: { color: colores.safeText, fontSize: 11, fontFamily: fuente, formatter: '{c} °C' },
      data: [{ yAxis: RANGO_TERMICO.minimo }, { yAxis: RANGO_TERMICO.maximo }],
    },
  }
}

/**
 * Icono de leyenda que repite el trazo de su serie (sólido, discontinuo o
 * punteado): con `symbol: 'none'` ECharts dibujaba un punto que la línea no
 * tiene. Los trazados se escalan a `itemWidth × itemHeight`.
 */
const ICONO_TRAZO: Record<string, string> = {
  solid: 'roundRect',
  dashed: 'path://M0,0H6V1H0ZM8,0H14V1H8ZM16,0H20V1H16Z',
  dotted: 'path://M0,0H2V1H0ZM5,0H7V1H5ZM10,0H12V1H10ZM15,0H17V1H15Z',
  mixto: 'path://M0,0H8V1H0ZM11,0H13V1H11ZM16,0H20V1H16Z',
}

function iconoTrazo(tipo: TipoTrazo): string {
  return ICONO_TRAZO[Array.isArray(tipo) ? 'mixto' : tipo]
}

function leyenda(colores: ColoresGrafica, extra: Record<string, unknown>) {
  return {
    top: 0,
    right: 0,
    itemWidth: 20,
    itemHeight: 3,
    itemGap: 16,
    // ECharts pinta la inactiva en #ccc (≈1,6:1); `faint` es legible (AA).
    inactiveColor: colores.muted,
    inactiveBorderColor: colores.muted,
    textStyle: { color: colores.texto, fontSize: 12, fontFamily: FUENTE_GRAFICA },
    ...extra,
  }
}

type TipoTrazo = 'solid' | 'dashed' | 'dotted' | number[]

/**
 * Trazo por equipo cuando la curva compara varios: tinta navy, gris
 * discontinuo, acero punteado y raya-punto. El tipo de línea separa los
 * equipos sin depender solo del color (WCAG 1.4.1) y ninguno usa el teal de
 * la franja, el carmesí de la excursión ni los colores de marca.
 */
function trazoEquipo(colores: ColoresGrafica, indice: number): { color: string; type: TipoTrazo } {
  const trazos: Array<{ color: string; type: TipoTrazo }> = [
    { color: colores.primary, type: 'solid' },
    { color: colores.secondary, type: 'dashed' },
    { color: colores.nodataTexto, type: 'dotted' },
    { color: colores.muted, type: [8, 3, 2, 3] },
  ]
  return trazos[indice % trazos.length]
}

/**
 * Historial sin filtro de equipo: con dos o más refrigeradores en la consulta,
 * una sola línea saltaba de un equipo a otro en cada lectura y dibujaba un
 * zigzag que nadie midió. Cada equipo lleva su propia línea, con sus propios
 * cortes por hueco y su marcador de inicio de excursión.
 */
function construirCurvaPorEquipo(
  serie: LecturaTermica[],
  equipos: string[],
  etiquetas: EtiquetasCurvaTermica,
  colores: ColoresGrafica,
  ventana?: { desde: number; hasta: number },
): EChartsCoreOption {
  const visible = ventana ? serie.filter((l) => Date.parse(l.timestamp) >= ventana.desde) : serie
  const porEquipo = equipos.map((equipo, indice) => {
    const propias = visible.filter((l) => l.device_id === equipo)
    const umbral = umbralHueco(propias)
    const { color, type } = trazoEquipo(colores, indice)
    const datos = puntos(propias, (l) => l.temperatura_interna, umbral)
    const linea = {
      name: equipo,
      type: 'line',
      smooth: false,
      symbol: 'none',
      showSymbol: false,
      connectNulls: false,
      sampling: 'lttb',
      data: datos,
      lineStyle: { width: 1.75, color, type },
      itemStyle: { color },
      ...(indice === 0 ? marcasRango(colores, etiquetas) : {}),
      markPoint: {
        symbol: 'circle',
        symbolSize: 9,
        itemStyle: { color: colores.critical, borderColor: colores.surface, borderWidth: 2 },
        label: { show: false },
        tooltip: { show: false },
        data: episodiosDeExcursion(propias, umbral)
          .filter((e) => !e.recortado)
          .slice(-MAX_MARCADORES_EPISODIO)
          .map((e) => ({ name: etiquetas.excursion, coord: [e.inicio, e.temperaturaInicio] })),
      },
    }
    return { linea, fuera: serieFueraDeRango(equipo, datos, colores, type) }
  })
  return {
    ...baseCurva(colores, ventana),
    legend: leyenda(colores, {
      data: equipos.map((equipo, indice) => ({ name: equipo, icon: iconoTrazo(trazoEquipo(colores, indice).type) })),
    }),
    // Las líneas primero (la prueba y la leyenda las esperan en orden); los
    // tramos carmesí, encima.
    series: [...porEquipo.map((e) => e.linea), ...porEquipo.flatMap((e) => e.fuera)],
  }
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
  tema?: TemaGrafica,
): EChartsCoreOption {
  const colores = temaGrafica(tema)
  // Orden estable: el mismo equipo conserva su trazo entre consultas.
  const equipos = [...new Set(serie.map((l) => l.device_id).filter(Boolean))].sort()
  if (equipos.length > 1) return construirCurvaPorEquipo(serie, equipos, etiquetas, colores, ventana)
  const umbral = umbralHueco(serie)
  const visible = ventana ? serie.filter((l) => Date.parse(l.timestamp) >= ventana.desde) : serie
  // Los episodios se buscan en toda la serie: uno que empezó antes de la
  // ventana sigue siendo el mismo episodio, no uno nuevo en el borde izquierdo.
  const episodios = episodiosDeExcursion(serie, umbral)
    .filter((e) => !ventana || e.fin >= ventana.desde)
    .map((e) => (ventana && e.inicio < ventana.desde ? { ...e, inicio: ventana.desde, recortado: true } : e))
  const huecos = huecosSinDatos(visible, umbral)
  // Un episodio que sigue abierto llega hasta la última lectura; con
  // `ventana` se extiende a «ahora» solo si esa lectura es reciente.
  const ultimaMs = visible.length > 0 ? Date.parse(visible[visible.length - 1].timestamp) : null
  const finEpisodio = (e: Episodio) =>
    ventana && e.fin === ultimaMs && ventana.hasta - e.fin < umbral ? ventana.hasta : e.fin
  const primeraMs = visible.length > 0 ? Date.parse(visible[0].timestamp) : 0
  const lapsoVisible = ventana ? ventana.hasta - ventana.desde : (ultimaMs ?? 0) - primeraMs
  const huecoConEtiqueta = ([inicio, fin]: [number, number]) =>
    lapsoVisible > 0 && (fin - inicio) / lapsoVisible >= FRACCION_MINIMA_ETIQUETA_HUECO
  const fuente = FUENTE_GRAFICA
  const datosInterna = puntos(visible, (l) => l.temperatura_interna, umbral)
  const trama = huecos.length > 0 ? rellenoSinDatos(colores) : colores.nodata

  return {
    ...baseCurva(colores, ventana),
    legend: leyenda(colores, {
      data: [
        { name: etiquetas.interna, icon: iconoTrazo('solid') },
        { name: etiquetas.ambiental, icon: iconoTrazo('dashed') },
      ],
      selected: { [etiquetas.ambiental]: false },
      formatter: etiquetaCortaTemperatura,
    }),
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
        data: datosInterna,
        // Tinta de registrador: 1,75 px, sin brillo ni relleno (DIRECTION §4).
        lineStyle: { width: 1.75, color: colores.primary },
        itemStyle: { color: colores.primary },
        ...marcasRango(colores, etiquetas),
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
        data: puntos(visible, (l) => l.temperatura_ambiental, umbral),
        lineStyle: { width: 1.5, color: colores.secondary, type: 'dashed' },
        itemStyle: { color: colores.secondary },
      },
      ...serieFueraDeRango(etiquetas.interna, datosInterna, colores),
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
                // El episodio (inicio, duración y fin) en un velo carmesí tenue.
                itemStyle: { color: colores.critical, opacity: 0.07 },
                label: { show: false },
              },
              { xAxis: finEpisodio(e) },
            ]),
            ...huecos.map(([inicio, fin]) => [
              {
                xAxis: inicio,
                // Sin datos: acero con trama, nunca un riesgo (HU-54).
                itemStyle: { color: trama, opacity: 1 },
                label: {
                  show: huecoConEtiqueta([inicio, fin]),
                  position: 'insideBottom',
                  color: colores.nodataTexto,
                  fontSize: 11,
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
              label: { position: 'end', color: colores.muted, fontSize: 11, fontFamily: fuente, formatter: etiquetas.ahora },
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
