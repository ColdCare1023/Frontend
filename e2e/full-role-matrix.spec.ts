import { expect, test } from '@playwright/test'
import { irA } from './helpers'

const roles = [
  {
    boton: 'Químico Farmacéutico',
    rutas: [
      '/dashboard', '/historial', '/alertas', '/trazabilidad', '/guia',
      '/reportes', '/metricas-ia',
    ],
  },
  {
    boton: 'Técnico de Farmacia',
    rutas: ['/dashboard', '/historial', '/alertas', '/trazabilidad', '/guia'],
  },
  {
    boton: 'Administrador',
    rutas: [
      '/dashboard', '/historial', '/alertas', '/trazabilidad', '/guia',
      '/reportes', '/metricas-ia', '/auditoria',
      '/usuarios', '/dispositivos',
    ],
  },
  {
    boton: 'Auditor Solo lectura',
    rutas: [
      '/dashboard', '/historial', '/alertas', '/trazabilidad', '/guia',
      '/reportes', '/metricas-ia', '/auditoria',
    ],
  },
] as const

const todasLasRutas = [
  '/dashboard', '/historial', '/alertas', '/trazabilidad', '/guia',
  '/reportes', '/metricas-ia', '/auditoria',
  '/usuarios', '/dispositivos',
] as const

async function iniciarSesionDemo(page: import('@playwright/test').Page, boton: string) {
  await page.goto('/login')
  await page.getByRole('button', { name: boton }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
  const tour = page.locator('[role="dialog"]')
  await expect(tour).toBeVisible()
  await tour.getByRole('button', { name: 'Omitir' }).click()
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
}

test('matriz completa de permisos: 10 rutas protegidas × 4 roles', async ({ page }) => {
  test.setTimeout(240_000)

  for (const perfil of roles) {
    await iniciarSesionDemo(page, perfil.boton)
    const permitidas = new Set<string>(perfil.rutas)

    for (const ruta of todasLasRutas) {
      await irA(page, ruta)
      await expect(page).toHaveURL(new RegExp(`${ruta}$`))
      const sinPermiso = page.getByText('No tienes permiso para ver esta sección.')

      if (permitidas.has(ruta)) {
        await expect(sinPermiso).toHaveCount(0)
        await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
        if (ruta === '/usuarios' || ruta === '/dispositivos') {
          await expect(page.getByRole('columnheader', { name: /^(Acciones|Opciones)$/ })).toBeVisible()
        }
      } else {
        await expect(sinPermiso).toBeVisible()
      }
    }
  }
})

test('pantallas de administración no desbordan viewport en anchos móviles y desktop', async ({ page }) => {
  test.setTimeout(120_000)
  await iniciarSesionDemo(page, 'Administrador')

  const viewports = [
    { width: 1920, height: 1080 },
    { width: 1600, height: 900 },
    { width: 1440, height: 900 },
    { width: 1366, height: 768 },
    { width: 1280, height: 800 },
    { width: 1024, height: 768 },
    { width: 834, height: 1194 },
    { width: 768, height: 1024 },
    { width: 430, height: 932 },
    { width: 393, height: 852 },
    { width: 390, height: 844 },
    { width: 375, height: 812 },
    { width: 320, height: 844 },
  ]
  for (const { width, height } of viewports) {
    await page.setViewportSize({ width, height })
    for (const ruta of ['/usuarios', '/dispositivos']) {
      await irA(page, ruta)
      await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
      const dimensiones = await page.evaluate(() => ({
        anchoDocumento: document.documentElement.scrollWidth,
        anchoViewport: document.documentElement.clientWidth,
      }))
      expect(dimensiones.anchoDocumento, `${ruta} a ${width}px`).toBeLessThanOrEqual(
        dimensiones.anchoViewport,
      )
    }
  }
})

test('gráficas ECharts cargan al abrir tablero, no durante login', async ({ page }) => {
  await page.goto('/login')
  const recursosLogin = await page.evaluate(() => performance.getEntriesByType('resource').map(({ name }) => name))
  expect(recursosLogin.some((url) => /echarts/i.test(url))).toBe(false)

  await page.getByRole('button', { name: 'Químico Farmacéutico' }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
  const tour = page.getByRole('dialog')
  await expect(tour).toBeVisible()
  await tour.getByRole('button', { name: 'Omitir' }).click()
  await expect(page.locator('canvas').first()).toBeVisible()
  await expect.poll(async () => {
    const recursos = await page.evaluate(() => performance.getEntriesByType('resource').map(({ name }) => name))
    return recursos.some((url) => /echarts/i.test(url))
  }).toBe(true)
})
