import { create } from 'zustand'

import { apiClient, getAccessToken, setAccessToken } from '@/infrastructure/api/apiClient'
import {
  decodificarSesion,
  loginConGoogle as loginConGoogleService,
  login as loginService,
} from '@/infrastructure/auth/authService'
import type { SesionUsuario } from '@/infrastructure/auth/authService'
import { limpiarSesionActiva, marcarSesionActiva } from '@/infrastructure/auth/avisoSesion'
import { cambiarPassword as cambiarPasswordService } from '@/infrastructure/auth/credencialesService'
import { MODO_DEMO } from '@/infrastructure/demo/modoDemo'

interface AuthState {
  usuario: SesionUsuario | null
  autenticado: boolean
  /**
   * FE-004: contraseña temporal (alta, restablecimiento o reactivación por un
   * administrador). Hasta cambiarla, el backend responde 403 a todo lo demás.
   */
  requiereCambioPassword: boolean
  login: (email: string, password: string) => Promise<void>
  /**
   * FE-001: la sesión solo se abre con un token que el backend acaba de
   * emitir (contraseña o ID token de Google verificado en el servidor). No
   * existe una vía para instalar un token arbitrario.
   */
  loginConGoogle: (idToken: string) => Promise<void>
  /** FE-004: cambia la contraseña e instala el token nuevo que emite el backend. */
  cambiarPassword: (actual: string, nueva: string) => Promise<void>
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
  requiereCambioPassword = false,
): void {
  setAccessToken(accessToken)
  marcarSesionActiva()
  set({ usuario: decodificarSesion(accessToken), autenticado: true, requiereCambioPassword })
}

/**
 * Estado de sesión SOLO en memoria (sin persist): el stack prohíbe
 * localStorage para el JWT como mitigación de XSS (OWASP WSTG).
 */
export const useAuthStore = create<AuthState>((set) => ({
  usuario: null,
  autenticado: false,
  requiereCambioPassword: false,

  login: async (email, password) => {
    const { accessToken, requiereCambioPassword } = await loginService(email, password)
    aplicarSesion(set, accessToken, requiereCambioPassword)
  },

  loginConGoogle: async (idToken) => {
    const { accessToken, requiereCambioPassword } = await loginConGoogleService(idToken)
    aplicarSesion(set, accessToken, requiereCambioPassword)
  },

  cambiarPassword: async (actual, nueva) => {
    // El backend invalida todas las sesiones previas, incluida la actual, y
    // devuelve un token nuevo: hay que sustituirlo o la siguiente petición
    // terminaría en 401.
    const { accessToken } = await cambiarPasswordService(actual, nueva)
    aplicarSesion(set, accessToken, false)
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
    set({ usuario: null, autenticado: false, requiereCambioPassword: false })
  },
}))
