import { expect, test } from '@playwright/test'
import { irA } from './helpers'

/**
 * Track «registros» del backlog (HU-26, HU-36, HU-37, HU-42, HU-49, HU-50)
 * contra la demo, que implementa los mismos endpoints y reglas del backend.
 */
async function entrar(page: import('@playwright/test').Page, rol: string) {
  await page.goto('/login')
  await page.getByRole('button', { name: rol }).first().click()
  await expect(page).toHaveURL(/\/dashboard$/)
}

test('HU-36: la curva y el resumen cubren el periodo y la tabla pagina en el servidor', async ({ page }) => {
  await entrar(page, 'Químico Farmacéutico')
  await irA(page, '/historial?device_id=FARM-01-CDL')
  const tira = page.getByRole('region', { name: 'Resumen del periodo' })
  await expect(tira).toBeVisible()
  const resultados = page.getByText(/\d+ lecturas en el periodo/)
  await expect(resultados).toBeVisible()
  const total = Number((await resultados.textContent())?.match(/(\d+)/)?.[1])
  await page.getByText('Curva del periodo', { exact: true }).filter({ visible: true }).click()
  await expect(page.getByText(/Promedio y mín\.–máx\. cada 1\s*min/)).toBeVisible()
  await expect(page.locator('#historial-grafica canvas').first()).toBeVisible()

  const tabla = page.locator('[role="region"][aria-label="Historial de lecturas"]')
  // La demo de un único equipo tiene una captura cada diez minutos. La hora ISO
  // identifica cada muestra de la consulta, incluso al cambiar de día.
  const horas = tabla.locator('tr[data-fila] time[datetime]')
  const leerHoras = () => horas.evaluateAll((filas) => filas.map((fila) => fila.getAttribute('datetime')!))
  const paginacion = page.getByRole('navigation', { name: 'Paginación', exact: true })
  await expect(horas.first()).toBeVisible()
  const primeraPagina = await leerHoras()
  const tamano = primeraPagina.length
  expect(total).toBeGreaterThan(tamano)
  const vistas: string[] = []
  for (let desde = 0; desde < total; desde += tamano) {
    const hasta = Math.min(desde + tamano, total)
    if (desde > 0) await paginacion.getByRole('button', { name: 'Página siguiente' }).click()
    await expect(paginacion).toContainText(`Mostrando ${desde + 1}–${hasta} de ${total}`)
    await expect(horas).toHaveCount(hasta - desde)
    vistas.push(...await leerHoras())
  }
  expect(new Set(vistas).size).toBe(total)
  await expect(paginacion.getByRole('button', { name: 'Página siguiente' })).toBeDisabled()
  await paginacion.getByRole('button', { name: '1', exact: true }).click()
  await expect(paginacion).toContainText(`Mostrando 1–${tamano} de ${total}`)
  expect(await leerHoras()).toEqual(primeraPagina)
})

test('HU-36 esc. 2: un rango sin telemetría muestra el texto literal del criterio', async ({ page }) => {
  await entrar(page, 'Químico Farmacéutico')
  await irA(page, '/historial')
  await page.getByRole('button', { name: 'Filtros', exact: true }).click()
  await page.getByLabel('Desde', { exact: true }).fill('2020-01-01T00:00')
  await page.getByLabel('Hasta', { exact: true }).fill('2020-01-02T00:00')
  await page.getByRole('button', { name: 'Aplicar filtros' }).click()
  await expect(page.getByText('Sin datos registrados en el rango seleccionado')).toBeVisible()
})

test('HU-26: el auditor elige la cadena del sistema y la verifica con su alcance a la vista', async ({ page }) => {
  await entrar(page, 'Auditor Consulta de registros')
  await irA(page, '/trazabilidad')
  const selector = page.getByLabel('Cadena', { exact: true })
  await expect(selector.locator('option')).toContainText(['Todas las cadenas'])
  await selector.selectOption('SISTEMA')
  await page.getByRole('button', { name: 'Revisar integridad' }).click()
  await expect(page.getByRole('heading', { name: 'No se detectaron cambios' })).toBeVisible()
  await expect(page.getByText('Cadena verificada')).toBeVisible()
  await expect(page.getByTestId('alcance-verificacion')).toContainText('DIGEMID')
})

test('HU-37: una lectura alterada en el periodo se rotula «Corrupta» con su ID', async ({ page }) => {
  await entrar(page, 'Químico Farmacéutico')
  await irA(page, '/trazabilidad')
  // La demo altera el registro más antiguo de la cadena: una lectura de FARM-01-CDL de hace ~7 días.
  await page.locator('summary').filter({ hasText: 'Herramientas de revisión' }).click()
  await page.getByRole('button', { name: 'Simular inconsistencia (demo)' }).click()
  await expect(page.getByText('Alteración detectada')).toBeVisible()
  const dia = (f: Date) => `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`
  await page.locator('summary').filter({ hasText: 'Verificar por dispositivo y periodo' }).click()
  await page.locator('#seg-device').fill('FARM-01-CDL')
  await page.locator('#seg-desde').fill(dia(new Date(Date.now() - 8 * 86_400_000)))
  await page.locator('#seg-hasta').fill(dia(new Date()))
  await page.getByRole('button', { name: 'Verificar segmento' }).click()
  const resultado = page.getByTestId('resultado-segmento')
  await expect(resultado).toContainText('Se detectó un cambio en el periodo')
  const corrupta = resultado.locator('li[data-estado="corrupto"]')
  await expect(corrupta).toHaveCount(1)
  await expect(corrupta).toContainText('Corrupta')
  await expect(corrupta.getByRole('button', { name: 'Copiar ID del registro' })).toBeVisible()
  // La verificación sigue con el resto del segmento.
  await expect(resultado.locator('li[data-estado="integro"]').first()).toContainText('Íntegra')
})

test('HU-49: el auditor consulta el historial de configuración con actor y vigencia', async ({ page }) => {
  await entrar(page, 'Auditor Consulta de registros')
  await irA(page, '/configuracion-equipos')
  await expect(page.getByRole('heading', { level: 1, name: 'Historial de configuración' })).toBeVisible()
  const lista = page.getByRole('list').filter({ hasText: 'Intervalo de reporte' })
  await lista.locator('summary').filter({ hasText: 'Intervalo de reporte' }).first().click()
  await expect(lista.getByText('Por Administrador Demo', { exact: false }).filter({ visible: true }).first()).toBeVisible()
  await expect(lista).toContainText(/Vigente desde el .* \(actual\)/)
  await page.getByLabel('Categoría', { exact: true }).selectOption('calibracion')
  await expect(page.getByText('Categoría: Calibración')).toBeVisible()
  await expect(page.getByRole('list').filter({ hasText: 'Última calibración' })).toBeVisible()
  await expect(page.getByText('Intervalo de reporte')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /guardar|editar/i })).toHaveCount(0)
})

test('HU-50: el administrador filtra eventos bloqueados y ve el umbral de intentos', async ({ page }) => {
  await entrar(page, 'Administrador')
  await irA(page, '/auditoria')
  await page.getByRole('button', { name: 'Filtros', exact: true }).click()
  await page.getByLabel('Resultado', { exact: true }).selectOption('bloqueado')
  await expect(page.getByText('Resultado: Bloqueado', { exact: true })).toBeVisible()
  const tabla = page.locator('[role="region"][aria-label="Bitácora de auditoría"]')
  await expect(tabla.getByText('Límite de intentos superado').first()).toBeVisible()
  await expect(tabla.getByText('Bloqueo temporal', { exact: true })).toHaveCount(0)
})
