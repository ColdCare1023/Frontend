import { describe, expect, it } from 'vitest'

import {
  ESTADOS_RIESGO,
  estadoRiesgoDe,
  instanteCaptura,
  lecturaSinHora,
  serieGraficable,
  type LecturaTermica,
} from '@/domain/entities/LecturaTermica'
import openapi from '../contrato/openapi-backend.json'

function lectura(over: Partial<LecturaTermica> = {}): LecturaTermica {
  return {
    id: 'l-1',
    device_id: 'FARM-01',
    timestamp: '2026-11-14T10:00:00Z',
    temperatura_ambiental: 21,
    humedad_ambiental: 60,
    temperatura_interna: 5,
    apertura_refrigerador: false,
    duracion_apertura_segundos: 0,
    estado_conectividad: 'online',
    nivel_riesgo: 'normal',
    confianza_ia: 0.9,
    modelo_version: '4.0.0',
    origen_clasificacion: 'random_forest',
    estado_inferencia: 'completada',
    motivo_no_inferencia: null,
    excursion_confirmada: false,
    riesgo_efectivo: 'normal',
    ...over,
  }
}

describe('HU-34: estado de riesgo a rotular', () => {
  it('usa el estado_riesgo del backend cuando llega', () => {
    // El backend dice «sin clasificación IA» aunque riesgo_efectivo sea normal.
    expect(estadoRiesgoDe(lectura({ estado_riesgo: 'sin_clasificacion_ia' }))).toBe('sin_clasificacion_ia')
    expect(estadoRiesgoDe(lectura({ estado_riesgo: 'falla_sensor', temperatura_interna: 5 }))).toBe('falla_sensor')
  })

  it('esc. 1-2: con inferencia completada, el riesgo efectivo', () => {
    expect(estadoRiesgoDe(lectura())).toBe('normal')
    expect(estadoRiesgoDe(lectura({ nivel_riesgo: 'riesgo_preventivo', riesgo_efectivo: 'riesgo_preventivo' }))).toBe('riesgo_preventivo')
  })

  it('esc. 4: sin inferencia del modelo no es Normal aunque riesgo_efectivo lo diga', () => {
    for (const estado of ['omitida', 'fallida', 'modelo_no_disponible'] as const) {
      expect(estadoRiesgoDe(lectura({ estado_inferencia: estado, nivel_riesgo: null, confianza_ia: null }))).toBe('sin_clasificacion_ia')
    }
    expect(estadoRiesgoDe(lectura({ nivel_riesgo: null }))).toBe('sin_clasificacion_ia')
    expect(estadoRiesgoDe(lectura({ riesgo_efectivo: null }))).toBe('sin_clasificacion_ia')
  })

  it('HU-17/D18: un motivo de omisión preventivo nuevo (sin contexto SHT31) se rotula «sin clasificación IA»', () => {
    // La interfaz no traduce `motivo_no_inferencia` (no lo muestra): cualquier
    // código del backend, incluidos `ventana_15min_sin_cobertura_suficiente` y
    // `ventana_15min_sin_contexto_ambiental`, cae en el estado genérico, nunca en Normal.
    for (const motivo of ['ventana_15min_sin_cobertura_suficiente', 'ventana_15min_sin_contexto_ambiental']) {
      const omitida = { estado_inferencia: 'omitida', motivo_no_inferencia: motivo, nivel_riesgo: null, confianza_ia: null, riesgo_efectivo: 'normal' } as const
      expect(estadoRiesgoDe(lectura(omitida))).toBe('sin_clasificacion_ia')
      expect(estadoRiesgoDe(lectura({ ...omitida, estado_riesgo: 'sin_clasificacion_ia' }))).toBe('sin_clasificacion_ia')
    }
  })

  it('esc. 4: sin temperatura interna válida es falla de sensor, no Normal', () => {
    expect(estadoRiesgoDe(lectura({ temperatura_interna: null, riesgo_efectivo: 'normal' }))).toBe('falla_sensor')
    expect(estadoRiesgoDe(lectura({ origen_clasificacion: 'fallo_sensor' }))).toBe('falla_sensor')
  })

  it('esc. 3: la excursión confirmada por la regla manda sobre la falta de clasificación', () => {
    expect(estadoRiesgoDe(lectura({ excursion_confirmada: true, nivel_riesgo: null, estado_inferencia: 'omitida' }))).toBe('excursion_critica')
    // Fuera de 2-8 °C aunque el backend anterior no marcara la excursión.
    expect(estadoRiesgoDe(lectura({ temperatura_interna: 8.6, nivel_riesgo: null, estado_inferencia: 'omitida' }))).toBe('excursion_critica')
  })

  it('ignora un estado_riesgo desconocido y aplica la regla', () => {
    expect(estadoRiesgoDe(lectura({ estado_riesgo: 'otro' as never, estado_inferencia: 'omitida' }))).toBe('sin_clasificacion_ia')
    expect(estadoRiesgoDe(null)).toBeNull()
  })

  it('los estados coinciden con el enum que publica la API', () => {
    const propiedad = (openapi as unknown as {
      components: { schemas: Record<string, { properties: Record<string, { anyOf: Array<{ enum?: string[] }> }> }> }
    }).components.schemas.LecturaResponse.properties.estado_riesgo
    const valores = propiedad.anyOf.find((o) => o.enum)?.enum ?? []
    expect([...valores].sort()).toEqual([...ESTADOS_RIESGO].sort())
  })
})

describe('HU-07: lecturas sin hora de captura', () => {
  it('usa sin_hora del backend', () => {
    expect(lecturaSinHora(lectura({ sin_hora: true }))).toBe(true)
    expect(lecturaSinHora(lectura({ sin_hora: false, time_quality: 'unsynced' }))).toBe(false)
  })

  it('sin el campo, `unsynced` sin hora reconstruida y no manual', () => {
    expect(lecturaSinHora(lectura({ time_quality: 'unsynced' }))).toBe(true)
    expect(lecturaSinHora(lectura({ time_quality: 'unsynced', timestamp_estimado: '2026-11-14T09:59:00Z' }))).toBe(false)
    expect(lecturaSinHora(lectura({ time_quality: 'unsynced', origen: 'manual' }))).toBe(false)
    expect(lecturaSinHora(lectura({ time_quality: 'synced' }))).toBe(false)
  })

  it('el instante de captura es la hora reconstruida, o null sin hora', () => {
    expect(instanteCaptura(lectura())).toBe(Date.parse('2026-11-14T10:00:00Z'))
    expect(instanteCaptura(lectura({ timestamp_estimado: '2026-11-14T09:58:00Z', time_quality: 'unsynced' }))).toBe(
      Date.parse('2026-11-14T09:58:00Z'),
    )
    expect(instanteCaptura(lectura({ sin_hora: true }))).toBeNull()
  })

  it('la serie de la curva excluye las lecturas sin hora y ubica las reancladas', () => {
    const serie = [
      lectura({ id: 'a', timestamp: '2026-11-14T10:00:00Z' }),
      // Llegó a las 10:05 pero se capturó a las 9:59 (hora reconstruida).
      lectura({ id: 'b', timestamp: '2026-11-14T10:05:00Z', timestamp_estimado: '2026-11-14T09:59:00Z', time_quality: 'unsynced' }),
      lectura({ id: 'c', timestamp: '2026-11-14T10:06:00Z', sin_hora: true, time_quality: 'unsynced' }),
    ]
    const graficable = serieGraficable(serie)
    expect(graficable.map((l) => l.id)).toEqual(['b', 'a'])
    expect(graficable[0].timestamp).toBe('2026-11-14T09:59:00.000Z')
  })

  it('devuelve la misma referencia si no hay nada que corregir', () => {
    const serie = [lectura({ id: 'a' }), lectura({ id: 'b', timestamp: '2026-11-14T10:00:30Z' })]
    expect(serieGraficable(serie)).toBe(serie)
  })
})
