import { expect, test } from '@playwright/test'
import { irA, abrirOpciones } from './helpers'

async function entrarComoAdmin(page: import('@playwright/test').Page) {
  await page.goto('/login')
  await page.getByRole('button', { name: 'Administrador' }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
  await page.getByRole('dialog').getByRole('button', { name: 'Omitir' }).click()
}

test('HU-50 registra bloqueos, resultado y exporta la bitácora filtrada', async ({ page }) => {
  await entrarComoAdmin(page)
  await irA(page, '/auditoria')
  await expect(page.getByText(/bloqueos temporales de acceso registrados/i)).toBeVisible()
  await expect(page.getByRole('columnheader', { name: 'Resultado' })).toBeVisible()
  await expect(page.getByText('denegado', { exact: true }).first()).toBeVisible()
  const descarga = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Exportar CSV' }).click()
  expect((await descarga).suggestedFilename()).toBe('coldcare-auditoria.csv')
})

test('HU-26 presenta inconsistencia simulada con detalle verificable', async ({ page }) => {
  await entrarComoAdmin(page)
  await irA(page, '/trazabilidad')
  await page.getByRole('button', { name: 'Simular inconsistencia (demo)' }).click()
  await expect(page.getByText('Alteración detectada')).toBeVisible()
  await expect(page.getByTestId('detalle-inconsistencia')).toContainText('Sello recalculado')
  await expect(page.getByTestId('detalle-inconsistencia')).toContainText('Sello almacenado')
})

test('HU-44 permite revocar credencial MQTT con confirmación y sin exponer secreto', async ({ page }) => {
  await entrarComoAdmin(page)
  await irA(page, '/dispositivos')
  page.once('dialog', (dialog) => dialog.accept())
  await abrirOpciones(page, 'FARM-01-CDL')
  await page.getByRole('menuitem', { name: 'Revocar credencial', exact: true }).click()
  await page.getByRole('row').filter({ hasText: 'FARM-01-CDL' }).locator('summary').click()
  await expect(page.getByText('Credencial revocada. Demo no contacta EMQX ni expone secretos.')).toBeVisible()
  await expect(page.getByText('Revocada').first()).toBeVisible()
})
