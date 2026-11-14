import { expect, test } from '@playwright/test'
import { irA } from './helpers'

async function entrar(page: import('@playwright/test').Page, rol: string) {
  await page.goto('/login')
  await page.getByRole('button', { name: rol }).first().click()
  await expect(page).toHaveURL(/\/dashboard$/)
}

test('historial agrupa por día, expande una lectura y abre el origen del riesgo', async ({ page }) => {
  await entrar(page, 'Químico Farmacéutico')
  await irA(page, '/historial')
  const tabla = page.locator('[role="region"][aria-label="Historial de lecturas"]')
  await expect(tabla.locator('th[scope="colgroup"]').first()).toBeVisible()
  // El nombre del botón cambia al expandir («Ocultar detalle…»): se fija por id.
  const id = await tabla.getByRole('button', { name: /Ver detalle de la lectura/ }).first().getAttribute('id')
  const boton = page.locator(`[id="${id}"]`)
  await boton.click()
  await expect(boton).toHaveAttribute('aria-expanded', 'true')
  await page.getByRole('button', { name: 'Ver origen del riesgo' }).click()
  await expect(page.getByRole('dialog', { name: 'Cómo se obtuvo este riesgo' })).toBeVisible()
})

test('auditoría: el auditor filtra fallidas sin consultar y expande una fila con IP y recurso', async ({ page }) => {
  await entrar(page, 'Auditor Consulta de registros')
  await irA(page, '/auditoria')
  await page.getByLabel('Resultado', { exact: true }).selectOption('fallidas')
  await expect(page.getByText(/Resultado: Fallidas o denegadas/)).toBeVisible()
  const tabla = page.locator('[role="region"][aria-label="Bitácora de auditoría"]')
  await tabla.getByRole('button', { name: /Ver detalle de/ }).first().click()
  await expect(page.locator('tr[data-detalle]')).toContainText('IP de origen')
  await expect(page.locator('tr[data-detalle]')).toContainText('Recurso')
})

test('registros a 375 y 768 px: filas compactas sin desborde horizontal', async ({ page }) => {
  await entrar(page, 'Administrador')
  for (const width of [375, 768]) {
    await page.setViewportSize({ width, height: 812 })
    for (const ruta of ['/historial', '/auditoria', '/trazabilidad']) {
      await irA(page, ruta)
      await expect(page.locator('tr[data-fila]').first()).toBeVisible()
      const medidas = await page.evaluate(() => ({
        viewport: document.documentElement.clientWidth,
        documento: document.documentElement.scrollWidth,
      }))
      expect(medidas.documento, `${ruta} a ${width}px`).toBeLessThanOrEqual(medidas.viewport)
    }
  }
})

test('registros respetan roles: el técnico no ve Aislar ni entra a Auditoría', async ({ page }) => {
  await entrar(page, 'Técnico de Farmacia')
  await irA(page, '/trazabilidad')
  await page.getByRole('button', { name: 'Simular inconsistencia (demo)' }).click()
  await expect(page.getByText('Alteración detectada')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Aislar registro corrupto' })).toHaveCount(0)
  await irA(page, '/auditoria')
  await expect(page.getByText(/permiso/i).first()).toBeVisible()
})
