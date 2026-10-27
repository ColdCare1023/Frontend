import { expect, test } from '@playwright/test'
import { abrirOpciones, accionPrimeraFila, irA } from './helpers'

async function entrarComo(page: import('@playwright/test').Page, perfil: string) {
  await page.goto('/login')
  await page.getByRole('button', { name: perfil }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
}

test('admin crea usuario, cambia rol y desactiva cuenta en demo', async ({ page }) => {
  await entrarComo(page, 'Administrador')
  await irA(page, '/usuarios')

  const sufijo = Date.now()
  const nombre = `Cuenta QA ${sufijo}`
  const correo = `qa-${sufijo}@demo.pe`
  await page.getByRole('button', { name: 'Nuevo usuario' }).click()
  let dialogo = page.getByRole('dialog')
  await dialogo.getByLabel('Nombre completo').fill(nombre)
  await dialogo.getByLabel('Correo electrónico').fill(correo)
  await dialogo.getByLabel('Contraseña').fill('demo-seguro-2026')
  await dialogo.getByLabel('Rol').selectOption('tecnico')
  await dialogo.getByRole('button', { name: 'Crear usuario' }).click()
  await expect(dialogo.getByRole('status')).toContainText('Usuario creado correctamente.')

  const fila = page.getByRole('row').filter({ hasText: correo })
  await expect(fila).toContainText('Técnico de Farmacia')
  await abrirOpciones(page, correo)
  await page.getByRole('menuitem', { name: `Cambiar rol de ${nombre}` }).click()
  dialogo = page.getByRole('dialog')
  await dialogo.getByLabel('Rol nuevo').selectOption('auditor')
  await dialogo.getByRole('button', { name: 'Cambiar rol' }).click()
  await expect(dialogo.getByRole('status')).toContainText('Rol actualizado correctamente.')
  await expect(fila).toContainText('Auditor')

  await abrirOpciones(page, correo)
  await page.getByRole('menuitem', { name: `Desactivar a ${nombre}` }).click()
  dialogo = page.getByRole('alertdialog')
  await dialogo.getByLabel('Motivo').selectOption('otros')
  await dialogo.getByRole('button', { name: 'Confirmar', exact: true }).click()
  await expect(dialogo.getByRole('status')).toContainText('Usuario desactivado correctamente.')
  await expect(fila).toContainText('Inactivo')
})

test('admin actualiza dispositivo, consulta historial y registra baja de reemplazo', async ({ page }) => {
  await entrarComo(page, 'Administrador')
  await irA(page, '/dispositivos')

  await abrirOpciones(page, 'FARM-01-CDL')
  const calibracion = page.getByRole('menuitem', {
    name: 'Registrar calibración',
  })
  await calibracion.click()
  let dialogo = page.getByRole('dialog')
  const hoy = new Date()
  await dialogo.getByLabel('Fecha de calibración').fill(hoy.toISOString().slice(0, 10))
  await dialogo.getByLabel('N.° de certificado').fill(`QA-CAL-${Date.now()}`)
  // B-12: el backend calcula el vencimiento con la vigencia en meses.
  await dialogo.getByLabel('Vigencia del certificado (meses)').fill('12')
  await dialogo.getByRole('button', { name: 'Guardar' }).click()
  await expect(dialogo).toBeHidden()

  await abrirOpciones(page, 'FARM-01-CDL')
  await page.getByRole('menuitem', {
    name: 'Ubicación e instalación',
  }).click()
  dialogo = page.getByRole('dialog')
  await dialogo.getByLabel('Ubicación').fill('Almacén QA')
  await dialogo.getByRole('button', { name: 'Guardar' }).click()
  await expect(dialogo.getByRole('status')).toContainText('Instalación actualizada correctamente.')
  await expect(dialogo).toBeHidden()

  await abrirOpciones(page, 'FARM-01-CDL')
  await page.getByRole('menuitem', {
    name: 'Responsable de notificaciones',
  }).click()
  dialogo = page.getByRole('dialog')
  await dialogo.getByLabel('Nombre').fill('Responsable QA')
  await dialogo.getByLabel('Correo electrónico').fill('responsable-qa@demo.pe')
  await dialogo.getByRole('button', { name: 'Guardar' }).click()
  await expect(dialogo.getByRole('status')).toContainText('Responsable actualizado correctamente.')
  await expect(dialogo).toBeHidden()

  await abrirOpciones(page, 'FARM-01-CDL')
  await page.getByRole('menuitem', {
    name: 'Historial de configuración',
  }).click()
  dialogo = page.getByRole('dialog')
  await expect(dialogo).toContainText('fecha_ultima_calibracion')
  await expect(dialogo).toContainText('ubicacion')
  await expect(dialogo).toContainText('responsable_nombre')
  await dialogo.getByRole('button', { name: 'Cerrar', exact: true }).first().click()

  const segundaFila = page.getByRole('row').filter({ hasText: 'FARM-02-CDL' })
  await abrirOpciones(page, 'FARM-02-CDL')
  const baja = page.getByRole('menuitem', { name: 'Dar de baja', exact: true })
  if (await baja.count()) {
    await baja.click()
    dialogo = page.getByRole('alertdialog')
    await dialogo.getByLabel('Motivo de baja').selectOption('reemplazo')
    await dialogo.getByLabel('Descripción (opcional)').fill('Reemplazo verificado en QA demo')
    await dialogo.getByLabel('Código del equipo de reemplazo (opcional)').fill('FARM-03-QA')
    await dialogo.getByRole('button', { name: 'Confirmar' }).click()
    await expect(dialogo.getByRole('status')).toContainText('Dispositivo dado de baja correctamente.')
  }
  await expect(segundaFila).toContainText('Dado de baja')
})

test('farmacéutico revisa alerta y genera reporte', async ({ page }) => {
  await entrarComo(page, 'Químico Farmacéutico')
  await irA(page, '/alertas')
  await page.getByRole('button', { name: 'Todas' }).click()

  // Las acciones de cada alerta viven en su menú «Opciones» (ActionMenu).
  await accionPrimeraFila(page, 'Acción correctiva')
  const dialogoAccion = page.getByRole('dialog')
  await dialogoAccion.getByLabel('Descripción de la acción correctiva')
    .fill('Se verificó cierre de puerta en QA demo.')
  await dialogoAccion.getByRole('button', { name: 'Guardar acción' }).click()
  await expect(dialogoAccion.getByRole('status')).toContainText('Acción correctiva registrada.')

  await irA(page, '/reportes')
  await page.getByRole('button', { name: 'Generar reporte' }).click()
  await expect(page.getByText('Resumen del periodo')).toBeVisible()
})
