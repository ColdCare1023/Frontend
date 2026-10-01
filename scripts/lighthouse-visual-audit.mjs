import fs from 'node:fs/promises'
import path from 'node:path'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
const qaRequire = createRequire('/tmp/coldcare-visual-qa-tools/package.json')
const { default: puppeteer } = await import(pathToFileURL(qaRequire.resolve('puppeteer-core')).href)
const { startFlow, desktopConfig } = await import(pathToFileURL(qaRequire.resolve('lighthouse')).href)

const mobile = process.argv[2] === 'mobile'
const output = path.resolve(`artifacts/visual-audit/lighthouse${mobile ? '-mobile' : ''}`)
await fs.mkdir(output, { recursive: true })
const browser = await puppeteer.launch({ executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless:true })
const page = await browser.newPage()
await page.setViewport(mobile ? {width:390,height:844} : { width:1440,height:900 })
const flow = await startFlow(page, { name:`ColdCare: producción local demo ${mobile ? 'mobile' : 'desktop'}`, ...(mobile ? {} : {config:desktopConfig, flags:{screenEmulation:{disabled:true},throttlingMethod:'provided'}}) })
try {
  await flow.navigate('http://127.0.0.1:4173/login', { name:'Login: navegación' })
  await page.waitForSelector('button[aria-label^="Administrador"]')
  await flow.startTimespan({ name:'Ingreso y carga de dashboard' })
  await page.click('button[aria-label^="Administrador"]')
  await page.waitForSelector('[role="dialog"]')
  await page.evaluate(() => [...document.querySelectorAll('[role="dialog"] button')].find(x=>x.textContent==='Omitir')?.click())
  await page.waitForSelector('canvas')
  await new Promise(resolve=>setTimeout(resolve,1000))
  await flow.endTimespan()
  await flow.snapshot({name:'Dashboard: snapshot autenticado'})
  for (const route of ['/historial','/usuarios']) {
    await flow.startTimespan({name:`${route}: transición SPA`})
    await page.evaluate(route => { history.pushState({},'',route); dispatchEvent(new PopStateEvent('popstate')) }, route)
    await page.waitForFunction(route=>location.pathname===route && !!document.querySelector('table'), {}, route)
    await new Promise(resolve=>setTimeout(resolve,700))
    await flow.endTimespan()
    await flow.snapshot({name:`${route}: snapshot autenticado`})
  }
  await fs.writeFile(path.join(output,'report.html'), await flow.generateReport())
  const result = await flow.createFlowResult()
  await fs.writeFile(path.join(output,'results.json'), JSON.stringify(result,null,2))
  console.log(JSON.stringify(result.steps.map(({name,lhr})=>({name,mode:lhr.gatherMode,categories:Object.fromEntries(Object.entries(lhr.categories).map(([k,v])=>[k,v.score])),metrics:Object.fromEntries(['largest-contentful-paint','cumulative-layout-shift','total-blocking-time','interaction-to-next-paint'].map(k=>[k,lhr.audits[k]?.numericValue])),failed:Object.entries(lhr.audits).filter(([,v])=>v.score===0 && v.scoreDisplayMode==='binary').map(([k])=>k)})),null,2))
} finally { await browser.close() }
