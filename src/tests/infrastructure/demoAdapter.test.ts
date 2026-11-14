import { describe, expect, it } from 'vitest'
import type { InternalAxiosRequestConfig } from 'axios'

import { demoAdapter } from '@/infrastructure/demo/demoAdapter'
import type { Dispositivo } from '@/domain/entities/Dispositivo'
import type { LecturaTermica } from '@/domain/entities/LecturaTermica'

function crearConfig(over: Partial<InternalAxiosRequestConfig>): InternalAxiosRequestConfig {
  return {
    headers: {
      get: () => null,
      set: () => {},
      has: () => false,
      delete: () => {},
      clear: () => {},
      toJSON: () => ({}),
    } as unknown as InternalAxiosRequestConfig['headers'],
    method: 'get',
    url: '',
    ...over,
  } as InternalAxiosRequestConfig
}

describe('demoAdapter (Fake API & Estado Operativo)', () => {
  it('devuelve todos los equipos cuando se pasa params: { todos: true }', async () => {
    const config = crearConfig({
      method: 'get',
      url: '/api/dispositivos/estado-operativo',
      params: { todos: true },
    })

    const respuesta = await demoAdapter(config)
    expect(respuesta.status).toBe(200)

    const equipos = respuesta.data as Dispositivo[]
    const ids = equipos.map((e) => e.id)
    expect(ids).toContain('FARM-01-CDL')
    expect(ids).toContain('FARM-02-CDL')
  })

  it('devuelve todos los equipos cuando se pasa ?todos=true en la URL', async () => {
    const config = crearConfig({
      method: 'get',
      url: '/api/dispositivos/estado-operativo?todos=true',
    })

    const respuesta = await demoAdapter(config)
    expect(respuesta.status).toBe(200)

    const equipos = respuesta.data as Dispositivo[]
    const ids = equipos.map((e) => e.id)
    expect(ids).toContain('FARM-01-CDL')
    expect(ids).toContain('FARM-02-CDL')
  })

  it('devuelve solo equipos con incidencias u offline cuando no se solicita todos', async () => {
    const config = crearConfig({
      method: 'get',
      url: '/api/dispositivos/estado-operativo',
    })

    const respuesta = await demoAdapter(config)
    expect(respuesta.status).toBe(200)

    const equipos = respuesta.data as Dispositivo[]
    const ids = equipos.map((e) => e.id)
    expect(ids).toContain('FARM-02-CDL')
    expect(ids).not.toContain('FARM-01-CDL')
  })

  it('entrega telemetría histórica válida para FARM-02-CDL en rango ~3–4 °C', async () => {
    const config = crearConfig({
      method: 'get',
      url: '/api/lecturas',
      params: { device_id: 'FARM-02-CDL', limite: '300' },
    })

    const respuesta = await demoAdapter(config)
    expect(respuesta.status).toBe(200)

    const lecturas = respuesta.data as LecturaTermica[]
    expect(lecturas.length).toBeGreaterThanOrEqual(200)
    for (const l of lecturas) {
      expect(l.device_id).toBe('FARM-02-CDL')
      expect(l.temperatura_interna).not.toBeNull()
      expect(l.temperatura_interna!).toBeGreaterThanOrEqual(2.5)
      expect(l.temperatura_interna!).toBeLessThanOrEqual(5.0)
    }
  })

  it('entrega telemetría para FARM-01-CDL sin mezclarse con FARM-02-CDL', async () => {
    const config = crearConfig({
      method: 'get',
      url: '/api/lecturas',
      params: { device_id: 'FARM-01-CDL', limite: '100' },
    })

    const respuesta = await demoAdapter(config)
    expect(respuesta.status).toBe(200)

    const lecturas = respuesta.data as LecturaTermica[]
    expect(lecturas.length).toBeGreaterThan(0)
    for (const l of lecturas) {
      expect(l.device_id).toBe('FARM-01-CDL')
    }
  })
})

describe('demo: simular una excursión desde Alertas', () => {
  it('crea una alerta pendiente con evidencia y la publica en el stream demo', async () => {
    const { estadoDemo } = await import('@/infrastructure/demo/datosDemo')
    const { EVENTO_SSE_DEMO } = await import('@/infrastructure/demo/constantesDemo')
    const recibidos: unknown[] = []
    const oyente = (evento: Event) => recibidos.push((evento as CustomEvent).detail)
    window.addEventListener(EVENTO_SSE_DEMO, oyente)
    const antes = estadoDemo.alertas.length

    await demoAdapter(
      crearConfig({ method: 'post', url: '/api/demo/dispositivos/FARM-01-CDL/simulacion', data: JSON.stringify({ escenario: 'excursion_critica' }) }),
    )
    await new Promise((r) => setTimeout(r, 0))
    window.removeEventListener(EVENTO_SSE_DEMO, oyente)

    const nueva = estadoDemo.alertas.at(-1)!
    expect(estadoDemo.alertas).toHaveLength(antes + 1)
    expect(nueva).toMatchObject({ estado: 'pendiente', nivel_riesgo: 'excursion_critica', temperatura_pico: 8.6, duracion_s: 600 })
    expect(recibidos).toHaveLength(1)
    expect((recibidos[0] as { alerta: { id: string } }).alerta.id).toBe(nueva.id)
  })

  it('las alertas de la semana traen evidencia y las atendidas su acción correctiva', async () => {
    const { estadoDemo } = await import('@/infrastructure/demo/datosDemo')
    const semilla = estadoDemo.alertas.filter((a) => !a.id.startsWith('al-sim'))
    expect(semilla.every((a) => a.temperatura_pico != null && a.duracion_s != null && a.iniciada_en)).toBe(true)
    const atendidas = semilla.filter((a) => a.estado === 'atendida')
    expect(atendidas.length).toBeGreaterThan(0)
    for (const a of atendidas) expect(estadoDemo.acciones.some((ac) => ac.alert_id === a.id && ac.decision && ac.justificacion)).toBe(true)
  })
})
