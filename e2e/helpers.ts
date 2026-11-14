import type { Page } from '@playwright/test'

/** Navega dentro de SPA sin recargar y borrar sesión de memoria. */
export async function irA(page: Page, ruta: string) {
  await page.evaluate((destino) => {
    window.history.pushState({}, '', destino)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }, ruta)
}

/** Open the labelled actions for one record. */
export async function abrirOpciones(page: Page, registro: string) {
  await page.getByRole('row').filter({ hasText: registro }).getByRole('button', { name: /^Opciones:/ }).click()
}

/** Abre el menú de acciones de la primera fila con acciones y elige `accion`. */
export async function accionPrimeraFila(page: Page, accion: string | RegExp) {
  await page.getByRole('row').getByRole('button', { name: /^Opciones:/ }).first().click()
  await page.getByRole('menuitem', { name: accion }).first().click()
}

/** El cierre de sesión vive en el menú de usuario de la barra superior. */
export async function cerrarSesion(page: Page) {
  await page.getByRole('button', { name: /^Menú de usuario/ }).click()
  await page.getByRole('menuitem', { name: 'Cerrar sesión' }).click()
}

/**
 * Alertas: las acciones van visibles en cada fila (Revisar, Registrar acción y
 * Cronología). Pulsa la acción `nombre` de la fila `indice` con acciones.
 */
export async function accionAlerta(page: Page, nombre: RegExp, indice = 0) {
  await page.getByRole('row').getByRole('button', { name: nombre }).nth(indice).click()
}

/** Abre el detalle de un equipo (`/dispositivos/:id`), opcionalmente en una pestaña. */
export async function abrirEquipo(page: Page, id: string, tab?: string) {
  await irA(page, `/dispositivos/${id}${tab ? `?tab=${tab}` : ''}`)
}

/** Abre el menú «Opciones» de un equipo en la lista de dispositivos. */
export async function abrirOpcionesEquipo(page: Page, id: string) {
  await page.getByRole('button', { name: `Opciones: ${id}`, exact: true }).click()
}
