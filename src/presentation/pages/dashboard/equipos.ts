import type { Dispositivo } from '@/domain/entities/Dispositivo'

/**
 * Une la lista completa (`todos`) con el detalle de incidencias del sondeo por
 * defecto: el mismo equipo puede llegar en ambas, y la segunda trae los
 * incidentes y el buffer que la fila necesita.
 */
export function unirEquipos(todos: readonly Dispositivo[], conIncidencias: readonly Dispositivo[]): Dispositivo[] {
  const porId = new Map<string, Dispositivo>()
  for (const equipo of todos) porId.set(equipo.id, equipo)
  for (const equipo of conIncidencias) porId.set(equipo.id, { ...porId.get(equipo.id), ...equipo })
  return [...porId.values()]
}

/** Orden de la celda: problemas primero (suspendido › sin datos › falla › pérdidas › offline › cola › operativo), luego nombre. */
export function rangoEquipo(equipo: Dispositivo): number {
  const buffer = equipo.buffer_littlefs
  if (equipo.estado_operativo === 'MONITOREO_SUSPENDIDO') return 0
  if (equipo.estado_operativo === 'SIN_DATOS') return 1
  if (equipo.estado_operativo === 'FALLA_SENSOR') return 2
  if ((buffer?.perdidas ?? 0) > 0 || (buffer?.brechas?.length ?? 0) > 0) return 3
  if (equipo.estado_conectividad !== 'online') return 4
  if ((buffer?.pendientes ?? 0) > 0) return 5
  return 6
}

export function ordenarEquipos(equipos: readonly Dispositivo[]): Dispositivo[] {
  return [...equipos].sort(
    (a, b) => rangoEquipo(a) - rangoEquipo(b) || (a.nombre || a.id).localeCompare(b.nombre || b.id),
  )
}

/** Un equipo «con incidencias» para el resumen de la celda. */
export function tieneIncidencia(equipo: Dispositivo): boolean {
  return rangoEquipo(equipo) < 6 || (equipo.incidencias_operativas ?? []).some((i) => i.estado === 'activo')
}
