import { chromium } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import fs from 'node:fs/promises'
const out='artifacts/visual-audit/dialogs'
await fs.mkdir(out,{recursive:true})
const browser=await chromium.launch({channel:'chrome',headless:true})
const context=await browser.newContext()
const page=await context.newPage()
await page.goto('http://127.0.0.1:5173/login')
await page.getByRole('button',{name:/^Administrador/}).click()
await page.getByRole('dialog').getByRole('button',{name:'Omitir'}).click()
const cases=[
 ['/usuarios','Nuevo usuario'],
 ['/usuarios','Cambiar rol de Brenda Gamio Fernández'],
 ['/usuarios','Desactivar a Brenda Gamio Fernández'],
 ['/dispositivos','Registrar equipo'],
 ...['Registrar calibración','Editar instalación','Editar responsable','Ver historial de configuración'].map(x=>['/dispositivos',`${x} del dispositivo FARM-01-CDL`]),
 ['/dispositivos','Dar de baja el dispositivo FARM-01-CDL'],
 ['/alertas','Acción correctiva'],
 ['/alertas',/ver cronología de atención/i],
]
const results=[]
try {
for(const [route,name] of cases) for(const width of [1440,390]) {
 await page.setViewportSize({width,height:900})
 await page.evaluate(route=>{history.pushState({},'',route);dispatchEvent(new PopStateEvent('popstate'))},route)
 const trigger=page.getByRole('button',{name,exact:typeof name==='string'}).first()
 await trigger.click()
 const dialog=page.locator('[role="dialog"], [role="alertdialog"]').last()
 await dialog.waitFor()
 await page.waitForTimeout(200)
 const title=await dialog.locator('h2').textContent()
 const box=await dialog.boundingBox()
 const violations=(await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations.map(x=>({id:x.id,nodes:x.nodes.map(n=>n.target)}))
 const focusedInside=await dialog.evaluate(x=>x.contains(document.activeElement))
 await page.screenshot({path:`${out}/${results.length}-${width}.png`,fullPage:true})
 await page.keyboard.press('Escape')
 await dialog.waitFor({state:'hidden'})
 results.push({route,title,width,box,withinViewport:box.x>=0&&box.y>=0&&box.x+box.width<=width&&box.y+box.height<=900,focusedInside,violations})
}
await fs.writeFile(`${out}/results.json`,JSON.stringify(results,null,2))
console.log(JSON.stringify({dialogs:results.length,failures:results.filter(x=>!x.withinViewport||!x.focusedInside||x.violations.length)},null,2))
} finally {await browser.close()}
