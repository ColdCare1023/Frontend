import axios from 'axios'

import { apiClient } from '../api/apiClient'
import { normalizarRol, type Rol } from '@/domain/value-objects/Rol'
import type { DesafioCodigo, MotivoRechazoCodigo } from '@/domain/value-objects/codigoVerificacion'
import { MODO_DEMO } from '../demo/modoDemo'

/**
 * `TokenResponse` del backend. Con OTP_LOGIN_ENABLED=true el login con
 * contraseña no trae token: trae `requiere_codigo` y el `desafio` que se canjea
 * en /api/auth/login/verificar (ver docs/operacion/CODIGOS_VERIFICACION.md).
 */
interface TokenResponse {
  access_token: string | null
  token_type: string
  /** BE-025: contraseña temporal asignada por un administrador. */
  require_password_change?: boolean
  /** HU-44 / BE-014: falta el consentimiento de la versión vigente. */
  require_privacy_consent?: boolean
  requiere_codigo?: boolean
  desafio?: string | null
  email_enmascarado?: string | null
  expira_en_segundos?: number | null
  reenviar_en_segundos?: number | null
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
  /** FE-004: el backend solo admite el cambio de contraseña hasta resolverlo. */
  requiereCambioPassword: boolean
  /** FE-005: el backend responde 403 hasta que se acepte la política. */
  requierePrivacidad: boolean
}

/** El login abre sesión directamente o pide el código enviado por correo. */
export type RespuestaLogin = { tipo: 'sesion'; sesion: ResultadoLogin } | { tipo: 'codigo'; desafio: DesafioCodigo }

/** Valores del backend por defecto (CODIGO_TTL_MINUTOS, CODIGO_REENVIO_SEGUNDOS). */
const EXPIRA_POR_DEFECTO_S = 600
const REENVIO_POR_DEFECTO_S = 60

function resultado(data: TokenResponse): ResultadoLogin {
  if (!data.access_token) throw new Error('Respuesta de sesión sin token')
  return {
    accessToken: data.access_token,
    requiereCambioPassword: Boolean(data.require_password_change),
    requierePrivacidad: Boolean(data.require_privacy_consent),
  }
}

function desafioDe(data: TokenResponse): DesafioCodigo {
  if (!data.desafio) throw new Error('Respuesta de verificación sin desafío')
  return {
    desafio: data.desafio,
    emailEnmascarado: data.email_enmascarado ?? '',
    expiraEnSegundos: data.expira_en_segundos ?? EXPIRA_POR_DEFECTO_S,
    reenviarEnSegundos: data.reenviar_en_segundos ?? REENVIO_POR_DEFECTO_S,
  }
}

/**
 * POST /api/auth/login (formulario OAuth2). Funciona con el segundo factor
 * apagado (token directo) y encendido (desafío).
 *
 * `accesoRapidoDemo` solo existe en la demostración: los botones de rol entran
 * sin código para que recorrer los perfiles siga siendo un clic.
 */
export async function login(
  email: string,
  password: string,
  { accesoRapidoDemo = false }: { accesoRapidoDemo?: boolean } = {},
): Promise<RespuestaLogin> {
  const body = new URLSearchParams({ username: email, password })
  const headers: Record<string, string> = { 'Content-Type': 'application/x-www-form-urlencoded' }
  if (MODO_DEMO && accesoRapidoDemo) headers['X-Demo-Acceso-Rapido'] = '1'
  const { data } = await apiClient.post<TokenResponse>('/api/auth/login', body, { headers })
  if (data.requiere_codigo) return { tipo: 'codigo', desafio: desafioDe(data) }
  return { tipo: 'sesion', sesion: resultado(data) }
}

/** Segundo paso: canjea el desafío y el código por el token de siempre. */
export async function verificarCodigoLogin(desafio: string, codigo: string): Promise<ResultadoLogin> {
  const { data } = await apiClient.post<TokenResponse>('/api/auth/login/verificar', { desafio, codigo })
  return resultado(data)
}

/** Código nuevo para el mismo desafío (429 con Retry-After durante la espera). */
export async function reenviarCodigoLogin(desafio: string): Promise<DesafioCodigo> {
  const { data } = await apiClient.post<TokenResponse>('/api/auth/login/reenviar', { desafio })
  return desafioDe(data)
}

/**
 * Traduce el rechazo del backend. Los 401 de /login/verificar comparten
 * estado y solo se distinguen por el mensaje (auth_router + login_con_codigo).
 */
export function motivoRechazoCodigo(error: unknown): MotivoRechazoCodigo {
  if (!axios.isAxiosError(error) || !error.response) return 'error'
  const { status, data } = error.response
  const detalle = typeof (data as { detail?: unknown })?.detail === 'string' ? (data as { detail: string }).detail : ''
  if (status === 429) return 'limite'
  if (status === 503) return 'no_disponible'
  if (status === 401 || status === 400) {
    if (/no es correcto/i.test(detalle)) return 'incorrecto'
    if (/agotaron/i.test(detalle)) return 'agotado'
    if (/super[oó] el n[uú]mero/i.test(detalle)) return 'bloqueado'
    return 'caducado'
  }
  if (status === 422) return 'incorrecto'
  return 'error'
}

/** Segundos de `Retry-After` de un 429, si el servidor los indicó. */
export function segundosParaReintentar(error: unknown): number | null {
  if (!axios.isAxiosError(error)) return null
  const cabecera = error.response?.headers?.['retry-after'] as unknown
  const segundos = Number(cabecera)
  return Number.isFinite(segundos) && segundos > 0 ? Math.ceil(segundos) : null
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
  return resultado(data)
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
