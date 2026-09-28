#!/usr/bin/env node
/**
 * Genera `vercel.json` con la directiva `connect-src` correcta para el
 * despliegue en curso.
 *
 * Por qué existe este script. `vercel.json` es un fichero estático: no admite
 * variables de entorno ni interpolación. La CSP del despliegue actual declara
 * `connect-src 'self' https://accounts.google.com`, lo que basta para la demo
 * —que resuelve todo en memoria con `MODO_DEMO` y no toca la red— pero bloquea
 * en el navegador **toda** llamada a la API y la conexión `EventSource` del SSE
 * en cuanto el frontend apunte al backend de Railway, que está en otro origen.
 * El síntoma sería un dashboard permanentemente vacío y errores de CSP en
 * consola, no un fallo de red evidente.
 *
 * Uso, con el hostname real del backend:
 *
 *   node scripts/generar-vercel-json.mjs https://mi-backend.up.railway.app
 *
 * Sin argumento regenera el fichero para modo demo (solo `'self'`), que es el
 * estado por defecto del repositorio.
 *
 * El origen se añade a `connect-src` en dos formas, `https://…` y `wss://…`:
 * `EventSource` usa HTTP, pero si en algún momento se pasa a WebSocket la
 * directiva ya lo contempla y no vuelve a ser una sorpresa el día del
 * despliegue.
 */
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function origenesDe(url) {
  if (!url) return []
  let analizada
  try {
    analizada = new URL(url)
  } catch {
    throw new Error(`«${url}» no es una URL válida. Ejemplo: https://api.up.railway.app`)
  }
  if (analizada.protocol !== 'https:') {
    throw new Error('El backend debe servirse por HTTPS (RNF-05 y Strict-Transport-Security).')
  }
  return [analizada.origin, `wss://${analizada.host}`]
}

const backend = process.argv[2]
const connectSrc = ["'self'", 'https://accounts.google.com', ...origenesDe(backend)].join(' ')

const csp = [
  "default-src 'self'",
  "script-src 'self' https://accounts.google.com https://apis.google.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://accounts.google.com",
  'font-src https://fonts.gstatic.com',
  "img-src 'self' data: https://lh3.googleusercontent.com",
  `connect-src ${connectSrc}`,
  'frame-src https://accounts.google.com',
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ')

const configuracion = {
  $schema: 'https://openapi.vercel.sh/vercel.json',
  buildCommand: backend ? 'npm run build' : 'npm run build:demo',
  rewrites: [{ source: '/((?!api/).*)', destination: '/index.html' }],
  headers: [
    {
      source: '/(.*)',
      headers: [
        { key: 'Content-Security-Policy', value: csp },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), geolocation=(), microphone=()' },
        { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
      ],
    },
  ],
}

const destino = path.join(raiz, 'vercel.json')
writeFileSync(destino, JSON.stringify(configuracion, null, 2) + '\n')

console.log(`vercel.json regenerado en modo ${backend ? 'producción' : 'demo'}.`)
console.log(`connect-src: ${connectSrc}`)
if (!backend) {
  console.log(
    '\nAviso: en modo demo `connect-src` es solo \'self\'. Antes de desplegar contra\n' +
      'el backend real hay que volver a ejecutar este script con su URL, o la API y\n' +
      'el SSE quedarán bloqueados por la CSP en el navegador.',
  )
}
