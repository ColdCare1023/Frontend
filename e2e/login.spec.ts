import { expect, test } from '@playwright/test'

import { cerrarSesion } from './helpers'

test('login móvil mantiene formulario legible y controles operables', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/login')
  await expect(page.getByRole('heading', { level: 1, name: 'Iniciar sesión' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)

  const marca = page.getByRole('button', { name: 'Acerca de ColdCare' })
  await marca.click()
  const acerca = page.getByRole('dialog', { name: 'Acerca de ColdCare' })
  await expect(acerca).toContainText('Vigila tus equipos, recibe alertas a tiempo')
  await expect(acerca).toContainText('Rango térmico de referencia · 2–8 °C')
  await page.keyboard.press('Escape')
  await expect(acerca).toHaveCount(0)
  await expect(marca).toBeFocused()

  const password = page.locator('#login-password')
  await password.fill('demo-2026')
  await page.getByRole('button', { name: 'Mostrar contraseña' }).click()
  await expect(password).toHaveAttribute('type', 'text')
  await page.getByRole('button', { name: 'Ocultar contraseña' }).click()
  await expect(password).toHaveAttribute('type', 'password')
})

test('sesión demo vive solo en memoria y recarga exige volver a ingresar', async ({ page }) => {
  await page.goto('/login')
  await page.getByRole('button', { name: /Auditor/i }).click()
  await expect(page).toHaveURL(/\/dashboard$/)

  const almacenamiento = await page.evaluate(() => ({
    local: Object.values(localStorage).join('\n'),
    session: Object.values(sessionStorage).join('\n'),
  }))
  expect(almacenamiento.local).not.toContain('eyJ')
  expect(almacenamiento.session).not.toContain('eyJ')
  expect(await page.evaluate(() => sessionStorage.getItem('cf_demo_token'))).toBeNull()

  await page.reload()
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Iniciar sesión' })).toBeVisible()
})

test('login real de demo pide el código por correo y limita intentos sin revelar cuenta', async ({ page }) => {
  await page.goto('/login')
  await page.locator('#login-email').fill('farmaceutico@demo.pe')
  await page.locator('#login-password').fill('demo-2026')
  await page.getByRole('button', { name: 'Ingresar' }).click()

  // Segundo paso: correo enmascarado, código de demostración visible y casillas OTP.
  await expect(page.getByRole('heading', { name: 'Revisa tu correo' })).toBeVisible()
  await expect(page.getByText('f***@demo.pe')).toBeVisible()
  await expect(page.getByText('Código de demostración:')).toBeVisible()
  await expect(page.getByLabel('Dígito 1 de 6')).toBeFocused()

  await page.keyboard.type('000000')
  await expect(page.getByRole('alert')).toContainText('El código no es correcto')
  await expect(page.getByLabel('Dígito 1 de 6')).toHaveValue('')

  await page.keyboard.type('123456')
  await expect(page).toHaveURL(/\/dashboard$/)
  await cerrarSesion(page)

  const email = `no-existe-${Date.now()}@demo.pe`
  for (let intento = 1; intento <= 5; intento++) {
    await page.locator('#login-email').fill(email)
    await page.locator('#login-password').fill('incorrecta')
    await page.getByRole('button', { name: 'Ingresar' }).click()
    const alerta = page.getByRole('alert')
    await expect(alerta).toContainText(intento === 5 ? 'Demasiados intentos' : 'Correo o contraseña incorrectos')
  }
})

test('el código demo se aplica con un clic y «Usar otra cuenta» vuelve al formulario', async ({ page }) => {
  await page.goto('/login')
  await page.locator('#login-email').fill('auditor@demo.pe')
  await page.locator('#login-password').fill('demo-2026')
  await page.getByRole('button', { name: 'Ingresar' }).click()
  await expect(page.getByRole('heading', { name: 'Revisa tu correo' })).toBeVisible()

  await page.getByRole('button', { name: 'Usar otra cuenta' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Iniciar sesión' })).toBeVisible()
  await expect(page.locator('#login-email')).toHaveValue('auditor@demo.pe')
  // «Usar otra cuenta» enfoca el correo (seleccionado: escribir lo reemplaza).
  await expect(page.locator('#login-email')).toBeFocused()

  await page.locator('#login-password').fill('demo-2026')
  await page.getByRole('button', { name: 'Ingresar' }).click()
  await page.getByRole('button', { name: 'Usar código' }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
})

test('recuperación y activación por código en la demo', async ({ page }) => {
  await page.goto('/login')
  await page.getByRole('link', { name: '¿Olvidaste tu contraseña?' }).click()
  await expect(page.getByRole('heading', { name: 'Recuperar contraseña' })).toBeVisible()
  await page.getByLabel('Correo electrónico').fill('tecnico@demo.pe')
  await page.getByRole('button', { name: 'Enviar código' }).click()

  await expect(page.getByRole('heading', { name: 'Crea tu nueva contraseña' })).toBeVisible()
  await page.getByLabel('Dígito 1 de 6').click()
  await page.keyboard.type('123456')
  await page.getByLabel('Nueva contraseña').fill('NuevaClave2026')
  await page.getByLabel('Confirmar contraseña').fill('NuevaClave2026')
  await page.getByRole('button', { name: 'Guardar contraseña' }).click()
  await expect(page.getByRole('heading', { name: 'Contraseña actualizada' })).toBeVisible()

  // Activación: el enlace del correo de bienvenida abre directamente el paso del código.
  await page.goto('/recuperar-contrasena?email=auditor%40demo.pe&modo=activar')
  await expect(page.getByRole('heading', { name: 'Activa tu cuenta' })).toBeVisible()
  await page.getByLabel('Dígito 1 de 6').click()
  await page.keyboard.type('123456')
  await page.getByLabel('Nueva contraseña').fill('ClaveActiva2026')
  await page.getByLabel('Confirmar contraseña').fill('ClaveActiva2026')
  await page.getByRole('button', { name: 'Activar cuenta' }).click()
  await expect(page.getByRole('heading', { name: 'Cuenta activada' })).toBeVisible()
  await page.getByRole('link', { name: 'Ir a iniciar sesión' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Iniciar sesión' })).toBeVisible()
})

// FE-001: ya no existen botones sociales simulados. Sin VITE_GOOGLE_CLIENT_ID
// no se ofrece Google, y Facebook se retiró (el backend no lo respalda).
test('el login no ofrece acceso social simulado', async ({ page }) => {
  await page.goto('/login')
  await page.locator('#login-email').fill('admin@demo.pe')
  await expect(page.getByRole('button', { name: /Google/i })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Facebook/i })).toHaveCount(0)
  await expect(page).toHaveURL(/\/login$/)
})
