import { describe, expect, it } from 'vitest'

import {
  aplicarEstadoNodo,
  CAPACIDAD_BUFFER_LITTLEFS,
  umbralSilencioSegundos,
  type Dispositivo,
} from '@/domain/entities/Dispositivo'
import { existeRuta } from '../contrato/validarOpenApi'

const base = { id: 'FARM-01', intervalo_reporte_segundos: 30 } as Dispositivo

describe('HU-48 / A-4: estado_nodo sobre la lista de equipos', () => {
  it('toma pendientes, capacidad, pérdidas e intervalo del nodo', () => {
    const [equipo] = aplicarEstadoNodo([base], {
      device_id: 'FARM-01',
      timestamp: '2026-10-26T10:00:00Z',
      detalle: { pendientes: 412, capacidad: 30_000, perdidas_total: 3, intervalo_s: 10 },
    })

    expect(equipo.buffer_littlefs).toMatchObject({ pendientes: 412, limite: 30_000, perdidas: 3 })
    expect(equipo.intervalo_reporte_segundos).toBe(10)
    expect(equipo.ultimo_latido_en).toBe('2026-10-26T10:00:00Z')
  })

  it('sin capacidad informada usa la real del nodo (no 128)', () => {
    const [equipo] = aplicarEstadoNodo([base], { device_id: 'FARM-01', timestamp: 'x', detalle: { pendientes: 0 } })
    expect(equipo.buffer_littlefs?.limite).toBe(CAPACIDAD_BUFFER_LITTLEFS)
    expect(equipo.buffer_littlefs?.ultima_sincronizacion_en).toBe('x')
  })

  it('no toca otros equipos', () => {
    const otro = { id: 'FARM-02' } as Dispositivo
    expect(aplicarEstadoNodo([otro], { device_id: 'FARM-01', timestamp: 'x', detalle: {} })[0]).toBe(otro)
  })
})

describe('B-17 / HU-54: umbral de silencio por dispositivo', () => {
  it('usa el umbral que calcula el backend', () => {
    expect(umbralSilencioSegundos({ umbral_sin_datos_segundos: 30, intervalo_reporte_segundos: 10 })).toBe(30)
  })

  it('sin umbral del backend, 3 × el intervalo del nodo', () => {
    expect(umbralSilencioSegundos({ intervalo_reporte_segundos: 60 })).toBe(180)
    expect(umbralSilencioSegundos(undefined)).toBe(90)
  })

  it('el historial de incidentes existe en el backend', () => {
    expect(existeRuta('get', '/api/dispositivos/incidentes')).toBe(true)
  })
})
