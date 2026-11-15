import { useCallback, useEffect, useRef, useState } from 'react'
import axios from 'axios'

import { normalizarEstadoServicio, type EstadoServicio } from '@/domain/entities/EstadoServicio'
import { apiClient } from '@/infrastructure/api/apiClient'

/** Cada cuánto se vuelve a consultar mientras la pestaña está visible. */
export const INTERVALO_ESTADO_SERVICIO_MS = 30_000

/** 401: sesión no válida; 403: el rol no es administrador; resto: falla de red o del servidor. */
export type ErrorEstadoServicio = 'sin_sesion' | 'sin_permiso' | 'error'

/**
 * `GET /health/detalle` (solo ADMINISTRADOR) para «Estado del servicio».
 *
 * Mismo sondeo que el estado operativo (PERFORMANCE C1): cada 30 s solo con la
 * pestaña visible y de inmediato al volver a ella. Una consulta fallida tras
 * otra exitosa conserva los últimos datos (y su hora) en vez de vaciar la
 * pantalla; un 401/403 sí los descarta: ya no se pueden ver.
 *
 * `refrescando` cubre cualquier consulta; `refrescandoManual` solo la que pidió
 * la persona con «Actualizar» (el sondeo no debe girar ni renombrar el botón).
 */
export function useEstadoServicio() {
  const [datos, setDatos] = useState<EstadoServicio | null>(null)
  const [cargando, setCargando] = useState(true)
  const [refrescando, setRefrescando] = useState(false)
  const [refrescandoManual, setRefrescandoManual] = useState(false)
  const [error, setError] = useState<ErrorEstadoServicio | null>(null)
  /** Hora local de la última consulta que respondió, para «Consultado …». */
  const [consultadoEn, setConsultadoEn] = useState<string | null>(null)
  const turno = useRef(0)

  const consultar = useCallback(async (manual = false) => {
    const propio = ++turno.current
    setRefrescando(true)
    if (manual) setRefrescandoManual(true)
    try {
      const { data } = await apiClient.get<unknown>('/health/detalle')
      if (propio !== turno.current) return
      setDatos(normalizarEstadoServicio(data))
      setConsultadoEn(new Date().toISOString())
      setError(null)
    } catch (e) {
      if (propio !== turno.current) return
      const status = axios.isAxiosError(e) ? e.response?.status : undefined
      if (status === 401 || status === 403) {
        setDatos(null)
        setError(status === 401 ? 'sin_sesion' : 'sin_permiso')
      } else {
        setError('error')
      }
    } finally {
      if (propio === turno.current) {
        setCargando(false)
        setRefrescando(false)
        setRefrescandoManual(false)
      }
    }
  }, [])

  useEffect(() => {
    void consultar()
    const timer = window.setInterval(() => {
      if (!document.hidden) void consultar()
    }, INTERVALO_ESTADO_SERVICIO_MS)
    const alVolver = () => {
      if (!document.hidden) void consultar()
    }
    document.addEventListener('visibilitychange', alVolver)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', alVolver)
    }
  }, [consultar])

  const actualizar = useCallback(() => consultar(true), [consultar])

  return { datos, cargando, refrescando, refrescandoManual, error, consultadoEn, actualizar }
}
