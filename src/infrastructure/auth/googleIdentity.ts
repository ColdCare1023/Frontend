/**
 * Integración con Google Identity Services (GIS).
 *
 * GIS se carga desde `accounts.google.com` en tiempo de ejecución en vez de
 * empaquetarse: Google no publica el cliente en npm y exige servirlo desde su
 * dominio para poder rotarlo. Eso implica que la CSP debe permitir
 * explícitamente `script-src`, `connect-src` y `frame-src` hacia
 * `https://accounts.google.com` (ver `vercel.json`); sin esas tres directivas
 * el botón se monta pero el navegador bloquea el flujo sin mensaje útil.
 *
 * El script SOLO se inyecta cuando hay `VITE_GOOGLE_CLIENT_ID`. Si no está
 * configurado no se contacta con Google en absoluto: una instalación que no usa
 * este método no carga código de terceros ni filtra visitas a Google.
 */

export const GOOGLE_CLIENT_ID: string = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? ''

/** ¿Está configurado el acceso con Google en este build? */
export const GOOGLE_HABILITADO = GOOGLE_CLIENT_ID !== ''

const URL_GIS = 'https://accounts.google.com/gsi/client'

interface RespuestaCredencial {
  credential: string
}

interface GoogleAccountsId {
  initialize: (config: {
    client_id: string
    callback: (respuesta: RespuestaCredencial) => void
    auto_select?: boolean
    cancel_on_tap_outside?: boolean
  }) => void
  renderButton: (contenedor: HTMLElement, opciones: Record<string, unknown>) => void
}

declare global {
  interface Window {
    google?: { accounts: { id: GoogleAccountsId } }
  }
}

let promesaCarga: Promise<GoogleAccountsId> | null = null

/** Carga el script de GIS una sola vez y resuelve con su API. */
export function cargarGoogleIdentity(): Promise<GoogleAccountsId> {
  if (!GOOGLE_HABILITADO) {
    return Promise.reject(new Error('VITE_GOOGLE_CLIENT_ID no está configurado'))
  }
  if (promesaCarga) return promesaCarga

  promesaCarga = new Promise<GoogleAccountsId>((resolver, rechazar) => {
    if (window.google?.accounts?.id) {
      resolver(window.google.accounts.id)
      return
    }
    const script = document.createElement('script')
    script.src = URL_GIS
    script.async = true
    script.defer = true
    script.onload = () => {
      const api = window.google?.accounts?.id
      if (api) resolver(api)
      else rechazar(new Error('Google Identity Services se cargó sin exponer su API'))
    }
    script.onerror = () => {
      // Se limpia la promesa para que un fallo de red no deje el botón
      // permanentemente inservible: el siguiente intento vuelve a cargar.
      promesaCarga = null
      rechazar(new Error('No se pudo cargar Google Identity Services'))
    }
    document.head.appendChild(script)
  })

  return promesaCarga
}

/**
 * Monta el botón oficial de Google dentro de `contenedor`.
 *
 * Se usa el botón que renderiza Google —y no uno propio— porque su política de
 * marca lo exige y porque el flujo de credenciales queda dentro de su iframe,
 * sin que la aplicación llegue a manipular la contraseña del usuario.
 */
export async function montarBotonGoogle(
  contenedor: HTMLElement,
  alRecibirToken: (idToken: string) => void,
): Promise<void> {
  const api = await cargarGoogleIdentity()
  api.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback: (respuesta) => alRecibirToken(respuesta.credential),
    // Sin selección automática: en un equipo compartido de farmacia, entrar
    // solo porque hay una sesión de Google abierta sería un fallo de control
    // de acceso, no una comodidad.
    auto_select: false,
    cancel_on_tap_outside: true,
  })
  api.renderButton(contenedor, {
    type: 'standard',
    theme: 'outline',
    size: 'large',
    width: contenedor.clientWidth || 320,
    text: 'continue_with',
    locale: document.documentElement.lang || 'es',
  })
}
