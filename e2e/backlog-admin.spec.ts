import { expect, test, type Page } from '@playwright/test'
import { irA } from './helpers'

async function entrarComo(page: Page, perfil: string) {
  await page.goto('/login')
  await page.getByRole('button', { name: perfil }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
}

/** `yyyy-MM-dd` del calendario local, desplazado `dias` desde hoy. */
function diaLocal(dias: number): string {
  const fecha = new Date()
  fecha.setDate(fecha.getDate() + dias)
  return [fecha.getFullYear(), String(fecha.getMonth() + 1).padStart(2, '0'), String(fecha.getDate()).padStart(2, '0')].join('-')
}

test('HU-30: el Químico Farmacéutico registra la calibración y ve la vencida en Historial y en la curva', async ({ page }) => {
  await entrarComo(page, 'Químico Farmacéutico')

  // Ficha del equipo en Monitoreo: el QF no entra a Dispositivos (solo admin).
  await page.getByRole('button', { name: 'Detalles', exact: true }).click()
  const panel = page.getByRole('dialog')
  await panel.getByRole('button', { name: 'Registrar calibración' }).click()
  await panel.getByLabel('Fecha de calibración').fill(diaLocal(-400))
  await panel.getByLabel('N.° de certificado').fill(`QF-CAL-${Date.now()}`)
  // Certificado ya vencido (hace 3 días) con un margen de aviso propio.
  await panel.getByLabel('Vencimiento del certificado').fill(diaLocal(-3))
  await panel.getByLabel('Avisar antes (días)').fill('20')
  await panel.getByRole('button', { name: 'Guardar' }).click()
  await expect(panel.getByText('Calibración registrada correctamente.')).toBeVisible()
  await expect(panel).toContainText('Aviso 20 días antes del vencimiento')
  await expect(panel).toContainText(/Calibración vencida el/)
  await panel.getByRole('button', { name: 'Cerrar' }).first().click()

  // La curva del equipo en pantalla avisa de la condición documental.
  await expect(page.getByRole('note').filter({ hasText: 'La calibración del sensor venció' })).toBeVisible()

  await irA(page, '/historial?device_id=FARM-01-CDL')
  await expect(page.getByRole('note', { name: 'Calibración vencida' })).toContainText('FARM-01-CDL: la calibración del sensor venció')
  await expect(page.getByRole('img', { name: 'Capturada con la calibración vencida' }).first()).toBeVisible()
})

test('HU-46 / P-12: el administrador ve el rechazo 409, registra, activa y desactiva una versión del modelo', async ({ page }) => {
  await entrarComo(page, 'Administrador')
  await irA(page, '/metricas-ia')
  const seccion = page.getByRole('region', { name: 'Versiones del modelo' })
  await expect(seccion.getByTestId('version-modelo-demo-3.0.0')).toContainText('No activable')
  // HU-20 / HU-46: sin versión activa en el registro, la clasificación preventiva no opera
  // y la activación comprueba el artefacto del modelo preventivo.
  const preventiva = page.getByTestId('estado-preventivo')
  await expect(preventiva).toHaveAttribute('data-situacion', 'fuera')
  await expect(seccion.getByTestId('artefacto-gobernado')).toHaveAttribute('data-modelo', 'preventivo')

  // Las regiones vivas de la sección existen (vacías) antes del resultado: así el lector de pantalla lo anuncia.
  await expect(seccion.getByRole('alert')).toBeEmpty()
  await expect(seccion.getByRole('status')).toBeEmpty()

  // Activar la versión sin H ni particiones: el backend (demo) la rechaza con su motivo.
  await seccion.getByRole('button', { name: 'Activar la versión demo-3.0.0' }).click()
  let dialogo = page.getByRole('alertdialog')
  await expect(dialogo).toContainText('El sistema rechazará la activación')
  await dialogo.getByRole('button', { name: 'Activar versión' }).click()
  await expect(seccion.getByRole('alert')).toContainText('No se activó la versión demo-3.0.0')
  await expect(seccion.getByRole('alert')).toContainText('falta el horizonte H de la etiqueta')

  // Registrar una versión completa…
  await seccion.getByRole('button', { name: 'Registrar versión' }).click()
  const panel = page.getByRole('dialog')
  await panel.getByLabel('Identificador de versión').fill('demo-4.0.0')
  await panel.getByLabel('Entrenado el').fill('2026-11-01T09:30')
  await panel.getByLabel('Huella SHA-256 del artefacto').fill('c'.repeat(64))
  await panel.getByLabel('Esquema de características').fill('4')
  await panel.getByLabel('Conjunto de datos').fill('corridas-demo')
  await panel.getByLabel('scikit-learn').fill('1.9.0')
  await panel.getByLabel('Python').fill('3.12')
  await panel.getByLabel('Horizonte H (minutos, opcional)').fill('30')
  await panel.getByLabel('Métricas (JSON, opcional)').fill(JSON.stringify({
    incidentes_evaluables: 12, sensibilidad_incidente: 0.9, ic95_inferior_sensibilidad: 0.6,
    falsas_alarmas_por_dia_sensor: 1, mediana_anticipacion_min: 8, ap_random_forest: 0.7, ap_mejor_baseline: 0.5,
  }))
  await panel.getByLabel('Particiones (JSON, opcional)').fill(JSON.stringify({ entrenamiento: ['c1'], prueba: ['c2'], separacion_min: 60 }))
  await panel.getByRole('button', { name: 'Registrar versión' }).click()
  await expect(seccion.getByRole('status')).toContainText('Versión demo-4.0.0 registrada. Aún no está activa')
  await expect(seccion.getByTestId('version-modelo-demo-4.0.0')).toContainText('Lista para activar')

  // …y activarla.
  await seccion.getByRole('button', { name: 'Activar la versión demo-4.0.0' }).click()
  dialogo = page.getByRole('alertdialog')
  await dialogo.getByRole('button', { name: 'Activar versión' }).click()
  await expect(seccion.getByRole('status')).toContainText('Versión demo-4.0.0 activada.')
  await expect(seccion.getByTestId('version-modelo-demo-4.0.0')).toContainText('Activa')
  // Activada la versión, el backend (demo) informa la preventiva en operación.
  await expect(preventiva).toHaveAttribute('data-situacion', 'operativa')
  await expect(preventiva).toContainText('Modelo preventivo demo-4.0.0')

  // P-12: desactivarla, con motivo, deja el registro sin versión activa y la preventiva vuelve a la línea base.
  await seccion.getByRole('button', { name: 'Desactivar la versión demo-4.0.0' }).click()
  dialogo = page.getByRole('alertdialog')
  await expect(dialogo).toContainText('No quedará ninguna versión activa')
  await dialogo.getByRole('button', { name: 'Desactivar versión' }).click()
  // El diálogo tiene su propia región de errores (vacía); el error del campo es otra alerta.
  await expect(dialogo.getByRole('alert').filter({ hasText: 'Escribe un motivo' })).toContainText('Escribe un motivo de al menos 10 caracteres.')
  await dialogo.getByLabel('Motivo de la desactivación').fill('Vuelta atrás: falsas alarmas en el banco')
  await dialogo.getByRole('button', { name: 'Desactivar versión' }).click()
  await expect(dialogo).toHaveCount(0)
  await expect(seccion.getByRole('status')).toContainText('Versión demo-4.0.0 desactivada.')
  await expect(seccion.getByRole('heading', { name: 'Versiones del modelo' })).toBeFocused()
  const fila = seccion.getByTestId('version-modelo-demo-4.0.0')
  await expect(fila).toContainText('Lista para activar')
  await expect(fila).toContainText(/Desactivada el/)
  await expect(fila.getByRole('button', { name: 'Activar la versión demo-4.0.0' })).toBeVisible()
  await expect(preventiva).toHaveAttribute('data-situacion', 'fuera')
})

test('HU-46: el auditor consulta las versiones en solo lectura; el QF no las ve', async ({ page }) => {
  await entrarComo(page, 'Auditor Consulta de registros')
  await irA(page, '/metricas-ia')
  const seccion = page.getByRole('region', { name: 'Versiones del modelo' })
  await expect(seccion.getByTestId('version-modelo-demo-3.0.0')).toBeVisible()
  await expect(seccion).toContainText('Solo lectura')
  await expect(seccion.getByRole('button')).toHaveCount(0)

  await entrarComo(page, 'Químico Farmacéutico')
  await irA(page, '/metricas-ia')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Versiones del modelo' })).toHaveCount(0)
  // HU-16: el estado del modelo se distingue; HU-20: la preventiva se informa al QF.
  await expect(page.getByTestId('estado-modelo')).toHaveAttribute('data-estado', 'disponible')
  await expect(page.getByTestId('estado-preventivo')).toContainText('Fuera de operación')
})

test('HU-47 / HU-18: la evidencia es del QF y del auditor; el técnico no recibe el botón', async ({ page }) => {
  await entrarComo(page, 'Técnico de Farmacia')
  await irA(page, '/historial')
  await page.getByRole('button', { name: /Ver detalle de la lectura/ }).first().click()
  await expect(page.getByText('Hora del equipo').first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Ver origen del riesgo' })).toHaveCount(0)

  await entrarComo(page, 'Químico Farmacéutico')
  await irA(page, '/historial')
  await page.getByRole('button', { name: /Ver detalle de la lectura/ }).first().click()
  await page.getByRole('button', { name: 'Ver origen del riesgo' }).click()
  const panel = page.getByRole('dialog')
  // En la demo, y solo en ella, la evidencia se rotula como ejemplo simulado.
  await expect(panel).toContainText('Ejemplo simulado')
  await expect(panel).toContainText('Versión activa y aprobada al clasificar')
})

test('HU-53: sin campos de teléfono para SMS en usuarios ni en el responsable del equipo', async ({ page }) => {
  await entrarComo(page, 'Administrador')
  await irA(page, '/usuarios')
  await page.getByRole('button', { name: 'Nuevo usuario' }).click()
  const dialogo = page.getByRole('dialog')
  await expect(dialogo.getByLabel('Nombre completo')).toBeVisible()
  await expect(dialogo.getByLabel(/Celular/)).toHaveCount(0)
  await dialogo.getByRole('button', { name: 'Cancelar' }).click()

  await irA(page, '/dispositivos/FARM-01-CDL?tab=ubicacion')
  const responsable = page.getByRole('region', { name: 'Responsable de notificaciones' })
  await responsable.getByRole('button', { name: 'Editar responsable de FARM-01-CDL' }).click()
  await expect(responsable.getByLabel('Correo electrónico')).toBeVisible()
  await expect(responsable.getByLabel(/Teléfono/)).toHaveCount(0)
  await expect(responsable).not.toContainText('SMS')
})
