import { useCallback, useEffect, useState } from 'react'

import type { LecturaTermica } from '@/domain/entities/LecturaTermica'
import { apiClient } from '@/infrastructure/api/apiClient'

export interface FiltrosHistorial {
  device_id?: string
  nivel_riesgo?: string
  desde?: string
  hasta?: string
}

export function useHistorial() {
  const [lecturas, setLecturas] = useState<LecturaTermica[]>([])
  const [cargando, setCargando] = useState(true)

  const consultar = useCallback(async (filtros: FiltrosHistorial = {}) => {
    setCargando(true)
    try {
      const params: Record<string, string> = { limite: '200' }
      if (filtros.device_id) params.device_id = filtros.device_id
      if (filtros.nivel_riesgo) params.nivel_riesgo = filtros.nivel_riesgo
      if (filtros.desde) params.desde = new Date(filtros.desde).toISOString()
      if (filtros.hasta) params.hasta = new Date(filtros.hasta).toISOString()
      const { data } = await apiClient.get<LecturaTermica[]>('/api/lecturas', { params })
      setLecturas(data)
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    void consultar()
  }, [consultar])

  return { lecturas, cargando, consultar }
}
