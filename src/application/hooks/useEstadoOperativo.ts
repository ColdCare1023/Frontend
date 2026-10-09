import { useCallback, useEffect, useState } from 'react'

import { aplicarCambioConectividad, type Dispositivo } from '@/domain/entities/Dispositivo'
import { apiClient } from '@/infrastructure/api/apiClient'
import { suscribirseTiempoReal } from '@/infrastructure/sse/sseClient'

/**
 * Estado operativo separado del riesgo térmico y de la clasificación IA.
 * Por defecto solo los nodos con incidencias; `todos` incluye también los
 * operativos (selector de equipo y tarjeta del equipo seleccionado).
 */
export function useEstadoOperativo(todos = false) {
  const [equipos, setEquipos] = useState<Dispositivo[]>([])

  const consultar = useCallback(async () => {
    try {
      const { data } = await apiClient.get<Dispositivo[]>('/api/dispositivos/estado-operativo', {
        params: todos ? { todos: true } : undefined,
      })
      setEquipos(data)
    } catch {
      // Endpoint nuevo no disponible en backend: no inferir estado ni mostrar alarma falsa.
      setEquipos([])
    }
  }, [todos])

  useEffect(() => {
    void consultar()
    const timer = window.setInterval(() => void consultar(), 15_000)
    return () => window.clearInterval(timer)
  }, [consultar])

  // HU-13: el cambio de conectividad llega por SSE en cuanto el backend lo
  // confirma (LWT, `online` o telemetría), sin esperar al siguiente sondeo.
  useEffect(
    () =>
      suscribirseTiempoReal({
        onConectividad: (cambio) => setEquipos((previos) => aplicarCambioConectividad(previos, cambio)),
      }),
    [],
  )

  return { equipos, consultar }
}
