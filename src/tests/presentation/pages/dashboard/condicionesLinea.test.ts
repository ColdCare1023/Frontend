import { describe, expect, it } from 'vitest'

import type { Dispositivo } from '@/domain/entities/Dispositivo'
import type { LecturaTermica } from '@/domain/entities/LecturaTermica'
import { condicionesLineaEstado } from '@/presentation/pages/dashboard/condicionesLinea'
import { aperturasEnSerie, estadoPuerta } from '@/presentation/pages/dashboard/puerta'
import { ordenarEquipos } from '@/presentation/pages/dashboard/equipos'

const HOY = new Date('2026-07-25T12:00:00Z')
const equipo = (overrides: Partial<Dispositivo> = {}) =>
  ({ id: 'FARM-01', nombre: 'Vacunas', estado_conectividad: 'online', estado_operativo: 'OPERATIVO', ...overrides }) as Dispositivo
const listo = (total = 0, criticas = 0) => ({ estado: 'listo' as const, total, criticas })

describe('Línea de estado: prioridades', () => {
  it('crítica › pendientes › sin datos › calibración › error › todo en orden', () => {
    const sinDatos = equipo({ id: 'B', estado_operativo: 'SIN_DATOS' })
    const vencida = equipo({ id: 'C', fecha_proxima_calibracion: '2026-01-01' })
    expect(condicionesLineaEstado({ alertas: listo(3, 1), equipos: [sinDatos, vencida], hoy: HOY }).map((c) => c.tipo)).toEqual([
      'criticas',
      'sin_datos',
      'calibracion_vencida',
    ])
    expect(condicionesLineaEstado({ alertas: listo(2), equipos: [], hoy: HOY })[0].tipo).toBe('pendientes')
    expect(condicionesLineaEstado({ alertas: listo(), equipos: [sinDatos], hoy: HOY })[0].tipo).toBe('sin_datos')
    expect(condicionesLineaEstado({ alertas: listo(), equipos: [vencida], hoy: HOY })[0].tipo).toBe('calibracion_vencida')
    expect(condicionesLineaEstado({ alertas: { estado: 'error', total: 0, criticas: 0 }, equipos: [equipo()], hoy: HOY })[0].tipo).toBe(
      'alertas_error',
    )
    expect(condicionesLineaEstado({ alertas: listo(), equipos: [equipo()], hoy: HOY })).toEqual([
      { tipo: 'todo_en_orden', reportando: 1, total: 1 },
    ])
  })

  it("nunca 'Todo en orden' si fallan las alertas o no se conoce ningún equipo", () => {
    const tipos = (estado: 'cargando' | 'error' | 'listo', equipos: Dispositivo[]) =>
      condicionesLineaEstado({ alertas: { estado, total: 0, criticas: 0 }, equipos, hoy: HOY }).map((c) => c.tipo)
    expect(tipos('error', [equipo()])).not.toContain('todo_en_orden')
    expect(tipos('cargando', [equipo()])).not.toContain('todo_en_orden')
    expect(tipos('listo', [])).not.toContain('todo_en_orden')
  })
})

describe('Estado de equipos: orden', () => {
  it('problemas primero y luego por nombre', () => {
    const lista = ordenarEquipos([
      equipo({ id: 'A', nombre: 'Zeta' }),
      equipo({ id: 'B', nombre: 'Beta', estado_operativo: 'SIN_DATOS' }),
      equipo({ id: 'C', nombre: 'Alfa' }),
      equipo({ id: 'D', nombre: 'Delta', estado_operativo: 'MONITOREO_SUSPENDIDO' }),
    ])
    expect(lista.map((e) => e.id)).toEqual(['D', 'B', 'C', 'A'])
  })
})

describe('HU-35: puerta', () => {
  const lectura = (minuto: number, abierta: boolean | null, continua?: number | null) =>
    ({
      timestamp: new Date(Date.UTC(2026, 6, 25, 12, minuto)).toISOString(),
      apertura_refrigerador: abierta,
      duracion_apertura_segundos: abierta ? 10 : 0,
      ...(continua !== undefined ? { apertura_continua_segundos: continua } : {}),
    }) as LecturaTermica

  it('aperturasEnSerie cuenta cada paso de cerrada a abierta e ignora null', () => {
    const serie = [lectura(0, false), lectura(1, true, 30), lectura(2, true, 150), lectura(3, null), lectura(4, false), lectura(5, true, 10)]
    const marcas = aperturasEnSerie(serie, 120)
    expect(marcas).toHaveLength(2)
    expect(marcas[0].prolongada).toBe(true)
    expect(marcas[1].prolongada).toBe(false)
  })

  it('sin MC-38 no hay estado de puerta inventado', () => {
    expect(estadoPuerta(lectura(0, null), 0, false).sinSensor).toBe(true)
  })
})
