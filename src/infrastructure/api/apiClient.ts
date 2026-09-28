import axios from 'axios'

import { demoAdapter } from '../demo/demoAdapter'
import { MODO_DEMO } from '../demo/modoDemo'

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

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  // En modo demo cada request se resuelve en memoria, sin tocar la red.
  ...(MODO_DEMO ? { adapter: demoAdapter } : {}),
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

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error) && error.response?.status === 401 && accessToken) {
      accessToken = null
      onSesionExpirada?.()
    }
    return Promise.reject(error)
  },
)
