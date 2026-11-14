import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

import { congelarAnimaciones } from './helpers'

const CODIGO = '482916'

async function sinViolacionesAxe(page: Page, contexto: string) {
  // Estado en reposo: sin el cursor encima del botón que se acaba de pulsar.
  await page.mouse.move(0, 0)
  await congelarAnimaciones(page)
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze()
  const failures = result.violations.flatMap((violation) =>
    violation.nodes.map((node) => `${violation.id}: ${node.target.join(' ')} — ${node.any[0]?.message ?? ''}`),
  )
  expect(failures, contexto).toEqual([])
}

/**
 * Carga completa: desde la misma ruta, cambiar solo el fragmento sería una
 * navegación dentro del documento y la página no volvería a leerlo.
 */
async function abrir(page: Page, fragmento: string) {
  await page.goto('about:blank')
  await page.goto(`/copiar-codigo${fragmento}`)
}

test('enlace «Copiar código» del correo: muestra el código, lo copia y no lo deja en la URL', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  const consola: string[] = []
  page.on('console', (mensaje) => consola.push(mensaje.text()))
  await page.setViewportSize({ width: 375, height: 812 })

  await abrir(page, `#${CODIGO}`)
  await expect(page.getByRole('heading', { name: 'Tu código de ColdCare' })).toBeVisible()
  await expect(page.locator('#copiar-codigo-digitos')).toHaveText(CODIGO)
  await expect(page.getByText('Vuelve a la pestaña de ColdCare y pégalo')).toBeVisible()
  await expect.poll(() => page.evaluate(() => window.location.hash)).toBe('')
  expect(page.url()).not.toContain(CODIGO)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)

  // El botón copia aunque el intento automático ya lo hubiera hecho.
  await page.evaluate(() => navigator.clipboard.writeText('otra cosa'))
  await page.getByRole('button', { name: /^(Copiar código|Código copiado)$/ }).click()
  await expect(page.getByRole('button', { name: 'Código copiado' })).toBeVisible()
  await expect(page.getByRole('status').filter({ hasText: 'Código copiado' })).toHaveCount(1)
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(CODIGO)

  const almacenado = await page.evaluate(() => [...Object.values(localStorage), ...Object.values(sessionStorage)].join('\n'))
  expect(almacenado).not.toContain(CODIGO)
  expect(consola.join('\n')).not.toContain(CODIGO)

  // Tema oscuro (predeterminado) y claro, a 375 px.
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await sinViolacionesAxe(page, 'oscuro')
  await page.evaluate(() => localStorage.setItem('coldcare-tema', 'light'))
  await abrir(page, `#${CODIGO}`)
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await expect(page.locator('#copiar-codigo-digitos')).toHaveText(CODIGO)
  await sinViolacionesAxe(page, 'claro')

  // Un enlace roto no muestra nada que copiar y lleva al acceso.
  await abrir(page, '#12345')
  await expect(page.getByRole('heading', { name: 'Este enlace no trae un código válido' })).toBeVisible()
  await expect.poll(() => page.evaluate(() => window.location.hash)).toBe('')
  await page.getByRole('link', { name: 'Volver a ColdCare' }).click()
  await expect(page).toHaveURL(/\/login$/)
})
