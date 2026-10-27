import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { irA } from './helpers'

test('monitoreo, alertas e historial sin violaciones axe WCAG 2 A/AA', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/login')
  await page.getByRole('button', { name: /Químico Farmacéutico/i }).click()
  await expect(page).toHaveURL(/\/dashboard$/)

  for (const route of ['/dashboard', '/alertas', '/historial']) {
    await irA(page, route)
    await expect(page.locator('h1')).toBeVisible()
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
    const result = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze()
    const failures = result.violations.flatMap((violation) =>
      violation.nodes.map((node) => `${violation.id}: ${node.target.join(' ')} — ${node.any[0]?.message ?? ''}`),
    )
    expect(failures, route).toEqual([])
  }
})
