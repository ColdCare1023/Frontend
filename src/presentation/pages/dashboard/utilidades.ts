import type { LecturaTermica } from '@/domain/entities/LecturaTermica'
import type { ResumenCurva } from '@/domain/entities/SerieTermica'
import type { EstadoTramo } from '@/domain/value-objects/Disponibilidad'
import type { Rol } from '@/domain/value-objects/Rol'

const formatoRelativo = new Map<string, Intl.RelativeTimeFormat>()

/** «hace 14 h» con Intl, sin claves nuevas (formateador en caché). */
export function haceRelativo(iso: string | null | undefined, idioma: string, ahora = Date.now()): string {
  if (!iso) return '—'
  const ms = Date.parse(iso)
  if (Number.isNaN(ms)) return '—'
  let formato = formatoRelativo.get(idioma)
  if (!formato) {
    formato = new Intl.RelativeTimeFormat(idioma, { numeric: 'auto', style: 'short' })
    formatoRelativo.set(idioma, formato)
  }
  const segundos = Math.round((ms - ahora) / 1000)
  const abs = Math.abs(segundos)
  if (abs < 60) return formato.format(segundos, 'second')
  if (abs < 3600) return formato.format(Math.round(segundos / 60), 'minute')
  if (abs < 86_400) return formato.format(Math.round(segundos / 3600), 'hour')
  return formato.format(Math.round(segundos / 86_400), 'day')
}


const MAX_PUNTOS = 48

/** Hasta 48 puntos repartidos por la ventana, conservando mínimo y máximo. */
export function submuestrear(valores: readonly number[], max = MAX_PUNTOS): number[] {
  if (valores.length <= max) return [...valores]
  const paso = valores.length / max
  const resultado: number[] = []
  for (let i = 0; i < max; i++) {
    const tramo = valores.slice(Math.floor(i * paso), Math.floor((i + 1) * paso))
    if (tramo.length === 0) continue
    // Alterna mínimo y máximo para no aplanar un pico breve.
    resultado.push(i % 2 === 0 ? Math.max(...tramo) : Math.min(...tramo))
  }
  return resultado
}


export type ResumenVentana = ResumenCurva

/** Resumen de lecturas crudas (ventana de 1 h, o sin serie agregada). */
export function resumenVentana(serie: readonly LecturaTermica[]): ResumenVentana | null {
  const temps = serie.map((l) => l.temperatura_interna).filter((v): v is number => v != null && Number.isFinite(v))
  if (temps.length === 0) return null
  return {
    minima: Math.min(...temps),
    maxima: Math.max(...temps),
    promedio: temps.reduce((suma, v) => suma + v, 0) / temps.length,
    // HU-34: cuenta excursiones CONFIRMADAS por la regla directa de rango,
    // no por lo que haya clasificado la IA (`nivel_riesgo`/model_class).
    fueraDeRango: serie.filter((l) => l.excursion_confirmada).length,
    lecturas: serie.length,
  }
}

/** Duración de un intervalo de la serie agregada: «1 min», «10 min», «1 h», «1 d». */
export function etiquetaIntervalo(segundos: number): string {
  if (segundos >= 86_400 && segundos % 86_400 === 0) return `${segundos / 86_400} d`
  if (segundos >= 3600 && segundos % 3600 === 0) return `${segundos / 3600} h`
  if (segundos >= 60 && segundos % 60 === 0) return `${segundos / 60} min`
  return `${segundos} s`
}


/** Color por estado del tramo: forma y texto acompañan siempre (leyenda y tooltip). */
export const FONDO_TRAMO: Record<EstadoTramo, string> = {
  operativo: 'bg-success-600',
  sin_datos: 'trama-sin-datos',
  perdida: 'bg-critical-solid',
  falla_sensor: 'bg-warning-600',
  suspendido: 'bg-warning-600',
  sin_registro: 'bg-border',
}


/**
 * Roles que ven el simulador de la demostración (solo en `MODO_DEMO`). Hoy
 * los cuatro, como antes del rediseño; la spec P5c (D-1) propone dejarlo
 * solo al administrador: basta con vaciar esta lista.
 */
export const ROLES_SIMULADOR: Rol[] = ['farmaceutico', 'tecnico', 'auditor']
