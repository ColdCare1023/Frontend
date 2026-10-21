import { afterEach, describe, expect, it, vi } from 'vitest'

import { registrarErrorDeInterfaz } from '@/infrastructure/registroErrores'

/** FE-011: la consola de producción no recibe mensajes ni trazas con datos. */
describe('registrarErrorDeInterfaz', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('en producción registra solo el tipo de error', () => {
    vi.stubEnv('DEV', false)
    const consola = vi.spyOn(console, 'error').mockImplementation(() => {})
    const error = new TypeError('lectura de FARM-01 para farma@upc.pe: 11.2 °C')

    registrarErrorDeInterfaz(error, { componentStack: '\n    at DashboardPage' })

    expect(consola).toHaveBeenCalledTimes(1)
    const registrado = consola.mock.calls[0].join(' ')
    expect(registrado).toContain('TypeError')
    expect(registrado).not.toContain('farma@upc.pe')
    expect(registrado).not.toContain('DashboardPage')
  })

  it('en desarrollo conserva el detalle para depurar', () => {
    vi.stubEnv('DEV', true)
    const consola = vi.spyOn(console, 'error').mockImplementation(() => {})
    const error = new Error('detalle')

    registrarErrorDeInterfaz(error, { componentStack: 'pila' })

    expect(consola).toHaveBeenCalledWith('[ErrorBoundary]', error, 'pila')
  })
})
