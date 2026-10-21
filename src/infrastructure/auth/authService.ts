import { apiClient } from '../api/apiClient'
import { normalizarRol, type Rol } from '@/domain/value-objects/Rol'

interface TokenResponse {
  access_token: string
  token_type: string
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
}

export async function login(email: string, password: string): Promise<ResultadoLogin> {
  const body = new URLSearchParams({ username: email, password })
  const { data } = await apiClient.post<TokenResponse>('/api/auth/login', body, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  })
  return { accessToken: data.access_token }
}

/**
 * FE-001: canjea el ID token de Google por el JWT interno del sistema.
 *
 * Google solo acredita la identidad; la sesión la decide el backend, que
 * verifica el token contra el JWKS de Google y exige que el correo esté dado
 * de alta y activo. El token que vuelve es el mismo JWT que el del acceso con
 * contraseña.
 */
export async function loginConGoogle(idToken: string): Promise<ResultadoLogin> {
  const { data } = await apiClient.post<TokenResponse>('/api/auth/google', { id_token: idToken })
  return { accessToken: data.access_token }
}

/** Decodifica el payload del JWT (sin verificar firma: eso lo hace el backend). */
export function decodificarSesion(token: string): SesionUsuario {
  const segmento = token.split('.')[1]
  if (!segmento) throw new Error('Token de sesión inválido')
  const base64 = segmento.replace(/-/g, '+').replace(/_/g, '/')
  const relleno = '='.repeat((4 - (base64.length % 4)) % 4)
  const payload: Record<string, unknown> = JSON.parse(atob(base64 + relleno))
  const rol = normalizarRol(payload.rol)
  const expiraEn = typeof payload.exp === 'number' ? payload.exp * 1000 : Number.NaN
  if (
    typeof payload.sub !== 'string' ||
    typeof payload.email !== 'string' ||
    !rol ||
    !Number.isFinite(expiraEn)
  ) {
    throw new Error('Token de sesión inválido')
  }
  return {
    id: payload.sub,
    email: payload.email,
    rol,
    // `exp` viene en segundos (RFC 7519); el resto del frontend trabaja en
    // milisegundos, así que se normaliza aquí y no en cada consumidor.
    expiraEn,
  }
}
