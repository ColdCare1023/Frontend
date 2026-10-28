/**
 * Preferencia del riel lateral (expandido/colapsado). Vive aparte del layout
 * para que el esqueleto de carga (App.tsx) reserve el mismo ancho sin
 * descargar AppLayout: así el contenido no salta al terminar de cargar.
 */
export const CLAVE_SIDEBAR = 'coldcare-sidebar'
export const ANCHO_EXPANDIDO = 248
export const ANCHO_COLAPSADO = 72

export function leerColapsado(): boolean {
  try {
    return window.localStorage.getItem(CLAVE_SIDEBAR) === 'colapsado'
  } catch {
    return false
  }
}

export function guardarColapsado(colapsado: boolean): void {
  try {
    window.localStorage.setItem(CLAVE_SIDEBAR, colapsado ? 'colapsado' : 'expandido')
  } catch {
    // La preferencia es opcional.
  }
}
