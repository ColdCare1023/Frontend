import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { LecturaTermica } from '@/domain/entities/LecturaTermica'

const suscribirseLecturas = vi.hoisted(() => vi.fn())
vi.mock('@/infrastructure/sse/sseClient', () => ({ suscribirseLecturas }))

import { MAX_LECTURAS_EN_MEMORIA, useMonitoreoTermico } from '@/application/hooks/useMonitoreoTermico'
import { instalarAdaptadorFalso } from '@/tests/ayudas'

/**
 * Comportamiento del monitoreo en vivo con lecturas llegando de forma
 * sostenida (RF-11).
 *
 * Un refrigerador emite del orden de 2.880 lecturas al día. El dashboard es
 * una pantalla que se deja abierta durante la jornada, así que lo que importa
 * no es cómo se comporta con una lectura, sino qué pasa tras varios miles.
 */

function lectura(indice: number, over: Partial<LecturaTermica> = {}): LecturaTermica {
  return {
    id: `l-${indice}`,
    device_id: 'FARM-01-CDL',
    timestamp: new Date(2026, 6, 25, 12, 0, indice).toISOString(),
    temperatura_ambiental: 21,
    humedad_ambiental: 60,
    temperatura_interna: 5,
    apertura_refrigerador: false,
    duracion_apertura_segundos: 0,
    estado_conectividad: 'online',
    nivel_riesgo: 'normal',
    excursion_confirmada: false,
    riesgo_efectivo: 'normal',
    confianza_ia: 0.98,
    modelo_version: '1.0.0',
    origen_clasificacion: 'random_forest',
    estado_inferencia: 'completada',
    motivo_no_inferencia: null,
    ...over,
  }
}

describe('useMonitoreoTermico con flujo SSE sostenido', () => {
  let adaptador: ReturnType<typeof instalarAdaptadorFalso>
  let emitir: (lectura: LecturaTermica) => void
  let cambiarEstado: (conectado: boolean) => void
  let cerrar: ReturnType<typeof vi.fn>

  beforeEach(() => {
    adaptador = instalarAdaptadorFalso(() => ({ data: [] }))
    cerrar = vi.fn()
    suscribirseLecturas.mockReset()
    suscribirseLecturas.mockImplementation((onLectura, onEstado) => {
      emitir = onLectura
      cambiarEstado = onEstado
      return cerrar
    })
  })

  afterEach(() => adaptador.restaurar())

  it('acota la serie en memoria por muchas lecturas que lleguen', async () => {
    const { result } = renderHook(() => useMonitoreoTermico())
    const total = MAX_LECTURAS_EN_MEMORIA + 50

    await act(async () => {
      for (let i = 0; i < total; i++) emitir(lectura(i))
    })

    // Sin tope, un rango ampliado a semanas acumularía sin fin: la gráfica se
    // vuelve ilegible y cada repintado recorre el array entero.
    expect(result.current.serie.length).toBeLessThanOrEqual(MAX_LECTURAS_EN_MEMORIA)
  })

  it('conserva las lecturas más recientes, no las primeras', async () => {
    const { result } = renderHook(() => useMonitoreoTermico())
    await act(async () => {
      await new Promise((resolver) => setTimeout(resolver, 0))
    })

    const total = MAX_LECTURAS_EN_MEMORIA + 50
    await act(async () => {
      for (let i = 0; i < total; i++) emitir(lectura(i))
    })

    // El descarte debe caer por el extremo antiguo: lo que interesa del
    // monitoreo en vivo es el ahora.
    expect(result.current.ultima?.id).toBe(`l-${total - 1}`)
    expect(result.current.serie[0].id).toBe(`l-${total - MAX_LECTURAS_EN_MEMORIA}`)
  })

  it('no descarta una lectura en vivo que se adelante al historial', async () => {
    // La suscripción SSE y el GET del historial arrancan en el mismo efecto.
    // Si la lectura en vivo gana la carrera, el historial no puede borrarla:
    // podría ser precisamente la excursión que motivó abrir el dashboard.
    adaptador.restaurar()
    adaptador = instalarAdaptadorFalso(() => ({ data: [lectura(1), lectura(0)] }))

    const { result } = renderHook(() => useMonitoreoTermico())
    await act(async () => {
      emitir(lectura(99, { nivel_riesgo: 'excursion_critica' }))
    })
    await act(async () => {
      await new Promise((resolver) => setTimeout(resolver, 0))
    })

    const ids = result.current.serie.map((l) => l.id)
    expect(ids).toContain('l-99')
    // Y el historial queda antes que la lectura en vivo, en orden cronológico.
    expect(ids).toEqual(['l-0', 'l-1', 'l-99'])
  })

  it('no duplica una lectura que llegue por SSE y también en el historial', async () => {
    adaptador.restaurar()
    adaptador = instalarAdaptadorFalso(() => ({ data: [lectura(5)] }))

    const { result } = renderHook(() => useMonitoreoTermico())
    await act(async () => emitir(lectura(5)))
    await act(async () => {
      await new Promise((resolver) => setTimeout(resolver, 0))
    })

    expect(result.current.serie.filter((l) => l.id === 'l-5')).toHaveLength(1)
  })

  it('no duplica una lectura reenviada por SSE tras reconexión', async () => {
    const { result } = renderHook(() => useMonitoreoTermico())
    await act(async () => {
      emitir(lectura(5))
      cambiarEstado(false)
      cambiarEstado(true)
      emitir(lectura(5))
      emitir(lectura(6))
    })

    expect(result.current.serie.map((l) => l.id)).toEqual(['l-5', 'l-6'])
  })

  it('distingue historial vacío de fallo de carga sin descartar SSE', async () => {
    adaptador.restaurar()
    adaptador = instalarAdaptadorFalso(() => ({ status: 500 }))

    const { result } = renderHook(() => useMonitoreoTermico())
    expect(result.current.estadoHistorial).toBe('cargando')
    await act(async () => {
      await new Promise((resolver) => setTimeout(resolver, 0))
    })
    expect(result.current.estadoHistorial).toBe('error')
    await act(async () => emitir(lectura(7)))
    expect(result.current.ultima?.id).toBe('l-7')
    expect(result.current.estadoHistorial).toBe('error')
  })

  it('marca historial vacío como carga completa', async () => {
    const { result } = renderHook(() => useMonitoreoTermico())
    await act(async () => {
      await new Promise((resolver) => setTimeout(resolver, 0))
    })
    expect(result.current.estadoHistorial).toBe('completo')
    expect(result.current.serie).toEqual([])
  })

  it('mantiene la serie en orden cronológico ascendente para la gráfica', async () => {
    const { result } = renderHook(() => useMonitoreoTermico())

    await act(async () => {
      for (let i = 0; i < 10; i++) emitir(lectura(i))
    })

    const instantes = result.current.serie.map((l) => new Date(l.timestamp).getTime())
    expect([...instantes].sort((a, b) => a - b)).toEqual(instantes)
  })

  it('expone la última excursión aunque llegue entre lecturas normales', async () => {
    const { result } = renderHook(() => useMonitoreoTermico())
    await act(async () => {
      await new Promise((resolver) => setTimeout(resolver, 0))
    })

    await act(async () => {
      emitir(lectura(1))
      emitir(lectura(2, { nivel_riesgo: 'excursion_critica', temperatura_interna: 11.4 }))
    })

    expect(result.current.ultima?.nivel_riesgo).toBe('excursion_critica')
    expect(result.current.ultima?.temperatura_interna).toBe(11.4)
  })

  it('refleja la caída y la recuperación del stream', async () => {
    const { result } = renderHook(() => useMonitoreoTermico())

    await act(async () => cambiarEstado(true))
    expect(result.current.sseConectado).toBe(true)

    await act(async () => cambiarEstado(false))
    expect(result.current.sseConectado).toBe(false)
  })

  it('cierra la suscripción al desmontar, sin dejar el stream abierto', async () => {
    const { unmount } = renderHook(() => useMonitoreoTermico())

    unmount()

    expect(cerrar).toHaveBeenCalledTimes(1)
  })

  it('se suscribe una sola vez, no en cada repintado', async () => {
    const { rerender } = renderHook(() => useMonitoreoTermico())

    rerender()
    rerender()

    // Una suscripción por repintado abriría un EventSource nuevo por cada
    // lectura recibida: el efecto de bola de nieve clásico del SSE.
    expect(suscribirseLecturas).toHaveBeenCalledTimes(1)
  })
})
