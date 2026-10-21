#!/usr/bin/env node
/**
 * FE-002 / FE-009: el build contra el backend no debe contener el modo demo:
 * ni el adaptador que simula la API, ni las cuentas y la contraseña demo, ni
 * el generador de JWT sin firma. Se ejecuta en CI tras `npm run build`.
 *
 * Uso: node scripts/verificar-bundle-produccion.mjs [carpeta dist]
 */
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

const carpeta = path.resolve(process.argv[2] ?? 'dist')
const PROHIBIDOS = [
  ['cuentas demo', /@demo\.pe/],
  ['contraseña demo', /demo-2026/],
  ['JWT sin firma', /alg["']?\s*:\s*["']none["']/],
  ['adaptador demo', /demoAdapter/],
]

function archivos(directorio) {
  return readdirSync(directorio, { withFileTypes: true }).flatMap((entrada) => {
    const ruta = path.join(directorio, entrada.name)
    return entrada.isDirectory() ? archivos(ruta) : [ruta]
  })
}

const hallazgos = []
for (const archivo of archivos(carpeta).filter((ruta) => /\.(js|html|css)$/.test(ruta))) {
  const contenido = readFileSync(archivo, 'utf-8')
  for (const [nombre, patron] of PROHIBIDOS) {
    if (patron.test(contenido)) hallazgos.push(`${path.relative(carpeta, archivo)}: ${nombre}`)
  }
}

if (hallazgos.length > 0) {
  console.error('El build de producción contiene código o datos del modo demo:\n  ' + hallazgos.join('\n  '))
  process.exit(1)
}
console.log(`Build de producción sin modo demo (${carpeta}).`)
