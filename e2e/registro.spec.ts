import { expect, test } from '@playwright/test'

for (const width of [1440, 390]) {
  test(`registro completo valida campos sin crear cuenta remota, ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    const accountRequests: string[] = []
    page.on('request', request => { if (request.method() === 'POST' && /registro|register|signup/.test(request.url())) accountRequests.push(request.url()) })
    await page.goto('/login')
    await page.getByRole('link', { name: 'Crear cuenta', exact: true }).click()
    await expect(page).toHaveURL(/\/registro$/)
    for (const [name, value] of Object.entries({ nombre:'Andrea', apellidos:'Prueba QA', email:'andrea.qa@example.test', telefono:'999111222', establecimiento:'Farmacia QA', direccion:'Dirección de prueba 123', password:'Prueba-segura-2026', confirmacion:'No-coincide-2026' })) {
      await page.locator(`[name="${name}"]`).fill(value)
    }
    await page.locator('[name="rol"]').selectOption('farmaceutico')
    await page.getByRole('button', { name:'Crear cuenta (demo)', exact:true }).click()
    await expect(page.getByRole('alert')).toContainText('Las contraseñas no coinciden')
    await page.locator('[name="confirmacion"]').fill('Prueba-segura-2026')
    await page.getByRole('button', { name:'Crear cuenta (demo)', exact:true }).click()
    await expect(page.getByRole('status')).toContainText('No se creó una cuenta ni se enviaron datos')
    await expect(page.locator('[name="password"]')).toHaveValue('')
    await expect(page.locator('[name="confirmacion"]')).toHaveValue('')
    expect(accountRequests).toEqual([])
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy()
  })
}
