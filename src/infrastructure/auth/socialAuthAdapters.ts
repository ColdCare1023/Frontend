import { crearTokenDemo, estadoDemo } from '../demo/datosDemo'

export interface SocialUser {
  provider: 'google' | 'facebook'
  providerId: string
  email: string
  name: string
  avatarUrl?: string
}

export type SocialAuthStatus = 'idle' | 'loading' | 'success' | 'not_authorized' | 'cancelled' | 'error'

export interface SocialAuthResult {
  status: SocialAuthStatus
  user?: SocialUser
  accessToken?: string
  errorMessage?: string
}

export interface ISocialAuthAdapter {
  readonly provider: 'google' | 'facebook'
  authenticate(hintEmail?: string): Promise<SocialAuthResult>
}

/**
 * Adaptador para autenticación federada con Google.
 * Cumple con RBAC: la autenticación con el proveedor valida la identidad,
 * pero SOLO se concede sesión si el usuario está registrado y activo en ColdCare.
 * En caso contrario, se devuelve `not_authorized` para guiar al usuario a "Solicitar acceso".
 */
export class GoogleAuthAdapter implements ISocialAuthAdapter {
  readonly provider = 'google' as const

  async authenticate(hintEmail?: string): Promise<SocialAuthResult> {
    try {
      // Simulación de latencia de handshake OAuth2 / OpenID Connect
      await new Promise((resolve) => setTimeout(resolve, 600))

      // En modo demo o desarrollo, o cuando se provee un correo de prueba:
      const emailTentativo = (hintEmail && hintEmail.includes('@') ? hintEmail : 'usuario.google@farmacia.pe').trim().toLowerCase()
      const nombreUsuario = emailTentativo.split('@')[0]?.replace(/\./g, ' ') ?? 'Usuario Google'

      const socialUser: SocialUser = {
        provider: 'google',
        providerId: `goog_${Date.now()}`,
        email: emailTentativo,
        name: nombreUsuario.charAt(0).toUpperCase() + nombreUsuario.slice(1),
        avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(nombreUsuario)}`,
      }

      // Verificación estricta de RBAC en el sistema ColdCare
      const usuarioEncontrado = estadoDemo.usuarios.find(
        (u) => u.email.toLowerCase() === emailTentativo,
      )

      if (usuarioEncontrado && usuarioEncontrado.is_active) {
        // Usuario federado autorizado en ColdCare
        const token = crearTokenDemo(emailTentativo)
        return {
          status: 'success',
          user: socialUser,
          accessToken: token,
        }
      }

      // Usuario federado válido ante el proveedor, pero SIN ROL / SIN AUTORIZACIÓN en ColdCare
      return {
        status: 'not_authorized',
        user: socialUser,
        errorMessage: 'Tu cuenta se autenticó correctamente con Google, pero aún no tiene acceso asignado en el sistema.',
      }
    } catch {
      return {
        status: 'error',
        errorMessage: 'No se pudo conectar con el servicio de autenticación de Google.',
      }
    }
  }
}

/**
 * Adaptador para autenticación federada con Facebook.
 * Cumple con RBAC: la autenticación con el proveedor valida la identidad,
 * pero SOLO se concede sesión si el usuario está registrado y activo en ColdCare.
 */
export class FacebookAuthAdapter implements ISocialAuthAdapter {
  readonly provider = 'facebook' as const

  async authenticate(hintEmail?: string): Promise<SocialAuthResult> {
    try {
      await new Promise((resolve) => setTimeout(resolve, 600))

      const emailTentativo = (hintEmail && hintEmail.includes('@') ? hintEmail : 'usuario.fb@farmacia.pe').trim().toLowerCase()
      const nombreUsuario = emailTentativo.split('@')[0]?.replace(/\./g, ' ') ?? 'Usuario Facebook'

      const socialUser: SocialUser = {
        provider: 'facebook',
        providerId: `fb_${Date.now()}`,
        email: emailTentativo,
        name: nombreUsuario.charAt(0).toUpperCase() + nombreUsuario.slice(1),
        avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(nombreUsuario)}`,
      }

      const usuarioEncontrado = estadoDemo.usuarios.find(
        (u) => u.email.toLowerCase() === emailTentativo,
      )

      if (usuarioEncontrado && usuarioEncontrado.is_active) {
        const token = crearTokenDemo(emailTentativo)
        return {
          status: 'success',
          user: socialUser,
          accessToken: token,
        }
      }

      return {
        status: 'not_authorized',
        user: socialUser,
        errorMessage: 'Tu cuenta se autenticó correctamente con Facebook, pero aún no tiene acceso asignado en el sistema.',
      }
    } catch {
      return {
        status: 'error',
        errorMessage: 'No se pudo conectar con el servicio de autenticación de Facebook.',
      }
    }
  }
}

export const googleAuthAdapter = new GoogleAuthAdapter()
export const facebookAuthAdapter = new FacebookAuthAdapter()
