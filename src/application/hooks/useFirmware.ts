import { useCallback, useEffect, useState } from 'react'
import axios from 'axios'

import type { FirmwareDespliegue, FirmwareRelease } from '@/domain/entities/Firmware'
import { apiClient } from '@/infrastructure/api/apiClient'

export function useFirmware() {
  const [releases, setReleases] = useState<FirmwareRelease[]>([])
  const [cargando, setCargando] = useState(true)

  const consultar = useCallback(async () => {
    setCargando(true)
    try {
      const { data } = await apiClient.get<FirmwareRelease[]>('/api/firmware/releases')
      setReleases(data)
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    void consultar()
  }, [consultar])

  const prepararRelease = useCallback(
    async (version: string, hashSha256: string, descripcion: string): Promise<'ok' | 'duplicado' | 'error'> => {
      try {
        await apiClient.post('/api/firmware/releases', { version, hash_sha256: hashSha256, descripcion })
        await consultar()
        return 'ok'
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 409) return 'duplicado'
        return 'error'
      }
    },
    [consultar],
  )

  const programarDespliegue = useCallback(
    async (deviceId: string, versionObjetivo: string): Promise<FirmwareDespliegue | 'downgrade' | 'no_encontrado' | 'error'> => {
      try {
        const { data } = await apiClient.post<FirmwareDespliegue>('/api/firmware/despliegues', {
          device_id: deviceId,
          version_objetivo: versionObjetivo,
        })
        return data
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 409) return 'downgrade'
        if (axios.isAxiosError(error) && error.response?.status === 404) return 'no_encontrado'
        return 'error'
      }
    },
    [],
  )

  const ejecutarDespliegue = useCallback(
    async (despliegueId: string): Promise<FirmwareDespliegue | 'error'> => {
      try {
        const { data } = await apiClient.post<FirmwareDespliegue>(
          `/api/firmware/despliegues/${despliegueId}/ejecutar`,
        )
        return data
      } catch {
        return 'error'
      }
    },
    [],
  )

  return { releases, cargando, consultar, prepararRelease, programarDespliegue, ejecutarDespliegue }
}
