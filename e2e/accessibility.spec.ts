import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { irA } from './helpers'

/**
 * axe mide el color pintado: si corre durante una entrada de página o un
 * fundido de texto (opacidad < 1), informa contrastes que no existen al
 * terminar. Se espera a que no quede ningún esqueleto de carga y a que acaben
 * las animaciones finitas (los indicadores en bucle, como el pulso «en vivo»,
 * no cuentan), y a que eso se mantenga en dos lecturas seguidas: la demo
 * responde con 180–420 ms de latencia y una fila que llega después monta su
 * etiqueta con un fundido.
 */
async function esperarAnimaciones(page: Page) {
  const quieta = () =>
    page.evaluate(
      () =>
        !document.querySelector('.esqueleto') &&
        document
          .getAnimations()
          .every((a) => a.playState !== 'running' || a.effect?.getTiming().iterations === Infinity),
    )
  await expect
    .poll(async () => (await quieta()) && (await page.waitForTimeout(500), await quieta()), { timeout: 15_000 })
    .toBe(true)
}

test('monitoreo, alertas e historial sin violaciones axe WCAG 2 A/AA', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/login')
  await page.getByRole('button', { name: /Químico Farmacéutico/i }).click()
  await expect(page).toHaveURL(/\/dashboard$/)

  for (const route of ['/dashboard', '/alertas', '/historial']) {
    await irA(page, route)
    await expect(page.locator('h1')).toBeVisible()
    await esperarAnimaciones(page)
    const result = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze()
    const failures = result.violations.flatMap((violation) =>
      violation.nodes.map((node) => `${violation.id}: ${node.target.join(' ')} — ${node.any[0]?.message ?? ''}`),
    )
    expect(failures, route).toEqual([])
  }
})

test('10 rutas disponibles para administración sin violaciones axe WCAG 2 A/AA', async ({ page }) => {
  test.setTimeout(180_000)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/login')
  await page.getByRole('button', { name: /Administrador/i }).click()
  await expect(page).toHaveURL(/\/dashboard$/)

  for (const route of [
    '/dashboard', '/historial', '/alertas', '/trazabilidad', '/guia',
    '/reportes', '/metricas-ia', '/auditoria',
    '/usuarios', '/dispositivos',
  ]) {
    await irA(page, route)
    await expect(page.locator('h1')).toBeVisible()
    await esperarAnimaciones(page)
    const result = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze()
    const failures = result.violations.flatMap((violation) =>
      violation.nodes.map((node) => `${violation.id}: ${node.target.join(' ')} — ${node.any[0]?.message ?? ''}`),
    )
    expect(failures, route).toEqual([])
  }
})

test('el foco de teclado se ve en el menú principal (WCAG 2.4.7)', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/login')
  await page.getByRole('button', { name: /Administrador/i }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(page.locator('h1')).toBeVisible()

  const enlace = page.locator('nav').getByRole('link', { name: 'Monitoreo', exact: true }).first()
  await expect(enlace).toBeVisible()
  // Se llega con Tab (no con `focus()`) para que aplique `:focus-visible`.
  let enfocado = false
  for (let i = 0; i < 25 && !enfocado; i++) {
    await page.keyboard.press('Tab')
    enfocado = await enlace.evaluate((el) => el === document.activeElement)
  }
  expect(enfocado).toBe(true)
  const contorno = await enlace.evaluate((el) => {
    const estilo = getComputedStyle(el)
    return { estilo: estilo.outlineStyle, ancho: estilo.outlineWidth }
  })
  expect(contorno).toEqual({ estilo: 'solid', ancho: '2px' })
})
