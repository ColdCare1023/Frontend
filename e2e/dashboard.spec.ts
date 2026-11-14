import AxeBuilder from '@axe-core/playwright'
import { congelarAnimaciones } from './helpers'
import { expect, test, type Page } from '@playwright/test'

/** P5c: el monitoreo como bento. Demo; los valores cambian, se afirma estructura. */
async function entrar(page: Page, perfil = 'Químico Farmacéutico') {
  await page.goto('/login')
  await page.getByRole('button', { name: perfil }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(page.getByTestId('valor-actual')).toBeVisible()
}

async function sinScrollHorizontal(page: Page) {
  const desborde = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(desborde).toBeLessThanOrEqual(1)
}

test('monitoreo 1440×900: lectura, condiciones, equipo y curva sobre el pliegue', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await entrar(page)
  const lectura = page.getByTestId('celda-lectura')
  const condiciones = page.getByRole('region', { name: 'Condiciones', exact: true })
  const equipo = page.getByRole('region', { name: 'Equipo', exact: true })
  const curva = page.getByRole('region', { name: 'Cómo cambió la temperatura' })
  for (const celda of [lectura, condiciones, equipo, curva]) await expect(celda).toBeVisible()
  const cajaCurva = await curva.boundingBox()
  expect(cajaCurva!.y).toBeLessThan(900)
  // Fila A: lectura a la izquierda, condiciones y equipo apilados a la derecha.
  const [a, c, e] = await Promise.all([lectura.boundingBox(), condiciones.boundingBox(), equipo.boundingBox()])
  expect(c!.x).toBeGreaterThan(a!.x + a!.width - 1)
  expect(e!.y).toBeGreaterThan(c!.y + c!.height - 1)
  // Fila A de 288 px (DIRECTION §12): Condiciones y Equipo miden lo mismo y la Lectura no se estira.
  expect(Math.abs(c!.height - e!.height)).toBeLessThanOrEqual(2)
  expect(a!.height).toBeLessThanOrEqual(300)
  // Estado de equipos: con 2 equipos, la cinta de 24 h de cada uno se ve sin desplazar la lista.
  const estado = page.getByRole('region', { name: 'Estado operativo de equipos' })
  const cajaLista = (await estado.getByRole('list').boundingBox())!
  const cintas = estado.getByRole('img', { name: /^Últimas 24 h de / })
  await expect(cintas).toHaveCount(2)
  for (const cinta of await cintas.all()) {
    const caja = (await cinta.boundingBox())!
    expect(caja.y + caja.height).toBeLessThanOrEqual(cajaLista.y + cajaLista.height)
  }
  await sinScrollHorizontal(page)
  if (process.env.CAPTURAS_P5C) await page.screenshot({ path: `${process.env.CAPTURAS_P5C}/dashboard-1440.png`, fullPage: true })
})

test('monitoreo 768×1024 y 375×812 sin scroll horizontal', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 })
  await entrar(page)
  await sinScrollHorizontal(page)
  await page.setViewportSize({ width: 375, height: 812 })
  await expect(page.getByTestId('celda-lectura')).toBeVisible()
  await expect(page.getByRole('region', { name: 'Condiciones', exact: true })).toBeVisible()
  await sinScrollHorizontal(page)
  if (process.env.CAPTURAS_P5C) await page.screenshot({ path: `${process.env.CAPTURAS_P5C}/dashboard-375.png`, fullPage: true })
})

test('cambiar de equipo desde Estado de equipos actualiza la lectura', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await entrar(page)
  const estado = page.getByRole('region', { name: 'Estado operativo de equipos' })
  const filas = estado.getByRole('listitem')
  await expect(filas).toHaveCount(2)
  const otra = estado.locator('li:not([aria-current])').getByRole('button', { name: /^Mostrar .* en el monitoreo$/ })
  const nombre = (await otra.getAttribute('aria-label'))!.replace(/^Mostrar (.*) en el monitoreo$/, '$1')
  await otra.click()
  await expect(estado.locator('li[aria-current="true"]')).toContainText(nombre)
  await expect(page.getByTestId('valor-actual')).toBeVisible()
})

test('panel de detalle de equipo: buffer, incidentes y ficha; Escape devuelve el foco', async ({ page }) => {
  await entrar(page)
  const boton = page.getByRole('region', { name: 'Equipo', exact: true }).getByRole('button', { name: 'Detalles' })
  await boton.click()
  const panel = page.getByRole('dialog')
  await expect(panel.getByRole('heading', { name: 'Buffer local' })).toBeVisible()
  await expect(panel.getByRole('heading', { name: 'Incidentes recientes' })).toBeVisible()
  await expect(panel.getByRole('heading', { name: 'Ficha técnica' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(panel).toHaveCount(0)
  await expect(boton).toBeFocused()
})

test('vista Lista: tabla paginada accesible', async ({ page }) => {
  await entrar(page)
  await page.getByRole('group', { name: 'Vista de la curva' }).getByRole('button', { name: 'Lista' }).click()
  const tabla = page.getByRole('region', { name: 'Cómo cambió la temperatura' }).getByRole('table')
  await expect(tabla).toBeVisible()
  await expect(tabla.locator('tbody tr')).toHaveCount(5)
})

test('Alertas pendientes y Lecturas recientes siempre visibles', async ({ page }) => {
  await entrar(page)
  await expect(page.getByRole('region', { name: 'Alertas pendientes' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Lecturas recientes' }).getByRole('listitem').first()).toBeVisible()
})

for (const perfil of ['Administrador', 'Químico Farmacéutico', 'Técnico de Farmacia', /^Auditor/] as const) {
  test(`simulador disponible en la demo: ${String(perfil)}`, async ({ page }) => {
    await page.goto('/login')
    await page.getByRole('button', { name: perfil }).click()
    await expect(page).toHaveURL(/\/dashboard$/)
    await expect(page.getByRole('button', { name: /Probar estados del dashboard/ })).toBeVisible()
  })
}

test('simular puerta abierta: advertencia con role alert; recuperar la quita', async ({ page }) => {
  await entrar(page, 'Administrador')
  await page.getByRole('button', { name: /Probar estados del dashboard/ }).click()
  const panel = page.getByRole('dialog')
  await panel.getByRole('button', { name: 'Simular puerta abierta' }).click()
  await expect(panel.getByRole('status')).toContainText('Escenario aplicado')
  await panel.getByRole('button', { name: 'Cerrar', exact: true }).last().click()
  await expect(page.getByTestId('puerta-advertencia')).toHaveAttribute('role', 'alert')
})

test('simular silencio del equipo: Sin datos en la línea de estado y la fila', async ({ page }) => {
  await entrar(page, 'Administrador')
  await page.getByRole('button', { name: /Probar estados del dashboard/ }).click()
  const panel = page.getByRole('dialog')
  await panel.getByRole('button', { name: 'Simular silencio del equipo' }).click()
  await expect(panel.getByRole('status')).toContainText('Escenario aplicado')
  await page.keyboard.press('Escape')
  const estado = page.getByRole('region', { name: 'Estado operativo de equipos' })
  await expect(estado.getByText(/^Sin datos \(\d+ s\)$/).first()).toBeVisible()
})

for (const tema of ['light', 'dark'] as const) {
  test(`monitoreo con paneles abiertos sin violaciones axe (${tema})`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: tema })
    await entrar(page, 'Administrador')
    const axe = async () => {
      // Con movimiento reducido el panel aún se funde: se mide al terminar.
      await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))))
      await congelarAnimaciones(page)
      const resultado = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze()
      return resultado.violations.flatMap((v) => v.nodes.map((n) => `${v.id}: ${n.target.join(' ')}`))
    }
    expect(await axe(), 'monitoreo').toEqual([])
    await page.getByRole('region', { name: 'Equipo', exact: true }).getByRole('button', { name: 'Detalles' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    expect(await axe(), 'detalle').toEqual([])
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: /Probar estados del dashboard/ }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    expect(await axe(), 'simulador').toEqual([])
  })
}
