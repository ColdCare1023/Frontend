import { describe, expect, it } from 'vitest'

import type { AlertaTermica } from '@/domain/entities/AlertaTermica'
import type { IncidenteOperativo } from '@/domain/entities/Dispositivo'
import { construirCinta24h } from '@/lib/cinta24h'
import { eventosRecientes } from '@/presentation/pages/dispositivos/actividad'
import { calcularTendencia, type PuntoTendencia } from '@/presentation/pages/dispositivos/lista/tendencias'

const MIN = 60_000
const AHORA = Date.parse('2026-11-14T12:00:00Z')

/** Serie cada 10 min que sube o baja `porHora` °C/h desde `inicio`. */
function serie(porHora: number, inicio = 5, puntos = 7): PuntoTendencia[] {
  return Array.from({ length: puntos }, (_, i) => ({ t: AHORA - (puntos - 1 - i) * 10 * MIN, v: inicio + (porHora * i * 10) / 60 }))
}

describe('tendencia corta de la fila (SPEC P5b §4.3)', () => {
  it('calcula la pendiente en °C/h y su sentido', () => {
    const sube = calcularTendencia(serie(1.2))
    expect(sube?.sentido).toBe('sube')
    expect(sube?.pendiente).toBeCloseTo(1.2, 5)
    expect(calcularTendencia(serie(-0.6))?.sentido).toBe('baja')
  })

  it('por debajo de 0.3 °C/h es estable', () => {
    expect(calcularTendencia(serie(0.1))?.sentido).toBe('estable')
  })

  it('sin 3 lecturas con valor o menos de 10 min de serie no hay tendencia', () => {
    expect(calcularTendencia(serie(1, 5, 2))).toBeNull()
    expect(calcularTendencia([{ t: AHORA - 2 * MIN, v: 5 }, { t: AHORA - MIN, v: 5.1 }, { t: AHORA, v: 5.2 }])).toBeNull()
    expect(calcularTendencia(serie(1).map((p) => ({ ...p, v: null })))).toBeNull()
  })

  it('usa solo la última hora cuando la serie es más larga', () => {
    // Bajó durante horas y sube en la última hora: manda la última hora.
    const larga: PuntoTendencia[] = [
      ...Array.from({ length: 12 }, (_, i) => ({ t: AHORA - (180 - i * 10) * MIN, v: 8 - i * 0.3 })),
      ...serie(2, 4.4, 7),
    ]
    expect(calcularTendencia(larga)?.sentido).toBe('sube')
  })
})

function alerta(over: Partial<AlertaTermica>): AlertaTermica {
  return {
    id: 'al-1',
    reading_id: 'l-1',
    device_id: 'FARM-01-CDL',
    nivel_riesgo: 'excursion_critica',
    mensaje: 'x',
    revisada: false,
    revisada_por: null,
    created_at: new Date(AHORA - 60 * MIN).toISOString(),
    estado: 'pendiente',
    reconocida_en: null,
    atendida_en: null,
    ...over,
  }
}

function incidente(over: Partial<IncidenteOperativo>): IncidenteOperativo {
  return {
    id: 'op-1',
    device_id: 'FARM-02-CDL',
    tipo: 'sin_datos',
    estado: 'activo',
    detectado_en: new Date(AHORA - 5 * MIN).toISOString(),
    ultimo_reporte_en: null,
    umbral_silencio_segundos: 90,
    recuperado_en: null,
    ...over,
  }
}

describe('actividad reciente de los equipos', () => {
  it('junta alertas e incidentes, el más reciente primero, sin repetir alertas', () => {
    const a = alerta({ id: 'al-1' })
    const eventos = eventosRecientes([a, a, alerta({ id: 'al-2', nivel_riesgo: 'riesgo_preventivo', created_at: new Date(AHORA - 3 * 60 * MIN).toISOString() })], [incidente({})], AHORA)
    expect(eventos.map((e) => e.tipo)).toEqual(['incidente', 'critica', 'preventiva'])
  })

  it('filtra por equipo, descarta lo de hace más de 7 días y las alertas normales', () => {
    const eventos = eventosRecientes(
      [
        alerta({ id: 'vieja', created_at: new Date(AHORA - 8 * 24 * 60 * MIN).toISOString() }),
        alerta({ id: 'normal', nivel_riesgo: 'normal' }),
        alerta({ id: 'ok' }),
      ],
      [incidente({ estado: 'resuelto', recuperado_en: new Date(AHORA - 2 * MIN).toISOString() })],
      AHORA,
      { deviceId: 'FARM-01-CDL' },
    )
    expect(eventos.map((e) => e.id)).toEqual(['a-ok'])
  })

  it('un incidente resuelto cuenta por su recuperación', () => {
    const [evento] = eventosRecientes([], [incidente({ estado: 'resuelto', recuperado_en: new Date(AHORA - 2 * MIN).toISOString() })], AHORA)
    expect(evento.tipo).toBe('recuperado')
    expect(evento.ms).toBe(AHORA - 2 * MIN)
  })
})

describe('cinta 24 h con equipos sin eventos', () => {
  it('incluye los equipos pedidos aunque no tengan alertas ni incidentes', () => {
    const cintas = construirCinta24h([], [], AHORA, ['FARM-01-CDL'])
    expect(cintas).toHaveLength(1)
    expect(cintas[0].tramos.every((t) => t === 'sin_eventos')).toBe(true)
    expect(cintas[0].resumen).toEqual({ criticas: 0, preventivos: 0, sinDatos: 0 })
  })
})
