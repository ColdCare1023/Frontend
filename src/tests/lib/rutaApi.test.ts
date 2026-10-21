import { describe, expect, it } from 'vitest'

import { rutaApi } from '@/lib/rutaApi'

/**
 * FE-006: un identificador no puede cambiar el endpoint al que el navegador
 * envía una petición autenticada.
 */
describe('rutaApi', () => {
  it('deja intactos los identificadores conformes', () => {
    expect(rutaApi`/api/dispositivos/${'FARM-01_CDL'}/baja`).toBe('/api/dispositivos/FARM-01_CDL/baja')
    expect(rutaApi`/api/usuarios/${'0f8fad5b-d9cb-469f-a165-70867728950e'}/rol`).toBe(
      '/api/usuarios/0f8fad5b-d9cb-469f-a165-70867728950e/rol',
    )
  })

  it('codifica cada valor como un único segmento', () => {
    expect(rutaApi`/api/dispositivos/${'../usuarios/x?'}/instalacion`).toBe(
      '/api/dispositivos/..%2Fusuarios%2Fx%3F/instalacion',
    )
    expect(rutaApi`/api/alertas/${'a#b'}/revisar`).toBe('/api/alertas/a%23b/revisar')
  })

  it.each(['', '.', '..', '%2e', '%2E%2e', '.%2e'])('rechaza el segmento %j', (valor) => {
    expect(() => rutaApi`/api/dispositivos/${valor}/baja`).toThrow()
  })

  it('el resultado no se normaliza a otra ruta en el navegador', () => {
    const ruta = rutaApi`/api/dispositivos/${'../../usuarios'}/baja`
    expect(new URL(ruta, 'https://api.example').pathname).toBe('/api/dispositivos/..%2F..%2Fusuarios/baja')
  })
})
