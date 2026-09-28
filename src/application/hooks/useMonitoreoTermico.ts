import { useEffect, useState } from 'react'

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
}

/**
 * Carga el historial de las últimas `horasVentana` horas (HU-31 criterio 4) y
 * se suscribe al flujo SSE en tiempo real. La serie se mantiene en orden
 * cronológico ascendente para las gráficas.
 */
export function useMonitoreoTermico(horasVentana: number = VENTANA_HORAS_POR_DEFECTO): MonitoreoTermico {
  const [serie, setSerie] = useState<LecturaTermica[]>([])
  const [sseConectado, setSseConectado] = useState(false)
  const [estadoHistorial, setEstadoHistorial] = useState<MonitoreoTermico['estadoHistorial']>('cargando')

  useEffect(() => {
    let activo = true
    // Se limpia al cambiar de ventana: mezclar una serie de 1 h con una
    // recién ampliada a 7 días confundiría el resumen y la gráfica mientras
    // llega la respuesta nueva.
    setSerie([])
    setEstadoHistorial('cargando')

    const desde = new Date(Date.now() - horasVentana * 60 * 60 * 1000).toISOString()

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
          const yaRecibidas = new Set(previa.map((lectura) => lectura.id))
          const historial = [...data]
            .reverse()
            .filter((lectura) => !yaRecibidas.has(lectura.id))
          return [...historial, ...previa].slice(-MAX_LECTURAS_EN_MEMORIA)
        })
        setEstadoHistorial('completo')
      })
      .catch(() => {
        if (activo) setEstadoHistorial('error')
      })

    const cerrar = suscribirseLecturas(
      (lectura) => {
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
  }, [horasVentana])

  return { ultima: serie.at(-1) ?? null, serie, sseConectado, estadoHistorial }
}
