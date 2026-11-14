import type { LecturaTermica } from '@/domain/entities/LecturaTermica'
import { estaEnRango } from '@/domain/value-objects/NivelRiesgo'
import { episodiosDeExcursion, huecosSinDatos, umbralHueco } from '@/infrastructure/charts/curvaTermica'
import { claveDia } from './agruparPorDia'

/**
 * Resúmenes del Historial calculados solo con las lecturas ya cargadas: no
 * hay petición nueva. «Sin datos» no es riesgo: las brechas no cuentan ni
 * dentro ni fuera de rango (DIRECTION §2.5).
 */

export interface ExcursionEquipo {
  equipo: string
  inicio: number
  fin: number
  /** Temperatura máxima del episodio. */
  pico: number | null
  /** Id de la primera lectura del episodio (para llevar a su fila). */
  idInicio: string | null
}

export interface BrechaEquipo {
  equipo: string
  inicio: number
  fin: number
}

export interface ResumenEquipo {
  equipo: string
  ultima: number | null
  min: number | null
  max: number | null
  promedio: number | null
  /** 0–1, ponderado por tiempo; `null` sin tramos medibles. */
  pctEnRango: number | null
  excursiones: ExcursionEquipo[]
  brechas: BrechaEquipo[]
  /** Proporción del periodo sin datos (0–1). */
  fraccionSinDatos: number
}

export interface ResumenPeriodo {
  n: number
  min: number | null
  max: number | null
  pctEnRango: number | null
  excursiones: ExcursionEquipo[]
  brechas: BrechaEquipo[]
  equipos: ResumenEquipo[]
}

function extremos(temperaturas: number[]) {
  if (temperaturas.length === 0) return { min: null, max: null, promedio: null }
  let min = Infinity
  let max = -Infinity
  let suma = 0
  for (const t of temperaturas) {
    if (t < min) min = t
    if (t > max) max = t
    suma += t
  }
  return { min, max, promedio: suma / temperaturas.length }
}

/**
 * % en rango ponderado por tiempo sobre una serie ascendente de un equipo:
 * cada tramo entre lecturas consecutivas cuenta con el estado de la lectura
 * anterior; los tramos más largos que el umbral de hueco no cuentan.
 */
export function porcentajeEnRango(serieAsc: readonly LecturaTermica[]): number | null {
  const umbral = umbralHueco([...serieAsc])
  let dentro = 0
  let total = 0
  for (let i = 1; i < serieAsc.length; i++) {
    const previa = serieAsc[i - 1]
    const dt = Date.parse(serieAsc[i].timestamp) - Date.parse(previa.timestamp)
    if (!(dt > 0) || dt >= umbral || previa.temperatura_interna == null) continue
    total += dt
    if (estaEnRango(previa.temperatura_interna)) dentro += dt
  }
  if (total > 0) return dentro / total
  // Una sola lectura (o ninguna medible): cuenta por lectura.
  const validas = serieAsc.filter((l) => l.temperatura_interna != null)
  if (validas.length === 0) return null
  return validas.filter((l) => estaEnRango(l.temperatura_interna as number)).length / validas.length
}

function resumenDeSerie(equipo: string, serieAsc: LecturaTermica[]): ResumenEquipo {
  const temperaturas = serieAsc.flatMap((l) => (l.temperatura_interna == null ? [] : [l.temperatura_interna]))
  const { min, max, promedio } = extremos(temperaturas)
  const umbral = umbralHueco(serieAsc)
  const excursiones = episodiosDeExcursion(serieAsc, umbral).map((episodio) => {
    let pico: number | null = null
    let idInicio: string | null = null
    for (const l of serieAsc) {
      const ms = Date.parse(l.timestamp)
      if (ms < episodio.inicio || ms > episodio.fin) continue
      if (idInicio === null) idInicio = l.id
      if (l.temperatura_interna != null && (pico === null || l.temperatura_interna > pico)) pico = l.temperatura_interna
    }
    return { equipo, inicio: episodio.inicio, fin: episodio.fin, pico, idInicio }
  })
  const brechas = huecosSinDatos(serieAsc, umbral).map(([inicio, fin]) => ({ equipo, inicio, fin }))
  const ultimaLectura = serieAsc.at(-1)
  const periodo =
    serieAsc.length > 1 ? Date.parse(serieAsc[serieAsc.length - 1].timestamp) - Date.parse(serieAsc[0].timestamp) : 0
  const sinDatos = brechas.reduce((suma, b) => suma + (b.fin - b.inicio), 0)
  return {
    equipo,
    ultima: ultimaLectura?.temperatura_interna ?? null,
    min,
    max,
    promedio,
    pctEnRango: porcentajeEnRango(serieAsc),
    excursiones,
    brechas,
    fraccionSinDatos: periodo > 0 ? Math.min(1, sinDatos / periodo) : 0,
  }
}

/** Lecturas (en el orden del backend, descendente) → resumen del periodo y por equipo. */
export function resumenPeriodo(lecturas: readonly LecturaTermica[]): ResumenPeriodo {
  const porEquipo = new Map<string, LecturaTermica[]>()
  for (const l of lecturas) {
    const lista = porEquipo.get(l.device_id)
    if (lista) lista.push(l)
    else porEquipo.set(l.device_id, [l])
  }
  const equipos = [...porEquipo.entries()]
    .map(([equipo, serie]) => resumenDeSerie(equipo, [...serie].sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp))))
    .sort((a, b) => a.equipo.localeCompare(b.equipo))
  const temperaturas = lecturas.flatMap((l) => (l.temperatura_interna == null ? [] : [l.temperatura_interna]))
  const { min, max } = extremos(temperaturas)
  const conPct = equipos.filter((e) => e.pctEnRango != null)
  return {
    n: lecturas.length,
    min,
    max,
    pctEnRango: conPct.length ? conPct.reduce((s, e) => s + (e.pctEnRango as number), 0) / conPct.length : null,
    excursiones: equipos.flatMap((e) => e.excursiones).sort((a, b) => b.fin - b.inicio - (a.fin - a.inicio)),
    brechas: equipos.flatMap((e) => e.brechas),
    equipos,
  }
}

export interface ResumenDia {
  n: number
  min: number | null
  max: number | null
  excursiones: number
}

/** Cabeceras de día: cifras del día completo, no solo de la página visible. */
export function resumenPorDia(lecturas: readonly LecturaTermica[]): Map<string, ResumenDia> {
  const mapa = new Map<string, ResumenDia>()
  // Un episodio se cuenta en el día en que empieza: lectura crítica cuya
  // lectura anterior del mismo equipo no lo era.
  const ascendentes = [...lecturas].sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp))
  const previoCritico = new Map<string, boolean>()
  for (const l of ascendentes) {
    const clave = claveDia(l.timestamp)
    const dia = mapa.get(clave) ?? { n: 0, min: null, max: null, excursiones: 0 }
    dia.n += 1
    const t = l.temperatura_interna
    if (t != null) {
      dia.min = dia.min === null ? t : Math.min(dia.min, t)
      dia.max = dia.max === null ? t : Math.max(dia.max, t)
    }
    const critica = l.riesgo_efectivo === 'excursion_critica'
    if (critica && !previoCritico.get(l.device_id)) dia.excursiones += 1
    previoCritico.set(l.device_id, critica)
    mapa.set(clave, dia)
  }
  return mapa
}
