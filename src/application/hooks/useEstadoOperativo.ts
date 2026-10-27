import { useCallback, useEffect, useRef, useState } from 'react'

import { aplicarCambioConectividad, aplicarEstadoNodo, type Dispositivo } from '@/domain/entities/Dispositivo'
import { apiClient } from '@/infrastructure/api/apiClient'
import { suscribirseTiempoReal, type EstadoNodo } from '@/infrastructure/sse/sseClient'

/**
 * Estado operativo separado del riesgo térmico y de la clasificación IA.
 * Por defecto solo los nodos con incidencias; `todos` incluye también los
 * operativos (selector de equipo y tarjeta del equipo seleccionado).
 */
export function useEstadoOperativo(todos = false) {
  const [equipos, setEquipos] = useState<Dispositivo[]>([])
  // HU-48: el backend no guarda el buffer del nodo; se conserva el último
  // `estado_nodo` recibido por SSE para no perderlo en cada sondeo.
  const estadosNodo = useRef(new Map<string, EstadoNodo>())

  const consultar = useCallback(async () => {
    try {
      const { data } = await apiClient.get<Dispositivo[]>('/api/dispositivos/estado-operativo', {
        params: todos ? { todos: true } : undefined,
      })
      setEquipos([...estadosNodo.current.values()].reduce(aplicarEstadoNodo, data))
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
        onEstadoNodo: (estado) => {
          estadosNodo.current.set(estado.device_id, estado)
          setEquipos((previos) => aplicarEstadoNodo(previos, estado))
        },
        // HU-54: el incidente persistente se abre o cierra en el backend; se
        // vuelve a consultar en vez de esperar al siguiente sondeo de 15 s.
        onIncidenteOperativo: () => void consultar(),
      }),
    [consultar],
  )

  return { equipos, consultar }
}
