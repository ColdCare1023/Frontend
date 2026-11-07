import type { EChartsCoreOption } from 'echarts/core'

import type { LecturaTermica } from '@/domain/entities/LecturaTermica'
import { colorToken } from '@/infrastructure/charts/temaColdCare'
import { duracionBreve, localeActual } from '@/lib/formato'

/** Lo que se comenta sobre la línea del día. Todo sale de las lecturas: nada se inventa ni se estima. */
export interface Anotacion {
  ms: number
  valor: number
  clave: 'dashboard.anotacionMaxima' | 'dashboard.anotacionMinima' | 'dashboard.anotacionPuerta'
  opciones: Record<string, string>
  debajo?: boolean
}

// Dos rótulos más cerca que esto, en fracción del ancho y en grados, se pisarían.
const SEPARACION_ANCHO = 0.2
const SEPARACION_ANCHO_MOVIL = 0.42
const SEPARACION_GRADOS = 1.4
const MAX_PUERTAS = 2

const horaDe = (ms: number, conDia: boolean) =>
  new Intl.DateTimeFormat(localeActual(), {
    ...(conDia ? { day: 'numeric', month: 'short' } : {}),
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(ms)

/** Aperturas largas de la ventana: cada racha seguida de lecturas con la puerta abierta cuenta una vez. */
function aperturasLargas(medidas: Array<{ lectura: LecturaTermica; ms: number; valor: number }>) {
  const rachas: Array<{ ms: number; valor: number; segundos: number }> = []
  let actual: (typeof rachas)[number] | null = null
  for (const { lectura, ms, valor } of medidas) {
    if (lectura.apertura_refrigerador !== true) {
      actual = null
      continue
    }
    const segundos = lectura.apertura_continua_segundos ?? lectura.duracion_apertura_segundos ?? 0
    if (actual) {
      actual.segundos = Math.max(actual.segundos, segundos)
    } else {
      actual = { ms, valor, segundos }
      rachas.push(actual)
    }
  }
  const umbral = medidas.at(-1)?.lectura.umbral_puerta_abierta_segundos ?? 120
  return rachas
    .filter((racha) => racha.segundos >= umbral)
    .sort((a, b) => b.segundos - a.segundos)
    .slice(0, MAX_PUERTAS)
}

export function anotacionesDelDia(
  serie: LecturaTermica[],
  ventana: { desde: number; hasta: number },
  compacto: boolean,
): Anotacion[] {
  const medidas = serie
    .map((lectura) => ({ lectura, ms: Date.parse(lectura.timestamp), valor: lectura.temperatura_interna as number }))
    .filter(({ ms, valor }) => valor != null && Number.isFinite(valor) && ms >= ventana.desde)
  if (medidas.length < 2) return []
  // Con varios equipos mezclados, una máxima no diría de cuál es.
  if (new Set(medidas.map(({ lectura }) => lectura.device_id)).size > 1) return []

  const conDia = ventana.hasta - ventana.desde > 36 * 60 * 60 * 1000
  const maxima = medidas.reduce((a, b) => (b.valor > a.valor ? b : a))
  const minima = medidas.reduce((a, b) => (b.valor < a.valor ? b : a))
  const candidatas: Anotacion[] = []
  // Una excursión ya lleva su propio rótulo en la gráfica.
  if (!maxima.lectura.excursion_confirmada) {
    candidatas.push({
      ms: maxima.ms,
      valor: maxima.valor,
      clave: 'dashboard.anotacionMaxima',
      opciones: { valor: maxima.valor.toFixed(1), hora: horaDe(maxima.ms, conDia) },
    })
  }
  for (const racha of aperturasLargas(medidas)) {
    candidatas.push({
      ms: racha.ms,
      valor: racha.valor,
      clave: 'dashboard.anotacionPuerta',
      opciones: { duracion: duracionBreve(racha.segundos), hora: horaDe(racha.ms, conDia) },
    })
  }
  candidatas.push({
    ms: minima.ms,
    valor: minima.valor,
    clave: 'dashboard.anotacionMinima',
    opciones: { valor: minima.valor.toFixed(1), hora: horaDe(minima.ms, conDia) },
    debajo: true,
  })

  const lapso = ventana.hasta - ventana.desde
  const separacion = compacto ? SEPARACION_ANCHO_MOVIL : SEPARACION_ANCHO
  const elegidas: Anotacion[] = []
  for (const candidata of candidatas) {
    const pisa = elegidas.some(
      (otra) =>
        Math.abs(otra.ms - candidata.ms) / lapso < separacion &&
        (Boolean(otra.debajo) === Boolean(candidata.debajo) || Math.abs(otra.valor - candidata.valor) < SEPARACION_GRADOS),
    )
    if (!pisa) elegidas.push(candidata)
  }
  return elegidas
}

/**
 * Suma las anotaciones a la curva sin tocar cómo se construye: una serie más, vacía, que solo lleva
 * los puntos rosados de la línea del día de la landing. La rejilla se fija aquí para que la tira de
 * abajo quede alineada con el eje.
 */
export function conAnotaciones(
  base: EChartsCoreOption,
  anotaciones: Array<Anotacion & { texto: string }>,
  ventana: { desde: number; hasta: number },
): EChartsCoreOption {
  const rosa = colorToken('accent', '#ff7aa2')
  const fondo = colorToken('background', '#f4f7fb')
  const tinta = colorToken('foreground', '#0f172a')
  const lapso = ventana.hasta - ventana.desde
  const serie = {
    name: '__anotaciones',
    type: 'line',
    data: [],
    silent: true,
    tooltip: { show: false },
    markPoint: {
      silent: true,
      animation: false,
      symbol: 'circle',
      symbolSize: 10,
      itemStyle: { color: rosa, borderColor: fondo, borderWidth: 2 },
      tooltip: { show: false },
      data: anotaciones.map((anotacion) => {
        const fraccion = (anotacion.ms - ventana.desde) / lapso
        return {
          name: anotacion.clave,
          coord: [anotacion.ms, anotacion.valor],
          label: {
            show: true,
            position: anotacion.debajo ? 'bottom' : 'top',
            distance: 8,
            align: fraccion > 0.84 ? 'right' : fraccion < 0.16 ? 'left' : 'center',
            formatter: anotacion.texto,
            color: tinta,
            // Una pastilla del color del fondo: el rótulo tapa la línea que cruza y se lee entero.
            backgroundColor: fondo,
            padding: [3, 6],
            borderRadius: 6,
            fontSize: 11.5,
            fontWeight: 600,
            fontFamily: '"Inter Variable", Inter, system-ui, sans-serif',
          },
        }
      }),
    },
  }
  const original = base as { series?: unknown[]; grid?: Record<string, unknown> }
  return {
    ...base,
    grid: { ...original.grid, left: 32, right: 14 },
    series: [...(original.series ?? []), serie],
  }
}
