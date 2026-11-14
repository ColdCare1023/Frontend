import { expect, test } from '@playwright/test'
import { abrirEquipo, abrirOpciones, abrirOpcionesEquipo, accionPrimeraFila, irA } from './helpers'

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

  // Las acciones del equipo viven en las pestañas de su detalle.
  await abrirOpcionesEquipo(page, 'FARM-01-CDL')
  await page.getByRole('menuitem', { name: 'Calibración' }).click()
  await expect(page).toHaveURL(/\/dispositivos\/FARM-01-CDL\?tab=calibracion/)
  await page.getByRole('button', { name: 'Registrar calibración' }).click()
  const hoy = new Date()
  await page.getByLabel('Fecha de calibración').fill(hoy.toISOString().slice(0, 10))
  await page.getByLabel('N.° de certificado').fill(`QA-CAL-${Date.now()}`)
  // HU-30: el vencimiento sale del certificado.
  await page.getByLabel('Vencimiento del certificado').fill(`${hoy.getFullYear() + 1}-12-31`)
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Calibración registrada correctamente.' })).toBeVisible()

  await page.getByRole('tab', { name: /Ubicación y responsable/ }).click()
  const ubicacion = page.getByRole('region', { name: 'Ubicación e instalación' })
  await ubicacion.getByRole('button', { name: 'Editar ubicación de FARM-01-CDL' }).click()
  await ubicacion.getByLabel('Ubicación', { exact: true }).fill('Almacén QA')
  await ubicacion.getByRole('button', { name: 'Guardar' }).click()
  await expect(ubicacion.getByRole('status')).toContainText('Instalación actualizada correctamente.')

  const responsable = page.getByRole('region', { name: 'Responsable de notificaciones' })
  await responsable.getByRole('button', { name: 'Editar responsable de FARM-01-CDL' }).click()
  await responsable.getByLabel('Nombre').fill('Responsable QA')
  await responsable.getByLabel('Correo electrónico').fill('responsable-qa@demo.pe')
  await responsable.getByRole('button', { name: 'Guardar' }).click()
  await expect(responsable.getByRole('status')).toContainText('Responsable actualizado correctamente.')

  await page.getByRole('tab', { name: /Configuración y cambios/ }).click()
  const historial = page.getByRole('tabpanel')
  await expect(historial).toContainText('fecha_ultima_calibracion')
  await expect(historial).toContainText('ubicacion')
  await expect(historial).toContainText('responsable_nombre')

  await abrirEquipo(page, 'FARM-02-CDL', 'seguridad')
  // Zona de riesgo: la baja abre su alertdialog con motivo.
  await page.getByRole('button', { name: 'Dar de baja…' }).click()
  const dialogo = page.getByRole('alertdialog')
  await dialogo.getByLabel('Motivo de baja').selectOption('reemplazo')
  await dialogo.getByLabel('Descripción (opcional)').fill('Reemplazo verificado en QA demo')
  await dialogo.getByLabel('Código del equipo de reemplazo (opcional)').fill('FARM-03-QA')
  await dialogo.getByRole('button', { name: 'Confirmar' }).click()
  await expect(dialogo.getByRole('status')).toContainText('Dispositivo dado de baja correctamente.')
  await expect(dialogo).toBeHidden()
  await page.getByRole('link', { name: 'Equipos' }).first().click()
  const lista = page.getByRole('list', { name: 'Equipos de medición' })
  await expect(lista.getByRole('listitem').filter({ hasText: 'FARM-02-CDL' })).toContainText('Dado de baja')
})

test('farmacéutico revisa alerta y genera reporte', async ({ page }) => {
  await entrarComo(page, 'Químico Farmacéutico')
  await irA(page, '/alertas')
  await page.getByRole('button', { name: 'Todas' }).click()

  // Las acciones de cada alerta viven en su menú «Opciones» (ActionMenu).
  await accionPrimeraFila(page, 'Acción correctiva')
  const dialogoAccion = page.getByRole('dialog')
  await dialogoAccion.getByLabel('Decisión adoptada').fill('Inmovilizar el lote')
  await dialogoAccion.getByLabel('Justificación').fill('Lectura fuera de rango')
  await dialogoAccion.getByLabel('Descripción de la acción correctiva')
    .fill('Se verificó cierre de puerta en QA demo.')
  await dialogoAccion.getByRole('button', { name: 'Guardar acción' }).click()
  await expect(dialogoAccion.getByRole('status')).toContainText('Acción correctiva registrada.')

  await irA(page, '/reportes')
  await page.getByRole('button', { name: 'Generar reporte' }).click()
  await expect(page.getByText('Resumen del periodo')).toBeVisible()
})
