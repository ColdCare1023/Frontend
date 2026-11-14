import { CircleCheck, Hourglass, OctagonAlert, TriangleAlert, WifiOff, type LucideIcon } from 'lucide-react'

import type { NivelRiesgo } from '@/domain/value-objects/NivelRiesgo'

/**
 * Vocabulario de estado compartido (DIRECTION §3 y §14). Cada estado tiene
 * color, icono con forma propia y texto: nunca solo color. «Sin datos» no es
 * un riesgo: va en acero con trama, nunca en rojo (HU-54).
 */
export type TonoEstado = 'normal' | 'preventivo' | 'critico' | 'sin_datos' | 'sin_conexion' | 'neutro'

export const ICONO_ESTADO: Record<TonoEstado, LucideIcon> = {
  normal: CircleCheck,
  preventivo: TriangleAlert,
  critico: OctagonAlert,
  sin_datos: Hourglass,
  sin_conexion: WifiOff,
  neutro: Hourglass,
}

/** Clase de texto del estado (iconos y etiquetas). */
export const TEXTO_ESTADO: Record<TonoEstado, string> = {
  normal: 'text-success-700',
  preventivo: 'text-warning-700',
  critico: 'text-critical',
  sin_datos: 'text-nodata-700',
  sin_conexion: 'text-warning-700',
  neutro: 'text-faint',
}

/** Clase de fondo sólido del estado (puntos, segmentos, marcas). */
export const FONDO_ESTADO: Record<TonoEstado, string> = {
  normal: 'bg-success-600',
  preventivo: 'bg-warning-600',
  critico: 'bg-critical-solid',
  sin_datos: 'trama-sin-datos',
  sin_conexion: 'bg-warning-600',
  neutro: 'bg-border-strong',
}

/** Color CSS del estado para variables en línea (`--marca` de la Regla). */
export const COLOR_ESTADO: Record<TonoEstado, string> = {
  normal: 'var(--color-success-600)',
  preventivo: 'var(--color-warning-600)',
  critico: 'var(--color-critical-solid)',
  sin_datos: 'var(--color-nodata-600)',
  sin_conexion: 'var(--color-warning-600)',
  neutro: 'var(--color-faint)',
}

/** Riesgo efectivo de una lectura → tono. `null` (sin clasificación) es neutro. */
export function tonoDesdeRiesgo(riesgo: NivelRiesgo | null | undefined): TonoEstado {
  if (riesgo === 'excursion_critica') return 'critico'
  if (riesgo === 'riesgo_preventivo') return 'preventivo'
  if (riesgo === 'normal') return 'normal'
  return 'neutro'
}
