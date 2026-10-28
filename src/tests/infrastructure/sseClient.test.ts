import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { aplicarCambioConectividad, type Dispositivo } from '@/domain/entities/Dispositivo'
import { setAccessToken } from '@/infrastructure/api/apiClient'
import {
  type CambioConectividad,
  REINTENTO_BASE_MS,
  REINTENTO_MAX_MS,
  suscribirseLecturas,
  suscribirseTiempoReal,
} from '@/infrastructure/sse/sseClient'
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

describe('suscribirseTiempoReal: conectividad y conexión compartida (HU-13)', () => {
  class EventSourceConOyentes {
    static instancias: EventSourceConOyentes[] = []
    onopen: (() => void) | null = null
    onerror: (() => void) | null = null
    oyentes = new Map<string, (e: MessageEvent) => void>()
    constructor(public url: string) {
      EventSourceConOyentes.instancias.push(this)
    }
    addEventListener(tipo: string, oyente: (e: MessageEvent) => void) {
      this.oyentes.set(tipo, oyente)
    }
    emitir(tipo: string, datos: unknown) {
      this.oyentes.get(tipo)?.({ data: JSON.stringify(datos) } as MessageEvent)
    }
    close() {}
  }

  let adaptador: ReturnType<typeof instalarAdaptadorFalso>

  beforeEach(() => {
    EventSourceConOyentes.instancias = []
    vi.stubGlobal('EventSource', EventSourceConOyentes)
    setAccessToken('token-de-prueba')
    adaptador = instalarAdaptadorFalso(() => ({ data: { ticket: 't' } }))
  })

  afterEach(() => {
    adaptador.restaurar()
    setAccessToken(null)
    vi.unstubAllGlobals()
  })

  it('reparte el evento `conectividad` y comparte una sola conexión', async () => {
    const cambios: CambioConectividad[] = []
    const lecturas: unknown[] = []
    const cerrarA = suscribirseTiempoReal({ onConectividad: (c) => cambios.push(c) })
    const cerrarB = suscribirseLecturas((l) => lecturas.push(l))

    await vi.waitFor(() => expect(EventSourceConOyentes.instancias.length).toBe(1))
    const fuente = EventSourceConOyentes.instancias[0]
    fuente.emitir('conectividad', {
      device_id: 'ESP32_01', estado: 'offline', desde: '2026-10-08T15:04:11+00:00', boot_id: 4, origen: 'lwt',
    })
    fuente.emitir('lectura', { id: 'l1' })

    expect(cambios).toEqual([expect.objectContaining({ device_id: 'ESP32_01', estado: 'offline' })])
    expect(lecturas).toEqual([{ id: 'l1' }])
    expect(adaptador.peticiones.filter((p) => p.url === '/api/auth/sse-ticket')).toHaveLength(1)

    cerrarA()
    cerrarB()
  })
})

describe('suscribirseTiempoReal: catálogo de eventos del backend (FE-008)', () => {
  class EventSourceConOyentes {
    static instancias: EventSourceConOyentes[] = []
    onopen: (() => void) | null = null
    onerror: (() => void) | null = null
    cerrado = false
    oyentes = new Map<string, (e: MessageEvent) => void>()
    constructor(public url: string) {
      EventSourceConOyentes.instancias.push(this)
    }
    addEventListener(tipo: string, oyente: (e: MessageEvent) => void) {
      this.oyentes.set(tipo, oyente)
    }
    emitir(tipo: string, datos: unknown) {
      this.oyentes.get(tipo)?.({ data: JSON.stringify(datos) } as MessageEvent)
    }
    close() {
      this.cerrado = true
    }
  }

  let adaptador: ReturnType<typeof instalarAdaptadorFalso>

  beforeEach(() => {
    EventSourceConOyentes.instancias = []
    vi.stubGlobal('EventSource', EventSourceConOyentes)
    setAccessToken('token-de-prueba')
    adaptador = instalarAdaptadorFalso(() => ({ data: { ticket: 't' } }))
  })

  afterEach(() => {
    adaptador.restaurar()
    setAccessToken(null)
    vi.unstubAllGlobals()
  })

  async function fuente() {
    await vi.waitFor(() => expect(EventSourceConOyentes.instancias.length).toBeGreaterThan(0))
    return EventSourceConOyentes.instancias.at(-1)!
  }

  it('convierte el LWT (v1.0 y heredado) en un cambio de conectividad', async () => {
    const cambios: CambioConectividad[] = []
    const cerrar = suscribirseTiempoReal({ onConectividad: (c) => cambios.push(c) })
    const sse = await fuente()

    sse.emitir('lwt_offline', { device_id: 'FARM-01', timestamp: '2026-10-21T10:00:00Z', boot_id: null })
    sse.emitir('reconexion', { device_id: 'FARM-02', timestamp: '2026-10-21T10:05:00Z' })

    expect(cambios).toEqual([
      { device_id: 'FARM-01', estado: 'offline', desde: '2026-10-21T10:00:00Z', boot_id: null, origen: 'lwt' },
      { device_id: 'FARM-02', estado: 'online', desde: '2026-10-21T10:05:00Z', boot_id: null, origen: 'online' },
    ])
    cerrar()
  })

  it('reparte alertas y avisos de dispositivo', async () => {
    const alertas: string[] = []
    const avisos: string[] = []
    const cerrar = suscribirseTiempoReal({
      onAlerta: (e) => alertas.push(`${e.tipo}:${e.device_id}`),
      onAvisoDispositivo: (a) => avisos.push(`${a.tipo}:${a.device_id}`),
    })
    const sse = await fuente()

    sse.emitir('alerta', { device_id: 'FARM-01', temperatura_interna: 11.2 })
    sse.emitir('recuperacion', { device_id: 'FARM-01' })
    sse.emitir('buffer_saturado', { device_id: 'FARM-01', timestamp: 'x', detalle: { perdidas: 3 } })
    sse.emitir('saturacion_buffer', { device_id: 'FARM-02', timestamp: 'x', detalle: null })

    expect(alertas).toEqual(['alerta:FARM-01', 'recuperacion:FARM-01'])
    expect(avisos).toEqual(['buffer_saturado:FARM-01', 'saturacion_buffer:FARM-02'])
    cerrar()
  })

  it('entrega las lecturas en UTC aunque el backend omita la zona', async () => {
    const instantes: string[] = []
    const cerrar = suscribirseLecturas((lectura) => instantes.push(lectura.timestamp))
    const sse = await fuente()

    sse.emitir('lectura', { id: 'l1', device_id: 'ESP32-001', timestamp: '2026-10-28T15:10:26' })

    expect(instantes).toEqual(['2026-10-28T15:10:26Z'])
    cerrar()
  })

  it('ante `sesion_expirada` cierra el stream y vuelve a pedir ticket', async () => {
    const estados: boolean[] = []
    const cerrar = suscribirseTiempoReal({ onEstado: (c) => estados.push(c) })
    const sse = await fuente()

    sse.emitir('sesion_expirada', {})

    expect(sse.cerrado).toBe(true)
    expect(estados.at(-1)).toBe(false)
    await vi.waitFor(() =>
      expect(adaptador.peticiones.filter((p) => p.url === '/api/auth/sse-ticket')).toHaveLength(2),
    )
    cerrar()
  })
})

describe('aplicarCambioConectividad (HU-13)', () => {
  it('actualiza solo el dispositivo del evento', () => {
    const base = [
      { id: 'A', estado_conectividad: 'online' },
      { id: 'B', estado_conectividad: 'online' },
    ] as Dispositivo[]
    const resultado = aplicarCambioConectividad(base, {
      device_id: 'B', estado: 'offline', desde: '2026-10-08T15:00:00Z',
    })
    expect(resultado.map((d) => [d.id, d.estado_conectividad, d.conectividad_cambiada_en ?? null])).toEqual([
      ['A', 'online', null],
      ['B', 'offline', '2026-10-08T15:00:00Z'],
    ])
  })
})
