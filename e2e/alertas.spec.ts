import { expect, test, type Page } from '@playwright/test'
import { accionAlerta, irA } from './helpers'

/**
 * Alertas (P5a): acciones visibles por fila según el rol (HU-23/27/28/41),
 * panel lateral de acción correctiva y cronología, rail de contexto (HU-54)
 * y diseño en escritorio, tablet y móvil. Modo demo.
 */
async function entrarComo(page: Page, perfil: string) {
  await page.goto('/login')
  await page.getByRole('button', { name: perfil }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
  await irA(page, '/alertas')
  await expect(page.getByRole('heading', { name: 'Alertas', level: 1 })).toBeVisible()
  await expect(page.getByRole('row').nth(1)).toBeVisible()
}

const fila = (page: Page) => page.getByRole('row').nth(1)

test('farmacéutico revisa una pendiente con un clic y pasa a Revisadas', async ({ page }) => {
  await entrarComo(page, 'Químico Farmacéutico')
  const pendientes = await page.getByRole('row').count()

  await accionAlerta(page, /^revisar alerta de/i)
  await expect(page.getByRole('row')).toHaveCount(pendientes - 1)

  await page.getByRole('button', { name: 'Revisadas', exact: true }).click()
  await expect(fila(page).getByRole('button', { name: /registrar acción correctiva/i })).toBeVisible()
  await expect(fila(page).getByRole('button', { name: /^revisar alerta/i })).toHaveCount(0)
})

test('técnico registra acción correctiva sin ver Revisar', async ({ page }) => {
  await entrarComo(page, 'Técnico de Farmacia')
  await expect(page.getByRole('button', { name: /^revisar alerta/i })).toHaveCount(0)

  await accionAlerta(page, /registrar acción correctiva/i)
  const panel = page.getByRole('dialog')
  await expect(panel.getByRole('tab', { name: 'Acción correctiva' })).toHaveAttribute('aria-selected', 'true')
  await expect(panel.getByLabel('Decisión adoptada')).toBeFocused()
  await panel.getByLabel('Decisión adoptada').fill('Cuarentena del lote')
  await panel.getByLabel('Descripción de la acción correctiva').fill('Se trasladó el lote al equipo de respaldo.')
  await panel.getByLabel('Justificación').fill('Superó 8 °C durante la excursión.')
  await panel.getByRole('button', { name: 'Guardar acción' }).click()
  await expect(panel.getByText('Acción correctiva registrada.')).toBeVisible()
  await expect(panel.getByRole('heading', { name: 'Cronología de atención' })).toBeVisible()
})

test('auditor solo consulta la cronología', async ({ page }) => {
  await entrarComo(page, 'Auditor Consulta de registros')
  await expect(page.getByRole('button', { name: /^revisar alerta/i })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /registrar acción correctiva/i })).toHaveCount(0)

  await accionAlerta(page, /ver cronología de atención/i)
  const panel = page.getByRole('dialog')
  await expect(panel.getByRole('tablist')).toHaveCount(0)
  await expect(panel.getByRole('heading', { name: 'Cronología de atención' })).toBeVisible()
  await expect(panel.getByRole('link', { name: 'Ver en Historial' })).toHaveAttribute('href', '/historial')
})

test('administrador ve las mismas acciones que el farmacéutico', async ({ page }) => {
  await entrarComo(page, 'Administrador')
  await expect(fila(page).getByRole('button', { name: /^revisar alerta/i })).toBeVisible()
  await expect(fila(page).getByRole('button', { name: /registrar acción correctiva/i })).toBeVisible()
  await expect(fila(page).getByRole('button', { name: /ver cronología de atención/i })).toBeVisible()
})

test('teclado: Tab recorre Revisar, Registrar acción y Cronología; Esc cierra y devuelve el foco', async ({ page }) => {
  await entrarComo(page, 'Químico Farmacéutico')
  const revisar = fila(page).getByRole('button', { name: /^revisar alerta/i })
  await revisar.focus()
  await page.keyboard.press('Tab')
  const registrar = fila(page).getByRole('button', { name: /registrar acción correctiva/i })
  await expect(registrar).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(fila(page).getByRole('button', { name: /ver cronología de atención/i })).toBeFocused()

  await registrar.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(registrar).toBeFocused()
})

test('escritorio 1440: rail a la derecha con incidentes y cinta 24 h', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await entrarComo(page, 'Químico Farmacéutico')
  const rail = page.getByRole('complementary', { name: 'Contexto operativo' })
  await expect(rail.getByRole('heading', { name: 'Incidentes operativos' })).toBeVisible()
  await expect(rail.getByRole('heading', { name: 'Últimas 24 h' })).toBeVisible()
  const lista = await page.getByRole('table').boundingBox()
  const caja = await rail.boundingBox()
  expect(caja!.x).toBeGreaterThan(lista!.x + lista!.width - 1)
})

test('tablet 768: rail debajo de la lista', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 })
  await entrarComo(page, 'Químico Farmacéutico')
  const lista = await page.getByRole('table').boundingBox()
  const rail = await page.getByRole('complementary', { name: 'Contexto operativo' }).boundingBox()
  expect(rail!.y).toBeGreaterThan(lista!.y + lista!.height - 1)
})

test('móvil 375: fichas con acciones de 44 px, panel a pantalla completa, sin scroll horizontal', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await entrarComo(page, 'Químico Farmacéutico')
  const registrar = fila(page).getByRole('button', { name: /registrar acción correctiva/i })
  expect((await registrar.boundingBox())!.height).toBeGreaterThanOrEqual(44)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)

  await registrar.click()
  const panel = await page.getByRole('dialog').boundingBox()
  expect(Math.round(panel!.width)).toBe(375)
})
