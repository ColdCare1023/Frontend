import { expect, test } from '@playwright/test'
import { irA, abrirOpciones } from './helpers'

async function entrarComoAdmin(page: import('@playwright/test').Page) {
  await page.goto('/login')
  await page.getByRole('button', { name: 'Administrador' }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
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
  await abrirOpciones(page, 'FARM-01-CDL')
  await page.getByRole('menuitem', { name: 'Revocar credencial', exact: true }).click()
  // FE-003: confirmación con motivo obligatorio, que queda en la auditoría.
  // Acción destructiva: el diálogo es un alertdialog.
  const dialogo = page.getByRole('alertdialog')
  await dialogo.getByLabel('Motivo').fill('Equipo extraviado (QA)')
  await dialogo.getByRole('button', { name: 'Revocar credencial' }).click()
  await expect(page.getByText(/Credencial revocada: el sistema ya no acepta/)).toBeVisible()
  // HU-44 Escenario 3: queda pendiente retirar el usuario en la consola del broker.
  await expect(page.getByText('Pendiente en el broker: retirar usuario').first()).toBeVisible()
  await expect(page.getByTestId('token-rotado')).toHaveCount(0)
})
