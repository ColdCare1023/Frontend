import { create } from 'zustand'

import { apiClient, getAccessToken, setAccessToken } from '@/infrastructure/api/apiClient'
import { decodificarSesion, login as loginService } from '@/infrastructure/auth/authService'
import type { SesionUsuario } from '@/infrastructure/auth/authService'
import { limpiarSesionActiva, marcarSesionActiva } from '@/infrastructure/auth/avisoSesion'
import { MODO_DEMO } from '@/infrastructure/demo/modoDemo'

interface AuthState {
  usuario: SesionUsuario | null
  autenticado: boolean
  login: (email: string, password: string) => Promise<void>
  loginConToken: (accessToken: string) => void
  /**
   * `revocar: false` para el cierre provocado por una sesión ya expirada:
   * el token no sirve, así que pedir su revocación solo produciría un 401.
   */
  logout: (opciones?: { revocar?: boolean }) => void
}

/**
 * Centraliza los efectos de abrir sesión.
 *
 * Si el login olvida `marcarSesionActiva()`, el aviso de expiración no se arma.
 */
function aplicarSesion(
  set: (estado: Partial<AuthState>) => void,
  accessToken: string,
): void {
  setAccessToken(accessToken)
  marcarSesionActiva()
  set({ usuario: decodificarSesion(accessToken), autenticado: true })
}

/**
 * Estado de sesión SOLO en memoria (sin persist): el stack prohíbe
 * localStorage para el JWT como mitigación de XSS (OWASP WSTG).
 */
export const useAuthStore = create<AuthState>((set) => ({
  usuario: null,
  autenticado: false,

  login: async (email, password) => {
    const { accessToken } = await loginService(email, password)
    aplicarSesion(set, accessToken)
  },

  loginConToken: (accessToken: string) => {
    aplicarSesion(set, accessToken)
  },

  logout: ({ revocar = true } = {}) => {
    // El backend revoca el jti del token (lista de revocación en memoria): sin
    // esta llamada, un JWT copiado del tráfico seguiría siendo válido hasta su
    // expiración aunque el usuario hubiera cerrado sesión.
    //
    // No se espera la respuesta a propósito: el estado local debe limpiarse
    // igual aunque la red falle, o un backend caído dejaría al usuario dentro.
    const token = getAccessToken()
    if (revocar && !MODO_DEMO && token) {
      // La cabecera se fija a mano en vez de dejarla al interceptor: este lee
      // el token en un microtask, para entonces `setAccessToken(null)` ya
      // habría corrido y la petición saldría sin autenticar (401), dejando el
      // jti sin revocar.
      void apiClient
        .post('/api/auth/logout', undefined, {
          headers: { Authorization: `Bearer ${token}` },
        })
        .catch(() => {
          // Sin conexión no se puede revocar en el servidor; la sesión local se
          // cierra de todos modos y el token expirará por sí solo.
        })
    }
    setAccessToken(null)
    limpiarSesionActiva()
    set({ usuario: null, autenticado: false })
  },
}))
