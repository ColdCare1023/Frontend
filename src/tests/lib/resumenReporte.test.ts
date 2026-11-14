import { describe, expect, it } from 'vitest'

import type { AlertaTermica } from '@/domain/entities/AlertaTermica'
import type { LecturaTermica } from '@/domain/entities/LecturaTermica'
import { conteoAlertas, curvaPorEquipo, submuestrear, tiempoEnRango } from '@/lib/resumenReporte'

const BASE = Date.parse('2026-07-01T00:00:00Z')
const MIN = 60_000

function lectura(minuto: number, temperatura: number | null, device = 'FARM-01'): LecturaTermica {
  return {
    id: null,
    device_id: device,
    timestamp: new Date(BASE + minuto * MIN).toISOString(),
    temperatura_ambiental: null,
    humedad_ambiental: null,
    temperatura_interna: temperatura,
    apertura_refrigerador: null,
    duracion_apertura_segundos: null,
  } as LecturaTermica
}

const serie = (desde: number, hasta: number, temp: (m: number) => number | null, device?: string) =>
  Array.from({ length: (hasta - desde) / 10 }, (_, i) => lectura(desde + i * 10, temp(desde + i * 10), device))

const iso = (minuto: number) => new Date(BASE + minuto * MIN).toISOString()
const AHORA = BASE + 10_000 * MIN

describe('tiempoEnRango (Reportes)', () => {
  it('todo en rango = 100 %', () => {
    const r = tiempoEnRango(serie(0, 120, () => 5), iso(0), iso(120), { ahora: AHORA })
    expect(r.porcentajes.enRango).toBe(100)
    expect(r.fuera).toBe(0)
  })

  it('un hueco mayor que 3 intervalos cuenta como sin datos', () => {
    const lecturas = [...serie(0, 60, () => 5), ...serie(120, 180, () => 5)]
    const r = tiempoEnRango(lecturas, iso(0), iso(180), { ahora: AHORA })
    // La última lectura (min 50) cubre hasta 3 intervalos (min 80); de 80 a 120 no hay datos.
    expect(r.sinDatos).toBe(40 * MIN)
  })

  it('temperatura nula cuenta como sin datos, no como excursión', () => {
    const r = tiempoEnRango(serie(0, 60, (m) => (m < 30 ? null : 5)), iso(0), iso(60), { ahora: AHORA })
    expect(r.fuera).toBe(0)
    expect(r.sinDatos).toBe(30 * MIN)
  })

  it('lecturas fuera de 2–8 cuentan como fuera de rango', () => {
    const r = tiempoEnRango(serie(0, 60, (m) => (m < 30 ? 9.2 : 5)), iso(0), iso(60), { ahora: AHORA })
    expect(r.fuera).toBe(30 * MIN)
    expect(r.enRango).toBe(30 * MIN)
  })

  it('reporte truncado: se calcula solo sobre el tramo recibido', () => {
    const r = tiempoEnRango(serie(0, 60, () => 5), iso(0), iso(600), { parcial: true, ahora: AHORA })
    expect(r.sinDatos).toBe(0)
    expect(r.porcentajes.enRango).toBe(100)
  })

  it('los porcentajes suman 100', () => {
    const lecturas = [...serie(0, 70, (m) => (m < 20 ? 9 : 5)), ...serie(110, 140, () => 5)]
    const { porcentajes } = tiempoEnRango(lecturas, iso(0), iso(170), { ahora: AHORA })
    expect(Math.round((porcentajes.enRango + porcentajes.fuera + porcentajes.sinDatos) * 10)).toBe(1000)
  })

  it('el tiempo futuro del periodo no cuenta', () => {
    const r = tiempoEnRango(serie(0, 60, () => 5), iso(0), iso(6000), { ahora: BASE + 60 * MIN })
    expect(r.hasta).toBe(BASE + 60 * MIN)
    expect(r.porcentajes.enRango).toBe(100)
  })

  it('varios equipos suman sus periodos', () => {
    const lecturas = [...serie(0, 60, () => 5, 'A'), ...serie(0, 60, () => 9, 'B')]
    const r = tiempoEnRango(lecturas, iso(0), iso(60), { ahora: AHORA })
    expect(r.enRango).toBe(60 * MIN)
    expect(r.fuera).toBe(60 * MIN)
    expect(r.porcentajes.enRango).toBe(50)
  })
})

describe('submuestrear y conteoAlertas', () => {
  it('devuelve ≤240 tramos y conserva mínimo y máximo', () => {
    const lecturas = serie(0, 10_000, (m) => (m === 5000 ? 9.9 : m === 2000 ? 1.1 : 5))
    const { buckets } = submuestrear(lecturas, 240)
    expect(buckets.length).toBeLessThanOrEqual(240)
    const valores = buckets.filter((b) => b !== null)
    expect(Math.max(...valores.map((b) => b!.max))).toBe(9.9)
    expect(Math.min(...valores.map((b) => b!.min))).toBe(1.1)
  })

  it('separa críticas, preventivas y pendientes', () => {
    const alertas = [
      { nivel_riesgo: 'excursion_critica', estado: 'pendiente' },
      { nivel_riesgo: 'riesgo_preventivo', estado: 'atendida' },
      { nivel_riesgo: 'riesgo_preventivo', estado: 'pendiente' },
    ] as AlertaTermica[]
    expect(conteoAlertas(alertas)).toEqual({ criticas: 1, preventivas: 2, pendientes: 2 })
  })
})

describe('curvaPorEquipo (mini curva de Reportes)', () => {
  it('separa los equipos sobre un eje común y no mezcla sus valores en un tramo', () => {
    const lecturas = [...serie(0, 600, () => 3, 'FARM-02-CDL'), ...serie(0, 600, () => 7, 'FARM-01-CDL')]
    const { series, tramos } = curvaPorEquipo(lecturas, 240)
    expect(series.map((s) => s.equipo)).toEqual(['FARM-01-CDL', 'FARM-02-CDL'])
    expect(tramos).toBeLessThanOrEqual(240)
    for (const s of series) {
      expect(s.tramos).toHaveLength(tramos)
      const valores = s.tramos.filter((t) => t !== null)
      // Cada tramo de un equipo solo contiene sus lecturas: nunca el rango 3–7 de los dos.
      expect(Math.max(...valores.map((t) => t!.max)) - Math.min(...valores.map((t) => t!.min))).toBe(0)
    }
  })

  it('conserva el pico de una excursión y deja hueco donde un equipo no tiene lecturas', () => {
    const lecturas = [
      ...serie(0, 300, (m) => (m === 150 ? 9.6 : 5), 'FARM-01-CDL'),
      ...serie(0, 100, () => 4, 'FARM-02-CDL'),
      ...serie(200, 300, () => 4, 'FARM-02-CDL'),
    ]
    const { series } = curvaPorEquipo(lecturas, 30)
    const farm1 = series.find((s) => s.equipo === 'FARM-01-CDL')!
    const farm2 = series.find((s) => s.equipo === 'FARM-02-CDL')!
    expect(Math.max(...farm1.tramos.map((t) => t?.max ?? 0))).toBe(9.6)
    expect(farm2.tramos.some((t) => t === null)).toBe(true)
  })

  it('sin temperaturas válidas no devuelve series', () => {
    expect(curvaPorEquipo(serie(0, 60, () => null)).series).toEqual([])
  })
})
