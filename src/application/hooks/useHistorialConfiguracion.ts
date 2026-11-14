import { useCallback, useEffect, useRef, useState } from 'react'
import axios from 'axios'

import type { CategoriaHistorial, Dispositivo, HistorialConfiguracion } from '@/domain/entities/Dispositivo'
import type { CadenaTrazabilidad } from '@/domain/entities/RegistroTrazabilidad'
import { apiClient } from '@/infrastructure/api/apiClient'
import { rutaApi } from '@/lib/rutaApi'

export interface FiltrosHistorialConfiguracion {
  categoria?: CategoriaHistorial
  desde?: string
  hasta?: string
}

export type ErrorHistorialConfiguracion = 'no_encontrado' | 'error'

/**
 * HU-49: historial de configuración de un equipo para el AUDITOR (solo
 * lectura). `GET /api/dispositivos` es del administrador, así que los equipos
 * salen de las cadenas de trazabilidad (incluye los dados de baja, que siguen
 * teniendo historia) y de los nodos activos.
 */
export function useHistorialConfiguracion() {
  const [equipos, setEquipos] = useState<string[]>([])
  const [cambios, setCambios] = useState<HistorialConfiguracion[]>([])
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<ErrorHistorialConfiguracion | null>(null)
  const turno = useRef(0)

  useEffect(() => {
    let vigente = true
    Promise.allSettled([
      apiClient.get<CadenaTrazabilidad[]>('/api/trazabilidad/cadenas'),
      apiClient.get<Dispositivo[]>('/api/dispositivos/estado-operativo', { params: { todos: true } }),
    ]).then(([cadenas, activos]) => {
      if (!vigente) return
      const ids = new Set<string>()
      if (cadenas.status === 'fulfilled' && Array.isArray(cadenas.value.data)) {
        for (const c of cadenas.value.data) if (!c.es_sistema) ids.add(c.chain_id)
      }
      if (activos.status === 'fulfilled' && Array.isArray(activos.value.data)) {
        for (const d of activos.value.data) if (d.id) ids.add(d.id)
      }
      setEquipos([...ids].sort())
    })
    return () => {
      vigente = false
    }
  }, [])

  const consultar = useCallback(async (deviceId: string, filtros: FiltrosHistorialConfiguracion = {}) => {
    const propio = ++turno.current
    setCargando(true)
    setError(null)
    try {
      const params: Record<string, string> = {}
      if (filtros.categoria) params.categoria = filtros.categoria
      if (filtros.desde) params.desde = new Date(filtros.desde).toISOString()
      if (filtros.hasta) params.hasta = new Date(filtros.hasta).toISOString()
      const { data } = await apiClient.get<HistorialConfiguracion[]>(rutaApi`/api/dispositivos/${deviceId}/historial-configuracion`, { params })
      if (propio !== turno.current) return
      setCambios(Array.isArray(data) ? data : [])
    } catch (e) {
      if (propio !== turno.current) return
      setCambios([])
      setError(axios.isAxiosError(e) && e.response?.status === 404 ? 'no_encontrado' : 'error')
    } finally {
      if (propio === turno.current) setCargando(false)
    }
  }, [])

  return { equipos, cambios, cargando, error, consultar }
}
