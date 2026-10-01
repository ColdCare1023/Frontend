import { expect, test } from '@playwright/test'
import { irA } from './helpers'

test('sesión demo, recorrido, navegación y reapertura', async ({ page }) => {
  await page.goto('/login')
  await page.evaluate(() => localStorage.clear())
  await page.getByRole('button', { name: 'Químico Farmacéutico' }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
  const tour = page.getByRole('dialog')
  await expect(tour).toContainText('Te damos la bienvenida a ColdCare')
  await expect(page.locator('aside [data-tour-route="/dashboard"]')).toBeVisible()
  await tour.getByRole('button', { name: 'Siguiente' }).click()
  await expect(tour).toContainText('Alertas')
  await tour.getByRole('button', { name: 'Atrás' }).click()
  await expect(tour).toContainText('Monitoreo')
  await page.keyboard.press('Escape')
  await expect(tour).toBeHidden()
  await page.reload()
  await expect(page).toHaveURL(/\/login$/)
  await page.getByRole('button', { name: 'Químico Farmacéutico' }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
  await irA(page, '/guia')
  await page.getByRole('button', { name: 'Volver a ver el recorrido' }).click()
  await expect(tour).toBeVisible()
  await tour.getByRole('button', { name: 'Omitir' }).click()
  await page.locator('aside [data-tour-route="/alertas"]').click()
  await expect(page.getByRole('heading', { name: 'Alertas' })).toBeVisible()
})

test('cambiar periodo de la curva conserva monitoreo visible sin destellos', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/login')
  await page.getByRole('button', { name: 'Químico Farmacéutico' }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
  const tour = page.getByRole('dialog')
  if (await tour.isVisible()) await tour.getByRole('button', { name: 'Omitir' }).click()
  await expect(tour).toBeHidden()

  const temperatura = page.getByRole('region', { name: 'Temperatura actual' })
  const curva = page.locator('[role="img"][aria-label^="Gráfica de líneas"]')
  const lecturaActual = await temperatura.locator('p.nums').textContent()
  expect(lecturaActual).toMatch(/^\d+\.\d+$/)
  await expect(curva).toBeVisible()

  const rangos = page.getByRole('group', { name: 'Rango de la curva térmica' })
  for (const nombre of ['1 h', '24 h', '7 d']) {
    const opcion = rangos.getByRole('button', { name: nombre, exact: true })
    await opcion.click()
    await expect(opcion).toHaveAttribute('aria-pressed', 'true')
    await expect(temperatura).toContainText(lecturaActual!)
    await expect(curva).toBeVisible()
    await expect(page.locator('main [aria-busy="true"]')).toHaveCount(0)
  }
})

test('guardas de autenticación y permisos por rol', async ({ page }) => {
  await page.goto('/usuarios')
  await expect(page).toHaveURL(/\/login$/)
  await page.getByRole('button', { name: 'Auditor Solo lectura' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Omitir' }).click()
  await irA(page, '/auditoria')
  await expect(page.getByRole('heading', { name: 'Bitácora de auditoría' })).toBeVisible()
  await irA(page, '/usuarios')
  await expect(page.getByText(/permiso/i)).toBeVisible()
})

test('selector de roles es responsive y mantiene permisos de Técnico de Farmacia', async ({ page }) => {
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 844 })
    await page.goto('/login')
    const roles = page.getByRole('group', { name: 'Acceso de demostración' })
    await expect(roles.getByRole('button')).toHaveCount(4)
    for (const nombre of [
      'Químico Farmacéutico',
      'Técnico de Farmacia',
      'Administrador',
      'Auditor Solo lectura',
    ]) {
      await expect(roles.getByRole('button', { name: nombre })).toBeVisible()
    }
    const medidas = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      documento: document.documentElement.scrollWidth,
    }))
    expect(medidas.documento, `login a ${width}px`).toBeLessThanOrEqual(medidas.viewport)
  }

  await page.getByRole('group', { name: 'Acceso de demostración' })
    .getByRole('button', { name: 'Técnico de Farmacia' })
    .click()
  await expect(page).toHaveURL(/\/dashboard$/)
  const tour = page.getByRole('dialog')
  await expect(tour).toBeVisible()
  await tour.getByRole('button', { name: 'Omitir' }).click()

  await irA(page, '/alertas')
  await expect(page.getByRole('heading', { name: 'Alertas' })).toBeVisible()
})

test('administrador puede abrir herramientas de administración en demo', async ({ page }) => {
  await page.goto('/login')
  await page.getByRole('button', { name: 'Administrador' }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
  const tour = page.getByRole('dialog')
  await expect(tour).toBeVisible()
  await tour.getByRole('button', { name: 'Omitir' }).click()

  for (const [ruta, titulo] of [
    ['/usuarios', 'Usuarios'],
    ['/dispositivos', 'Equipos de medición'],
  ]) {
    await irA(page, ruta)
    await expect(page.getByRole('heading', { level: 1 })).toContainText(titulo)
    await expect(page.getByText(/permiso/i)).toHaveCount(0)
  }
})

test('farmacéutico puede consultar reportes e IA en demo', async ({ page }) => {
  await page.goto('/login')
  await page.getByRole('button', { name: 'Químico Farmacéutico' }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
  const tour = page.getByRole('dialog')
  await expect(tour).toBeVisible()
  await tour.getByRole('button', { name: 'Omitir' }).click()

  for (const [ruta, titulo] of [
    ['/reportes', 'Reportes de monitoreo'],
    ['/metricas-ia', 'Cómo se comporta el clasificador'],
  ]) {
    await irA(page, ruta)
    await expect(page.getByRole('heading', { level: 1 })).toContainText(titulo)
    await expect(page.getByText(/permiso/i)).toHaveCount(0)
  }
})

test('alertas permiten abrir detalle contextual', async ({ page }) => {
  await page.goto('/login')
  await page.getByRole('button', { name: 'Químico Farmacéutico' }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
  const tour = page.getByRole('dialog')
  await expect(tour).toBeVisible()
  await tour.getByRole('button', { name: 'Omitir' }).click()
  await expect(tour).toBeHidden()
  await page.locator('aside [data-tour-route="/alertas"]').click()
  await page.getByRole('button', { name: 'Todas' }).click()
  await expect(page.getByText('Excursión crítica').first()).toBeVisible()
  await expect(page.getByText('Riesgo preventivo').first()).toBeVisible()
  await page.getByRole('button', { name: /ver cronología de atención/i }).first().click()
  await expect(page.getByRole('dialog')).toContainText(/temperatura|dispositivo/i)
})

test('logout elimina acceso a ruta protegida', async ({ page }) => {
  await page.goto('/login')
  await page.getByRole('button', { name: 'Químico Farmacéutico' }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
  await page.getByRole('dialog').getByRole('button', { name: 'Omitir' }).click()
  await page.getByRole('button', { name: 'Cerrar sesión' }).click()
  await expect(page).toHaveURL(/\/login$/)
  await irA(page, '/alertas')
  await expect(page).toHaveURL(/\/login$/)
})

test('navegación móvil abre menú y permite llegar a alertas', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/login')
  await page.getByRole('button', { name: 'Químico Farmacéutico' }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
  await page.getByRole('dialog').getByRole('button', { name: 'Omitir' }).click()
  await page.getByRole('button', { name: 'Abrir menú' }).click()
  await page.getByRole('dialog').getByRole('link', { name: 'Alertas' }).click()
  await expect(page.getByRole('heading', { name: 'Alertas' })).toBeVisible()
  await expect(page.getByRole('dialog')).toBeHidden()

  const filtros = page.getByRole('group', { name: 'Filtrar alertas por estado de seguimiento' })
  const opciones = ['Pendientes', 'Revisadas', 'Atendidas', 'Todas']
  await expect(filtros.getByRole('button', { name: 'Pendientes', exact: true })).toHaveAttribute('aria-pressed', 'true')
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 })
    const botones = filtros.getByRole('button')
    await expect(botones).toHaveCount(4)
    for (const opcion of opciones) await expect(filtros.getByRole('button', { name: opcion, exact: true })).toBeVisible()

    const medidas = await filtros.evaluate((grupo) => {
      const caja = grupo.getBoundingClientRect()
      const botones = [...grupo.querySelectorAll('button')].map((boton) => {
        const { x, y, width, height } = boton.getBoundingClientRect()
        return { x, y, width, height }
      })
      return { izquierda: caja.left, derecha: caja.right, botones }
    })
    expect(medidas.izquierda).toBeGreaterThanOrEqual(0)
    expect(medidas.derecha).toBeLessThanOrEqual(width)
    for (const boton of medidas.botones) {
      expect(boton.x).toBeGreaterThanOrEqual(0)
      expect(boton.x + boton.width).toBeLessThanOrEqual(width)
    }
    for (let i = 1; i < medidas.botones.length; i++) {
      const anterior = medidas.botones[i - 1]
      const actual = medidas.botones[i]
      expect(actual.y >= anterior.y + anterior.height || actual.x >= anterior.x + anterior.width).toBeTruthy()
    }
    expect(medidas.botones.every(({ height }) => Math.round(height) >= 44), JSON.stringify(medidas.botones)).toBe(true)
  }
})

test('rutas principales conservan el viewport y tablas se desplazan por teclado', async ({ page }) => {
  test.setTimeout(120_000)
  await page.goto('/login')
  await page.getByRole('button', { name: 'Químico Farmacéutico' }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
  const tour = page.getByRole('dialog')
  if (await tour.isVisible()) await tour.getByRole('button', { name: 'Omitir' }).click()

  const rutas = [
    '/dashboard',
    '/historial',
    '/alertas',
    '/trazabilidad',
    '/reportes',
    '/metricas-ia',
    '/guia',
  ]
  const viewports = [
    { width: 1440, height: 900 },
    { width: 1280, height: 800 },
    { width: 1024, height: 768 },
    { width: 768, height: 1024 },
    { width: 430, height: 932 },
    { width: 390, height: 844 },
  ]
  for (const { width, height } of viewports) {
    await page.setViewportSize({ width, height })
    for (const ruta of rutas) {
      await irA(page, ruta)
      await page.locator('main h1').first().waitFor({ state: 'visible', timeout: 10_000 })
      const medidas = await page.evaluate(() => ({
        viewport: document.documentElement.clientWidth,
        documento: document.documentElement.scrollWidth,
      }))
      expect(medidas.documento, `${ruta} a ${width}px`).toBeLessThanOrEqual(medidas.viewport)
    }
  }

  await page.setViewportSize({ width: 320, height: 844 })
  await irA(page, '/historial')
  const tabla = page.locator('[role="region"][aria-label="Historial de lecturas"]')
  await tabla.evaluate((element) => {
    element.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
  })
  expect(await tabla.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0)
  await tabla.evaluate((element) => {
    element.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }))
  })
  expect(await tabla.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0)
})

test('trazabilidad explica cadena, oculta sellos y muestra verificación', async ({ page }) => {
  await page.goto('/login')
  await page.getByRole('button', { name: 'Químico Farmacéutico' }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
  await page.getByRole('dialog').getByRole('button', { name: 'Omitir' }).click()
  await irA(page, '/trazabilidad')
  await expect(page.getByRole('columnheader', { name: 'Evento' })).toBeVisible()
  await expect(page.getByRole('columnheader', { name: 'Sello anterior' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Mostrar detalles técnicos de los sellos' }).click()
  await expect(page.getByRole('columnheader', { name: 'Sello anterior' })).toBeVisible()
  await page.getByRole('button', { name: 'Revisar integridad' }).click()
  await expect(page.getByText(/no se detectaron cambios|alteración detectada/i).first()).toBeVisible()
})
