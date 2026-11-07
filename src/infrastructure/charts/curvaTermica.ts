import type { EChartsCoreOption } from 'echarts/core'

import type { LecturaTermica } from '@/domain/entities/LecturaTermica'
import { RANGO_TERMICO } from '@/domain/value-objects/NivelRiesgo'
import { localeActual } from '@/lib/formato'
import { colorInactivo, temaGrafica, type TemaGrafica } from './temaColdCare'

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
    const paso = marcaDe(serie[i]) - marcaDe(serie[i - 1])
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

/*
 * Cada lectura se consulta varias veces por opción y la opción se rehace con cada lectura nueva:
 * con 5000 puntos, interpretar la fecha una y otra vez era lo más caro de construirla.
 */
const MARCAS = new WeakMap<LecturaTermica, number>()
function marcaDe(lectura: LecturaTermica): number {
  let ms = MARCAS.get(lectura)
  if (ms === undefined) {
    ms = Date.parse(lectura.timestamp)
    MARCAS.set(lectura, ms)
  }
  return ms
}

/** Agrupa lecturas consecutivas con excursión confirmada en episodios. */
export function episodiosDeExcursion(serie: LecturaTermica[], umbralMs = umbralHueco(serie)): Episodio[] {
  const episodios: Episodio[] = []
  let actual: Episodio | null = null
  let previoMs: number | null = null
  for (const lectura of serie) {
    const ms = marcaDe(lectura)
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
    const anterior = marcaDe(serie[i - 1])
    const siguiente = marcaDe(serie[i])
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
    const ms = marcaDe(lectura)
    if (previoMs !== null && ms - previoMs >= umbralMs) resultado.push([previoMs + 1, null])
    resultado.push([ms, valor(lectura) ?? null])
    previoMs = ms
  }
  return resultado
}

const FUENTE_GRAFICA = '"Inter Variable", Inter, system-ui, sans-serif'
const NEGRITA_MEDIA = 500
const MARGEN_IZQUIERDO = 28
const DIA_MS = 24 * 60 * 60 * 1000

// Una etiqueta de excursión ocupa cerca de un tercio de un teléfono: más juntas se pisarían.
const SEPARACION_ROTULOS = 0.34
const MAX_ROTULOS_EXCURSION = 2
// A esta distancia en el eje vertical, el rótulo de una excursión ya no toca la cifra de la última lectura.
const CERCANIA_CIFRA_GRADOS = 2

type ColoresGrafica = ReturnType<typeof temaGrafica>
type Ventana = { desde: number; hasta: number }

/* Crear un formateador de fechas cuesta mucho más que usarlo, y el eje lo pide en cada repintado. */
const FORMATOS = new Map<string, Intl.DateTimeFormat>()
function formato(opciones: Intl.DateTimeFormatOptions) {
  const clave = `${localeActual()}|${JSON.stringify(opciones)}`
  let hecho = FORMATOS.get(clave)
  if (!hecho) {
    hecho = new Intl.DateTimeFormat(localeActual(), opciones)
    FORMATOS.set(clave, hecho)
  }
  return hecho
}
const HORA: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }
const DIA: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }
const horaCorta = (ms: number) => formato(HORA).format(ms)
const diaCorto = (ms: number) => formato(DIA).format(ms)

/** Un `device_id` viene del backend y el tooltip es HTML: nada entra sin escapar. */
function escapar(texto: string) {
  return texto.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
}

const fueraDeRango = (valor: number) => valor < RANGO_TERMICO.minimo || valor > RANGO_TERMICO.maximo

interface ParametroTooltip {
  seriesName?: string
  axisValue?: number | string
  color?: unknown
  value?: unknown
}

function contenidoTooltip(
  parametros: ParametroTooltip | ParametroTooltip[],
  colores: ColoresGrafica,
  etiquetas: EtiquetasCurvaTermica,
) {
  const lista = (Array.isArray(parametros) ? parametros : [parametros]).filter((p) => !p.seriesName?.startsWith('__'))
  const ms = Number(lista[0]?.axisValue)
  if (!Number.isFinite(ms)) return ''
  const filas = lista.map((p) => {
    const valor = Array.isArray(p.value) ? p.value[1] : p.value
    const numero = typeof valor === 'number' && Number.isFinite(valor) ? valor : null
    // El ambiente puede estar a 22 °C sin que eso sea una alerta: el rango solo vale para la cámara.
    const alerta = numero !== null && p.seriesName !== etiquetas.ambiental && fueraDeRango(numero)
    const color = typeof p.color === 'string' ? p.color : colores.primary
    const nombre = p.seriesName === etiquetas.interna || p.seriesName === etiquetas.ambiental ? etiquetaCortaTemperatura(p.seriesName) : (p.seriesName ?? '')
    return (
      `<div style="display:flex;align-items:center;justify-content:space-between;gap:18px;margin-top:3px">` +
      `<span style="display:inline-flex;align-items:center;gap:7px;color:${colores.muted}">` +
      `<span style="width:10px;height:2px;border-radius:1px;background:${alerta ? colores.criticalSolid : color}"></span>${escapar(nombre)}</span>` +
      `<span style="font-weight:600;color:${alerta ? colores.critical : colores.foreground}">${numero === null ? '—' : `${numero.toFixed(1)} °C`}</span>` +
      `</div>`
    )
  })
  const sinDatos = lista.every((p) => {
    const valor = Array.isArray(p.value) ? p.value[1] : p.value
    return typeof valor !== 'number'
  })
  return (
    `<div style="font-size:11.5px;font-weight:500;color:${colores.muted}">${escapar(diaCorto(ms))} · ${horaCorta(ms)}</div>` +
    (sinDatos ? `<div style="margin-top:3px;font-weight:600">${escapar(etiquetas.sinDatos)}</div>` : filas.join(''))
  )
}

/**
 * Las marcas del eje en una columna estrecha. Con una semana no caben todos los días y ECharts deja
 * unos sí y otros no (1, 2, 3, 5, 7): se marca cada día y se rotula uno de cada dos.
 */
function marcasEstrechas(lapso: number) {
  if (lapso < 5 * DIA_MS || lapso > 9 * DIA_MS) return { splitNumber: 3 }
  return {
    splitNumber: 7,
    axisLabel: { formatter: (valor: number) => (new Date(valor).getDate() % 2 === 1 ? diaCorto(valor) : '') },
  }
}

/** Ejes, rejilla y tooltip comunes a la curva de un equipo y a la de varios. */
function baseCurva(colores: ColoresGrafica, etiquetas: EtiquetasCurvaTermica, ventana: Ventana | undefined, lapso: number, arriba: number) {
  // Con varios días a la vista, la hora sola repetiría "00:00" en todo el eje.
  const variosDias = lapso > 36 * 60 * 60 * 1000
  const fuente = FUENTE_GRAFICA
  return {
    // Sin barrido de entrada ni transiciones: cada cuadro de animación repintaba miles de puntos.
    // La gráfica aparece con un fundido del contenedor, que no cuesta repintar nada.
    animation: false,
    backgroundColor: 'transparent',
    textStyle: { fontFamily: fuente, color: colores.foreground },
    grid: { left: MARGEN_IZQUIERDO, right: 12, top: arriba, bottom: 24 },
    // ECharts mide su propio contenedor: en una columna estrecha, menos marcas y todas parejas.
    media: [{ query: { maxWidth: 520 }, option: { xAxis: marcasEstrechas(lapso) } }],
    tooltip: {
      confine: true,
      trigger: 'axis',
      transitionDuration: 0,
      showDelay: 0,
      hideDelay: 80,
      padding: [8, 11],
      axisPointer: {
        type: 'line',
        snap: true,
        lineStyle: { color: colores.muted, type: 'solid', width: 1, opacity: 0.5 },
        label: { show: false },
      },
      backgroundColor: colores.raised,
      borderColor: colores.borderStrong,
      borderWidth: 1,
      textStyle: { color: colores.foreground, fontSize: 12.5, fontFamily: fuente },
      extraCssText: 'border-radius:10px;font-variant-numeric:tabular-nums;white-space:nowrap;box-shadow:0 1px 2px rgb(15 23 42/.1),0 10px 28px -6px rgb(15 23 42/.22);',
      formatter: (parametros: ParametroTooltip | ParametroTooltip[]) => contenidoTooltip(parametros, colores, etiquetas),
    },
    xAxis: {
      type: 'time',
      min: ventana?.desde,
      max: ventana?.hasta,
      axisLine: { lineStyle: { color: colores.border } },
      axisTick: { show: false },
      // Solo filetes verticales muy tenues: el tiempo se lee sin una rejilla encima de la línea.
      splitLine: { show: true, lineStyle: { color: colores.grid, width: 1 } },
      axisLabel: {
        hideOverlap: true,
        margin: 9,
        fontSize: 11,
        fontWeight: NEGRITA_MEDIA,
        color: colores.muted,
        fontFamily: fuente,
        alignMinLabel: 'left',
        alignMaxLabel: 'right',
        formatter: (valor: number) => (variosDias ? diaCorto(valor) : horaCorta(valor)),
      },
    },
    yAxis: {
      type: 'value',
      min: (value: { min: number }) => Math.floor(Math.min(value.min, 0)),
      max: (value: { max: number }) => Math.ceil(Math.max(value.max, 10)),
      splitNumber: 5,
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { show: false },
      axisLabel: { margin: 7, fontSize: 11, fontWeight: NEGRITA_MEDIA, color: colores.muted, fontFamily: fuente, formatter: '{value}°' },
    },
  }
}

/** Banda del rango de referencia 2–8 °C: un velo con sus dos filetes, sin guiones ni rótulos repetidos. */
function marcasRango(colores: ColoresGrafica, etiquetas: EtiquetasCurvaTermica) {
  return {
    markArea: {
      silent: true,
      itemStyle: { color: colores.safe, opacity: 0.09 },
      label: {
        show: true,
        position: 'insideTopLeft',
        distance: 6,
        color: colores.safeText,
        fontSize: 10.5,
        fontWeight: NEGRITA_MEDIA,
        fontFamily: FUENTE_GRAFICA,
        formatter: etiquetas.rangoEsperado,
      },
      data: [[{ yAxis: RANGO_TERMICO.minimo }, { yAxis: RANGO_TERMICO.maximo }]],
    },
    markLine: {
      silent: true,
      symbol: 'none',
      lineStyle: { color: colores.safe, type: 'solid', width: 1, opacity: 0.32 },
      label: { show: false },
      data: [{ yAxis: RANGO_TERMICO.minimo }, { yAxis: RANGO_TERMICO.maximo }],
    },
  }
}

/** A la izquierda: la derecha es de «Ahora» y de la cifra de la última lectura. */
function leyenda(colores: ColoresGrafica, extra: Record<string, unknown>) {
  return {
    top: 0,
    left: MARGEN_IZQUIERDO,
    padding: 0,
    icon: 'roundRect',
    itemWidth: 12,
    itemHeight: 2,
    itemGap: 14,
    inactiveBorderWidth: 0,
    itemStyle: { borderWidth: 0 },
    textStyle: { color: colores.muted, fontSize: 11.5, fontWeight: NEGRITA_MEDIA, fontFamily: FUENTE_GRAFICA },
    ...extra,
  }
}

/** Con varios días, miles de lecturas en pocos píxeles: una línea más fina deja ver la forma. */
const grosorDeLinea = (lapso: number) => (lapso > 3 * 24 * 60 * 60 * 1000 ? 1.5 : 2)

/** El punto de la línea que se ilumina al pasar por ella: no se dibuja ninguno más. */
function puntoAlPasar(color: string, colores: ColoresGrafica) {
  return {
    symbol: 'circle',
    symbolSize: 8,
    showSymbol: false,
    itemStyle: { color, borderColor: colores.surface, borderWidth: 2 },
    // Sin engrosar la línea al pasar: repintarla entera por cada movimiento no aporta nada.
    emphasis: { scale: false, focus: 'none' },
  }
}

/** La línea es roja solo donde sale de 2–8 °C: el color dice lo mismo que en el resto del panel. */
function rojoFueraDeRango(colores: ColoresGrafica, serie: number, color: string) {
  return {
    show: false,
    type: 'piecewise',
    seriesIndex: serie,
    dimension: 1,
    pieces: [{ gte: RANGO_TERMICO.minimo, lte: RANGO_TERMICO.maximo, color }],
    outOfRange: { color: colores.criticalSolid },
  }
}

/** Un token hexadecimal con transparencia; otro formato de color se queda como está. */
const conAlfa = (color: string, alfa: string) => (/^#[0-9a-f]{6}$/i.test(color) ? `${color}${alfa}` : color)

/** Una excursión: punto rojo con halo, y su rótulo si cabe. */
function marcaExcursion(colores: ColoresGrafica, nombre: string, ms: number, temperatura: number, rotulo?: { texto: string; alinear: string }) {
  return {
    name: nombre,
    coord: [ms, temperatura],
    symbolSize: 9,
    // El borde translúcido es el halo: un solo elemento que dibujar.
    itemStyle: { color: colores.criticalSolid, borderColor: conAlfa(colores.criticalSolid, '40'), borderWidth: 6 },
    label: rotulo
      ? {
          show: true,
          position: 'top',
          distance: 9,
          align: rotulo.alinear,
          color: colores.critical,
          fontSize: 10.5,
          fontWeight: 600,
          fontFamily: FUENTE_GRAFICA,
          backgroundColor: colores.surface,
          borderRadius: 5,
          padding: [2, 4],
          formatter: rotulo.texto,
        }
      : { show: false },
  }
}

const marcadores = (data: unknown[]) => ({ symbol: 'circle', silent: true, tooltip: { show: false }, data })

/** Lapso cubierto, recorriendo a mano: con miles de lecturas, `Math.max(...x)` puede desbordar la pila. */
function lapsoDe(serie: LecturaTermica[]) {
  let min = Infinity
  let max = -Infinity
  for (const lectura of serie) {
    const ms = marcaDe(lectura)
    if (!Number.isFinite(ms)) continue
    if (ms < min) min = ms
    if (ms > max) max = ms
  }
  return max > min ? max - min : 0
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
  ventana?: Ventana,
  tema?: TemaGrafica,
): EChartsCoreOption {
  const visible = ventana ? serie.filter((l) => marcaDe(l) >= ventana.desde) : serie
  // Con más de tres equipos la leyenda de un teléfono ocupa dos líneas: la gráfica les deja sitio.
  const arriba = equipos.length > 3 ? 50 : 30
  const lapso = ventana ? ventana.hasta - ventana.desde : lapsoDe(visible)
  const grosor = grosorDeLinea(lapso)
  return {
    ...baseCurva(colores, etiquetas, ventana, lapso, arriba),
    visualMap: equipos.map((_, indice) => rojoFueraDeRango(colores, indice, colores.equipos[indice % colores.equipos.length])),
    legend: leyenda(colores, { data: equipos, inactiveColor: colorInactivo(tema) }),
    series: equipos.map((equipo, indice) => {
      const propias = visible.filter((l) => l.device_id === equipo)
      const umbral = umbralHueco(propias)
      const color = colores.equipos[indice % colores.equipos.length]
      return {
        name: equipo,
        type: 'line',
        smooth: false,
        connectNulls: false,
        sampling: 'lttb',
        data: puntos(propias, (l) => l.temperatura_interna, umbral),
        lineStyle: { width: grosor, cap: 'round', join: 'round' },
        ...puntoAlPasar(color, colores),
        ...(indice === 0 ? marcasRango(colores, etiquetas) : {}),
        markPoint: marcadores(
          episodiosDeExcursion(propias, umbral)
            .filter((e) => !e.recortado)
            .slice(-MAX_MARCADORES_EPISODIO)
            .map((e) => marcaExcursion(colores, etiquetas.excursion, e.inicio, e.temperaturaInicio)),
        ),
      }
    }),
  }
}

/*
 * El monitoreo avisa cada 15 s de que la ventana avanzó, pero en 24 h eso es menos de un píxel. Se
 * guarda la última opción de cada serie: si los datos son los mismos y el eje no se movió de forma
 * visible, se devuelve el mismo objeto y la gráfica no repinta nada.
 */
const PASOS_DE_EJE = 1600
const RECUERDO = new WeakMap<LecturaTermica[], { clave: string; opcion: EChartsCoreOption }>()

function claveDeOpcion(etiquetas: EtiquetasCurvaTermica, ventana: Ventana | undefined, tema: TemaGrafica | undefined) {
  const eje = ventana
    ? (() => {
        const paso = Math.max(1, (ventana.hasta - ventana.desde) / PASOS_DE_EJE)
        return `${Math.floor(ventana.desde / paso)}:${Math.floor(ventana.hasta / paso)}`
      })()
    : ''
  return `${localeActual()}|${tema ?? ''}|${eje}|${JSON.stringify(etiquetas)}`
}

/**
 * Curva térmica compartida por el dashboard (ventana en vivo que termina en
 * «ahora»), el historial y los reportes (rango de la consulta).
 *
 * - Eje temporal real: el espaciado refleja el tiempo, no el número de
 *   lecturas, y con `ventana` el borde derecho es el momento actual.
 * - Segmentos rectos entre muestras reales (DESIGN.md) y cortes en los huecos.
 * - Una excursión confirmada se muestra como franja por episodio con un único
 *   marcador al inicio, en lugar de un círculo por lectura. La línea cambia a
 *   rojo fuera de 2–8 °C.
 * - Con `ventana`, la última lectura lleva su punto y su cifra.
 */
export function construirOpcionCurvaTermica(
  serie: LecturaTermica[],
  etiquetas: EtiquetasCurvaTermica,
  ventana?: Ventana,
  tema?: TemaGrafica,
): EChartsCoreOption {
  const clave = claveDeOpcion(etiquetas, ventana, tema)
  const previa = RECUERDO.get(serie)
  if (previa?.clave === clave) return previa.opcion
  const opcion = armarOpcion(serie, etiquetas, ventana, tema)
  RECUERDO.set(serie, { clave, opcion })
  return opcion
}

function armarOpcion(
  serie: LecturaTermica[],
  etiquetas: EtiquetasCurvaTermica,
  ventana?: Ventana,
  tema?: TemaGrafica,
): EChartsCoreOption {
  const colores = temaGrafica(tema)
  // Ordenados: el mismo equipo lleva el mismo color en todas las pantallas y consultas.
  const equipos = [...new Set(serie.map((l) => l.device_id).filter(Boolean))].sort()
  if (equipos.length > 1) return construirCurvaPorEquipo(serie, equipos, etiquetas, colores, ventana, tema)
  const umbral = umbralHueco(serie)
  const visible = ventana ? serie.filter((l) => marcaDe(l) >= ventana.desde) : serie
  // Los episodios se buscan en toda la serie: uno que empezó antes de la
  // ventana sigue siendo el mismo episodio, no uno nuevo en el borde izquierdo.
  const episodios = episodiosDeExcursion(serie, umbral)
    .filter((e) => !ventana || e.fin >= ventana.desde)
    .map((e) => (ventana && e.inicio < ventana.desde ? { ...e, inicio: ventana.desde, recortado: true } : e))
  const huecos = huecosSinDatos(visible, umbral)
  // Un episodio que sigue abierto llega hasta la última lectura; con
  // `ventana` se extiende a «ahora» solo si esa lectura es reciente.
  const ultimaMs = visible.length > 0 ? marcaDe(visible[visible.length - 1]) : null
  const finEpisodio = (e: Episodio) =>
    ventana && e.fin === ultimaMs && ventana.hasta - e.fin < umbral ? ventana.hasta : e.fin
  const primeraMs = visible.length > 0 ? marcaDe(visible[0]) : 0
  const lapsoVisible = ventana ? ventana.hasta - ventana.desde : (ultimaMs ?? 0) - primeraMs
  const huecoConEtiqueta = ([inicio, fin]: [number, number]) =>
    lapsoVisible > 0 && (fin - inicio) / lapsoVisible >= FRACCION_MINIMA_ETIQUETA_HUECO
  const fuente = FUENTE_GRAFICA
  const inicioEje = ventana ? ventana.desde : primeraMs

  // La última lectura dentro de la ventana, con su cifra: es lo primero que se busca en una curva en vivo.
  const ultimaValida = ventana
    ? [...visible].reverse().find((l) => typeof l.temperatura_interna === 'number' && Number.isFinite(l.temperatura_interna))
    : undefined
  const puntoUltima = ultimaValida && {
    name: etiquetas.interna,
    coord: [marcaDe(ultimaValida), ultimaValida.temperatura_interna],
    symbolSize: 9,
    itemStyle: {
      color: fueraDeRango(ultimaValida.temperatura_interna as number) ? colores.criticalSolid : colores.primary,
      borderColor: colores.surface,
      borderWidth: 2,
    },
    label: {
      show: true,
      position: 'top',
      distance: 8,
      align: 'right',
      color: fueraDeRango(ultimaValida.temperatura_interna as number) ? colores.critical : colores.foreground,
      fontSize: 12.5,
      fontWeight: 600,
      fontFamily: fuente,
      // Sobre la propia línea: con fondo se lee aunque la curva pase por detrás.
      backgroundColor: colores.surface,
      borderRadius: 6,
      padding: [2, 5],
      formatter: `${(ultimaValida.temperatura_interna as number).toFixed(1)} °C`,
    },
  }

  // Rótulos de excursión de la más reciente hacia atrás, solo si no se pisan entre sí ni con la cifra.
  const conRotulo = new Set<number>()
  const inicios = episodios.filter((e) => !e.recortado).slice(-MAX_MARCADORES_EPISODIO)
  const pisaLaCifra = (e: Episodio) =>
    ultimaValida !== undefined &&
    (marcaDe(ultimaValida) - e.inicio) / Math.max(1, lapsoVisible) < SEPARACION_ROTULOS &&
    Math.abs((ultimaValida.temperatura_interna as number) - e.temperaturaInicio) < CERCANIA_CIFRA_GRADOS
  let referencia = Infinity
  for (let i = inicios.length - 1; i >= 0 && conRotulo.size < MAX_ROTULOS_EXCURSION; i--) {
    const e = inicios[i]
    if (lapsoVisible > 0 && referencia - e.inicio >= lapsoVisible * SEPARACION_ROTULOS && !pisaLaCifra(e)) {
      conRotulo.add(e.inicio)
      referencia = e.inicio
    }
  }
  const alineacion = (ms: number) => {
    const fraccion = lapsoVisible > 0 ? (ms - inicioEje) / lapsoVisible : 0.5
    return fraccion < 0.2 ? 'left' : fraccion > 0.8 ? 'right' : 'center'
  }

  return {
    ...baseCurva(colores, etiquetas, ventana, lapsoVisible, 30),
    visualMap: rojoFueraDeRango(colores, 0, colores.primary),
    legend: leyenda(colores, {
      data: [etiquetas.interna, etiquetas.ambiental],
      inactiveColor: colorInactivo(tema),
      selected: { [etiquetas.ambiental]: false },
      formatter: etiquetaCortaTemperatura,
    }),
    series: [
      {
        name: etiquetas.interna,
        type: 'line',
        smooth: false,
        connectNulls: false,
        // HU-31 criterio 3: LTTB conserva picos y caídas al muestrear ventanas largas.
        sampling: 'lttb',
        z: 3,
        data: puntos(visible, (l) => l.temperatura_interna, umbral),
        // Sin `color` aquí: un color fijo en `lineStyle` anula el rojo de `visualMap`.
        lineStyle: { width: grosorDeLinea(lapsoVisible), cap: 'round', join: 'round' },
        ...puntoAlPasar(colores.primary, colores),
        ...marcasRango(colores, etiquetas),
        markPoint: marcadores([
          ...inicios.map((e) =>
            marcaExcursion(
              colores,
              etiquetas.excursion,
              e.inicio,
              e.temperaturaInicio,
              conRotulo.has(e.inicio) ? { texto: `${etiquetas.excursion} · ${horaCorta(e.inicio)}`, alinear: alineacion(e.inicio) } : undefined,
            ),
          ),
          ...(puntoUltima ? [puntoUltima] : []),
        ]),
      },
      {
        name: etiquetas.ambiental,
        type: 'line',
        smooth: false,
        connectNulls: false,
        sampling: 'lttb',
        data: puntos(visible, (l) => l.temperatura_ambiental, umbral),
        lineStyle: { width: 1.5, color: colores.secondary, type: [4, 4] },
        ...puntoAlPasar(colores.secondary, colores),
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
                itemStyle: { color: colores.criticalSolid, opacity: 0.07 },
                label: { show: false },
              },
              { xAxis: finEpisodio(e) },
            ]),
            ...huecos.map(([inicio, fin]) => [
              {
                xAxis: inicio,
                itemStyle: { color: colores.muted, opacity: 0.08 },
                label: {
                  show: huecoConEtiqueta([inicio, fin]),
                  position: 'insideBottom',
                  color: colores.muted,
                  fontSize: 10.5,
                  fontWeight: NEGRITA_MEDIA,
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
              lineStyle: { color: colores.muted, type: 'solid', width: 1, opacity: 0.4 },
              // Sin `opacity` propia, el rótulo hereda la del filete y casi no se lee.
              label: { position: 'end', align: 'right', distance: 4, opacity: 1, color: colores.muted, fontSize: 10.5, fontWeight: NEGRITA_MEDIA, fontFamily: fuente, formatter: etiquetas.ahora },
              data: [{ xAxis: ventana.hasta }],
            }
          : undefined,
      },
    ],
  }
}

function etiquetaCortaTemperatura(nombre: string): string {
  const corta = nombre
    .replace(/^temperatura\s+(del?\s+)?/i, '')
    .replace(/\s+temperature$/i, '')
  return corta.charAt(0).toUpperCase() + corta.slice(1)
}
