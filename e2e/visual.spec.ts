import { expect, test } from '@playwright/test'

import { irA } from './helpers'

/**
 * Regresión visual de pantallas sin datos en vivo (login y guía).
 *
 * Las capturas de referencia dependen del sistema operativo (fuentes y
 * rasterizado), así que no corren en el CI de Linux: se ejecutan con
 * `VISUAL=1 PW_CHANNEL=chrome npx playwright test e2e/visual.spec.ts` y se
 * regeneran añadiendo `--update-snapshots` tras un cambio visual deliberado.
 */
test.skip(!process.env.VISUAL, 'Regresión visual: ejecutar con VISUAL=1')

const VISTAS = [
  { nombre: 'escritorio', width: 1440, height: 900 },
  { nombre: 'movil', width: 390, height: 844 },
] as const

for (const tema of ['dark', 'light'] as const) {
  for (const vista of VISTAS) {
    test(`login ${tema} ${vista.nombre}`, async ({ page }) => {
      await page.addInitScript((t) => window.localStorage.setItem('coldcare-tema', t), tema)
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await page.setViewportSize({ width: vista.width, height: vista.height })
      await page.goto('/login')
      await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible()
      await expect(page).toHaveScreenshot(`login-${tema}-${vista.nombre}.png`, { fullPage: true, animations: 'disabled' })
    })
  }
}

test('guía de uso dentro del shell oscuro', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/login')
  await page.getByRole('button', { name: 'Químico Farmacéutico' }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
  await irA(page, '/guia')
  // El título propio de la guía: el h1 del monitoreo sigue en pantalla mientras carga.
  await expect(page.getByRole('heading', { level: 1, name: 'Consulta y usa ColdCare' })).toBeVisible()
  await expect(page).toHaveScreenshot('guia-dark.png', {
    fullPage: true,
    animations: 'disabled',
    // La fecha de la barra superior y los avisos en vivo cambian en cada ejecución.
    mask: [page.locator('header p.text-xs'), page.locator('[role="region"][aria-live="polite"]')],
  })
})
