import type { AlertaTermica } from '@/domain/entities/AlertaTermica'
import type { NivelRiesgo } from '@/domain/value-objects/NivelRiesgo'

type FiltroOrden = 'pendiente' | 'reconocida' | 'atendida' | 'todas'

const GRAVEDAD: Record<NivelRiesgo, number> = {
  excursion_critica: 2,
  riesgo_preventivo: 1,
  normal: 0,
}

const ms = (iso: string | null) => {
  const valor = iso ? Date.parse(iso) : Number.NaN
  return Number.isNaN(valor) ? 0 : valor
}

/** El orden de triage aplica a la bandeja abierta (pendientes y revisadas). */
export function ordenEsTriage(filtro: FiltroOrden): boolean {
  return filtro === 'pendiente' || filtro === 'reconocida'
}

/**
 * Orden de la bandeja (DIRECTION §6: un foco por vista).
 *
 * - Pendientes y Revisadas: la más grave primero y, dentro de cada nivel, la
 *   más antigua; así la primera fila es siempre la que más urge atender.
 * - Atendidas y Todas: cronológico, la más reciente primero.
 *
 * Función pura: no muta la lista recibida.
 */
export function ordenarAlertas(alertas: readonly AlertaTermica[], filtro: FiltroOrden): AlertaTermica[] {
  const copia = [...alertas]
  if (ordenEsTriage(filtro)) {
    return copia.sort(
      (a, b) =>
        (GRAVEDAD[b.nivel_riesgo] ?? 0) - (GRAVEDAD[a.nivel_riesgo] ?? 0) || ms(a.created_at) - ms(b.created_at),
    )
  }
  return copia.sort((a, b) => ms(b.created_at) - ms(a.created_at))
}
