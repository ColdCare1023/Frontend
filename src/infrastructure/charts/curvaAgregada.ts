import type { EChartsCoreOption } from 'echarts/core'

import { serieGraficable, type LecturaTermica } from '@/domain/entities/LecturaTermica'
import type { BrechaSerie, EstadisticaMagnitud, SerieTermica } from '@/domain/entities/SerieTermica'
import { RANGO_TERMICO } from '@/domain/value-objects/NivelRiesgo'
import { diaCorto } from '@/lib/formato'
import {
  baseCurva,
  etiquetaCortaTemperatura,
  FRACCION_MINIMA_ETIQUETA_HUECO,
  FUENTE_GRAFICA,
  iconoTrazo,
  leyenda,
  marcasRango,
  MAX_MARCADORES_EPISODIO,
  rellenoSinDatos,
  serieFueraDeRango,
  type EtiquetasCurvaTermica,
  type Punto,
} from './curvaTermica'
import { temaGrafica, type TemaGrafica } from './temaColdCare'

/**
 * HU-31: curva del dashboard a partir de la serie agregada del backend
 * (`GET /api/lecturas/serie`). Cubre la ventana completa (24 h o 7 d) sin el
 * tope de lecturas crudas que la recortaba a unas 14 h a 10 s por lectura.
 *
 * - La línea es el promedio de cada intervalo y la franja sombreada, su
 *   mínimo y su máximo: un pico breve no se pierde al promediar (esc. 3).
 * - Los tramos sin datos son las brechas que calcula el backend, con su causa
 *   («sin datos» o buffer lleno, HU-48), no una deducción por cadencia.
 * - Las lecturas en vivo posteriores a la serie se añaden como puntos sueltos.
 */
export interface EtiquetasCurvaAgregada extends EtiquetasCurvaTermica {
  /** Rótulo de una brecha por buffer LittleFS lleno (HU-48 esc. 2). */
  bufferAgotado: string
}

/** Un intervalo de la serie o una lectura en vivo posterior a ella. */
export interface PuntoCurva {
  /** Centro del intervalo (o instante de la lectura), en ms. */
  x: number
  inicio: number
  fin: number
  lecturas: number
  interna: EstadisticaMagnitud
  ambiental: EstadisticaMagnitud
  humedad: EstadisticaMagnitud
  /** Lecturas con excursión confirmada (HU-21). */
  excursiones: number
  /** Solo en un punto en vivo: la lectura cruda. */
  lectura?: LecturaTermica
}

/** Desde este lapso el eje rotula días en lugar de horas. */
const MULTIDIA_MS = 36 * 3_600_000

const VACIA: EstadisticaMagnitud = { min: null, max: null, promedio: null, n: 0 }

const finito = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

function deValor(valor: number | null | undefined): EstadisticaMagnitud {
  return finito(valor) ? { min: valor, max: valor, promedio: valor, n: 1 } : VACIA
}

/** Intervalos de la serie y lecturas en vivo posteriores a su `hasta`, en orden. */
export function puntosCurvaAgregada(serie: SerieTermica, enVivo: readonly LecturaTermica[] = []): PuntoCurva[] {
  const desdeMs = Date.parse(serie.desde)
  const hastaMs = Date.parse(serie.hasta)
  const puntos: PuntoCurva[] = serie.buckets.map((bucket) => {
    const inicio = Date.parse(bucket.inicio)
    const fin = Date.parse(bucket.fin)
    // Los intervalos van alineados a la época: el primero y el último pueden
    // salirse del periodo. Su punto se queda dentro (el último no cae en el
    // futuro, después de las lecturas en vivo).
    return {
      x: Math.min(Math.max(inicio + (fin - inicio) / 2, desdeMs), hastaMs),
      inicio,
      fin,
      lecturas: bucket.lecturas,
      interna: bucket.temperatura_interna ?? VACIA,
      ambiental: bucket.temperatura_ambiental ?? VACIA,
      humedad: bucket.humedad_ambiental ?? VACIA,
      excursiones: bucket.excursiones ?? 0,
    }
  })
  for (const lectura of serieGraficable([...enVivo])) {
    const ms = Date.parse(lectura.timestamp)
    if (!(ms > hastaMs)) continue
    puntos.push({
      x: ms,
      inicio: ms,
      fin: ms,
      lecturas: 1,
      interna: deValor(lectura.temperatura_interna),
      ambiental: deValor(lectura.temperatura_ambiental),
      humedad: deValor(lectura.humedad_ambiental),
      excursiones: lectura.excursion_confirmada ? 1 : 0,
      lectura,
    })
  }
  return puntos.filter((p) => Number.isFinite(p.x)).sort((a, b) => a.x - b.x)
}

function tramosBrecha(brechas: readonly BrechaSerie[]): Array<{ desde: number; hasta: number; causa: BrechaSerie['causa'] }> {
  return brechas
    .map((b) => ({ desde: Date.parse(b.desde), hasta: Date.parse(b.hasta), causa: b.causa }))
    .filter((b) => Number.isFinite(b.desde) && Number.isFinite(b.hasta) && b.hasta > b.desde)
}

/**
 * Entre dos puntos la línea se corta si entre ambos no hubo datos por más
 * del umbral de silencio del nodo, o si una brecha del backend ocupa al
 * menos la mitad del segmento. Una brecha breve dentro de un intervalo largo
 * (7 d en intervalos de 10 min) se sombrea pero no parte la línea.
 */
export function hayCorte(
  a: PuntoCurva,
  b: PuntoCurva,
  umbralMs: number,
  brechas: ReadonlyArray<{ desde: number; hasta: number }>,
): boolean {
  if (b.inicio - a.fin >= umbralMs) return true
  const segmento = b.x - a.x
  return brechas.some((g) => g.desde < b.x && g.hasta > a.x && g.hasta - g.desde >= segmento / 2)
}

interface EpisodioAgregado {
  inicio: number
  fin: number
  x: number
  temperatura: number
  recortado: boolean
}

/** Valor que marca el inicio de una excursión: el extremo que salió de 2–8 °C. */
function extremoFuera(p: PuntoCurva): number | null {
  const { min, max, promedio } = p.interna
  if (finito(max) && max > RANGO_TERMICO.maximo) return max
  if (finito(min) && min < RANGO_TERMICO.minimo) return min
  return finito(promedio) ? promedio : null
}

/** Intervalos consecutivos (sin corte) con alguna excursión confirmada. */
export function episodiosAgregados(puntos: readonly PuntoCurva[], cortes: readonly boolean[]): EpisodioAgregado[] {
  const episodios: EpisodioAgregado[] = []
  let actual: EpisodioAgregado | null = null
  puntos.forEach((p, i) => {
    if (p.excursiones > 0) {
      if (actual && !cortes[i]) {
        actual.fin = p.fin
      } else {
        actual = { inicio: p.inicio, fin: p.fin, x: p.x, temperatura: extremoFuera(p) ?? 0, recortado: i === 0 }
        episodios.push(actual)
      }
    } else {
      actual = null
    }
  })
  return episodios
}

/** Construye la opción de ECharts de la curva agregada. */
export function construirOpcionCurvaAgregada(
  puntos: readonly PuntoCurva[],
  serie: Pick<SerieTermica, 'brechas' | 'umbral_brecha_segundos' | 'bucket_segundos'>,
  etiquetas: EtiquetasCurvaAgregada,
  ventana: { desde: number; hasta: number },
  tema?: TemaGrafica,
): EChartsCoreOption {
  const colores = temaGrafica(tema)
  const brechas = tramosBrecha(serie.brechas).filter((b) => b.hasta >= ventana.desde && b.desde <= ventana.hasta)
  const umbralMs = Math.max(serie.umbral_brecha_segundos, 1) * 1000
  const cortes = puntos.map((p, i) => i > 0 && hayCorte(puntos[i - 1], p, umbralMs, brechas))

  const promedio: Punto[] = []
  const minimo: Punto[] = []
  const amplitud: Punto[] = []
  const maximo: Punto[] = []
  const ambiental: Punto[] = []
  puntos.forEach((p, i) => {
    if (cortes[i]) {
      // Un `null` en la misma posición de todas las series: la franja apilada
      // se corta junto con la línea.
      const x = puntos[i - 1].x + 1
      for (const datos of [promedio, minimo, amplitud, maximo, ambiental]) datos.push([x, null])
    }
    const { min, max, promedio: prom } = p.interna
    promedio.push([p.x, finito(prom) ? prom : null])
    const conRango = finito(min) && finito(max)
    minimo.push([p.x, conRango ? min : null])
    amplitud.push([p.x, conRango ? max - min : null])
    maximo.push([p.x, conRango ? max : null])
    ambiental.push([p.x, finito(p.ambiental.promedio) ? p.ambiental.promedio : null])
  })

  const episodios = episodiosAgregados(puntos, cortes)
  const ultimo = puntos.at(-1)
  // Un episodio en curso en el último punto llega a «ahora» si es reciente.
  const finEpisodio = (e: EpisodioAgregado) =>
    ultimo && e.fin === ultimo.fin && ventana.hasta - e.fin < umbralMs ? ventana.hasta : e.fin
  const lapso = ventana.hasta - ventana.desde
  const conEtiqueta = (desde: number, hasta: number) => lapso > 0 && (hasta - desde) / lapso >= FRACCION_MINIMA_ETIQUETA_HUECO
  const trama = brechas.length > 0 ? rellenoSinDatos(colores) : colores.nodata
  const fuente = FUENTE_GRAFICA
  const nombre = etiquetas.interna
  const base = { type: 'line', smooth: false, symbol: 'none', showSymbol: false, connectNulls: false }
  // Mín. y máx. del intervalo como franja (apilada sobre el mínimo), con el
  // mismo nombre que la línea: la leyenda las muestra y oculta juntas.
  const franja = { ...base, name: nombre, stack: '__envolvente', silent: true, tooltip: { show: false }, emphasis: { disabled: true } }

  const ejes = baseCurva(colores, ventana)
  // En ventanas de varios días la hora sola («12:00 a. m.» repetido) no dice
  // de qué día es cada marca: se rotula el día.
  const xAxis =
    lapso > MULTIDIA_MS
      ? { ...ejes.xAxis, axisLabel: { ...ejes.xAxis.axisLabel, formatter: (valor: number) => diaCorto(new Date(valor).toISOString()) } }
      : ejes.xAxis

  return {
    ...ejes,
    xAxis,
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
        ...base,
        name: nombre,
        data: promedio,
        z: 2,
        lineStyle: { width: 1.75, color: colores.primary },
        itemStyle: { color: colores.primary },
        ...marcasRango(colores, etiquetas),
        markPoint: {
          symbol: 'circle',
          symbolSize: 9,
          itemStyle: { color: colores.critical, borderColor: colores.surface, borderWidth: 2 },
          label: { show: false },
          tooltip: { show: false },
          data: episodios
            .filter((e) => !e.recortado && e.inicio >= ventana.desde)
            .slice(-MAX_MARCADORES_EPISODIO)
            .map((e) => ({ name: etiquetas.excursion, coord: [e.x, e.temperatura] })),
        },
      },
      { ...franja, data: minimo, lineStyle: { opacity: 0 }, itemStyle: { color: colores.primary } },
      {
        ...franja,
        data: amplitud,
        lineStyle: { opacity: 0 },
        itemStyle: { color: colores.primary },
        areaStyle: { color: colores.primary, opacity: 0.12 },
      },
      {
        ...base,
        name: etiquetas.ambiental,
        data: ambiental,
        lineStyle: { width: 1.5, color: colores.secondary, type: 'dashed' },
        itemStyle: { color: colores.secondary },
      },
      // Lo que sale de 2–8 °C, en carmesí: el promedio y los extremos del intervalo.
      ...serieFueraDeRango(nombre, promedio, colores),
      ...serieFueraDeRango(nombre, maximo, colores),
      ...serieFueraDeRango(nombre, minimo, colores),
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
              { xAxis: Math.max(e.inicio, ventana.desde), itemStyle: { color: colores.critical, opacity: 0.07 }, label: { show: false } },
              { xAxis: finEpisodio(e) },
            ]),
            ...brechas.map((b) => [
              {
                xAxis: Math.max(b.desde, ventana.desde),
                // Sin datos: acero con trama, nunca un riesgo (HU-54).
                itemStyle: { color: trama, opacity: 1 },
                label: {
                  show: conEtiqueta(b.desde, b.hasta),
                  position: 'insideBottom',
                  color: colores.nodataTexto,
                  fontSize: 11,
                  fontFamily: fuente,
                  formatter: b.causa === 'buffer_agotado' ? etiquetas.bufferAgotado : etiquetas.sinDatos,
                },
              },
              { xAxis: Math.min(b.hasta, ventana.hasta) },
            ]),
          ],
        },
        markLine: {
          silent: true,
          symbol: 'none',
          lineStyle: { color: colores.muted, type: 'solid', width: 1, opacity: 0.5 },
          label: { position: 'end', color: colores.muted, fontSize: 11, fontFamily: fuente, formatter: etiquetas.ahora },
          data: [{ xAxis: ventana.hasta }],
        },
      },
    ],
  }
}
