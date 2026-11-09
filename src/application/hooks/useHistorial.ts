import { useCallback, useEffect, useState } from 'react'

import type { LecturaTermica } from '@/domain/entities/LecturaTermica'
import { apiClient } from '@/infrastructure/api/apiClient'

export interface FiltrosHistorial {
  device_id?: string
  /** HU-36 / B-14: riesgo efectivo, el mismo que muestra la tabla (no la clase cruda). */
  riesgo_efectivo?: string
  desde?: string
  hasta?: string
}

export function useHistorial() {
  const [lecturas, setLecturas] = useState<LecturaTermica[]>([])
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState(false)

  const consultar = useCallback(async (filtros: FiltrosHistorial = {}) => {
    setCargando(true)
    setErrorCarga(false)
    try {
      const params: Record<string, string> = { limite: '200' }
      if (filtros.device_id) params.device_id = filtros.device_id
      if (filtros.riesgo_efectivo) params.riesgo_efectivo = filtros.riesgo_efectivo
      if (filtros.desde) params.desde = new Date(filtros.desde).toISOString()
      if (filtros.hasta) params.hasta = new Date(filtros.hasta).toISOString()
      const { data } = await apiClient.get<LecturaTermica[]>('/api/lecturas', { params })
      setLecturas(data)
    } catch {
      setErrorCarga(true)
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    void consultar()
  }, [consultar])

  return { lecturas, cargando, errorCarga, consultar }
}
