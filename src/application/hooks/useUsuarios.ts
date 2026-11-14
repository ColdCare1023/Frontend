import { useCallback, useEffect, useState } from 'react'
import axios from 'axios'

import type { PasswordTemporal, Usuario, UsuarioCreado } from '@/domain/entities/Usuario'
import type { Rol } from '@/domain/value-objects/Rol'
import { apiClient } from '@/infrastructure/api/apiClient'
import { rutaApi } from '@/lib/rutaApi'

export type ResultadoCrear =
  | { estado: 'ok'; usuario: Usuario | null; activacion: boolean | null }
  | { estado: 'duplicado' | 'politica' | 'error' }

export function useUsuarios() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState(false)

  const consultar = useCallback(async () => {
    setCargando(true)
    setErrorCarga(false)
    try {
      const { data } = await apiClient.get<Usuario[]>('/api/usuarios')
      setUsuarios(data)
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

  const crear = useCallback(
    async (nombre: string, email: string, password: string, rol: Rol, telefono?: string): Promise<ResultadoCrear> => {
      try {
        // El celular (E.164) es opcional.
        const { data } = await apiClient.post<UsuarioCreado>('/api/usuarios', {
          nombre,
          email,
          password,
          rol,
          ...(telefono ? { telefono } : {}),
        })
        await consultar()
        return {
          estado: 'ok',
          usuario: data ?? null,
          // Si el backend no informa el campo, no se afirma que el correo salió.
          activacion: typeof data?.codigo_activacion_emitido === 'boolean' ? data.codigo_activacion_emitido : null,
        }
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 409) return { estado: 'duplicado' }
        if (axios.isAxiosError(error) && error.response?.status === 422) return { estado: 'politica' }
        return { estado: 'error' }
      }
    },
    [consultar],
  )

  const desactivar = useCallback(
    async (usuarioId: string, motivo: string): Promise<'ok' | 'conflicto' | 'error'> => {
      try {
        await apiClient.patch(rutaApi`/api/usuarios/${usuarioId}/desactivar`, { motivo })
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
        await apiClient.patch(rutaApi`/api/usuarios/${usuarioId}/rol`, { rol })
        await consultar()
        return 'ok'
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 409) return 'conflicto'
        return 'error'
      }
    },
    [consultar],
  )

  // FE-004 / BE-025: el administrador asigna una contraseña temporal (al
  // restablecer o al reactivar). El backend la devuelve una sola vez.
  const asignarTemporal = useCallback(
    async (usuarioId: string, accion: 'restablecer-password' | 'reactivar'): Promise<PasswordTemporal | null> => {
      try {
        const { data } = await apiClient.post<PasswordTemporal>(
          rutaApi`/api/usuarios/${usuarioId}/${accion}`,
        )
        await consultar()
        return data
      } catch {
        return null
      }
    },
    [consultar],
  )

  return { usuarios, cargando, errorCarga, reintentar: consultar, crear, desactivar, cambiarRol, asignarTemporal }
}
