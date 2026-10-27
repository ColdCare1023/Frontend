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
