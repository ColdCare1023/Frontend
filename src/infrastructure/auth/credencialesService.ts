import axios from 'axios'

import { apiClient } from '../api/apiClient'

/**
 * FE-004: ciclo de vida de la contraseña contra el backend real (BE-025).
 * Sustituye al servicio simulado que aceptaba un token fijo incluido en el
 * bundle y "enviaba" correos que nunca salían.
 */

function estado(error: unknown): number | undefined {
  return axios.isAxiosError(error) ? error.response?.status : undefined
}

export type ResultadoSolicitud = 'enviado' | 'no_disponible' | 'limite' | 'error'

/** La respuesta es la misma exista o no la cuenta (anti-enumeración). */
export async function solicitarRecuperacion(email: string): Promise<ResultadoSolicitud> {
  try {
    await apiClient.post('/api/auth/recuperar-password', { email })
    return 'enviado'
  } catch (error) {
    const codigo = estado(error)
    if (codigo === 503) return 'no_disponible'
    if (codigo === 429) return 'limite'
    return 'error'
  }
}

export type ResultadoRestablecimiento = 'ok' | 'enlace_invalido' | 'password_invalida' | 'limite' | 'error'

export async function restablecerPassword(token: string, passwordNueva: string): Promise<ResultadoRestablecimiento> {
  try {
    await apiClient.post('/api/auth/restablecer-password', { token, password_nueva: passwordNueva })
    return 'ok'
  } catch (error) {
    const codigo = estado(error)
    if (codigo === 400) return 'enlace_invalido'
    if (codigo === 422) return 'password_invalida'
    if (codigo === 429) return 'limite'
    return 'error'
  }
}

export interface PasswordCambiada {
  accessToken: string
  requierePrivacidad: boolean
}

/** Lanza el error de axios: el llamador distingue 400 (actual incorrecta). */
export async function cambiarPassword(actual: string, nueva: string): Promise<PasswordCambiada> {
  const { data } = await apiClient.post<{ access_token: string; require_privacy_consent?: boolean }>(
    '/api/auth/cambiar-password',
    { password_actual: actual, password_nueva: nueva },
  )
  return { accessToken: data.access_token, requierePrivacidad: Boolean(data.require_privacy_consent) }
}

/**
 * El enlace del correo trae el token en el fragmento (`#token=…`), que el
 * navegador no envía a ningún servidor. Se lee una vez y se borra de la
 * barra de direcciones y del historial para que no quede a la vista.
 */
export function consumirTokenDelEnlace(): string | null {
  const parametros = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  const token = parametros.get('token')
  if (window.location.hash) {
    window.history.replaceState(null, '', window.location.pathname + window.location.search)
  }
  return token && token.trim() ? token.trim() : null
}
