import type { AlertaTermica } from '@/domain/entities/AlertaTermica'
import type { EstadoAlerta } from '@/domain/value-objects/EstadoAlerta'
import type { NivelRiesgo } from '@/domain/value-objects/NivelRiesgo'
import { localeActual } from '@/lib/formato'

const ORDEN_ESTADO: Record<EstadoAlerta, number> = { pendiente: 0, reconocida: 1, atendida: 2 }
const ORDEN_NIVEL: Record<NivelRiesgo, number> = { excursion_critica: 0, riesgo_preventivo: 1, normal: 2 }

/** El color del campo significa el nivel; en una atendida se retira el relleno, no el dato. */
export const FONDO_POR_NIVEL: Record<NivelRiesgo, string> = {
  excursion_critica: 'bg-campo-critico',
  riesgo_preventivo: 'bg-campo-preventivo',
  normal: 'bg-campo-rango',
}

export const TINTA_POR_NIVEL: Record<NivelRiesgo, string> = {
  excursion_critica: 'text-campo-critico-tinta',
  riesgo_preventivo: 'text-campo-preventivo-tinta',
  normal: 'text-campo-rango-tinta',
}

/** Pendientes primero; dentro de cada estado, lo más grave y luego lo más reciente. */
export function ordenarBandeja(alertas: AlertaTermica[]): AlertaTermica[] {
  return [...alertas].sort(
    (a, b) =>
      ORDEN_ESTADO[a.estado] - ORDEN_ESTADO[b.estado] ||
      ORDEN_NIVEL[a.nivel_riesgo] - ORDEN_NIVEL[b.nivel_riesgo] ||
      (b.created_at ?? '').localeCompare(a.created_at ?? ''),
  )
}

/**
 * La cifra del aviso: el pico de la excursión si el backend lo registró y, en alertas anteriores a
 * esa migración, la lectura escrita en el mensaje. Lo que viene después de «rango» es el rango de
 * referencia (2–8 °C), no una medición: sin lectura se devuelve `null`, nunca una cifra inventada.
 */
export function temperaturaDeAlerta(alerta: AlertaTermica): number | null {
  if (alerta.temperatura_pico != null && Number.isFinite(alerta.temperatura_pico)) return alerta.temperatura_pico
  const antesDelRango = alerta.mensaje.split(/\b(?:rango|range)\b/i)[0]
  const hallada = /(?<![\d.,–-])(-?\d+(?:[.,]\d+)?)\s*°\s?C/.exec(antesDelRango)
  if (!hallada) return null
  const valor = Number.parseFloat(hallada[1].replace(',', '.'))
  return Number.isFinite(valor) ? valor : null
}

/** «7 nov, 11:03 a. m.»: lo que cabe en una fila; el dato completo va en el detalle. */
export function fechaBreve(iso: string | null): string {
  if (!iso) return '—'
  const fecha = new Date(iso)
  if (Number.isNaN(fecha.getTime())) return '—'
  return fecha.toLocaleString(localeActual(), { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
}

/**
 * Lo que este rol puede hacer con este aviso. HU-23/HU-41: reconocer es exclusivo del farmacéutico
 * (igual que `require_roles(Rol.FARMACEUTICO)` en el backend); registrar la acción lo permiten
 * farmacéutico y técnico; el auditor es de solo lectura y no ve ninguna de las dos.
 */
export function accionesDisponibles(alerta: AlertaTermica, puedeReconocer: boolean, puedeRegistrar: boolean) {
  return {
    reconocer: alerta.estado === 'pendiente' && puedeReconocer,
    registrar: alerta.estado !== 'atendida' && puedeRegistrar,
  }
}
