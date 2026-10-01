import { useCallback, useEffect, useState } from 'react'

import type { Dispositivo } from '@/domain/entities/Dispositivo'
import { apiClient } from '@/infrastructure/api/apiClient'

/** Estado operativo separado del riesgo térmico y de la clasificación IA. */
export function useEstadoOperativo() {
  const [equipos, setEquipos] = useState<Dispositivo[]>([])

  const consultar = useCallback(async () => {
    try {
      const { data } = await apiClient.get<Dispositivo[]>('/api/dispositivos/estado-operativo')
      setEquipos(data)
    } catch {
      // Endpoint nuevo no disponible en backend: no inferir estado ni mostrar alarma falsa.
      setEquipos([])
    }
  }, [])

  useEffect(() => {
    void consultar()
    const timer = window.setInterval(() => void consultar(), 15_000)
    return () => window.clearInterval(timer)
  }, [consultar])

  return { equipos, consultar }
}
