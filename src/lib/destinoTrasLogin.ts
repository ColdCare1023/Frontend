/**
 * HU-52 / HU-54: los correos enlazan una pantalla interna (`/alertas?id=…`,
 * `/alertas`). Sin sesión (el JWT vive solo en memoria, HU-40), la ruta
 * protegida manda al login y guarda aquí, en el estado de la navegación, a
 * dónde iba la persona; tras autenticarse vuelve a ese destino en vez de al
 * monitoreo.
 */
export interface EstadoDestino {
  desde?: unknown
}

/** Rutas a las que nunca se vuelve tras el login (o que crearían un bucle). */
const PROHIBIDAS = ['/login', '/cambiar-password', '/recuperar-contrasena', '/restablecer-password', '/copiar-codigo']

/**
 * Destino interno seguro a partir del estado de la navegación, o null. Solo
 * rutas relativas a la propia aplicación: nada con esquema, `//host` ni `\\`,
 * para que el estado no pueda convertirse en una redirección abierta.
 */
export function destinoSeguro(estado: unknown): string | null {
  const desde = (estado as EstadoDestino | null | undefined)?.desde
  if (typeof desde !== 'string' || desde.length > 2048) return null
  if (!desde.startsWith('/') || desde.startsWith('//') || desde.includes('\\')) return null
  const ruta = desde.split(/[?#]/, 1)[0]
  if (PROHIBIDAS.some((prohibida) => ruta === prohibida || ruta.startsWith(`${prohibida}/`))) return null
  return desde
}

