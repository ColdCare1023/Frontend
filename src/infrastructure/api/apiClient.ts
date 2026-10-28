import axios, { type AxiosAdapter } from 'axios'

import { MODO_DEMO } from '../demo/modoDemo'
import { normalizarFechasUtc } from './fechasUtc'

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

/**
 * El token JWT vive solo en memoria (nunca en localStorage) según los
 * controles de seguridad del stack (OWASP WSTG — mitigación de robo de
 * sesión por XSS). Recargar la página cierra la sesión.
 */
let accessToken: string | null = null

export function setAccessToken(token: string | null): void {
  accessToken = token
}

export function getAccessToken(): string | null {
  return accessToken
}

/**
 * En modo demo cada request se resuelve en memoria, sin tocar la red.
 *
 * FE-009: el adaptador (y con él los datos y cuentas demo) se carga con
 * import dinámico. `MODO_DEMO` es una constante de compilación, así que en el
 * build contra el backend esta rama desaparece y el módulo demo no se emite.
 */
const adaptadorDemo: AxiosAdapter = async (config) => (await import('../demo/demoAdapter')).demoAdapter(config)

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  ...(MODO_DEMO ? { adapter: adaptadorDemo } : {}),
})

apiClient.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`
  }
  return config
})

let onSesionExpirada: (() => void) | null = null

export function setOnSesionExpirada(handler: () => void): void {
  onSesionExpirada = handler
}

let onPrivacidadRequerida: (() => void) | null = null

/**
 * FE-005: el backend responde 403 a cualquier recurso mientras falte el
 * consentimiento de la versión VIGENTE de la política (p. ej. si cambia de
 * versión durante la sesión). El manejador reabre el modal de consentimiento.
 */
export function setOnPrivacidadRequerida(handler: () => void): void {
  onPrivacidadRequerida = handler
}

const DETALLE_PRIVACIDAD = /pol[ií]tica de privacidad/i

apiClient.interceptors.response.use(
  (response) => {
    response.data = normalizarFechasUtc(response.data)
    return response
  },
  (error) => {
    if (axios.isAxiosError(error) && error.response?.status === 401 && accessToken) {
      accessToken = null
      onSesionExpirada?.()
    }
    if (
      axios.isAxiosError(error) &&
      error.response?.status === 403 &&
      DETALLE_PRIVACIDAD.test(String((error.response.data as { detail?: unknown } | undefined)?.detail ?? ''))
    ) {
      onPrivacidadRequerida?.()
    }
    return Promise.reject(error)
  },
)
