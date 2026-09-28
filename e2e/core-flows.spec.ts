import { expect, test } from '@playwright/test'

test('sesión demo, recorrido, navegación y reapertura', async ({ page }) => {
  await page.goto('/login')
  await page.evaluate(() => localStorage.clear())
  await page.getByRole('button', { name: 'Personal Técnico de Farmacia' }).click()
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
  await expect(tour).toBeHidden()
  await page.getByRole('link', { name: 'Guía de uso' }).click()
  await page.getByRole('button', { name: 'Volver a ver recorrido' }).click()
  await expect(tour).toBeVisible()
  await tour.getByRole('button', { name: 'Omitir' }).click()
  await page.locator('aside [data-tour-route="/alertas"]').click()
  await expect(page.getByRole('heading', { name: 'Gestión de alertas' })).toBeVisible()
})

test('guardas de autenticación y permisos por rol', async ({ page }) => {
  await page.goto('/usuarios')
  await expect(page).toHaveURL(/\/login$/)
  await page.getByRole('button', { name: 'Auditor (solo lectura)' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Omitir' }).click()
  await page.goto('/auditoria')
  await expect(page.getByRole('heading', { name: 'Bitácora de auditoría' })).toBeVisible()
  await page.goto('/usuarios')
  await expect(page.getByText(/permiso/i)).toBeVisible()
  await page.goto('/checklist-bpa')
  await expect(page.getByText(/permiso/i)).toBeVisible()
})

test('alertas permiten abrir detalle contextual', async ({ page }) => {
  await page.goto('/login')
  await page.getByRole('button', { name: 'Personal Técnico de Farmacia' }).click()
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

test('privacidad obligatoria precede recorrido inicial', async ({ page }) => {
  await page.goto('/login')
  await page.evaluate(() => localStorage.clear())
  await page.getByRole('button', { name: 'Personal Técnico de Farmacia' }).click()
  await expect(page.getByRole('dialog')).toContainText('Te damos la bienvenida a ColdCare')
  await page.evaluate(async () => {
    const { useAuthStore } = await import('/src/application/stores/authStore.ts')
    useAuthStore.setState({ requierePrivacidad: true })
  })
  await expect(page.getByRole('dialog')).toHaveCount(1)
  await expect(page.getByRole('dialog')).toContainText(/privacidad/i)
  await page.evaluate(async () => {
    const { useAuthStore } = await import('/src/application/stores/authStore.ts')
    useAuthStore.setState({ requierePrivacidad: false })
  })
  await expect(page.getByRole('dialog')).toContainText('Te damos la bienvenida a ColdCare')
})

test('logout elimina acceso a ruta protegida', async ({ page }) => {
  await page.goto('/login')
  await page.getByRole('button', { name: 'Personal Técnico de Farmacia' }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
  await page.getByRole('dialog').getByRole('button', { name: 'Omitir' }).click()
  await page.getByRole('button', { name: 'Cerrar sesión' }).click()
  await expect(page).toHaveURL(/\/login$/)
  await page.goto('/alertas')
  await expect(page).toHaveURL(/\/login$/)
})

test('navegación móvil abre menú y permite llegar a alertas', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/login')
  await page.getByRole('button', { name: 'Personal Técnico de Farmacia' }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
  await page.getByRole('dialog').getByRole('button', { name: 'Omitir' }).click()
  await page.getByRole('button', { name: 'Abrir menú' }).click()
  await page.getByRole('dialog').getByRole('link', { name: 'Alertas' }).click()
  await expect(page.getByRole('heading', { name: 'Gestión de alertas' })).toBeVisible()
  await expect(page.getByRole('dialog')).toBeHidden()

  await page.getByRole('button', { name: 'EN', exact: true }).click()
  const filtros = page.getByRole('group', { name: 'Filter alerts by follow-up status' })
  const opciones = ['Pending', 'Acknowledged', 'Resolved', 'All']
  await expect(filtros.getByRole('button', { name: 'Pending', exact: true })).toHaveAttribute('aria-pressed', 'true')
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
    expect(medidas.botones[0].y).toBe(medidas.botones[1].y)
    expect(medidas.botones[2].y).toBe(medidas.botones[3].y)
    expect(medidas.botones[2].y).toBeGreaterThan(medidas.botones[0].y)
    expect(medidas.botones.every(({ height }) => height >= 44), JSON.stringify(medidas.botones)).toBe(true)
  }
})

test('rutas principales conservan el viewport y tablas se desplazan por teclado', async ({ page }) => {
  test.setTimeout(120_000)
  await page.goto('/login')
  await page.getByRole('button', { name: 'Personal Técnico de Farmacia' }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
  const tour = page.getByRole('dialog')
  if (await tour.isVisible()) await tour.getByRole('button', { name: 'Omitir' }).click()

  const rutas = [
    '/dashboard',
    '/historial',
    '/alertas',
    '/trazabilidad',
    '/checklist-bpa',
    '/reportes',
    '/metricas-ia',
    '/guia',
  ]
  for (const width of [320, 375, 390, 768, 1024, 1280]) {
    await page.setViewportSize({ width, height: 844 })
    for (const ruta of rutas) {
      await page.goto(ruta)
      await page.locator('main h1').first().waitFor({ state: 'visible', timeout: 10_000 })
      const medidas = await page.evaluate(() => ({
        viewport: document.documentElement.clientWidth,
        documento: document.documentElement.scrollWidth,
      }))
      expect(medidas.documento, `${ruta} a ${width}px`).toBeLessThanOrEqual(medidas.viewport)
    }
  }

  await page.setViewportSize({ width: 320, height: 844 })
  await page.goto('/historial')
  const tabla = page.getByRole('region', { name: 'Historial térmico' })
  await tabla.focus()
  await tabla.press('ArrowRight')
  expect(await tabla.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0)
  await tabla.press('End')
  expect(await tabla.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0)
})

test('trazabilidad explica cadena, oculta sellos y muestra verificación', async ({ page }) => {
  await page.goto('/login')
  await page.getByRole('button', { name: 'Personal Técnico de Farmacia' }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
  await page.getByRole('dialog').getByRole('button', { name: 'Omitir' }).click()
  await page.goto('/trazabilidad')
  await expect(page.getByText('Registro N+1')).toBeVisible()
  await expect(page.getByRole('columnheader', { name: 'Sello anterior' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Mostrar detalles técnicos de los sellos' }).click()
  await expect(page.getByRole('columnheader', { name: 'Sello anterior' })).toBeVisible()
  await page.getByRole('button', { name: 'Verificar registros' }).click()
  await expect(page.getByText(/registros intactos|alteración detectada/i).first()).toBeVisible()
})
