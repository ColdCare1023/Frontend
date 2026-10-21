/**
 * FE-007: Content-Security-Policy de la SPA, como función pura para poder
 * probarla (la usa scripts/generar-vercel-json.mjs).
 *
 * - Sin orígenes de terceros por defecto: las fuentes van empaquetadas
 *   (@fontsource) y no se cargan imágenes externas.
 * - Google Identity Services solo si el build lo usa (`google: true`), y
 *   limitado a las rutas que exige GIS (/gsi/client, /gsi/style, /gsi/).
 * - `style-src 'unsafe-inline'` se mantiene en la política aplicada porque
 *   Radix inyecta un <style> para bloquear el scroll de los diálogos. La
 *   política Report-Only mide su retirada y Trusted Types sin romper nada.
 */

export const GIS = 'https://accounts.google.com/gsi'

/** Orígenes https/wss del backend para connect-src (API + SSE). */
export function origenesBackend(url) {
  if (!url) return []
  let analizada
  try {
    analizada = new URL(url)
  } catch {
    throw new Error(`«${url}» no es una URL válida. Ejemplo: https://api.up.railway.app`)
  }
  if (analizada.protocol !== 'https:') {
    throw new Error('El backend debe servirse por HTTPS (RNF-05 y Strict-Transport-Security).')
  }
  return [analizada.origin, `wss://${analizada.host}`]
}

function directivas({ backend, google, estilosEnLinea }) {
  const conGoogle = (base, ...extra) => (google ? [...base, ...extra] : base)
  return [
    "default-src 'self'",
    `script-src ${conGoogle(["'self'"], `${GIS}/client`).join(' ')}`,
    `style-src ${conGoogle(estilosEnLinea ? ["'self'", "'unsafe-inline'"] : ["'self'"], `${GIS}/style`).join(' ')}`,
    "font-src 'self'",
    "img-src 'self' data:",
    `connect-src ${conGoogle(["'self'", ...origenesBackend(backend)], `${GIS}/`).join(' ')}`,
    google ? `frame-src ${GIS}/` : "frame-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ]
}

/** Política aplicada. */
export function politicaCsp({ backend = undefined, google = false } = {}) {
  return directivas({ backend, google, estilosEnLinea: true }).join('; ')
}

/** Política de observación: sin estilos en línea y con Trusted Types. */
export function politicaCspReportOnly({ backend = undefined, google = false } = {}) {
  return [...directivas({ backend, google, estilosEnLinea: false }), "require-trusted-types-for 'script'"].join('; ')
}
