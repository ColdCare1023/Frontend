import { chromium } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import fs from 'node:fs/promises'
import path from 'node:path'

const phase = process.argv[2] || 'baseline'
const output = path.resolve('artifacts/redesign', phase)
await fs.mkdir(output, { recursive: true })
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await context.newPage()
const cdp = await context.newCDPSession(page)
await cdp.send('DOM.enable')
await cdp.send('CSS.enable')
const errors = []
page.on('pageerror', error => errors.push(error.message))
page.on('console', message => { if (message.type() === 'error' || message.type() === 'warning') errors.push(message.text()) })
page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`) })
const results = []
const primaryViewports = [[1440,900],[1710,1037],[768,1024],[390,844]]
const extendedViewports = [[360,800],[430,932],[768,1024],[1024,768],[1366,768],[1920,1080],[2560,1440],[1180,800],[900,900],[820,900],[700,900],[600,900],[520,900],[480,900]]
const routes = ['/dashboard','/alertas','/historial','/trazabilidad','/reportes','/dispositivos','/usuarios','/metricas-ia','/auditoria','/guia']
async function navigate(route) {
  await page.evaluate(route => { history.pushState({}, '', route); dispatchEvent(new PopStateEvent('popstate')) }, route)
  await page.locator('main h1, main h2').first().waitFor()
  await page.waitForTimeout(650)
}
async function inspect(route, viewports) {
  for (const [width,height] of viewports) {
    await page.setViewportSize({ width, height })
    await page.waitForTimeout(200)
    const name = `${route.slice(1)}-${width}x${height}`
    await page.screenshot({ path: path.join(output, `${name}.png`), fullPage: true })
    const dimensions = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth, stackOverlaps: [...document.querySelectorAll('.coldcare-data-stack tbody > tr')].flatMap(row => { const bounds=row.getBoundingClientRect(); return [...row.children].filter(cell=>cell.getBoundingClientRect().bottom > bounds.bottom+1).map(cell=>cell.getAttribute('data-label')||cell.textContent.slice(0,40)) }), headings: [...document.querySelectorAll('h1,h2,h3')].map(x => ({ text:x.textContent, size:getComputedStyle(x).fontSize })) }))
    const violations = primaryViewports.some(v => v[0] === width) ? (await new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze()).violations.map(v => ({ id:v.id, impact:v.impact, nodes:v.nodes.map(n => ({target:n.target,summary:n.failureSummary})) })) : []
    const documentNode = await cdp.send('DOM.getDocument')
    const match = await cdp.send('DOM.querySelector', {nodeId:documentNode.root.nodeId,selector:'main'})
    const computed = match.nodeId ? (await cdp.send('CSS.getComputedStyleForNode',{nodeId:match.nodeId})).computedStyle.filter(x=>['width','height','min-width','max-width','padding-top','padding-right','padding-bottom','padding-left','display','overflow-x','font-family','font-size','line-height'].includes(x.name)) : []
    results.push({ route,width,height,...dimensions,violations,devtoolsComputed:computed })
  }
}
try {
  await page.goto('http://127.0.0.1:5173/login', { waitUntil: 'networkidle' })
  for (const route of ['/login','/registro','/solicitar-acceso','/recuperar-contrasena','/restablecer-contrasena']) {
    await navigate(route)
    await inspect(route, phase.endsWith('final') ? [...primaryViewports,...extendedViewports.filter(v=>!primaryViewports.some(p=>p[0]===v[0]))] : primaryViewports)
  }
  await navigate('/login')
  await page.getByRole('button', { name: /^Administrador/ }).click()
  await page.waitForURL('**/dashboard')
  const omit = page.getByRole('button', { name:'Omitir', exact:true })
  await omit.waitFor({ timeout: 10000 })
  await omit.click()
  for (const route of routes) {
    await navigate(route)
    await inspect(route, phase.endsWith('final') ? [...primaryViewports,...extendedViewports.filter(v=>!primaryViewports.some(p=>p[0]===v[0]))] : primaryViewports)
    console.log(`${phase}: ${route}`)
  }
} finally {
  await fs.writeFile(path.join(output, 'results.json'), JSON.stringify({ results,errors }, null, 2))
  await browser.close()
}
console.log(JSON.stringify({captures:results.length,overflow:results.filter(x=>x.document>x.viewport).map(x=>`${x.route} ${x.width}`),stackOverlaps:results.filter(x=>x.stackOverlaps.length).map(x=>({route:x.route,width:x.width,fields:x.stackOverlaps})),axe:results.filter(x=>x.violations.length).map(x=>({route:x.route,width:x.width,violations:x.violations.map(v=>v.id)})),errors}))
