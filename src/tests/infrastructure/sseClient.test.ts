import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { setAccessToken } from '@/infrastructure/api/apiClient'
import { REINTENTO_BASE_MS, REINTENTO_MAX_MS, suscribirseLecturas } from '@/infrastructure/sse/sseClient'
import { instalarAdaptadorFalso } from '@/tests/ayudas'

/**
 * HU-32: reconexión del flujo SSE con backoff exponencial. Un EventSource falso
 * permite provocar caídas y ver cuándo se vuelve a pedir ticket.
 */
class EventSourceFalso {
  static instancias: EventSourceFalso[] = []
  onopen: (() => void) | null = null
  onerror: (() => void) | null = null
  constructor(public url: string) {
    EventSourceFalso.instancias.push(this)
  }
  addEventListener() {}
  close() {}
}

describe('suscribirseLecturas: reconexión con backoff (HU-32)', () => {
  let adaptador: ReturnType<typeof instalarAdaptadorFalso>

  beforeEach(() => {
    vi.useFakeTimers()
    EventSourceFalso.instancias = []
    vi.stubGlobal('EventSource', EventSourceFalso)
    setAccessToken('token-de-prueba')
    adaptador = instalarAdaptadorFalso(() => ({ data: { ticket: 't' } }))
  })

  afterEach(() => {
    adaptador.restaurar()
    setAccessToken(null)
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  const tickets = () => adaptador.peticiones.filter((p) => p.url === '/api/auth/sse-ticket').length

  async function caer() {
    await vi.waitFor(() => expect(EventSourceFalso.instancias.length).toBeGreaterThan(0))
    EventSourceFalso.instancias.at(-1)!.onerror?.()
  }

  it('espera 1 s, 2 s, 4 s… entre reintentos y avisa del corte', async () => {
    const estados: boolean[] = []
    const cerrar = suscribirseLecturas(() => {}, (conectado) => estados.push(conectado))

    await caer()
    expect(estados.at(-1)).toBe(false)
    await vi.advanceTimersByTimeAsync(REINTENTO_BASE_MS - 1)
    expect(tickets()).toBe(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(tickets()).toBe(2)

    await caer()
    await vi.advanceTimersByTimeAsync(2 * REINTENTO_BASE_MS - 1)
    expect(tickets()).toBe(2)
    await vi.advanceTimersByTimeAsync(1)
    expect(tickets()).toBe(3)

    cerrar()
  })

  it('vuelve a 1 s cuando la conexión se reabre y no pasa del tope', async () => {
    const cerrar = suscribirseLecturas(() => {})

    for (let i = 0; i < 8; i++) {
      await caer()
      await vi.advanceTimersByTimeAsync(REINTENTO_MAX_MS)
    }
    EventSourceFalso.instancias.at(-1)!.onopen?.()
    const antes = tickets()
    await caer()
    await vi.advanceTimersByTimeAsync(REINTENTO_BASE_MS)
    expect(tickets()).toBe(antes + 1)

    cerrar()
  })
})
