import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { politicaCsp, politicaCspReportOnly } from '../../../scripts/csp.mjs'

/**
 * FE-007: la CSP no autoriza orígenes de terceros que la aplicación no usa, y
 * Google Identity Services solo entra si el build lo activa.
 */
function directiva(politica: string, nombre: string): string {
  return politica.split('; ').find((d) => d.startsWith(`${nombre} `)) ?? ''
}

describe('Content-Security-Policy', () => {
  it('sin Google no autoriza ningún origen externo', () => {
    const politica = politicaCsp()
    expect(politica).not.toMatch(/google|gstatic|googleusercontent/)
    expect(directiva(politica, 'script-src')).toBe("script-src 'self'")
    expect(directiva(politica, 'frame-src')).toBe("frame-src 'none'")
    expect(directiva(politica, 'img-src')).toBe("img-src 'self' data:")
  })

  it('con Google autoriza solo las rutas de Google Identity Services', () => {
    const politica = politicaCsp({ google: true })
    expect(directiva(politica, 'script-src')).toBe("script-src 'self' https://accounts.google.com/gsi/client")
    expect(directiva(politica, 'frame-src')).toBe('frame-src https://accounts.google.com/gsi/')
    expect(politica).not.toContain('apis.google.com')
  })

  it('añade el backend HTTPS a connect-src y rechaza HTTP', () => {
    expect(directiva(politicaCsp({ backend: 'https://api.example.app' }), 'connect-src')).toBe(
      "connect-src 'self' https://api.example.app wss://api.example.app",
    )
    expect(() => politicaCsp({ backend: 'http://api.example.app' })).toThrow()
  })

  it('la política de observación mide la retirada de estilos en línea y Trusted Types', () => {
    const observacion = politicaCspReportOnly()
    expect(directiva(observacion, 'style-src')).toBe("style-src 'self'")
    expect(observacion).toContain("require-trusted-types-for 'script'")
  })

  it('vercel.json versionado coincide con la política generada para producción (backend real)', () => {
    // Producción (coldcare.vercel.app) compila contra el backend de Railway:
    // `node scripts/generar-vercel-json.mjs https://backend-production-2e5efc7d.up.railway.app`.
    const backend = 'https://backend-production-2e5efc7d.up.railway.app'
    const vercel = JSON.parse(readFileSync(path.resolve(__dirname, '../../../vercel.json'), 'utf-8'))
    const cabeceras = Object.fromEntries(
      vercel.headers[0].headers.map((h: { key: string; value: string }) => [h.key, h.value]),
    )
    expect(vercel.buildCommand).toBe('npm run build && npm run verificar:bundle')
    expect(cabeceras['Content-Security-Policy']).toBe(politicaCsp({ backend }))
    expect(cabeceras['Content-Security-Policy-Report-Only']).toBe(politicaCspReportOnly({ backend }))
  })

  it('vercel.json cachea como inmutables solo los ficheros con hash de /assets', () => {
    const vercel = JSON.parse(readFileSync(path.resolve(__dirname, '../../../vercel.json'), 'utf-8'))
    const regla = vercel.headers.find((h: { headers: { key: string }[] }) =>
      h.headers.some((c) => c.key === 'Cache-Control'),
    )
    expect(regla.source).toBe('/assets/(.*\\.(?:js|css|woff2))')
    expect(regla.headers).toEqual([{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }])
    // Equivalente RegExp del patrón path-to-regexp: las imágenes de
    // public/assets no llevan hash y no deben quedar congeladas en caché.
    const patron = /^\/assets\/(.*\.(?:js|css|woff2))$/
    expect(patron.test('/assets/index-B0GlBf0l.js')).toBe(true)
    expect(patron.test('/assets/inter-latin-wght-normal-Dx4kXJAl.woff2')).toBe(true)
    expect(patron.test('/assets/coldcare-auth-editorial.webp')).toBe(false)
    expect(patron.test('/assets/cold-chain-hero.jpg')).toBe(false)
  })
})
