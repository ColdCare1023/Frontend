import { describe, expect, it } from 'vitest'

import {
  aplicarEstadoNodo,
  brechasRecientes,
  CAPACIDAD_BUFFER_LITTLEFS,
  perdidasDeBrecha,
  umbralSilencioSegundos,
  type BrechaTelemetria,
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

describe('HU-48: rango de los pendientes y brechas del buffer', () => {
  const conBuffer = {
    ...base,
    buffer_littlefs: {
      pendientes: 40,
      limite: 30_000,
      desde: '2026-11-14T09:00:00Z',
      hasta: '2026-11-14T09:20:00Z',
      rango_estimado: true,
      perdidas: 0,
      reportado_en: '2026-11-14T09:20:05Z',
    },
  } as Dispositivo

  it('esc. 1: toma el rango que informa el firmware (deja de ser estimado)', () => {
    const [equipo] = aplicarEstadoNodo([conBuffer], {
      device_id: 'FARM-01',
      timestamp: '2026-11-14T09:25:00Z',
      detalle: { pendientes: 70, pendientes_desde: '2026-11-14T09:01:00Z', pendientes_hasta: '2026-11-14T09:25:00Z', cuarentena: 2 },
    })
    expect(equipo.buffer_littlefs).toMatchObject({
      pendientes: 70,
      desde: '2026-11-14T09:01:00Z',
      hasta: '2026-11-14T09:25:00Z',
      rango_estimado: false,
      cuarentena: 2,
      reportado_en: '2026-11-14T09:20:05Z',
    })
  })

  it('esc. 1: sin rango en el latido conserva el que dio el backend', () => {
    const [equipo] = aplicarEstadoNodo([conBuffer], { device_id: 'FARM-01', timestamp: 'x', detalle: { pendientes: 55 } })
    expect(equipo.buffer_littlefs).toMatchObject({ pendientes: 55, desde: '2026-11-14T09:00:00Z', rango_estimado: true })
  })

  it('esc. 3: con 0 pendientes el indicador y su rango desaparecen', () => {
    const [equipo] = aplicarEstadoNodo([conBuffer], { device_id: 'FARM-01', timestamp: '2026-11-14T09:30:00Z', detalle: { pendientes: 0 } })
    expect(equipo.buffer_littlefs).toMatchObject({ pendientes: 0, desde: null, hasta: null, rango_estimado: false })
    expect(equipo.buffer_littlefs?.ultima_sincronizacion_en).toBe('2026-11-14T09:30:00Z')
  })

  it('esc. 2: brechas de la más reciente a la más antigua, la abierta primero', () => {
    const brecha = (desde: string | null, hasta: string | null, extra: Partial<BrechaTelemetria> = {}): BrechaTelemetria => ({
      desde,
      hasta,
      muestras_perdidas: 3,
      causa: 'buffer_agotado',
      registrada_en: hasta ?? '2026-11-14T00:00:00Z',
      ...extra,
    })
    const vieja = brecha('2026-11-10T08:00:00Z', '2026-11-10T09:00:00Z')
    const nueva = brecha('2026-11-13T08:00:00Z', '2026-11-13T09:00:00Z')
    const abierta = brecha(null, null, { abierta: true, registrada_en: '2026-11-12T00:00:00Z' })
    // Orden de la demo y de backends anteriores (ascendente) y del actual (descendente).
    expect(brechasRecientes({ brechas: [vieja, nueva, abierta] })).toEqual([abierta, nueva, vieja])
    expect(brechasRecientes({ brechas: [abierta, nueva, vieja] }, 2)).toEqual([abierta, nueva])
    expect(brechasRecientes(undefined)).toEqual([])
  })

  it('pérdidas de una brecha con el nombre del backend actual o el anterior', () => {
    const b = { desde: null, hasta: null, muestras_perdidas: 4, causa: 'buffer_agotado', registrada_en: 'x' } as const
    expect(perdidasDeBrecha(b)).toBe(4)
    expect(perdidasDeBrecha({ ...b, perdidas: 7 })).toBe(7)
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
