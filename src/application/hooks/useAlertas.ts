import { useCallback, useEffect, useState } from 'react'
import axios from 'axios'

import type { AccionCorrectiva, AlertaTermica } from '@/domain/entities/AlertaTermica'
import type { EstadoAlerta } from '@/domain/value-objects/EstadoAlerta'
import { apiClient } from '@/infrastructure/api/apiClient'
import { rutaApi } from '@/lib/rutaApi'

export type ResultadoAccionAlerta = 'ok' | 'conflicto' | 'error'
export type ResultadoRectificacion = ResultadoAccionAlerta | 'prohibido'

// HU-23: filtro por la máquina de estados, no por el booleano `revisada`
// (que el backend conserva solo por compatibilidad hacia atrás).
export type FiltroEstado = 'todas' | EstadoAlerta

export function useAlertas() {
  const [alertas, setAlertas] = useState<AlertaTermica[]>([])
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState(false)
  const [filtro, setFiltro] = useState<FiltroEstado>('pendiente')

  const consultar = useCallback(async (filtroActual: FiltroEstado) => {
    setCargando(true)
    setErrorCarga(false)
    try {
      const params: Record<string, string> = { limite: '200' }
      if (filtroActual !== 'todas') params.estado = filtroActual
      const { data } = await apiClient.get<AlertaTermica[]>('/api/alertas', { params })
      setAlertas(data)
    } catch {
      setErrorCarga(true)
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    void consultar(filtro)
  }, [consultar, filtro])

  const reintentar = useCallback(() => void consultar(filtro), [consultar, filtro])

  // HU-23 Escenario 1: PENDIENTE -> RECONOCIDA. El nombre del endpoint
  // (/revisar) es histórico — se conserva por compatibilidad con el backend.
  //
  // HU-27 Escenario 2: si otro usuario ya reconoció (o atendió) esta alerta
  // entre que se cargó la lista y este click, el backend responde 409 — se
  // refresca la lista para que la fila desaparezca/actualice sola, en vez de
  // dejar un botón "Reconocer" fantasma sobre una alerta que ya cambió.
  const reconocerAlerta = useCallback(
    async (alertaId: string): Promise<ResultadoAccionAlerta> => {
      try {
        await apiClient.patch(rutaApi`/api/alertas/${alertaId}/revisar`)
        await consultar(filtro)
        return 'ok'
      } catch (error) {
        await consultar(filtro)
        if (axios.isAxiosError(error) && error.response?.status === 409) return 'conflicto'
        return 'error'
      }
    },
    [consultar, filtro],
  )

  // HU-23 Escenario 2 / HU-27 Escenario 2: registrar la acción correctiva
  // marca la alerta como ATENDIDA (RECONOCIDA -> ATENDIDA, o directamente
  // PENDIENTE -> ATENDIDA si nadie la reconoció antes). Si otro usuario ya la
  // atendió primero, el backend responde 409 — se informa en vez de fingir
  // éxito o de sobrescribir en silencio.
  const registrarAccionCorrectiva = useCallback(
    async (alertaId: string, descripcion: string): Promise<ResultadoAccionAlerta> => {
      try {
        await apiClient.post(rutaApi`/api/alertas/${alertaId}/acciones-correctivas`, { descripcion })
        await consultar(filtro)
        return 'ok'
      } catch (error) {
        await consultar(filtro)
        if (axios.isAxiosError(error) && error.response?.status === 409) return 'conflicto'
        return 'error'
      }
    },
    [consultar, filtro],
  )

  // HU-23 criterio 4: cronología de atención de una alerta (reconocimiento +
  // acciones correctivas + rectificaciones, HU-28), de solo lectura.
  const obtenerCicloAtencion = useCallback(async (alertaId: string): Promise<AccionCorrectiva[]> => {
    const { data } = await apiClient.get<AccionCorrectiva[]>(
      rutaApi`/api/alertas/${alertaId}/acciones-correctivas`,
    )
    return data
  }, [])

  // HU-28: rectificar crea una acción nueva que referencia a la anterior; la
  // original no se toca. 409: ya no es la versión vigente (alguien la
  // rectificó antes). 403: ni autor ni farmacéutico.
  const rectificarAccion = useCallback(
    async (accionId: string, descripcion: string, motivo: string): Promise<ResultadoRectificacion> => {
      try {
        await apiClient.post(rutaApi`/api/alertas/acciones-correctivas/${accionId}/rectificar`, {
          descripcion,
          motivo_rectificacion: motivo,
        })
        return 'ok'
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 409) return 'conflicto'
        if (axios.isAxiosError(error) && error.response?.status === 403) return 'prohibido'
        return 'error'
      }
    },
    [],
  )

  return {
    alertas,
    cargando,
    errorCarga,
    reintentar,
    filtro,
    setFiltro,
    reconocerAlerta,
    registrarAccionCorrectiva,
    obtenerCicloAtencion,
    rectificarAccion,
  }
}
