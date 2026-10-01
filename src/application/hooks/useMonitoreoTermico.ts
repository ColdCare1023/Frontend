import { useCallback, useEffect, useState } from 'react'

import type { LecturaTermica } from '@/domain/entities/LecturaTermica'
import { apiClient } from '@/infrastructure/api/apiClient'
import { suscribirseLecturas } from '@/infrastructure/sse/sseClient'

// HU-31 criterio 4: ventana por defecto de 24 horas para la curva térmica del
// dashboard (antes era un conteo fijo de las últimas 60 lecturas, sin
// relación con el tiempo real transcurrido).
export const VENTANA_HORAS_POR_DEFECTO = 24

// Techo defensivo de memoria: a 30 s/lectura, 24 h son ~2880 puntos por
// dispositivo — lejos de este límite. Sin él, un rango ampliado a semanas
// podría acumular sin fin en el navegador.
export const MAX_LECTURAS_EN_MEMORIA = 5000

interface MonitoreoTermico {
  ultima: LecturaTermica | null
  serie: LecturaTermica[]
  sseConectado: boolean
  estadoHistorial: 'cargando' | 'completo' | 'error'
  reintentar: () => void
}

/**
 * Carga historial para la ventana activa y conserva última lectura en vivo al
 * cambiarla. La serie se mantiene en orden cronológico ascendente.
 */
export function useMonitoreoTermico(horasVentana: number = VENTANA_HORAS_POR_DEFECTO): MonitoreoTermico {
  const [serie, setSerie] = useState<LecturaTermica[]>([])
  const [ultima, setUltima] = useState<LecturaTermica | null>(null)
  const [sseConectado, setSseConectado] = useState(false)
  const [estadoHistorial, setEstadoHistorial] = useState<MonitoreoTermico['estadoHistorial']>('cargando')
  const [intento, setIntento] = useState(0)
  const reintentar = useCallback(() => setIntento((actual) => actual + 1), [])

  useEffect(() => {
    let activo = true
    // Mantiene visible la ventana anterior mientras llega la nueva respuesta.
    // Vaciarla aquí desmontaba el panel de monitoreo y producía un destello.
    setEstadoHistorial('cargando')

    const desde = new Date(Date.now() - horasVentana * 60 * 60 * 1000).toISOString()
    const desdeMs = new Date(desde).getTime()

    apiClient
      .get<LecturaTermica[]>('/api/lecturas', { params: { desde, limite: MAX_LECTURAS_EN_MEMORIA } })
      .then(({ data }) => {
        if (!activo) return
        // El historial no puede sobrescribir la serie: la suscripción SSE se
        // abre en el mismo efecto y no hay garantía de qué responde antes. Si
        // una lectura en vivo llegaba mientras el GET seguía en vuelo, este
        // `set` la borraba —y con una excursión térmica en marcha, esa es
        // justo la lectura que no puede perderse—. Se antepone el historial a
        // lo ya recibido, descartando por `id` lo que venga repetido.
        setSerie((previa) => {
          const enVentana = previa.filter((lectura) => new Date(lectura.timestamp).getTime() >= desdeMs)
          const yaRecibidas = new Set(enVentana.map((lectura) => lectura.id))
          const historial = [...data]
            .reverse()
            .filter((lectura) => new Date(lectura.timestamp).getTime() >= desdeMs)
            .filter((lectura) => !yaRecibidas.has(lectura.id))
          return [...historial, ...enVentana].slice(-MAX_LECTURAS_EN_MEMORIA)
        })
        const lecturaMasReciente = data.reduce<LecturaTermica | null>((reciente, lectura) =>
          !reciente || lectura.timestamp > reciente.timestamp ? lectura : reciente, null)
        if (lecturaMasReciente) {
          setUltima((previa) => !previa || lecturaMasReciente.timestamp > previa.timestamp ? lecturaMasReciente : previa)
        }
        setEstadoHistorial('completo')
      })
      .catch(() => {
        if (activo) setEstadoHistorial('error')
      })

    const cerrar = suscribirseLecturas(
      (lectura) => {
        setUltima((previa) => !previa || lectura.timestamp > previa.timestamp ? lectura : previa)
        if (new Date(lectura.timestamp).getTime() < desdeMs) return
        setSerie((previa) => {
          if (previa.some((actual) => actual.id === lectura.id)) return previa
          return [...previa, lectura].slice(-MAX_LECTURAS_EN_MEMORIA)
        })
      },
      (conectado) => setSseConectado(conectado),
    )

    return () => {
      activo = false
      cerrar()
    }
  }, [horasVentana, intento])

  return { ultima, serie, sseConectado, estadoHistorial, reintentar }
}
