#!/usr/bin/env node
/**
 * Genera `vercel.json` con la directiva `connect-src` correcta para el
 * despliegue en curso.
 *
 * Por qué existe este script. `vercel.json` es un fichero estático: no admite
 * variables de entorno ni interpolación. La CSP de la demo declara
 * `connect-src 'self'`, lo que basta para la demo —que resuelve todo en
 * memoria con `MODO_DEMO` y no toca la red— pero bloquea
 * en el navegador **toda** llamada a la API y la conexión `EventSource` del SSE
 * en cuanto el frontend apunte al backend de Railway, que está en otro origen.
 * El síntoma sería un dashboard permanentemente vacío y errores de CSP en
 * consola, no un fallo de red evidente.
 *
 * Uso, con el hostname real del backend:
 *
 *   node scripts/generar-vercel-json.mjs https://mi-backend.up.railway.app
 *   node scripts/generar-vercel-json.mjs https://mi-backend.up.railway.app --google
 *
 * `--google` solo si el build define VITE_GOOGLE_CLIENT_ID (acceso con Google).
 * La política en sí está en scripts/csp.mjs (FE-007).
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

import { politicaCsp, politicaCspReportOnly } from './csp.mjs'

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

// Uso: node scripts/generar-vercel-json.mjs [URL del backend] [--google]
// `--google`: el build define VITE_GOOGLE_CLIENT_ID (FE-001) y la CSP debe
// permitir Google Identity Services; sin él no se autoriza ningún origen de
// Google (FE-007).
const argumentos = process.argv.slice(2)
const google = argumentos.includes('--google')
const backend = argumentos.find((argumento) => !argumento.startsWith('--'))
const csp = politicaCsp({ backend, google })
const cspObservacion = politicaCspReportOnly({ backend, google })
const connectSrc = csp.split('; ').find((directiva) => directiva.startsWith('connect-src')).slice('connect-src '.length)

const configuracion = {
  $schema: 'https://openapi.vercel.sh/vercel.json',
  // FE-002: `npm run build` compila contra el backend real (--mode backend);
  // la demo es siempre una elección explícita.
  buildCommand: backend ? 'npm run build' : 'npm run build:demo',
  rewrites: [{ source: '/((?!api/).*)', destination: '/index.html' }],
  headers: [
    {
      source: '/(.*)',
      headers: [
        { key: 'Content-Security-Policy', value: csp },
        // FE-007: mide (sin bloquear) la retirada de 'unsafe-inline' en
        // estilos y Trusted Types antes de aplicarlos.
        { key: 'Content-Security-Policy-Report-Only', value: cspObservacion },
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
