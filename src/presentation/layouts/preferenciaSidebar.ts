/**
 * Preferencia del riel lateral (expandido/colapsado). Vive aparte del layout
 * para que el esqueleto de carga (App.tsx) reserve el mismo ancho sin
 * descargar AppLayout: así el contenido no salta al terminar de cargar.
 */
export const CLAVE_SIDEBAR = 'coldcare-sidebar'
export const ANCHO_EXPANDIDO = 240
export const ANCHO_COLAPSADO = 72
/** Bajo este ancho (1024–1279) el riel arranca colapsado si no hay preferencia. */
export const ANCHO_RIEL_COMPLETO = 1280

/** Preferencia guardada, o `null` si la persona nunca eligió. */
export function leerPreferenciaSidebar(): boolean | null {
  try {
    const valor = window.localStorage.getItem(CLAVE_SIDEBAR)
    return valor === 'colapsado' ? true : valor === 'expandido' ? false : null
  } catch {
    return null
  }
}

/** Colapsado al arrancar: la preferencia, o compacto en 1024–1279 (DIRECTION §7). */
export function leerColapsado(): boolean {
  const preferencia = leerPreferenciaSidebar()
  if (preferencia !== null) return preferencia
  return typeof window !== 'undefined' && window.innerWidth < ANCHO_RIEL_COMPLETO
}

export function guardarColapsado(colapsado: boolean): void {
  try {
    window.localStorage.setItem(CLAVE_SIDEBAR, colapsado ? 'colapsado' : 'expandido')
  } catch {
    // La preferencia es opcional.
  }
}
