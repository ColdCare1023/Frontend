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

  it('vercel.json versionado coincide con la política generada para la demo', () => {
    const vercel = JSON.parse(readFileSync(path.resolve(__dirname, '../../../vercel.json'), 'utf-8'))
    const cabeceras = Object.fromEntries(
      vercel.headers[0].headers.map((h: { key: string; value: string }) => [h.key, h.value]),
    )
    expect(cabeceras['Content-Security-Policy']).toBe(politicaCsp())
    expect(cabeceras['Content-Security-Policy-Report-Only']).toBe(politicaCspReportOnly())
  })
})
