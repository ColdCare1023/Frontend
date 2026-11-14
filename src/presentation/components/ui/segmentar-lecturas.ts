import type { LecturaTermica } from '@/domain/entities/LecturaTermica'
import { tonoDesdeRiesgo, type TonoEstado } from './estado-tonos'

export interface SegmentoCinta {
  /** Inicio del tramo (ISO). */
  inicio: string
  tono: TonoEstado
  minimo: number | null
  maximo: number | null
}

const PESO: Record<TonoEstado, number> = {
  critico: 5,
  preventivo: 4,
  sin_conexion: 3,
  normal: 2,
  neutro: 1,
  sin_datos: 0,
}

/**
 * Reparte lecturas ya cargadas en `n` tramos iguales hasta `ahora` (por
 * defecto 48 de 30 min = 24 h). Cada tramo toma el peor estado de sus
 * lecturas; un tramo sin lecturas es «sin datos» (trama), nunca un riesgo.
 * No pide nada al servidor: usa lo que el hook de la pantalla ya trajo.
 */
export function segmentarLecturas(
  lecturas: readonly LecturaTermica[],
  { ahora = Date.now(), horas = 24, segmentos = 48 }: { ahora?: number; horas?: number; segmentos?: number } = {},
): SegmentoCinta[] {
  const tramoMs = (horas * 3_600_000) / segmentos
  const inicio = ahora - horas * 3_600_000
  const cubetas: SegmentoCinta[] = Array.from({ length: segmentos }, (_, i) => ({
    inicio: new Date(inicio + i * tramoMs).toISOString(),
    tono: 'sin_datos',
    minimo: null,
    maximo: null,
  }))
  for (const lectura of lecturas) {
    const ms = Date.parse(lectura.timestamp)
    if (Number.isNaN(ms) || ms < inicio || ms > ahora) continue
    const cubeta = cubetas[Math.min(segmentos - 1, Math.floor((ms - inicio) / tramoMs))]
    const tono = tonoDesdeRiesgo(lectura.riesgo_efectivo ?? lectura.nivel_riesgo)
    const tonoLectura: TonoEstado = tono === 'neutro' ? 'normal' : tono
    if (PESO[tonoLectura] > PESO[cubeta.tono]) cubeta.tono = tonoLectura
    const t = lectura.temperatura_interna
    if (t !== null && t !== undefined) {
      cubeta.minimo = cubeta.minimo === null ? t : Math.min(cubeta.minimo, t)
      cubeta.maximo = cubeta.maximo === null ? t : Math.max(cubeta.maximo, t)
    }
  }
  return cubetas
}
