// Controlled browser fixtures only. No backend is contacted or changed.
import { chromium } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import fs from 'node:fs/promises'
const output = `artifacts/redesign/${process.argv[2] || 'states'}`
await fs.mkdir(output, { recursive: true })
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const results = []
try {
  for (const width of [1440, 390]) {
    for (const state of ['loading', 'empty', 'error']) {
      const context = await browser.newContext({ viewport: { width, height: 900 } })
      const page = await context.newPage()
      await page.route(url => url.pathname.startsWith('/api/'), async route => {
        const url = route.request().url()
        if (state === 'loading') await new Promise(resolve => setTimeout(resolve, 2400))
        if (url.includes('/auth/sse-ticket')) return route.fulfill({ status: 503, json: { detail: 'QA: stream unavailable' } })
        if (state === 'error') return route.fulfill({ status: 500, json: { detail: 'Controlled visual QA error' } })
        if (url.includes('/ia/modelo')) return route.fulfill({ status: 503, json: { detail: 'QA: model unavailable' } })
        await route.fulfill({ json: url.includes('/trazabilidad/estado') ? { cadena_comprometida: false } : [] })
      })
      await page.goto('http://127.0.0.1:5174/login')
      await page.evaluate(async () => {
        const { useAuthStore } = await import('/src/application/stores/authStore.ts')
        const payload = btoa(JSON.stringify({ sub: 'visual-qa', email: 'qa@example.invalid', rol: 'administrador', exp: Math.floor(Date.now() / 1000) + 1800 }))
        useAuthStore.getState().loginConToken(`qa.${payload}.fixture`)
        localStorage.setItem('cf_onboarding_seen_v1:visual-qa', 'true')
      })
      // Existing walkthrough is dismissed through its own control.
      await page.evaluate(() => { history.pushState({}, '', '/dashboard'); dispatchEvent(new PopStateEvent('popstate')) })
      const skip = page.getByRole('button', { name: 'Omitir', exact: true })
      if (await skip.isVisible()) await skip.click()
      const routes = state === 'error' ? ['/dashboard', '/alertas', '/historial', '/metricas-ia'] : ['/dashboard', '/alertas', '/historial', '/usuarios', '/dispositivos', '/trazabilidad', '/auditoria', '/metricas-ia']
      for (const route of routes) {
        // Remount route to exercise initial data state.
        await page.evaluate(() => { history.pushState({}, '', '/guia'); dispatchEvent(new PopStateEvent('popstate')) })
        await page.waitForTimeout(80)
        await page.evaluate(route => { history.pushState({}, '', route); dispatchEvent(new PopStateEvent('popstate')) }, route)
        await page.locator('main h1').first().waitFor()
        await page.waitForTimeout(state === 'loading' ? 150 : 400)
        const tourSkip = page.getByRole('button', { name: 'Omitir', exact: true })
        if (await tourSkip.isVisible()) await tourSkip.click()
        await page.screenshot({ path: `${output}/${state}-${route.slice(1)}-${width}.png`, fullPage: true })
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
        const violations = state === 'loading' ? [] : (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations.map(x => x.id)
        results.push({ route, width, state, overflow, violations, fixture: true })
      }
      await context.close()
    }
  }
} finally {
  await browser.close()
  await fs.writeFile(`${output}/results.json`, JSON.stringify(results, null, 2))
}
console.log(JSON.stringify({ captures: results.length, failures: results.filter(x => x.overflow || x.violations.length) }))
