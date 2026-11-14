import { useCallback, useEffect, useState } from 'react'
import axios from 'axios'

import type {
  EstadoCadena,
  RegistroTrazabilidad,
  VerificacionIntegridad,
  VerificacionSegmento,
} from '@/domain/entities/RegistroTrazabilidad'
import { apiClient } from '@/infrastructure/api/apiClient'
import { rutaApi } from '@/lib/rutaApi'

export function useTrazabilidad() {
  const [registros, setRegistros] = useState<RegistroTrazabilidad[]>([])
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState(false)
  const [verificacion, setVerificacion] = useState<VerificacionIntegridad | null>(null)
  const [verificando, setVerificando] = useState(false)
  const [estadoCadena, setEstadoCadena] = useState<EstadoCadena | null>(null)

  const consultar = useCallback(async (tipoEvento?: string, deviceId?: string) => {
    setCargando(true)
    setErrorCarga(false)
    try {
      const params: Record<string, string> = { limite: '200' }
      if (tipoEvento) params.tipo_evento = tipoEvento
      // `device_id` es un parámetro que GET /api/trazabilidad ya acepta.
      if (deviceId) params.device_id = deviceId
      const { data } = await apiClient.get<RegistroTrazabilidad[]>('/api/trazabilidad', { params })
      setRegistros(data)
    } catch {
      // No se relanza: quien refresca tras una operación ya hecha no debe
      // perder su resultado por un fallo de la recarga.
      setErrorCarga(true)
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    void consultar()
  }, [consultar])

  const consultarEstadoCadena = useCallback(async () => {
    try {
      const { data } = await apiClient.get<EstadoCadena>('/api/trazabilidad/estado')
      setEstadoCadena(data)
    } catch {
      // Sin estado de cadena la pantalla sigue siendo útil; el fallo de la
      // lista ya se muestra con `errorCarga`.
    }
  }, [])

  useEffect(() => {
    void consultarEstadoCadena()
  }, [consultarEstadoCadena])

  const verificarIntegridad = useCallback(async () => {
    setVerificando(true)
    try {
      const { data } = await apiClient.get<VerificacionIntegridad>('/api/trazabilidad/verificar')
      setVerificacion(data)
      await consultarEstadoCadena()
    } finally {
      setVerificando(false)
    }
  }, [consultarEstadoCadena])

  // HU-37: verificación acotada a un dispositivo y periodo — endpoint
  // distinto de /verificar (cadena completa). `null` en `error` cuando no se
  // ha intentado o la verificación fue exitosa; un string cuando falló, para
  // distinguir "sin ejecutar todavía" de "se ejecutó y dio error".
  const [verificacionSegmento, setVerificacionSegmento] = useState<VerificacionSegmento | null>(null)
  const [verificandoSegmento, setVerificandoSegmento] = useState(false)
  const [errorSegmento, setErrorSegmento] = useState<string | null>(null)

  const verificarPorDispositivo = useCallback(
    async (deviceId: string, desde: string, hasta: string) => {
      setVerificandoSegmento(true)
      setErrorSegmento(null)
      try {
        const { data } = await apiClient.get<VerificacionSegmento>(
          '/api/trazabilidad/verificar-dispositivo',
          { params: { device_id: deviceId, desde, hasta } },
        )
        setVerificacionSegmento(data)
      } catch (error) {
        setVerificacionSegmento(null)
        setErrorSegmento(
          axios.isAxiosError(error) && error.response?.status === 422
            ? 'rango_invalido'
            : 'error',
        )
      } finally {
        setVerificandoSegmento(false)
      }
    },
    [],
  )

  const aislarCorrupcion = useCallback(
    async (registroId: string): Promise<'ok' | 'error'> => {
      try {
        await apiClient.post(rutaApi`/api/trazabilidad/corrupcion/${registroId}/aislar`)
        await consultarEstadoCadena()
        return 'ok'
      } catch {
        return 'error'
      }
    },
    [consultarEstadoCadena],
  )

  return {
    registros,
    cargando,
    errorCarga,
    consultar,
    verificacion,
    verificando,
    verificarIntegridad,
    estadoCadena,
    aislarCorrupcion,
    verificacionSegmento,
    verificandoSegmento,
    errorSegmento,
    verificarPorDispositivo,
  }
}
