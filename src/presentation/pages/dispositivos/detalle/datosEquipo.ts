import { useCallback, useEffect, useState } from 'react'

import type { HistorialConfiguracion } from '@/domain/entities/Dispositivo'
import type { LecturaTermica } from '@/domain/entities/LecturaTermica'
import { apiClient } from '@/infrastructure/api/apiClient'
import { useFlota } from '../contextoFlota'

/**
 * HU-49: historial de configuración del equipo, pedido al abrir la pestaña
 * que lo usa (mismo endpoint de siempre). `recargar` tras guardar un cambio.
 */
export function useCambiosEquipo(deviceId: string) {
  const { obtenerHistorialConfiguracion } = useFlota()
  const [cambios, setCambios] = useState<HistorialConfiguracion[]>([])
  const [cargando, setCargando] = useState(true)

  const recargar = useCallback(async () => {
    setCargando(true)
    try {
      setCambios(await obtenerHistorialConfiguracion(deviceId))
    } catch {
      setCambios([])
    } finally {
      setCargando(false)
    }
  }, [deviceId, obtenerHistorialConfiguracion])

  useEffect(() => {
    void recargar()
  }, [recargar])

  return { cambios, cargando, recargar }
}

/**
 * Últimas lecturas del equipo: la misma consulta que Historial
 * (`GET /api/lecturas?device_id=&limite=200`), solo al abrir la pestaña.
 */
export function useLecturasEquipo(deviceId: string) {
  const [lecturas, setLecturas] = useState<LecturaTermica[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(false)

  const consultar = useCallback(async () => {
    setCargando(true)
    setError(false)
    try {
      const { data } = await apiClient.get<LecturaTermica[]>('/api/lecturas', {
        params: { limite: '200', device_id: deviceId },
      })
      setLecturas(Array.isArray(data) ? data : [])
    } catch {
      setError(true)
    } finally {
      setCargando(false)
    }
  }, [deviceId])

  useEffect(() => {
    void consultar()
  }, [consultar])

  return { lecturas, cargando, error, consultar }
}
