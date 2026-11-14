import { createContext, useContext } from 'react'

import type { useDispositivos } from '@/application/hooks/useDispositivos'
import type { AlertaTermica } from '@/domain/entities/AlertaTermica'
import type { IncidenteOperativo } from '@/domain/entities/Dispositivo'

/**
 * La flota se carga una vez en `DispositivosLayout` y la comparten la lista y
 * el detalle: ir y volver entre ambos no vuelve a pedir `/api/dispositivos`
 * (no existe `GET /api/dispositivos/{id}`).
 */
export type Flota = ReturnType<typeof useDispositivos>

export const ContextoFlota = createContext<Flota | null>(null)

export function useFlota(): Flota {
  const flota = useContext(ContextoFlota)
  if (!flota) throw new Error('useFlota se usa dentro de DispositivosLayout')
  return flota
}

/**
 * Actividad de los equipos (cinta 24 h y «Actividad reciente»): alertas sin
 * atender del estado en vivo, las últimas atendidas e incidentes operativos.
 * Mismas GET que Alertas; la cargan una vez el layout para lista y detalle.
 */
export interface Actividad {
  alertas: AlertaTermica[]
  incidentes: IncidenteOperativo[]
  cargando: boolean
  error: boolean
}

const SIN_ACTIVIDAD: Actividad = { alertas: [], incidentes: [], cargando: false, error: false }

export const ContextoActividad = createContext<Actividad | null>(null)

export function useActividad(): Actividad {
  return useContext(ContextoActividad) ?? SIN_ACTIVIDAD
}
