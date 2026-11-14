import { useState } from 'react'

import type { Dispositivo } from '@/domain/entities/Dispositivo'

/** Nodo que reportó más recientemente; null si aún no hay ninguno. */
export function equipoMasReciente(equipos: readonly Dispositivo[]): string | null {
  const conReporte = equipos.filter((equipo) => equipo.ultimo_reporte_en)
  const candidatos = conReporte.length > 0 ? conReporte : equipos
  if (candidatos.length === 0) return null
  return [...candidatos].sort(
    (a, b) => Date.parse(b.ultimo_reporte_en ?? '') - Date.parse(a.ultimo_reporte_en ?? '') || a.id.localeCompare(b.id),
  )[0].id
}

/**
 * Equipo en pantalla. El equipo por defecto se fija la primera vez que se
 * conoce: recalcularlo en cada sondeo hacía que el dashboard saltara de
 * refrigerador cada vez que otro nodo reportaba después. Solo se vuelve a
 * elegir si el fijado desaparece de la lista; una lista vacía (sondeo
 * fallido) no lo suelta.
 */
export function useEquipoSeleccionado(equipos: readonly Dispositivo[]) {
  const [equipoElegido, setEquipoElegido] = useState<string | null>(null)
  const [equipoPorDefecto, setEquipoPorDefecto] = useState<string | null>(null)
  const masReciente = equipoMasReciente(equipos)
  const sigueListado =
    equipoPorDefecto !== null && (equipos.length === 0 || equipos.some((equipo) => equipo.id === equipoPorDefecto))
  if (!sigueListado && masReciente !== equipoPorDefecto) setEquipoPorDefecto(masReciente)
  const deviceId = equipoElegido ?? (sigueListado ? equipoPorDefecto : masReciente)
  return { deviceId, elegir: setEquipoElegido }
}
