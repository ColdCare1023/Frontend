import { useCallback, useEffect, useState } from 'react'
import axios from 'axios'

import type { Dispositivo, HistorialConfiguracion } from '@/domain/entities/Dispositivo'
import { apiClient } from '@/infrastructure/api/apiClient'

export function useDispositivos() {
  const [dispositivos, setDispositivos] = useState<Dispositivo[]>([])
  const [cargando, setCargando] = useState(true)

  const consultar = useCallback(async () => {
    setCargando(true)
    try {
      const { data } = await apiClient.get<Dispositivo[]>('/api/dispositivos')
      setDispositivos(data)
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    void consultar()
  }, [consultar])

  const darDeBaja = useCallback(
    async (
      deviceId: string,
      motivo: string,
      descripcion: string | undefined,
      deviceIdReemplazo: string | undefined,
    ): Promise<'ok' | 'no_encontrado' | 'error'> => {
      try {
        await apiClient.post(`/api/dispositivos/${deviceId}/baja`, {
          motivo,
          descripcion: descripcion || undefined,
          device_id_reemplazo: deviceIdReemplazo || undefined,
        })
        await consultar()
        return 'ok'
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 404) return 'no_encontrado'
        return 'error'
      }
    },
    [consultar],
  )

  // HU-30: certificado de calibración del sensor.
  const registrarCalibracion = useCallback(
    async (
      deviceId: string,
      fechaCalibracion: string,
      numeroCertificado: string,
      observaciones: string | undefined,
      mesesVigencia: number,
    ): Promise<'ok' | 'error'> => {
      try {
        await apiClient.patch(`/api/dispositivos/${deviceId}/calibracion`, {
          fecha_calibracion: fechaCalibracion,
          numero_certificado: numeroCertificado,
          observaciones: observaciones || undefined,
          meses_vigencia: mesesVigencia,
        })
        await consultar()
        return 'ok'
      } catch {
        return 'error'
      }
    },
    [consultar],
  )

  // HU-51: ubicación y metadatos de instalación del sensor.
  const actualizarInstalacion = useCallback(
    async (
      deviceId: string,
      ubicacion: string | undefined,
      fechaInstalacion: string | undefined,
      observaciones: string | undefined,
    ): Promise<'ok' | 'error'> => {
      try {
        await apiClient.patch(`/api/dispositivos/${deviceId}/instalacion`, {
          ubicacion: ubicacion || undefined,
          fecha_instalacion: fechaInstalacion || undefined,
          observaciones: observaciones || undefined,
        })
        await consultar()
        return 'ok'
      } catch {
        return 'error'
      }
    },
    [consultar],
  )

  // HU-53/HU-54: responsable registrado (destinatario de avisos).
  const actualizarResponsable = useCallback(
    async (
      deviceId: string,
      nombre: string | undefined,
      email: string | undefined,
      telefono: string | undefined,
    ): Promise<'ok' | 'error'> => {
      try {
        await apiClient.patch(`/api/dispositivos/${deviceId}/responsable`, {
          nombre: nombre || undefined,
          email: email || undefined,
          telefono: telefono || undefined,
        })
        await consultar()
        return 'ok'
      } catch {
        return 'error'
      }
    },
    [consultar],
  )

  // HU-49: historial auditable de cambios (instalación, calibración,
  // responsable) de un dispositivo — de solo lectura.
  const obtenerHistorialConfiguracion = useCallback(
    async (deviceId: string): Promise<HistorialConfiguracion[]> => {
      const { data } = await apiClient.get<HistorialConfiguracion[]>(
        `/api/dispositivos/${deviceId}/historial-configuracion`,
      )
      return data
    },
    [],
  )

  return {
    dispositivos,
    cargando,
    consultar,
    darDeBaja,
    registrarCalibracion,
    actualizarInstalacion,
    actualizarResponsable,
    obtenerHistorialConfiguracion,
  }
}
