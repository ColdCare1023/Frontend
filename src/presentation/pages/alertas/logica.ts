import type { AlertaTermica } from '@/domain/entities/AlertaTermica'
import type { IncidenteOperativo } from '@/domain/entities/Dispositivo'

/*
 * Lógica pura de la bandeja de Alertas: se calcula con lo ya cargado (sin
 * peticiones extra) y se prueba sin montar componentes.
 */

const SIETE_DIAS_MS = 7 * 24 * 60 * 60 * 1000

export interface ResumenBandeja {
  pendientes: number
  revisadas: number
  criticasAbiertas: number
  /** Inicio de la más antigua entre las críticas abiertas o, si no hay, entre las pendientes. */
  masAntigua: string | null
  atendidas7d: number
  /** Las 50 cargadas son de los últimos 7 días: hay al menos esas. */
  atendidas7dTruncado: boolean
  atencionMedia7d: number | null
  ultimaAtendida: AlertaTermica | null
}

const msFecha = (iso: string | null | undefined) => {
  const valor = iso ? Date.parse(iso) : Number.NaN
  return Number.isNaN(valor) ? null : valor
}

/** Resumen de la bandeja calculado con lo ya cargado (sin peticiones extra). */
export function resumirBandeja(
  pendientes: readonly AlertaTermica[],
  revisadas: readonly AlertaTermica[],
  atendidas: readonly AlertaTermica[],
  limiteAtendidas: number,
  ahora: number,
): ResumenBandeja {
  const abiertas = [...pendientes, ...revisadas]
  const criticas = abiertas.filter((a) => a.nivel_riesgo === 'excursion_critica')
  const base = criticas.length > 0 ? criticas : pendientes
  const masAntigua = base.reduce<string | null>((min, a) => {
    if (!a.created_at) return min
    return min === null || a.created_at < min ? a.created_at : min
  }, null)
  const recientes = atendidas.filter((a) => {
    const fin = msFecha(a.atendida_en)
    return fin !== null && ahora - fin <= SIETE_DIAS_MS
  })
  const tiempos = recientes
    .map((a) => {
      const inicio = msFecha(a.created_at)
      const fin = msFecha(a.atendida_en)
      return inicio !== null && fin !== null && fin >= inicio ? (fin - inicio) / 1000 : null
    })
    .filter((s): s is number => s !== null)
  const ultimaAtendida = atendidas.reduce<AlertaTermica | null>(
    (ultima, a) => (a.atendida_en && (!ultima || a.atendida_en > (ultima.atendida_en ?? '')) ? a : ultima),
    null,
  )
  return {
    pendientes: pendientes.length,
    revisadas: revisadas.length,
    criticasAbiertas: criticas.length,
    masAntigua,
    atendidas7d: recientes.length,
    atendidas7dTruncado: atendidas.length >= limiteAtendidas && recientes.length === atendidas.length,
    atencionMedia7d: tiempos.length > 0 ? tiempos.reduce((s, v) => s + v, 0) / tiempos.length : null,
    ultimaAtendida,
  }
}

const ms = (iso: string | null | undefined) => (iso ? Date.parse(iso) || 0 : 0)

/** Activos primero (los más recientes arriba) y luego los resueltos. */
export function ordenarIncidentes(incidentes: readonly IncidenteOperativo[]): IncidenteOperativo[] {
  const activos = incidentes.filter((i) => i.estado === 'activo').sort((a, b) => ms(b.detectado_en) - ms(a.detectado_en))
  const resueltos = incidentes
    .filter((i) => i.estado !== 'activo')
    .sort((a, b) => ms(b.recuperado_en ?? b.detectado_en) - ms(a.recuperado_en ?? a.detectado_en))
  return [...activos, ...resueltos]
}

/** Hasta cuántas filas visibles la bandeja se acompaña de contexto debajo (DIRECTION §13.3). */
export const FILAS_CON_CONTEXTO = 4

/** Cuántas atendidas se muestran según las filas visibles (relleno con datos, DIRECTION §13.3). */
export function cuantasAtendidas(filasVisibles: number): number {
  if (filasVisibles <= 2) return 5
  if (filasVisibles <= 4) return 3
  return 0
}

