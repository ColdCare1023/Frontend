import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

test('monitoreo, alertas e historial sin violaciones axe WCAG 2 A/AA', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/login')
  await page.getByRole('button', { name: 'Personal Técnico de Farmacia' }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
  await page.getByRole('dialog').getByRole('button', { name: 'Omitir' }).click()

  for (const route of ['/dashboard', '/alertas', '/historial']) {
    await page.goto(route)
    await expect(page.locator('h1')).toBeVisible()
    const result = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()
    const failures = result.violations.flatMap((violation) =>
      violation.nodes.map((node) => `${violation.id}: ${node.target.join(' ')} — ${node.any[0]?.message ?? ''}`),
    )
    expect(failures, route).toEqual([])
  }
})
