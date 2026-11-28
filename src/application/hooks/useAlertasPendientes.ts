import { useCallback, useEffect, useRef, useState } from 'react'

import type { AlertaTermica } from '@/domain/entities/AlertaTermica'
import { apiClient } from '@/infrastructure/api/apiClient'
import { useAccionesAlerta, type CambioAlerta } from './useAccionesAlerta'
import { suscribirseTiempoReal } from '@/infrastructure/sse/sseClient'

export type EstadoAlertasPendientes = 'cargando' | 'listo' | 'error'

interface ResumenPendientes {
  total: number
  criticas: number
  /** Críticas primero; dentro de cada grupo, la más antigua primero. */
  alertas: AlertaTermica[]
  estado: EstadoAlertasPendientes
  ultimaAtendidaLocal?: AlertaTermica
}

const instante = (alerta: AlertaTermica) => alerta.iniciada_en ?? alerta.created_at ?? ''

/** Críticas primero y, dentro de cada grupo, la que lleva más tiempo esperando. */
export function ordenarPendientes(alertas: readonly AlertaTermica[]): AlertaTermica[] {
  return [...alertas].sort((a, b) => {
    const criticaA = a.nivel_riesgo === 'excursion_critica' ? 0 : 1
    const criticaB = b.nivel_riesgo === 'excursion_critica' ? 0 : 1
    return criticaA - criticaB || instante(a).localeCompare(instante(b))
  })
}

function resumir(alertas: AlertaTermica[]): ResumenPendientes {
  return {
    total: alertas.length,
    criticas: alertas.filter((alerta) => alerta.nivel_riesgo === 'excursion_critica').length,
    alertas: ordenarPendientes(alertas),
    estado: 'listo',
  }
}

/** HU-21/HU-23: alertas en PENDIENTE o RECONOCIDA, actualizadas por SSE. */
export function useAlertasPendientes() {
  const [resumen, setResumen] = useState<ResumenPendientes>({ total: 0, criticas: 0, alertas: [], estado: 'cargando' })

  const ultimaConsulta = useRef(0)
  const consultar = useCallback(async () => {
    const consulta = ++ultimaConsulta.current
    try {
      const respuestas = await Promise.all(
        ['pendiente', 'reconocida'].map((estado) =>
          apiClient.get<AlertaTermica[]>('/api/alertas', { params: { estado, limite: '200' } }),
        ),
      )
      if (consulta !== ultimaConsulta.current) return
      // La alerta puede cambiar de estado entre ambas respuestas: conservar la más avanzada.
      const porId = new Map(respuestas.flatMap(({ data }) => data.map((a) => [a.id, a] as const)))
      setResumen((previo) => ({ ...resumir([...porId.values()]), ultimaAtendidaLocal: previo.ultimaAtendidaLocal }))
    } catch {
      if (consulta !== ultimaConsulta.current) return
      // Sin datos no se afirma «0 pendientes»: el estado de error lo distingue.
      setResumen((previo) => ({ ...previo, total: 0, criticas: 0, alertas: [], estado: 'error' }))
    }
  }, [])

  useEffect(() => {
    void consultar()
  }, [consultar])

  useEffect(() => suscribirseTiempoReal({ onAlerta: () => void consultar() }), [consultar])

  const reintentar = useCallback(() => {
    setResumen((previo) => ({ ...previo, estado: 'cargando' }))
    void consultar()
  }, [consultar])

  const aplicarLocal = useCallback((id: string, cambio: CambioAlerta) => {
    setResumen((previo) => {
      if (previo.estado !== 'listo') return previo
      const actualizadas = previo.alertas.map((a) => a.id === id
        ? { ...a, ...(typeof cambio === 'function' ? cambio(a) : cambio) }
        : a)
      return {
        ...resumir(actualizadas.filter((a) => a.estado !== 'atendida')),
        ultimaAtendidaLocal: actualizadas.find((a) => a.id === id && a.estado === 'atendida') ?? previo.ultimaAtendidaLocal,
      }
    })
  }, [])
  const acciones = useAccionesAlerta(aplicarLocal, consultar, consultar)
  return { ...resumen, reintentar, ...acciones }
}

/**
 * Contexto del estado vacío: la última alerta atendida (misma consulta de
 * lectura que usa Alertas). Solo se pide cuando no hay pendientes.
 */
export function useUltimaAlertaAtendida(activo: boolean): AlertaTermica | null {
  const [ultima, setUltima] = useState<AlertaTermica | null>(null)
  useEffect(() => {
    if (!activo) return
    let vigente = true
    apiClient
      .get<AlertaTermica[]>('/api/alertas', { params: { estado: 'atendida', limite: '1' } })
      .then(({ data }) => {
        if (vigente) setUltima(data[0] ?? null)
      })
      .catch(() => {
        if (vigente) setUltima(null)
      })
    return () => {
      vigente = false
    }
  }, [activo])
  return activo ? ultima : null
}
