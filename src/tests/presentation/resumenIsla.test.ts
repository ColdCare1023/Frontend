import { describe, expect, it } from 'vitest'

import type { Dispositivo } from '@/domain/entities/Dispositivo'
import type { LecturaTermica } from '@/domain/entities/LecturaTermica'
import { estadoEquipo, ordenarEquipos, type EquipoIsla } from '@/presentation/components/notificaciones/useResumenIsla'

const AHORA = new Date('2026-11-07T12:00:00Z').getTime()

function lectura(cambios: Partial<LecturaTermica> = {}): LecturaTermica {
  return {
    device_id: 'FARM-01',
    timestamp: new Date(AHORA - 5000).toISOString(),
    temperatura_interna: 4.7,
    riesgo_efectivo: 'normal',
    excursion_confirmada: false,
    ...cambios,
  } as LecturaTermica
}

const equipo = (id: string, estado: EquipoIsla['estado'], antiguedad: number | null = 5): EquipoIsla => ({ id, nombre: null, lectura: null, estado, antiguedad })

describe('Lo que la isla dice de un equipo', () => {
  it('una lectura vigente dentro del rango es normal', () => {
    expect(estadoEquipo(lectura(), null, AHORA)).toEqual({ estado: 'normal', antiguedad: 5 })
  })

  it('sin temperatura no hay un cero ni una excursión: no hay dato', () => {
    expect(estadoEquipo(lectura({ temperatura_interna: null, excursion_confirmada: true }), null, AHORA).estado).toBe('sinDatos')
  })

  it('sin ninguna lectura tampoco inventa un estado', () => {
    expect(estadoEquipo(null, null, AHORA)).toEqual({ estado: 'sinDatos', antiguedad: null })
  })

  it('una lectura crítica vieja no se presenta como crítica actual', () => {
    const vieja = lectura({ timestamp: new Date(AHORA - 120_000).toISOString(), riesgo_efectivo: 'excursion_critica', excursion_confirmada: true })
    expect(estadoEquipo(vieja, null, AHORA)).toEqual({ estado: 'sinDatos', antiguedad: 120 })
  })

  it('usa el umbral de silencio del propio equipo', () => {
    const conUmbral = { umbral_sin_datos_segundos: 600 } as Dispositivo
    const vieja = lectura({ timestamp: new Date(AHORA - 120_000).toISOString() })
    expect(estadoEquipo(vieja, conUmbral, AHORA).estado).toBe('normal')
  })

  it('lee el riesgo efectivo y la excursión confirmada, no la clase del modelo', () => {
    expect(estadoEquipo(lectura({ riesgo_efectivo: 'riesgo_preventivo' }), null, AHORA).estado).toBe('aviso')
    expect(estadoEquipo(lectura({ nivel_riesgo: 'excursion_critica', riesgo_efectivo: 'normal' }), null, AHORA).estado).toBe('normal')
    expect(estadoEquipo(lectura({ excursion_confirmada: true, riesgo_efectivo: 'riesgo_preventivo' }), null, AHORA).estado).toBe('critico')
  })

  it('un nodo suspendido o con falla de sensor queda sin datos aunque tenga lectura', () => {
    expect(estadoEquipo(lectura(), { estado_operativo: 'MONITOREO_SUSPENDIDO' } as Dispositivo, AHORA).estado).toBe('sinDatos')
    expect(estadoEquipo(lectura(), { estado_operativo: 'FALLA_SENSOR' } as Dispositivo, AHORA).estado).toBe('sinDatos')
  })
})

describe('Qué equipo cuenta la isla', () => {
  it('primero lo más grave y, a igual gravedad, lo más reciente', () => {
    const orden = ordenarEquipos([equipo('A', 'normal', 3), equipo('B', 'sinDatos', 200), equipo('C', 'critico', 9), equipo('D', 'normal', 1), equipo('E', 'aviso', 2)])
    expect(orden.map((e) => e.id)).toEqual(['C', 'E', 'D', 'A', 'B'])
  })
})
