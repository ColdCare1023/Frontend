import type { BucketSerie, SerieTermica } from '@/domain/entities/SerieTermica'
import { claveDia } from './agruparPorDia'
import type { BrechaEquipo, ExcursionEquipo, ResumenDia, ResumenEquipo, ResumenPeriodo } from './resumenTermico'

/**
 * HU-36: resúmenes del Historial a partir de la serie agregada del backend
 * (`GET /api/lecturas/serie`), que cubre el periodo COMPLETO. Antes salían de
 * las 200 lecturas cargadas: unos 33 minutos de datos reales a 10 s.
 *
 * Las cifras (lecturas, mínima, máxima, fuera de rango) son exactas porque
 * vienen de agregados SQL. Las excursiones se agrupan en episodios con la
 * resolución del intervalo de la serie: intervalos consecutivos con alguna
 * lectura en excursión confirmada, sin una brecha entre ellos.
 */

const ms = (iso: string) => Date.parse(iso)

/** ¿Hay una brecha de la serie entre los instantes `a` y `b`? */
function brechaEntre(serie: SerieTermica, a: number, b: number): boolean {
  return serie.brechas.some((brecha) => ms(brecha.desde) < b && ms(brecha.hasta) > a)
}

/** Valor extremo de un intervalo en excursión: el que sale del rango. */
function extremo(bucket: BucketSerie): number | null {
  const { min, max } = bucket.temperatura_interna
  if (max != null && max > 8) return max
  if (min != null && min < 2) return min
  return max ?? min
}

export interface EpisodioSerie extends ExcursionEquipo {
  /** Temperatura con la que se marca el inicio en la curva. */
  temperaturaInicio: number | null
}

/** Episodios de excursión confirmada de una serie, en orden cronológico. */
export function episodiosDeSerie(serie: SerieTermica): EpisodioSerie[] {
  const episodios: EpisodioSerie[] = []
  let actual: EpisodioSerie | null = null
  let previo: BucketSerie | null = null
  for (const bucket of serie.buckets) {
    const enExcursion = (bucket.excursiones ?? 0) > 0
    const contiguo =
      previo !== null &&
      !brechaEntre(serie, (ms(previo.inicio) + ms(previo.fin)) / 2, (ms(bucket.inicio) + ms(bucket.fin)) / 2)
    if (enExcursion) {
      const valor = extremo(bucket)
      if (actual && contiguo) {
        actual.fin = ms(bucket.fin)
        const max = bucket.temperatura_interna.max
        if (max != null && (actual.pico === null || max > actual.pico)) actual.pico = max
      } else {
        actual = {
          equipo: serie.device_id,
          inicio: ms(bucket.inicio),
          fin: ms(bucket.fin),
          pico: bucket.temperatura_interna.max,
          idInicio: null,
          temperaturaInicio: valor,
        }
        episodios.push(actual)
      }
    } else {
      actual = null
    }
    previo = bucket
  }
  return episodios
}

function pctEnRango(serie: SerieTermica): number | null {
  const n = serie.resumen.temperatura_interna.n
  const fuera = serie.resumen.fuera_de_rango
  if (!n || fuera == null) return null
  return Math.max(0, n - fuera) / n
}

function brechasDeSerie(serie: SerieTermica): BrechaEquipo[] {
  return serie.brechas.map((b) => ({
    equipo: serie.device_id,
    inicio: ms(b.desde),
    fin: ms(b.hasta),
    causa: b.causa,
    perdidas: b.perdidas ?? null,
  }))
}

function resumenEquipo(serie: SerieTermica): ResumenEquipo {
  const { min, max, promedio } = serie.resumen.temperatura_interna
  const brechas = brechasDeSerie(serie)
  const periodo = ms(serie.hasta) - ms(serie.desde)
  const sinDatos = brechas.reduce((suma, b) => suma + (b.fin - b.inicio), 0)
  const ultimo = serie.buckets.at(-1)
  return {
    equipo: serie.device_id,
    ultima: ultimo?.temperatura_interna.promedio ?? null,
    min,
    max,
    promedio,
    pctEnRango: pctEnRango(serie),
    excursiones: episodiosDeSerie(serie),
    brechas,
    fraccionSinDatos: periodo > 0 ? Math.min(1, sinDatos / periodo) : 0,
  }
}

/** Series con lecturas → resumen del periodo y por equipo (mismo contrato que `resumenPeriodo`). */
export function resumenDeSeries(series: readonly SerieTermica[]): ResumenPeriodo {
  const equipos = series
    .filter((s) => s.total_lecturas > 0)
    .map(resumenEquipo)
    .sort((a, b) => a.equipo.localeCompare(b.equipo))
  const mins = equipos.flatMap((e) => (e.min == null ? [] : [e.min]))
  const maxs = equipos.flatMap((e) => (e.max == null ? [] : [e.max]))
  // % en rango del periodo: ponderado por lecturas de todos los equipos.
  let dentro = 0
  let conTemperatura = 0
  for (const s of series) {
    const n = s.resumen.temperatura_interna.n
    if (!n || s.resumen.fuera_de_rango == null) continue
    conTemperatura += n
    dentro += Math.max(0, n - s.resumen.fuera_de_rango)
  }
  return {
    n: series.reduce((suma, s) => suma + s.total_lecturas, 0),
    min: mins.length ? Math.min(...mins) : null,
    max: maxs.length ? Math.max(...maxs) : null,
    pctEnRango: conTemperatura > 0 ? dentro / conTemperatura : null,
    excursiones: equipos.flatMap((e) => e.excursiones).sort((a, b) => b.fin - b.inicio - (a.fin - a.inicio)),
    brechas: equipos.flatMap((e) => e.brechas),
    equipos,
  }
}

/**
 * Cabeceras de día de la tabla paginada: cifras del día COMPLETO según la
 * serie, no solo de la página visible. Con intervalos de hasta 1 h (rangos de
 * hasta ~62 días) y zonas horarias de hora entera, ningún intervalo cruza la
 * medianoche local, así que el conteo por día es exacto.
 */
export function resumenPorDiaDeSeries(series: readonly SerieTermica[]): Map<string, ResumenDia> {
  const mapa = new Map<string, ResumenDia>()
  for (const serie of series) {
    for (const bucket of serie.buckets) {
      const clave = claveDia(bucket.inicio)
      const dia = mapa.get(clave) ?? { n: 0, min: null, max: null, excursiones: 0 }
      dia.n += bucket.lecturas
      const { min, max } = bucket.temperatura_interna
      if (min != null) dia.min = dia.min === null ? min : Math.min(dia.min, min)
      if (max != null) dia.max = dia.max === null ? max : Math.max(dia.max, max)
      mapa.set(clave, dia)
    }
    for (const episodio of episodiosDeSerie(serie)) {
      const clave = claveDia(new Date(episodio.inicio).toISOString())
      const dia = mapa.get(clave)
      if (dia) dia.excursiones += 1
    }
  }
  return mapa
}

/** Lecturas que la serie cuenta pero no dibuja (sin hora de captura o manuales). */
export function lecturasNoDibujadas(series: readonly SerieTermica[]): { sinHora: number; manuales: number } {
  return series.reduce(
    (total, s) => ({ sinHora: total.sinHora + (s.lecturas_sin_hora ?? 0), manuales: total.manuales + (s.lecturas_manuales ?? 0) }),
    { sinHora: 0, manuales: 0 },
  )
}
