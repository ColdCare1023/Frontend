import { expect, test, type Page } from '@playwright/test'
import { accionAlerta, cerrarSesion, irA } from './helpers'

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
  // El primer esqueleto de carga también es una fila: se espera a una fila
  // real (la Cronología está en cada fila y para todos los roles).
  await expect(page.getByRole('button', { name: /^ver cronología de atención/i }).first()).toBeVisible()
}

const fila = (page: Page) => page.getByRole('row').nth(1)

test('farmacéutico reconoce una pendiente con un clic y pasa a Reconocidas', async ({ page }) => {
  await entrarComo(page, 'Químico Farmacéutico')
  const pendientes = await page.getByRole('row').count()

  await accionAlerta(page, /^reconocer alerta de/i)
  await expect(page.getByRole('row')).toHaveCount(pendientes - 1)

  await page.getByRole('button', { name: 'Reconocidas', exact: true }).click()
  await expect(fila(page).getByRole('button', { name: /registrar acción correctiva/i })).toBeVisible()
  await expect(fila(page).getByRole('button', { name: /^reconocer alerta/i })).toHaveCount(0)
})

test('HU-23: la acción sobre una PENDIENTE la reconoce y la cronología lo muestra en orden', async ({ page }) => {
  await entrarComo(page, 'Químico Farmacéutico')
  await accionAlerta(page, /registrar acción correctiva/i)
  const panel = page.getByRole('dialog')
  await panel.getByLabel('Decisión adoptada').fill('Cuarentena del lote')
  await panel.getByLabel('Descripción de la acción correctiva').fill('Se trasladó el lote al equipo de respaldo.')
  await panel.getByLabel('Justificación').fill('Superó 8 °C durante la excursión.')
  await panel.getByRole('button', { name: 'Guardar acción' }).click()
  await expect(panel.getByText('Acción correctiva registrada.')).toBeVisible()

  const cronologia = panel.getByRole('list', { name: 'Cronología de atención' })
  await expect(cronologia.getByText('Acción correctiva registrada')).toBeVisible()
  const eventos = cronologia.getByRole('listitem')
  await expect(eventos.nth(1)).toContainText('Alerta reconocida')
  await expect(eventos.nth(1)).toContainText('Reconocida al registrar la acción correctiva')
  await expect(eventos.nth(1)).toContainText('Responsable: Farmacéutica Demo')
  await expect(eventos.nth(2)).toContainText('Acción correctiva registrada')
})

test('técnico consulta la cronología sin Reconocer ni Registrar acción (H16)', async ({ page }) => {
  await entrarComo(page, 'Técnico de Farmacia')
  await expect(page.getByRole('button', { name: /^reconocer alerta/i })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /registrar acción correctiva/i })).toHaveCount(0)

  await accionAlerta(page, /ver cronología de atención/i)
  const panel = page.getByRole('dialog')
  await expect(panel.getByRole('tablist')).toHaveCount(0)
  await expect(panel.getByRole('heading', { name: 'Cronología de atención' })).toBeVisible()
})

test('HU-52: el enlace del correo (/alertas?id=…) pasa por el login y abre esa alerta', async ({ page }) => {
  await entrarComo(page, 'Químico Farmacéutico')
  const id = await fila(page).getAttribute('data-alerta-id')
  const equipo = (await fila(page).locator('.codigo').first().textContent())!.trim()
  expect(id).toBeTruthy()

  // Sin sesión (el JWT vive solo en memoria), el enlace lleva al login…
  await cerrarSesion(page)
  await expect(page).toHaveURL(/\/login$/)
  await irA(page, `/alertas?id=${id}`)
  await expect(page).toHaveURL(/\/login$/)

  // …y tras entrar vuelve a la alerta del correo, con su panel abierto.
  await page.getByRole('button', { name: 'Químico Farmacéutico' }).click()
  await expect(page).toHaveURL(new RegExp(`/alertas\\?id=${id}$`))
  const panel = page.getByRole('dialog')
  await expect(panel).toContainText(equipo)
  await expect(page.locator(`[data-alerta-id="${id}"]`)).toHaveAttribute('data-seleccionada')

  // Al cerrar, el id sale de la URL.
  await page.keyboard.press('Escape')
  await expect(page).toHaveURL(/\/alertas$/)
})

test('HU-54: el enlace SIN_DATOS (/alertas) muestra el rail de incidentes tras el login', async ({ page }) => {
  await page.goto('/alertas')
  await expect(page).toHaveURL(/\/login$/)
  await page.getByRole('button', { name: 'Químico Farmacéutico' }).click()
  await expect(page).toHaveURL(/\/alertas$/)
  const rail = page.getByRole('complementary', { name: 'Contexto operativo' })
  await expect(rail.getByRole('heading', { name: 'Incidentes operativos' })).toBeVisible()
})

test('auditor solo consulta la cronología', async ({ page }) => {
  await entrarComo(page, 'Auditor Consulta de registros')
  await expect(page.getByRole('button', { name: /^reconocer alerta/i })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /registrar acción correctiva/i })).toHaveCount(0)

  await accionAlerta(page, /ver cronología de atención/i)
  const panel = page.getByRole('dialog')
  await expect(panel.getByRole('tablist')).toHaveCount(0)
  await expect(panel.getByRole('heading', { name: 'Cronología de atención' })).toBeVisible()
  await expect(panel.getByRole('link', { name: 'Ver en Historial' })).toHaveAttribute('href', '/historial')
})

test('HU-28: «Verificar cadena del equipo» abre Trazabilidad con la cadena de ese equipo elegida', async ({ page }) => {
  await entrarComo(page, 'Auditor Consulta de registros')
  const equipo = (await fila(page).locator('.codigo').first().textContent())!.trim()
  await accionAlerta(page, /ver cronología de atención/i)
  const panel = page.getByRole('dialog')
  const enlace = panel.getByRole('link', { name: 'Verificar cadena del equipo' })
  await expect(enlace).toHaveAttribute('href', `/trazabilidad?cadena=${encodeURIComponent(equipo)}`)

  await enlace.click()
  await expect(page).toHaveURL(new RegExp(`/trazabilidad\\?cadena=${encodeURIComponent(equipo)}$`))
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByLabel('Cadena', { exact: true })).toHaveValue(equipo)
})

test('HU-28: un ?cadena= que no es una cadena existente se ignora', async ({ page }) => {
  await entrarComo(page, 'Auditor Consulta de registros')
  await irA(page, '/trazabilidad?cadena=NO-EXISTE')
  const selector = page.getByLabel('Cadena', { exact: true })
  // La lista de cadenas llegó (hay opciones de equipo) y aun así sigue en «Todas».
  await expect(selector.locator('option')).not.toHaveCount(1)
  await expect(selector).toHaveValue('')
})

test('administrador ve las mismas acciones que el farmacéutico', async ({ page }) => {
  await entrarComo(page, 'Administrador')
  await expect(fila(page).getByRole('button', { name: /^reconocer alerta/i })).toBeVisible()
  await expect(fila(page).getByRole('button', { name: /registrar acción correctiva/i })).toBeVisible()
  await expect(fila(page).getByRole('button', { name: /ver cronología de atención/i })).toBeVisible()
})

test('teclado: Tab recorre Reconocer, Registrar acción y Cronología; Esc cierra y devuelve el foco', async ({ page }) => {
  await entrarComo(page, 'Químico Farmacéutico')
  const reconocer = fila(page).getByRole('button', { name: /^reconocer alerta/i })
  await reconocer.focus()
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
  const historial = rail.locator('summary').filter({ hasText: 'Últimas 24 h' })
  await expect(historial).toBeVisible()
  await historial.focus()
  await page.keyboard.press('Enter')
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

test('demo: simular excursión crítica hace llegar una fila nueva sin recargar', async ({ page }) => {
  await entrarComo(page, 'Químico Farmacéutico')
  const filas = await page.getByRole('row').count()
  // Si la página se recargara, esta marca desaparecería.
  await page.evaluate(() => Object.assign(window, { __sinRecargar: true }))

  await page.getByRole('button', { name: 'Simular alerta (demostración)' }).click()
  await page.getByRole('menuitem', { name: 'Simular excursión crítica' }).click()

  // La alerta llega por el stream en vivo, como por SSE: una fila más, con su evidencia.
  await expect(page.getByRole('row')).toHaveCount(filas + 1)
  // La fila simulada (id `al-sim-…`): la serie demo puede traer otra de 8.6 °C.
  const nueva = page.locator('tr[data-alerta-id^="al-sim-"]').filter({ hasText: 'Temperatura interna 8.6 °C fuera del rango' })
  await expect(nueva).toBeVisible()
  // Evidencia: el pico con su Regla S (el lector oye «Pico 8.6 °C»).
  await expect(nueva).toContainText(/Pico 8\.6\s°C/)
  await expect(nueva.getByRole('button', { name: /registrar acción correctiva/i })).toBeVisible()
  // La tira cuenta ya dos críticas abiertas y la página no se recargó.
  await expect(page.getByRole('region', { name: 'Resumen de alertas' })).toContainText('2 excursiones críticas sin atender')
  expect(await page.evaluate(() => (window as unknown as { __sinRecargar?: boolean }).__sinRecargar)).toBe(true)
})
