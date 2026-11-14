import type { AlertaTermica } from '@/domain/entities/AlertaTermica'
import type { IncidenteOperativo } from '@/domain/entities/Dispositivo'
import type { SegmentoCinta } from '@/presentation/components/ui/segmentar-lecturas'

/** Tramo de la cinta de Alertas. «Sin eventos» no es «en rango»: no hay lecturas que lo prueben. */
export type TramoCinta = 'critica' | 'preventiva' | 'sin_datos' | 'sin_eventos'

export interface CintaEquipo {
  deviceId: string
  tramos: TramoCinta[]
  /** Los mismos tramos en el formato de la `Cinta24h` compartida. */
  segmentos: SegmentoCinta[]
  resumen: { criticas: number; preventivos: number; sinDatos: number }
}

const TRAMO_MS = 30 * 60 * 1000
const TRAMOS = 48

const PESO: Record<TramoCinta, number> = { critica: 3, preventiva: 2, sin_datos: 1, sin_eventos: 0 }

const TONO = {
  critica: 'critico',
  preventiva: 'preventivo',
  sin_datos: 'sin_datos',
  sin_eventos: 'neutro',
} as const

const parse = (iso: string | null | undefined) => {
  const valor = iso ? Date.parse(iso) : Number.NaN
  return Number.isNaN(valor) ? null : valor
}

/**
 * Cinta de 24 h por equipo construida SOLO con alertas e incidentes que la
 * pantalla ya cargó (sin GET por equipo): 48 tramos de 30 min que terminan en
 * el tramo actual. Cada tramo toma el evento más grave (crítica > preventiva >
 * sin datos > sin eventos). Solo aparecen los equipos con algún evento.
 */
export function construirCinta24h(
  alertas: readonly AlertaTermica[],
  incidentes: readonly IncidenteOperativo[],
  ahora: number,
): CintaEquipo[] {
  const fin = (Math.floor(ahora / TRAMO_MS) + 1) * TRAMO_MS
  const inicio = fin - TRAMOS * TRAMO_MS
  const porEquipo = new Map<string, TramoCinta[]>()

  const pintar = (deviceId: string, desde: number, hasta: number, tramo: TramoCinta) => {
    if (hasta < inicio || desde >= fin) return
    const primero = Math.max(0, Math.floor((desde - inicio) / TRAMO_MS))
    const ultimo = Math.min(TRAMOS - 1, Math.floor((Math.min(hasta, fin - 1) - inicio) / TRAMO_MS))
    let tramos = porEquipo.get(deviceId)
    if (!tramos) {
      tramos = Array.from({ length: TRAMOS }, () => 'sin_eventos' as TramoCinta)
      porEquipo.set(deviceId, tramos)
    }
    for (let i = primero; i <= ultimo; i++) if (PESO[tramo] > PESO[tramos[i]]) tramos[i] = tramo
  }

  const vistas = new Set<string>()
  for (const alerta of alertas) {
    if (vistas.has(alerta.id)) continue
    vistas.add(alerta.id)
    const tramo: TramoCinta | null =
      alerta.nivel_riesgo === 'excursion_critica' ? 'critica' : alerta.nivel_riesgo === 'riesgo_preventivo' ? 'preventiva' : null
    if (!tramo) continue
    const iniciada = parse(alerta.iniciada_en)
    if (iniciada !== null && alerta.duracion_s != null) {
      pintar(alerta.device_id, iniciada, iniciada + alerta.duracion_s * 1000, tramo)
    } else {
      const creada = parse(alerta.created_at)
      if (creada !== null) pintar(alerta.device_id, creada, creada, tramo)
    }
  }

  for (const incidente of incidentes) {
    const desde = parse(incidente.detectado_en)
    if (desde === null) continue
    const hasta = parse(incidente.recuperado_en) ?? ahora
    pintar(incidente.device_id, desde, hasta, 'sin_datos')
  }

  return [...porEquipo.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([deviceId, tramos]) => ({
      deviceId,
      tramos,
      segmentos: tramos.map((tramo, i) => ({
        inicio: new Date(inicio + i * TRAMO_MS).toISOString(),
        tono: TONO[tramo],
        minimo: null,
        maximo: null,
      })),
      resumen: {
        criticas: tramos.filter((t) => t === 'critica').length,
        preventivos: tramos.filter((t) => t === 'preventiva').length,
        sinDatos: tramos.filter((t) => t === 'sin_datos').length,
      },
    }))
}
