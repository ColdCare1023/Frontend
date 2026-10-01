import { chromium } from '@playwright/test'
import path from 'path'
import fs from 'fs'

const viewports = [
  { name: '1920x1080', width: 1920, height: 1080 },
  { name: '1600x900', width: 1600, height: 900 },
  { name: '1440x900', width: 1440, height: 900 },
  { name: '1366x768', width: 1366, height: 768 },
  { name: '1280x800', width: 1280, height: 800 },
  { name: '1024x768', width: 1024, height: 768 },
  { name: '768x1024', width: 768, height: 1024 },
  { name: '430x932', width: 430, height: 932 },
  { name: '390x844', width: 390, height: 844 },
  { name: '360x800', width: 360, height: 800 },
]

const outputDir = '/Users/diegosoto/.gemini/antigravity/brain/d0a04507-0ed2-4081-8cc4-6c82d624ad43/screenshots'
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true })
}

async function run() {
  const browser = await chromium.launch()

  for (const vp of viewports) {
    const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } })
    await page.goto('http://localhost:4173/login', { waitUntil: 'networkidle' })
    await page.waitForTimeout(600) // allow motion entrance animation to settle

    const screenshotPath = path.join(outputDir, `login-${vp.name}.png`)
    await page.screenshot({ path: screenshotPath, fullPage: false })
    console.log(`Saved screenshot: ${screenshotPath}`)
    await page.close()
  }

  // Also capture auxiliary pages at 1280x800
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
  await page.goto('http://localhost:4173/recuperar-contrasena', { waitUntil: 'networkidle' })
  await page.waitForTimeout(600)
  await page.screenshot({ path: path.join(outputDir, 'recuperar-1280x800.png') })
  console.log('Saved recuperar-1280x800.png')

  await page.goto('http://localhost:4173/solicitar-acceso', { waitUntil: 'networkidle' })
  await page.waitForTimeout(600)
  await page.screenshot({ path: path.join(outputDir, 'solicitar-1280x800.png') })
  console.log('Saved solicitar-1280x800.png')

  await browser.close()
  console.log('All QA screenshots captured successfully!')
}

run().catch(err => {
  console.error(err)
  process.exit(1)
})
