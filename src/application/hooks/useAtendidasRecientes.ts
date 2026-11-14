import { useCallback, useEffect, useState } from 'react'

import type { AlertaTermica } from '@/domain/entities/AlertaTermica'
import { apiClient } from '@/infrastructure/api/apiClient'
import { suscribirseTiempoReal } from '@/infrastructure/sse/sseClient'

const LIMITE = 50
const AGRUPAR_SSE_MS = 750

export type EstadoConsulta = 'cargando' | 'listo' | 'error'

/**
 * Últimas alertas ATENDIDAS (la misma GET del filtro «Atendidas», con
 * `limite=50`). Alimenta el contexto de la bandeja: «Atendidas en 7 días»,
 * la atención media, la cinta 24 h y «Atendidas recientemente». Se refresca
 * por SSE agrupando ráfagas y cuando la página registra una acción.
 */
export function useAtendidasRecientes() {
  const [alertas, setAlertas] = useState<AlertaTermica[]>([])
  const [estado, setEstado] = useState<EstadoConsulta>('cargando')

  const recargar = useCallback(async () => {
    try {
      const { data } = await apiClient.get<AlertaTermica[]>('/api/alertas', {
        params: { estado: 'atendida', limite: String(LIMITE) },
      })
      setAlertas(data)
      setEstado('listo')
    } catch {
      // Con datos previos, se conservan: un refresco fallido no borra el contexto.
      setEstado((previo) => (previo === 'listo' ? 'listo' : 'error'))
    }
  }, [])

  useEffect(() => {
    void recargar()
  }, [recargar])

  useEffect(() => {
    let pendiente: number | null = null
    const cancelar = suscribirseTiempoReal({
      onAlerta: () => {
        if (pendiente !== null) return
        pendiente = window.setTimeout(() => {
          pendiente = null
          void recargar()
        }, AGRUPAR_SSE_MS)
      },
    })
    return () => {
      if (pendiente !== null) window.clearTimeout(pendiente)
      cancelar()
    }
  }, [recargar])

  return { alertas, estado, limite: LIMITE, recargar }
}
