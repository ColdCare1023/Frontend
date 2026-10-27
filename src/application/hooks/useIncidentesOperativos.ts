import { useCallback, useEffect, useState } from 'react'

import type { IncidenteOperativo } from '@/domain/entities/Dispositivo'
import { apiClient } from '@/infrastructure/api/apiClient'
import { suscribirseTiempoReal } from '@/infrastructure/sse/sseClient'

/**
 * HU-54 / A-3: historial de incidentes SIN_DATOS (apertura, aviso y
 * recuperación), separado de las alertas térmicas. Se refresca en cuanto el
 * backend abre o cierra un incidente (SSE `sin_datos` / `sin_datos_resuelto`).
 */
export function useIncidentesOperativos(limite = 50) {
  const [incidentes, setIncidentes] = useState<IncidenteOperativo[]>([])
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState(false)

  const consultar = useCallback(async () => {
    setErrorCarga(false)
    try {
      const { data } = await apiClient.get<IncidenteOperativo[]>('/api/dispositivos/incidentes', { params: { limite } })
      setIncidentes(data)
    } catch {
      setErrorCarga(true)
    } finally {
      setCargando(false)
    }
  }, [limite])

  useEffect(() => {
    void consultar()
  }, [consultar])

  useEffect(() => suscribirseTiempoReal({ onIncidenteOperativo: () => void consultar() }), [consultar])

  return { incidentes, cargando, errorCarga, consultar }
}
