import type { AlertaTermica } from '@/domain/entities/AlertaTermica'
import type { IncidenteOperativo } from '@/domain/entities/Dispositivo'

/**
 * Actividad reciente de los equipos: alertas térmicas e incidentes
 * operativos que la pantalla ya cargó, en una sola línea de tiempo. Lógica
 * pura (se prueba sin montar componentes); los textos los pone la vista.
 */
export type TipoEvento = 'critica' | 'preventiva' | 'incidente' | 'recuperado'

export interface EventoEquipo {
  id: string
  deviceId: string
  tipo: TipoEvento
  /** Instante del evento (ms). */
  ms: number
  alerta?: AlertaTermica
  incidente?: IncidenteOperativo
}

const SIETE_DIAS_MS = 7 * 24 * 60 * 60 * 1000

const parse = (iso: string | null | undefined) => {
  const valor = iso ? Date.parse(iso) : Number.NaN
  return Number.isNaN(valor) ? null : valor
}

/**
 * Eventos de los últimos 7 días, el más reciente primero. Una alerta cuenta
 * por su inicio; un incidente activo, por su detección, y uno resuelto, por
 * su recuperación. Las alertas repetidas (mismo id en dos fuentes) cuentan una vez.
 */
export function eventosRecientes(
  alertas: readonly AlertaTermica[],
  incidentes: readonly IncidenteOperativo[],
  ahora: number,
  { deviceId, limite = 5 }: { deviceId?: string; limite?: number } = {},
): EventoEquipo[] {
  const desde = ahora - SIETE_DIAS_MS
  const eventos: EventoEquipo[] = []
  const vistas = new Set<string>()
  for (const alerta of alertas) {
    if (vistas.has(alerta.id) || (deviceId && alerta.device_id !== deviceId)) continue
    vistas.add(alerta.id)
    if (alerta.nivel_riesgo !== 'excursion_critica' && alerta.nivel_riesgo !== 'riesgo_preventivo') continue
    const ms = parse(alerta.iniciada_en) ?? parse(alerta.created_at)
    if (ms === null || ms < desde) continue
    eventos.push({
      id: `a-${alerta.id}`,
      deviceId: alerta.device_id,
      tipo: alerta.nivel_riesgo === 'excursion_critica' ? 'critica' : 'preventiva',
      ms,
      alerta,
    })
  }
  for (const incidente of incidentes) {
    if (deviceId && incidente.device_id !== deviceId) continue
    const activo = incidente.estado === 'activo'
    const ms = activo ? parse(incidente.detectado_en) : parse(incidente.recuperado_en) ?? parse(incidente.detectado_en)
    if (ms === null || ms < desde) continue
    eventos.push({ id: `i-${incidente.id}`, deviceId: incidente.device_id, tipo: activo ? 'incidente' : 'recuperado', ms, incidente })
  }
  return eventos.sort((a, b) => b.ms - a.ms).slice(0, limite)
}
