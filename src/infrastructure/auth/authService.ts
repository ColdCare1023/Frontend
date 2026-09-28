import { apiClient } from '../api/apiClient'
import type { Rol } from '@/domain/value-objects/Rol'

interface TokenResponse {
  access_token: string
  token_type: string
  require_privacy_consent: boolean
}

export interface SesionUsuario {
  id: string
  email: string
  rol: Rol
  /** Instante de expiración del JWT, en milisegundos (`exp` × 1000). */
  expiraEn: number
}

export interface ResultadoLogin {
  accessToken: string
  requierePrivacidad: boolean
}

export async function login(email: string, password: string): Promise<ResultadoLogin> {
  const body = new URLSearchParams({ username: email, password })
  const { data } = await apiClient.post<TokenResponse>('/api/auth/login', body, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  })
  return { accessToken: data.access_token, requierePrivacidad: data.require_privacy_consent }
}

/**
 * Canjea el ID token de Google por el JWT interno del sistema.
 *
 * Google solo acredita la identidad: el backend comprueba la firma contra el
 * JWKS de Google y exige además que el correo esté dado de alta y activo en la
 * tabla de usuarios. El token que vuelve es el mismo JWT que el del acceso con
 * contraseña, así que el resto del frontend no distingue el método.
 */
export async function loginConGoogle(idToken: string): Promise<ResultadoLogin> {
  const { data } = await apiClient.post<TokenResponse>('/api/auth/google', {
    id_token: idToken,
  })
  return { accessToken: data.access_token, requierePrivacidad: data.require_privacy_consent }
}

/** Decodifica el payload del JWT (sin verificar firma: eso lo hace el backend). */
export function decodificarSesion(token: string): SesionUsuario {
  const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
  return {
    id: payload.sub,
    email: payload.email,
    rol: payload.rol,
    // `exp` viene en segundos (RFC 7519); el resto del frontend trabaja en
    // milisegundos, así que se normaliza aquí y no en cada consumidor.
    expiraEn: typeof payload.exp === 'number' ? payload.exp * 1000 : 0,
  }
}
