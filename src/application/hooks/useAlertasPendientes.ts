import { useCallback, useEffect, useState } from 'react'

import type { AlertaTermica } from '@/domain/entities/AlertaTermica'
import { apiClient } from '@/infrastructure/api/apiClient'
import { suscribirseTiempoReal } from '@/infrastructure/sse/sseClient'

/** HU-21/HU-23: alertas en PENDIENTE o RECONOCIDA, actualizadas por SSE. */
export function useAlertasPendientes() {
  const [resumen, setResumen] = useState({ total: 0, criticas: 0 })

  const consultar = useCallback(async () => {
    try {
      const respuestas = await Promise.all(
        ['pendiente', 'reconocida'].map((estado) =>
          apiClient.get<AlertaTermica[]>('/api/alertas', { params: { estado, limite: '200' } }),
        ),
      )
      const alertas = respuestas.flatMap(({ data }) => data)
      setResumen({
        total: alertas.length,
        criticas: alertas.filter((alerta) => alerta.nivel_riesgo === 'excursion_critica').length,
      })
    } catch {
      setResumen({ total: 0, criticas: 0 })
    }
  }, [])

  useEffect(() => {
    void consultar()
  }, [consultar])

  useEffect(() => suscribirseTiempoReal({ onAlerta: () => void consultar() }), [consultar])

  return resumen
}
