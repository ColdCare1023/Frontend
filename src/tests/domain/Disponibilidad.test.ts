import { describe, expect, it } from 'vitest'

import type { Dispositivo, IncidenteOperativo } from '@/domain/entities/Dispositivo'
import { fusionarTramos, porcentajeConDatos, tramosDisponibilidad } from '@/domain/value-objects/Disponibilidad'

const AHORA = Date.parse('2026-07-25T12:10:00Z')
const H = 3_600_000

function equipo(overrides: Partial<Dispositivo> = {}): Dispositivo {
  return {
    id: 'FARM-01',
    nombre: 'Vacunas',
    estado_conectividad: 'online',
    estado_operativo: 'OPERATIVO',
    registrado_en: new Date(AHORA - 100 * 24 * H).toISOString(),
    ...overrides,
  } as Dispositivo
}

function incidente(overrides: Partial<IncidenteOperativo>): IncidenteOperativo {
  return {
    id: 'i-1',
    device_id: 'FARM-01',
    tipo: 'sin_datos',
    estado: 'resuelto',
    detectado_en: new Date(AHORA - 5 * H).toISOString(),
    ultimo_reporte_en: null,
    umbral_silencio_segundos: 90,
    recuperado_en: new Date(AHORA - 4 * H).toISOString(),
    ...overrides,
  } as IncidenteOperativo
}

describe('Disponibilidad: cinta de 24 h', () => {
  it('48 tramos operativos sin incidentes', () => {
    const tramos = tramosDisponibilidad(equipo(), AHORA)
    expect(tramos).toHaveLength(48)
    expect(tramos.every((t) => t.estado === 'operativo')).toBe(true)
    expect(tramos.at(-1)?.fin).toBe(AHORA)
    expect(porcentajeConDatos(tramos)).toBe(100)
  })

  it('antes de registrado_en es sin_registro', () => {
    const tramos = tramosDisponibilidad(equipo({ registrado_en: new Date(AHORA - 2 * H).toISOString() }), AHORA)
    expect(tramos[0].estado).toBe('sin_registro')
    expect(tramos.at(-1)?.estado).toBe('operativo')
    // Lo no registrado no cuenta contra la disponibilidad.
    expect(porcentajeConDatos(tramos)).toBe(100)
  })

  it('incidente activo desde ultimo_reporte_en hasta ahora', () => {
    const tramos = tramosDisponibilidad(
      equipo({
        estado_operativo: 'SIN_DATOS',
        incidencias_operativas: [
          incidente({ estado: 'activo', ultimo_reporte_en: new Date(AHORA - H).toISOString(), recuperado_en: null }),
        ],
      }),
      AHORA,
    )
    expect(tramos.at(-1)?.estado).toBe('sin_datos')
    expect(tramos.at(-3)?.estado).toBe('sin_datos')
    expect(tramos.at(-5)?.estado).toBe('operativo')
  })

  it('brecha gana a sin_datos', () => {
    const desde = new Date(AHORA - 5 * H).toISOString()
    const tramos = tramosDisponibilidad(
      equipo({
        incidencias_operativas: [incidente({})],
        buffer_littlefs: {
          pendientes: 0,
          limite: 30_000,
          desde: null,
          hasta: null,
          perdidas: 3,
          brechas: [{ desde, hasta: new Date(AHORA - 5 * H + 10 * 60_000).toISOString(), muestras_perdidas: 3 }],
        } as Dispositivo['buffer_littlefs'],
      }),
      AHORA,
    )
    expect(tramos.some((t) => t.estado === 'perdida')).toBe(true)
    expect(tramos.some((t) => t.estado === 'sin_datos')).toBe(true)
  })

  it('estado actual FALLA_SENSOR sin incidente pinta el último tramo', () => {
    const tramos = tramosDisponibilidad(equipo({ estado_operativo: 'FALLA_SENSOR' }), AHORA)
    expect(tramos.at(-1)?.estado).toBe('falla_sensor')
    expect(tramos.at(-2)?.estado).toBe('operativo')
  })

  it('porcentaje con floor (no redondea hacia arriba)', () => {
    const tramos = tramosDisponibilidad(equipo({ estado_operativo: 'SIN_DATOS' }), AHORA)
    // 1 de 48 tramos (el último, de 10 min) sin datos → 99,…% → 99.
    expect(porcentajeConDatos(tramos)).toBe(99)
  })

  it('resumen accesible fusiona tramos contiguos', () => {
    const tramos = tramosDisponibilidad(equipo({ incidencias_operativas: [incidente({})] }), AHORA)
    const fusion = fusionarTramos(tramos)
    expect(fusion.filter((t) => t.estado === 'sin_datos')).toHaveLength(1)
    expect(fusion.length).toBeLessThan(tramos.length)
  })
})
