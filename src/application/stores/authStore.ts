import { create } from 'zustand'

import { apiClient, getAccessToken, setAccessToken } from '@/infrastructure/api/apiClient'
import {
  decodificarSesion,
  login as loginService,
  loginConGoogle as loginConGoogleService,
} from '@/infrastructure/auth/authService'
import type { SesionUsuario } from '@/infrastructure/auth/authService'
import { limpiarSesionActiva, marcarSesionActiva } from '@/infrastructure/auth/avisoSesion'
import { MODO_DEMO } from '@/infrastructure/demo/modoDemo'

interface AuthState {
  usuario: SesionUsuario | null
  autenticado: boolean
  requierePrivacidad: boolean
  login: (email: string, password: string) => Promise<void>
  /** RF-17: acceso alternativo. Recibe el ID token que emite Google en el
   * navegador; la autorización la sigue resolviendo el backend. */
  loginConGoogle: (idToken: string) => Promise<void>
  /**
   * `revocar: false` para el cierre provocado por una sesión ya expirada:
   * el token no sirve, así que pedir su revocación solo produciría un 401.
   */
  logout: (opciones?: { revocar?: boolean }) => void
  aceptarPrivacidad: () => Promise<void>
  rechazarPrivacidad: () => Promise<void>
}

const CLAVE_TOKEN_DEMO = 'cf_demo_token'

/**
 * Solo en modo demo la sesión sobrevive a la recarga (el token es falso,
 * sin valor real). En producción el JWT vive únicamente en memoria.
 */
function restaurarSesionDemo(): SesionUsuario | null {
  if (!MODO_DEMO) return null
  const token = sessionStorage.getItem(CLAVE_TOKEN_DEMO)
  if (!token) return null
  setAccessToken(token)
  return decodificarSesion(token)
}

const sesionRestaurada = restaurarSesionDemo()

/**
 * Efectos de abrir sesión, compartidos por todos los métodos de acceso.
 *
 * Extraído para que contraseña y Google no puedan divergir: si un método
 * olvidara `marcarSesionActiva()`, el aviso de expiración no se armaría y la
 * sesión moriría sin previo aviso en mitad de una revisión de alertas.
 */
function aplicarSesion(
  set: (estado: Partial<AuthState>) => void,
  accessToken: string,
  requierePrivacidad: boolean,
): void {
  setAccessToken(accessToken)
  marcarSesionActiva()
  if (MODO_DEMO) sessionStorage.setItem(CLAVE_TOKEN_DEMO, accessToken)
  set({ usuario: decodificarSesion(accessToken), autenticado: true, requierePrivacidad })
}

/**
 * Estado de sesión SOLO en memoria (sin persist): el stack prohíbe
 * localStorage para el JWT como mitigación de XSS (OWASP WSTG).
 */
export const useAuthStore = create<AuthState>((set) => ({
  usuario: sesionRestaurada,
  autenticado: sesionRestaurada !== null,
  requierePrivacidad: false,

  login: async (email, password) => {
    const { accessToken, requierePrivacidad } = await loginService(email, password)
    aplicarSesion(set, accessToken, requierePrivacidad)
  },

  loginConGoogle: async (idToken) => {
    const { accessToken, requierePrivacidad } = await loginConGoogleService(idToken)
    // Misma sesión resultante que con contraseña: el token es el JWT interno,
    // no el de Google. Si se guardara el de Google, el resto del sistema no
    // podría leer el rol ni la expiración que gobiernan el RBAC.
    aplicarSesion(set, accessToken, requierePrivacidad)
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
    if (MODO_DEMO) sessionStorage.removeItem(CLAVE_TOKEN_DEMO)
    set({ usuario: null, autenticado: false, requierePrivacidad: false })
  },

  aceptarPrivacidad: async () => {
    await apiClient.post('/api/auth/privacidad/aceptar')
    set({ requierePrivacidad: false })
  },

  rechazarPrivacidad: async () => {
    try {
      await apiClient.post('/api/auth/privacidad/rechazar')
    } catch {
      // El backend responde 401 intencionalmente (revoca el token): esperado.
    }
  },
}))
