import { describe, expect, it } from 'vitest'

import type { LecturaTermica } from '@/domain/entities/LecturaTermica'
import { anotacionesDelDia, conAnotaciones } from '@/presentation/pages/monitoreo/anotaciones'
import { porcentajeEnRango, tonoDe } from '@/presentation/pages/monitoreo/estadoEquipo'

const HORA = 60 * 60 * 1000
const FIN = Date.parse('2026-07-25T12:00:00Z')
const ventana = { desde: FIN - 24 * HORA, hasta: FIN }

function lectura(horasAtras: number, temperatura: number | null, extra: Partial<LecturaTermica> = {}): LecturaTermica {
  return {
    id: `l-${horasAtras}`,
    device_id: 'FARM-01-CDL',
    timestamp: new Date(FIN - horasAtras * HORA).toISOString(),
    temperatura_interna: temperatura,
    apertura_refrigerador: false,
    duracion_apertura_segundos: 0,
    excursion_confirmada: false,
    ...extra,
  } as LecturaTermica
}

describe('anotaciones de la línea del día', () => {
  it('marca la máxima y la mínima reales de la ventana', () => {
    const notas = anotacionesDelDia([lectura(20, 5), lectura(12, 7.4), lectura(4, 3.1), lectura(1, 5)], ventana, false)

    expect(notas.map((n) => [n.clave, n.valor])).toEqual([
      ['dashboard.anotacionMaxima', 7.4],
      ['dashboard.anotacionMinima', 3.1],
    ])
  })

  it('no anota lo que queda fuera de la ventana ni las lecturas sin dato', () => {
    const notas = anotacionesDelDia([lectura(30, 9.9), lectura(20, null), lectura(10, 5), lectura(2, 6)], ventana, false)

    expect(notas[0].valor).toBe(6)
    expect(notas.some((n) => n.valor === 9.9)).toBe(false)
  })

  it('una excursión confirmada no repite rótulo: ya lleva el suyo en la gráfica', () => {
    const notas = anotacionesDelDia([lectura(20, 5), lectura(10, 9.1, { excursion_confirmada: true }), lectura(2, 4)], ventana, false)

    expect(notas.some((n) => n.clave === 'dashboard.anotacionMaxima')).toBe(false)
  })

  it('cuenta una vez cada apertura larga y deja fuera las cortas', () => {
    const notas = anotacionesDelDia(
      [
        lectura(20, 5, { apertura_refrigerador: true, duracion_apertura_segundos: 30 }),
        lectura(19, 5.5),
        lectura(10, 5.2, { apertura_refrigerador: true, duracion_apertura_segundos: 200 }),
        lectura(9.9, 5.3, { apertura_refrigerador: true, duracion_apertura_segundos: 300 }),
        lectura(2, 4),
      ],
      ventana,
      false,
    )

    const puertas = notas.filter((n) => n.clave === 'dashboard.anotacionPuerta')
    expect(puertas).toHaveLength(1)
    expect(puertas[0].opciones.duracion).toBe('5:00')
  })

  it('en poco ancho descarta los rótulos que se pisarían', () => {
    const serie = [lectura(20, 5), lectura(12, 7), lectura(11, 3), lectura(2, 5)]

    expect(anotacionesDelDia(serie, ventana, false)).toHaveLength(2)
    // 1 h de 24 está a menos de la separación en ambos casos, pero uno va arriba y otro abajo con 4 °C entre ellos.
    expect(anotacionesDelDia(serie, ventana, true)).toHaveLength(2)
    const pegadas = [lectura(20, 5), lectura(12, 5.3), lectura(11, 4.9), lectura(2, 5)]
    expect(anotacionesDelDia(pegadas, ventana, true)).toHaveLength(1)
  })

  it('con equipos mezclados no anota: una máxima no diría de cuál es', () => {
    const notas = anotacionesDelDia([lectura(10, 5), lectura(5, 7, { device_id: 'FARM-02-CDL' })], ventana, false)

    expect(notas).toEqual([])
  })

  it('añade una serie propia sin tocar las de la curva', () => {
    const base = { series: [{ name: 'interna' }], grid: { top: 30, bottom: 24, left: 28, right: 12 } }
    const opcion = conAnotaciones(base, [{ ms: FIN - HORA, valor: 7, clave: 'dashboard.anotacionMaxima', opciones: {}, texto: 'Máxima 7°' }], ventana) as {
      series: Array<{ name: string; markPoint?: { data: unknown[] } }>
      grid: { top: number; left: number }
    }

    expect(opcion.series[0]).toBe(base.series[0])
    expect(opcion.series[1].name).toBe('__anotaciones')
    expect(opcion.series[1].markPoint?.data).toHaveLength(1)
    expect(opcion.grid.top).toBe(30)
    expect(base.series).toHaveLength(1)
  })
})

describe('color del campo', () => {
  it('sigue al estado cuando hay riesgo o falta el dato', () => {
    expect(tonoDe('critico', 5)).toBe('critico')
    expect(tonoDe('aviso', 5)).toBe('preventivo')
    expect(tonoDe('sinDatos', 5)).toBe('sinDatos')
  })

  it('dentro de «normal» depende de dónde está la lectura', () => {
    expect(tonoDe('normal', 5)).toBe('rango')
    expect(tonoDe('normal', 3)).toBe('frio')
    expect(tonoDe('normal', 7)).toBe('cerca')
  })

  it('sin lectura no hay color de temperatura, aunque el riesgo diga «normal»', () => {
    expect(tonoDe('normal', null)).toBe('sinDatos')
  })
})

describe('porcentaje en rango', () => {
  it('no redondea a 100 si hubo algo fuera de rango', () => {
    expect(porcentajeEnRango(1266, 1270)).toBe('99.6')
    expect(porcentajeEnRango(1269, 1270)).toBe('99.9')
    expect(porcentajeEnRango(10, 10)).toBe('100')
    expect(porcentajeEnRango(85, 100)).toBe('85')
  })
})
