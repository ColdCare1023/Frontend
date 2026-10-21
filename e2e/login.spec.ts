import { expect, test } from '@playwright/test'

test('login móvil mantiene formulario legible y controles operables', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/login')
  await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)

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
  await page.getByRole('dialog').getByRole('button', { name: 'Omitir' }).click()

  const almacenamiento = await page.evaluate(() => ({
    local: Object.values(localStorage).join('\n'),
    session: Object.values(sessionStorage).join('\n'),
  }))
  expect(almacenamiento.local).not.toContain('eyJ')
  expect(almacenamiento.session).not.toContain('eyJ')
  expect(await page.evaluate(() => sessionStorage.getItem('cf_demo_token'))).toBeNull()

  await page.reload()
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible()
})

test('login real de demo usa credenciales conocidas y limita intentos sin revelar cuenta', async ({ page }) => {
  await page.goto('/login')
  await page.locator('#login-email').fill('farmaceutico@demo.pe')
  await page.locator('#login-password').fill('demo-2026')
  await page.getByRole('button', { name: 'Ingresar' }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
  await page.getByRole('dialog').getByRole('button', { name: 'Omitir' }).click()
  await page.getByRole('button', { name: 'Cerrar sesión' }).click()

  const email = `no-existe-${Date.now()}@demo.pe`
  for (let intento = 1; intento <= 5; intento++) {
    await page.locator('#login-email').fill(email)
    await page.locator('#login-password').fill('incorrecta')
    await page.getByRole('button', { name: 'Ingresar' }).click()
    const alerta = page.getByRole('alert')
    await expect(alerta).toContainText(intento === 5 ? 'Demasiados intentos' : 'Correo o contraseña incorrectos')
  }
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
