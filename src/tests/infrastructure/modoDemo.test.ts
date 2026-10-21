import { afterEach, describe, expect, it, vi } from 'vitest'

/**
 * FE-002: el modo demo es de fallo cerrado. Solo `VITE_MODO_DEMO=true`
 * exacto lo activa; cualquier otro valor (o su ausencia) conecta al backend.
 */
async function modoDemoCon(valor: string | undefined): Promise<boolean> {
  vi.resetModules()
  vi.stubEnv('VITE_MODO_DEMO', valor as string)
  const { MODO_DEMO } = await import('@/infrastructure/demo/modoDemo')
  return MODO_DEMO
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('MODO_DEMO', () => {
  it('solo se activa con "true" exacto', async () => {
    expect(await modoDemoCon('true')).toBe(true)
  })

  it.each([undefined, '', 'false', 'TRUE', '1', 'yes'])('queda desactivado con %s', async (valor) => {
    expect(await modoDemoCon(valor)).toBe(false)
  })
})
