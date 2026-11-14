import { describe, expect, it } from 'vitest'

import type { LecturaTermica } from '@/domain/entities/LecturaTermica'
import { bucketAutomatico, resumenCombinado, type SerieTermica } from '@/domain/entities/SerieTermica'

const HORA = 3_600_000

function serieBase(over: Partial<SerieTermica> = {}): SerieTermica {
  return {
    device_id: 'FARM-01',
    desde: '2026-11-13T10:00:00Z',
    hasta: '2026-11-14T10:00:00Z',
    bucket_segundos: 60,
    bucket_automatico: true,
    intervalo_reporte_segundos: 10,
    umbral_brecha_segundos: 30,
    total_lecturas: 8640,
    lecturas_sin_hora: 0,
    lecturas_manuales: 0,
    buckets: [],
    brechas: [],
    resumen: {
      lecturas: 8640,
      temperatura_interna: { min: 3, max: 7, promedio: 5, n: 8640 },
      temperatura_ambiental: { min: 20, max: 24, promedio: 22, n: 8640 },
      humedad_ambiental: { min: 50, max: 70, promedio: 60, n: 8640 },
      fuera_de_rango: 0,
      excursiones: 2,
    },
    ...over,
  }
}

function enVivo(timestamp: string, temperatura: number, excursion = false): LecturaTermica {
  return {
    id: timestamp,
    device_id: 'FARM-01',
    timestamp,
    temperatura_ambiental: 22,
    humedad_ambiental: 60,
    temperatura_interna: temperatura,
    apertura_refrigerador: false,
    duracion_apertura_segundos: 0,
    estado_conectividad: 'online',
    nivel_riesgo: 'normal',
    confianza_ia: 0.9,
    modelo_version: '4',
    origen_clasificacion: 'random_forest',
    estado_inferencia: 'completada',
    motivo_no_inferencia: null,
    excursion_confirmada: excursion,
    riesgo_efectivo: excursion ? 'excursion_critica' : 'normal',
  }
}

describe('HU-31: intervalo automático (mismo criterio que el backend)', () => {
  it('24 h en intervalos de 1 min y 7 d en intervalos de 10 min, sin pasar de 1500', () => {
    expect(bucketAutomatico(0, 24 * HORA)).toBe(60)
    expect(bucketAutomatico(0, 7 * 24 * HORA)).toBe(600)
    expect(bucketAutomatico(0, HORA)).toBe(60)
    expect(bucketAutomatico(0, 366 * 24 * HORA)).toBe(21_600)
  })
})

describe('HU-31: resumen del periodo completo más lo recibido en vivo', () => {
  it('sin lecturas nuevas, el resumen del backend', () => {
    expect(resumenCombinado(serieBase())).toEqual({ minima: 3, maxima: 7, promedio: 5, fueraDeRango: 2, lecturas: 8640 })
  })

  it('suma solo las lecturas posteriores a `hasta`, con el promedio ponderado', () => {
    const resumen = resumenCombinado(serieBase(), [
      enVivo('2026-11-14T09:59:50Z', 1), // ya está en la serie: no se cuenta dos veces
      enVivo('2026-11-14T10:00:10Z', 9, true),
    ])
    expect(resumen?.maxima).toBe(9)
    expect(resumen?.minima).toBe(3)
    expect(resumen?.lecturas).toBe(8641)
    expect(resumen?.fueraDeRango).toBe(3)
    expect(resumen?.promedio).toBeCloseTo((5 * 8640 + 9) / 8641, 6)
  })

  it('null si no hay temperatura en el periodo ni en vivo', () => {
    const vacia = serieBase({
      total_lecturas: 0,
      resumen: {
        lecturas: 0,
        temperatura_interna: { min: null, max: null, promedio: null, n: 0 },
        temperatura_ambiental: { min: null, max: null, promedio: null, n: 0 },
        humedad_ambiental: { min: null, max: null, promedio: null, n: 0 },
      },
    })
    expect(resumenCombinado(vacia)).toBeNull()
    expect(resumenCombinado(vacia, [enVivo('2026-11-14T10:00:10Z', 4)])).toMatchObject({ minima: 4, maxima: 4, promedio: 4, lecturas: 1 })
  })
})
