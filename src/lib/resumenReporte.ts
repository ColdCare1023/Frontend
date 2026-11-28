import type { AlertaTermica } from '@/domain/entities/AlertaTermica'
import { INTERVALO_REPORTE_POR_DEFECTO } from '@/domain/entities/Dispositivo'
import type { LecturaTermica } from '@/domain/entities/LecturaTermica'
import { estaEnRango } from '@/domain/value-objects/NivelRiesgo'

/**
 * Cálculos del resumen de Reportes. Funciones puras sobre las filas que el
 * backend ya devolvió en `GET /api/reportes/bpa`: no piden nada nuevo.
 */

export interface TiempoEnRango {
  /** Milisegundos de cada tramo. */
  enRango: number
  fuera: number
  sinDatos: number
  /** Porcentajes con 1 decimal que suman 100 (resto mayor). */
  porcentajes: { enRango: number; fuera: number; sinDatos: number }
  /** Tramo sobre el que se calculó (si es parcial, el recibido). */
  desde: number
  hasta: number
}

const INTERVALO_POR_DEFECTO = INTERVALO_REPORTE_POR_DEFECTO * 1000

function mediana(valores: number[]): number {
  if (valores.length === 0) return INTERVALO_POR_DEFECTO
  const orden = [...valores].sort((a, b) => a - b)
  const mitad = Math.floor(orden.length / 2)
  return orden.length % 2 ? orden[mitad] : (orden[mitad - 1] + orden[mitad]) / 2
}

/** Porcentajes de 1 decimal que suman exactamente 100 (método del resto mayor). */
export function porcentajesExactos<K extends string>(valores: Record<K, number>): Record<K, number> {
  const claves = Object.keys(valores) as K[]
  const total = claves.reduce((s, k) => s + valores[k], 0)
  const resultado = {} as Record<K, number>
  if (total <= 0) {
    for (const k of claves) resultado[k] = 0
    return resultado
  }
  // Se trabaja en décimas: 1000 = 100,0 %.
  const crudos = claves.map((k) => ({ k, v: (valores[k] / total) * 1000 }))
  let asignado = 0
  for (const { k, v } of crudos) {
    resultado[k] = Math.floor(v)
    asignado += Math.floor(v)
  }
  const restos = crudos.sort((a, b) => (b.v - Math.floor(b.v)) - (a.v - Math.floor(a.v)))
  for (let i = 0; i < 1000 - asignado; i++) resultado[restos[i % restos.length].k] += 1
  for (const k of claves) resultado[k] = resultado[k] / 10
  return resultado
}

/**
 * Tiempo dentro de 2–8 °C, fuera y sin datos.
 *
 * Cada lectura cubre desde su instante hasta la siguiente, como mucho tres
 * intervalos de muestreo (la mediana de los saltos del equipo). Lo que queda
 * descubierto es «sin datos», igual que una lectura sin temperatura interna:
 * un sensor caído no es una excursión. Con varios equipos se suman sus
 * periodos. El futuro del periodo (hoy después de ahora) no cuenta.
 */
export function tiempoEnRango(
  lecturas: readonly LecturaTermica[],
  desdeISO: string,
  hastaISO: string,
  { parcial = false, ahora = Date.now() }: { parcial?: boolean; ahora?: number } = {},
): TiempoEnRango {
  const porEquipo = new Map<string, LecturaTermica[]>()
  for (const l of lecturas) {
    const lista = porEquipo.get(l.device_id)
    if (lista) lista.push(l)
    else porEquipo.set(l.device_id, [l])
  }

  const tiempos = lecturas.map((l) => Date.parse(l.timestamp)).filter(Number.isFinite)
  let inicio = Date.parse(desdeISO)
  let fin = Math.min(Date.parse(hastaISO), ahora)
  if (parcial && tiempos.length > 0) {
    inicio = Math.min(...tiempos)
    fin = Math.max(...tiempos)
  }

  let enRango = 0
  let fuera = 0
  let cubierto = 0
  const equipos = Math.max(1, porEquipo.size)

  for (const lista of porEquipo.values()) {
    const orden = [...lista].sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp))
    const ts = orden.map((l) => Date.parse(l.timestamp))
    const saltos = ts.slice(1).map((t, i) => t - ts[i]).filter((d) => d > 0)
    const intervalo = ts.length < 2 ? INTERVALO_POR_DEFECTO : mediana(saltos)
    orden.forEach((lectura, i) => {
      const t0 = Math.max(ts[i], inicio)
      const siguiente = i + 1 < ts.length ? ts[i + 1] : Infinity
      const t1 = Math.min(siguiente, ts[i] + 3 * intervalo, fin)
      const dur = t1 - t0
      if (!(dur > 0)) return
      const temp = lectura.temperatura_interna
      if (temp === null || temp === undefined) return
      cubierto += dur
      if (estaEnRango(temp)) enRango += dur
      else fuera += dur
    })
  }

  const total = Math.max(0, fin - inicio) * equipos
  const sinDatos = Math.max(0, total - cubierto)
  return {
    enRango,
    fuera,
    sinDatos,
    porcentajes: porcentajesExactos({ enRango, fuera, sinDatos }),
    desde: inicio,
    hasta: fin,
  }
}

export interface BucketCurva {
  min: number
  max: number
}

/**
 * Agrupa la temperatura interna en `n` tramos de tiempo iguales y conserva
 * mínimo y máximo de cada uno. Un tramo sin lecturas es `null` (hueco).
 */
export function submuestrear(
  lecturas: readonly LecturaTermica[],
  n = 240,
): { buckets: (BucketCurva | null)[]; desde: number; hasta: number } {
  const validas = lecturas
    .map((l) => ({ t: Date.parse(l.timestamp), v: l.temperatura_interna }))
    .filter((p): p is { t: number; v: number } => Number.isFinite(p.t) && typeof p.v === 'number')
  if (validas.length === 0) return { buckets: [], desde: 0, hasta: 0 }
  const desde = Math.min(...validas.map((p) => p.t))
  const hasta = Math.max(...validas.map((p) => p.t))
  const cantidad = Math.max(1, Math.min(n, validas.length))
  const ancho = (hasta - desde) / cantidad || 1
  const buckets: (BucketCurva | null)[] = Array.from({ length: cantidad }, () => null)
  for (const p of validas) {
    const i = Math.min(cantidad - 1, Math.floor((p.t - desde) / ancho))
    const b = buckets[i]
    buckets[i] = b ? { min: Math.min(b.min, p.v), max: Math.max(b.max, p.v) } : { min: p.v, max: p.v }
  }
  return { buckets, desde, hasta }
}

export interface PuntoCurva {
  media: number
  min: number
  max: number
}

export interface CurvaEquipo {
  device_id: string
  /** Un punto por tramo de tiempo; `null` = tramo sin lecturas (hueco). */
  puntos: (PuntoCurva | null)[]
}

/**
 * Curva del periodo POR EQUIPO: temperatura interna promediada en `n` tramos
 * de tiempo iguales (los mismos para todos los equipos), con su mínimo y
 * máximo. Con «Todos los equipos» cada refrigerador lleva su línea: un solo
 * mínimo–máximo por tramo mezclaba dos equipos y dibujaba un código de barras
 * entre sus temperaturas.
 */
export function curvasPorEquipo(
  lecturas: readonly LecturaTermica[],
  n = 120,
): { curvas: CurvaEquipo[]; desde: number; hasta: number } {
  const validas = lecturas
    .map((l) => ({ t: Date.parse(l.timestamp), v: l.temperatura_interna, d: l.device_id ?? '' }))
    .filter((p): p is { t: number; v: number; d: string } => Number.isFinite(p.t) && typeof p.v === 'number')
  if (validas.length === 0) return { curvas: [], desde: 0, hasta: 0 }
  let desde = Infinity
  let hasta = -Infinity
  for (const p of validas) {
    if (p.t < desde) desde = p.t
    if (p.t > hasta) hasta = p.t
  }
  const cantidad = Math.max(1, Math.min(n, validas.length))
  const ancho = (hasta - desde) / cantidad || 1
  const acumulado = new Map<string, Array<{ suma: number; cuenta: number; min: number; max: number } | null>>()
  for (const p of validas) {
    let tramos = acumulado.get(p.d)
    if (!tramos) {
      tramos = Array.from({ length: cantidad }, () => null)
      acumulado.set(p.d, tramos)
    }
    const i = Math.min(cantidad - 1, Math.floor((p.t - desde) / ancho))
    const tramo = tramos[i]
    tramos[i] = tramo
      ? { suma: tramo.suma + p.v, cuenta: tramo.cuenta + 1, min: Math.min(tramo.min, p.v), max: Math.max(tramo.max, p.v) }
      : { suma: p.v, cuenta: 1, min: p.v, max: p.v }
  }
  const curvas = [...acumulado.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([device_id, tramos]) => ({
      device_id,
      puntos: tramos.map((t) => (t ? { media: t.suma / t.cuenta, min: t.min, max: t.max } : null)),
    }))
  return { curvas, desde, hasta }
}

export interface ConteoAlertas {
  criticas: number
  preventivas: number
  pendientes: number
}

export function conteoAlertas(alertas: readonly AlertaTermica[]): ConteoAlertas {
  let criticas = 0
  let preventivas = 0
  let pendientes = 0
  for (const a of alertas) {
    if (a.nivel_riesgo === 'excursion_critica') criticas++
    else if (a.nivel_riesgo === 'riesgo_preventivo') preventivas++
    if (a.estado === 'pendiente') pendientes++
  }
  return { criticas, preventivas, pendientes }
}

export interface ResumenTemperatura {
  minimo: number
  maximo: number
  promedio: number
}

export function resumenTemperatura(lecturas: readonly LecturaTermica[]): ResumenTemperatura | null {
  const valores = lecturas
    .map((l) => l.temperatura_interna)
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
  if (valores.length === 0) return null
  const suma = valores.reduce((s, v) => s + v, 0)
  return { minimo: Math.min(...valores), maximo: Math.max(...valores), promedio: suma / valores.length }
}

/** Equipos presentes en las lecturas, en orden de aparición. */
export function equiposDe(lecturas: readonly LecturaTermica[]): string[] {
  return [...new Set(lecturas.map((l) => l.device_id))]
}
