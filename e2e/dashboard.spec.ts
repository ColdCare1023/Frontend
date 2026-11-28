import AxeBuilder from '@axe-core/playwright'
import { congelarAnimaciones } from './helpers'
import { expect, test, type Page } from '@playwright/test'

/** El monitoreo usa datos de demostración que cambian en tiempo real. */
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

test('monitoreo 1440×900: lectura y condiciones al entrar; curva y alertas en la misma pantalla', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await entrar(page)
  const lectura = page.getByTestId('celda-lectura')
  const condiciones = page.getByRole('region', { name: 'Condiciones', exact: true })
  await expect(lectura).toBeVisible()
  await expect(condiciones).toBeVisible()
  const rango = lectura.locator('summary')
  const escala = lectura.locator('details')
  await expect(escala).not.toHaveAttribute('open')
  await rango.focus()
  await page.keyboard.press('Enter')
  await expect(escala).toHaveAttribute('open', '')
  await page.keyboard.press('Enter')
  const variaciones = condiciones.getByRole('button', { name: 'Variaciones del periodo' })
  await expect(variaciones).toHaveAttribute('aria-expanded', 'false')
  await variaciones.click()
  await expect(variaciones).toHaveAttribute('aria-expanded', 'true')
  const curva = page.getByRole('region', { name: 'Cómo cambió la temperatura' })
  await expect(curva).toBeVisible()
  await expect(lectura).toBeVisible()
  await expect(page.getByRole('tablist', { name: 'Monitoreo' })).toHaveCount(0)
  await page.getByText('Diagnóstico de equipos', { exact: true }).click()
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
  await expect(page.getByRole('region', { name: 'Cómo cambió la temperatura' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Alertas pendientes' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Cómo cambió la temperatura' })).toBeVisible()
})

test('cambiar de equipo desde Estado de equipos actualiza la lectura', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await entrar(page)
  await page.getByText('Diagnóstico de equipos', { exact: true }).click()
  const estado = page.getByRole('region', { name: 'Estado operativo de equipos' })
  const filas = estado.getByRole('listitem')
  await expect(filas).toHaveCount(2)
  const otra = estado.locator('li:not([aria-current])').getByRole('button', { name: /^Mostrar .* en el monitoreo$/ })
  const nombre = (await otra.getAttribute('aria-label'))!.replace(/^Mostrar (.*) en el monitoreo$/, '$1')
  await otra.click()
  await expect(page.locator('#equipo-monitoreado')).toBeFocused()
  await expect(page.getByRole('heading', { name: 'Última temperatura recibida' })).toBeVisible()
  await expect(estado.locator('li[aria-current="true"]')).toContainText(nombre)
})

test('la cabecera abre el equipo elegido sin abandonar el tablero', async ({ page }) => {
  await entrar(page)
  await page.getByRole('button', { name: /^Estado en vivo/ }).click()
  await page.getByRole('link', { name: /Cámara fría de vacunas/ }).click()
  await expect(page.getByRole('combobox', { name: 'Equipo' })).toHaveValue('FARM-02-CDL')
  await expect(page.getByRole('heading', { name: 'Última temperatura recibida' })).toBeVisible()
  await expect(page).toHaveURL(/\/dashboard$/)
})

test('panel de detalle de equipo: buffer, incidentes y ficha; Escape devuelve el foco', async ({ page }) => {
  await entrar(page)
  await page.getByText('Diagnóstico de equipos', { exact: true }).click()
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

test('Alertas pendientes visibles y lecturas recientes a un clic', async ({ page }) => {
  await entrar(page)
  await expect(page.getByRole('region', { name: 'Alertas pendientes' })).toBeVisible()
  await expect(page.locator('details').filter({ has: page.locator('summary', { hasText: 'Consultar lecturas recientes' }) })).not.toHaveAttribute('open')
  await page.getByText('Consultar lecturas recientes', { exact: true }).click()
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

/** Abre el simulador de la demo y aplica un escenario; el panel queda abierto. */
async function aplicarEscenario(page: Page, escenario: string) {
  const panel = page.getByRole('dialog')
  if (!(await panel.isVisible())) await page.getByRole('button', { name: /Probar estados del dashboard/ }).click()
  await panel.getByRole('button', { name: escenario }).click()
  await expect(panel.getByRole('status')).toContainText('Escenario aplicado')
}

async function cerrarSimulador(page: Page) {
  await page.getByRole('dialog').getByRole('button', { name: 'Cerrar', exact: true }).last().click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
}

test('HU-35: simular puerta abierta avisa con role alert; al cerrarla el aviso desaparece y la apertura queda contada', async ({ page }) => {
  await entrar(page, 'Administrador')
  await aplicarEscenario(page, 'Simular puerta abierta')
  await cerrarSimulador(page)
  const advertencia = page.getByTestId('puerta-advertencia')
  await expect(advertencia).toHaveAttribute('role', 'alert')
  await expect(advertencia).toContainText('Abierta')

  // Esc. 3: la puerta se cierra; la advertencia activa desaparece…
  await aplicarEscenario(page, 'Simular puerta cerrada')
  await cerrarSimulador(page)
  await expect(page.getByTestId('puerta-advertencia')).toHaveCount(0)
  const condiciones = page.getByRole('region', { name: 'Condiciones', exact: true })
  await expect(condiciones.getByText('Cerrada', { exact: true })).toBeVisible()
  // …y el evento histórico se conserva en el conteo de la ventana.
  await expect(condiciones.getByText(/^≥?[1-9]\d* aperturas? · 24/)).toBeVisible()
})

test('HU-07/HU-34: un arranque sin hora se rotula «Sin hora» y «Sin clasificación IA», nunca Normal', async ({ page }) => {
  await entrar(page, 'Administrador')
  await aplicarEscenario(page, 'Simular arranque sin hora sincronizada')
  await cerrarSimulador(page)
  const lectura = page.getByTestId('celda-lectura')
  await expect(lectura.getByTestId('riesgo-sin-clasificacion')).toContainText('Sin clasificación IA')
  await expect(lectura.getByText('Normal', { exact: true })).toHaveCount(0)
  await expect(lectura.getByText(/^Sin hora/)).toBeVisible()
  await page.getByText('Consultar lecturas recientes', { exact: true }).click()
  const recientes = page.getByRole('region', { name: 'Lecturas recientes' })
  await expect(recientes.getByText(/^Sin hora/).first()).toBeVisible()
  await expect(page.getByTestId('aviso-curva-sin-hora')).toContainText('sin hora')

  // Al sincronizar el reloj, las lecturas se reanclan: ya no quedan sin hora.
  await aplicarEscenario(page, 'Recuperar y sincronizar')
  await cerrarSimulador(page)
  await expect(recientes.getByText(/^Sin hora/)).toHaveCount(0)
})

test('HU-31: 24 h y 7 d dibujan la serie agregada del periodo completo', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await entrar(page)
  const curva = page.getByRole('region', { name: 'Cómo cambió la temperatura' })
  const grafica = curva.locator('[role="img"][aria-label^="Gráfica de líneas"]')
  await expect(grafica).toHaveAttribute('aria-label', /promedio cada 1 min con su mínimo y máximo/)
  await expect(curva.getByText(/lecturas · promedio cada 1 min/)).toBeVisible()

  const rangos = page.getByRole('group', { name: 'Rango de la curva térmica' })
  await rangos.getByRole('button', { name: '7 d', exact: true }).click()
  await expect(grafica).toHaveAttribute('aria-label', /los últimos 7 días, promedio cada 10 min/)
  await expect(curva.getByText(/lecturas · promedio cada 10 min/)).toBeVisible()

  // 1 h sigue con lecturas crudas.
  await rangos.getByRole('button', { name: '1 h', exact: true }).click()
  await expect(grafica).toHaveAttribute('aria-label', /de las últimas \d+ lecturas/)
})

test('HU-48: buffer lleno muestra el periodo en cola, las pérdidas y la brecha en curso', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await entrar(page, 'Administrador')
  await aplicarEscenario(page, 'Simular buffer lleno y pérdidas')
  await cerrarSimulador(page)
  await page.getByText('Diagnóstico de equipos', { exact: true }).click()
  const equipo = page.getByRole('region', { name: 'Equipo', exact: true })
  await expect(equipo.getByTestId('buffer-rango')).toContainText(/Periodo en cola: .+ – .+ · Perdidas: \d+/)
  await equipo.getByRole('button', { name: 'Detalles' }).click()
  const brechas = page.getByRole('dialog').getByRole('list', { name: 'Brechas por buffer lleno' })
  await expect(brechas.getByRole('listitem').first()).toContainText(/Se perdieron 3 lecturas · buffer local lleno · en curso/)
  await expect(brechas.getByRole('listitem').first()).toContainText(/Periodo afectado: .+ – .+/)
  await page.keyboard.press('Escape')

  // Esc. 3: al sincronizar, el indicador de pendientes desaparece y la brecha deja de estar en curso.
  await aplicarEscenario(page, 'Recuperar y sincronizar')
  await cerrarSimulador(page)
  await expect(equipo.getByTestId('buffer-rango')).toHaveCount(0)
  await equipo.getByRole('button', { name: 'Detalles' }).click()
  const panel = page.getByRole('dialog')
  await expect(panel.getByText(/Sin pendientes; sincronización recuperada/)).toBeVisible()
  await expect(panel.getByRole('list', { name: 'Brechas por buffer lleno' }).getByRole('listitem').first()).not.toContainText('en curso')
})

test('simular silencio del equipo: Sin datos en la línea de estado y la fila', async ({ page }) => {
  await entrar(page, 'Administrador')
  await page.getByRole('button', { name: /Probar estados del dashboard/ }).click()
  const panel = page.getByRole('dialog')
  await panel.getByRole('button', { name: 'Simular silencio del equipo' }).click()
  await expect(panel.getByRole('status')).toContainText('Escenario aplicado')
  await page.keyboard.press('Escape')
  await page.getByText('Diagnóstico de equipos', { exact: true }).click()
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
    await page.getByText('Diagnóstico de equipos', { exact: true }).click()
    await page.getByRole('region', { name: 'Equipo', exact: true }).getByRole('button', { name: 'Detalles' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    expect(await axe(), 'detalle').toEqual([])
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: /Probar estados del dashboard/ }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    expect(await axe(), 'simulador').toEqual([])
  })
}
