import { useCallback, useEffect, useState } from 'react'
import axios from 'axios'

import type { Usuario } from '@/domain/entities/Usuario'
import type { Rol } from '@/domain/value-objects/Rol'
import { apiClient } from '@/infrastructure/api/apiClient'

export function useUsuarios() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [cargando, setCargando] = useState(true)

  const consultar = useCallback(async () => {
    setCargando(true)
    try {
      const { data } = await apiClient.get<Usuario[]>('/api/usuarios')
      setUsuarios(data)
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    void consultar()
  }, [consultar])

  const crear = useCallback(
    async (nombre: string, email: string, password: string, rol: Rol): Promise<'ok' | 'duplicado' | 'error'> => {
      try {
        await apiClient.post('/api/usuarios', { nombre, email, password, rol })
        await consultar()
        return 'ok'
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 409) return 'duplicado'
        return 'error'
      }
    },
    [consultar],
  )

  const desactivar = useCallback(
    async (usuarioId: string, motivo: string): Promise<'ok' | 'conflicto' | 'error'> => {
      try {
        await apiClient.patch(`/api/usuarios/${usuarioId}/desactivar`, { motivo })
        await consultar()
        return 'ok'
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 409) return 'conflicto'
        return 'error'
      }
    },
    [consultar],
  )

  // HU-41 criterio 1: "crea un usuario O asigna/modifica un rol" — un
  // administrador puede cambiar el rol de un usuario YA existente, no solo
  // fijarlo al crearlo.
  const cambiarRol = useCallback(
    async (usuarioId: string, rol: Rol): Promise<'ok' | 'conflicto' | 'error'> => {
      try {
        await apiClient.patch(`/api/usuarios/${usuarioId}/rol`, { rol })
        await consultar()
        return 'ok'
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 409) return 'conflicto'
        return 'error'
      }
    },
    [consultar],
  )

  return { usuarios, cargando, crear, desactivar, cambiarRol }
}
