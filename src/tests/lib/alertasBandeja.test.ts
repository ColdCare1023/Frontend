import { describe, expect, it } from 'vitest'

import type { AlertaTermica } from '@/domain/entities/AlertaTermica'
import type { IncidenteOperativo } from '@/domain/entities/Dispositivo'
import { construirCinta24h } from '@/lib/cinta24h'
import { duracionLegible, fechaHoraCompacta, haceCuanto } from '@/lib/formato'
import { ordenarAlertas } from '@/lib/ordenAlertas'
import { cuantasAtendidas, ordenarIncidentes, resumirBandeja } from '@/presentation/pages/alertas/logica'

const AHORA = Date.parse('2026-11-14T12:00:00Z')

const alerta = (over: Partial<AlertaTermica> = {}): AlertaTermica => ({
  id: 'a',
  reading_id: 'l',
  device_id: 'FARM-01-CDL',
  nivel_riesgo: 'excursion_critica',
  mensaje: 'm',
  revisada: false,
  revisada_por: null,
  created_at: '2026-11-14T10:00:00Z',
  estado: 'pendiente',
  reconocida_en: null,
  atendida_en: null,
  ...over,
})

const incidente = (over: Partial<IncidenteOperativo> = {}): IncidenteOperativo => ({
  id: 'i',
  device_id: 'FARM-02-CDL',
  tipo: 'sin_datos',
  estado: 'activo',
  detectado_en: '2026-11-14T11:00:00Z',
  ultimo_reporte_en: null,
  umbral_silencio_segundos: 90,
  recuperado_en: null,
  ...over,
})

describe('ordenarAlertas', () => {
  it('triage de pendientes: gravedad y, dentro del nivel, la más antigua', () => {
    const lista = [
      alerta({ id: 'prev', nivel_riesgo: 'riesgo_preventivo', created_at: '2026-11-14T01:00:00Z' }),
      alerta({ id: 'crit-nueva', created_at: '2026-11-14T11:00:00Z' }),
      alerta({ id: 'crit-vieja', created_at: '2026-11-13T11:00:00Z' }),
    ]
    expect(ordenarAlertas(lista, 'pendiente').map((a) => a.id)).toEqual(['crit-vieja', 'crit-nueva', 'prev'])
    expect(lista[0].id).toBe('prev') // no muta
  })

  it('cronológico (más reciente primero) en atendidas y todas', () => {
    const lista = [alerta({ id: 'vieja', created_at: '2026-11-13T00:00:00Z' }), alerta({ id: 'nueva', created_at: '2026-11-14T00:00:00Z' })]
    expect(ordenarAlertas(lista, 'atendida').map((a) => a.id)).toEqual(['nueva', 'vieja'])
    expect(ordenarAlertas(lista, 'todas').map((a) => a.id)).toEqual(['nueva', 'vieja'])
  })
})

describe('construirCinta24h', () => {
  it('pinta el episodio con iniciada_en y duracion_s', () => {
    const [cinta] = construirCinta24h(
      [alerta({ iniciada_en: '2026-11-14T09:00:00Z', duracion_s: 3600 })],
      [],
      AHORA,
    )
    expect(cinta.resumen.criticas).toBe(3) // 09:00, 09:30 y el tramo de las 10:00
    expect(cinta.tramos).toHaveLength(48)
  })

  it('sin duración pinta solo el tramo de created_at', () => {
    const [cinta] = construirCinta24h([alerta({ nivel_riesgo: 'riesgo_preventivo' })], [], AHORA)
    expect(cinta.resumen).toEqual({ criticas: 0, preventivos: 1, sinDatos: 0 })
  })

  it('incidente sin_datos pinta trama hasta recuperado_en o ahora', () => {
    const [activo] = construirCinta24h([], [incidente()], AHORA)
    expect(activo.resumen.sinDatos).toBe(3)
    const [resuelto] = construirCinta24h([], [incidente({ estado: 'resuelto', recuperado_en: '2026-11-14T11:20:00Z' })], AHORA)
    expect(resuelto.resumen.sinDatos).toBe(1)
  })

  it('la gravedad del tramo es crítica > preventiva > sin datos', () => {
    const [cinta] = construirCinta24h(
      [alerta({ device_id: 'FARM-02-CDL', created_at: '2026-11-14T11:10:00Z' })],
      [incidente()],
      AHORA,
    )
    expect(cinta.resumen).toEqual({ criticas: 1, preventivos: 0, sinDatos: 2 })
  })

  it('equipos sin eventos en 24 h no aparecen', () => {
    expect(construirCinta24h([alerta({ created_at: '2026-11-10T00:00:00Z' })], [], AHORA)).toEqual([])
  })
})

describe('formatos compactos de Alertas', () => {
  it('duracionLegible', () => {
    expect(duracionLegible(45)).toBe('45\u00a0s')
    expect(duracionLegible(185)).toBe('3\u00a0min 5\u00a0s')
    expect(duracionLegible(2400)).toBe('40\u00a0min')
    expect(duracionLegible(4800)).toBe('1\u00a0h 20\u00a0min')
  })

  it('fechaHoraCompacta y haceCuanto', () => {
    expect(fechaHoraCompacta(null)).toBe('—')
    expect(fechaHoraCompacta('2026-11-14T12:00:00Z')).toMatch(/^\d{2}\/\d{2}\u00a0\d{2}:\d{2}$/)
    expect(haceCuanto('2026-11-14T09:00:00Z', AHORA)).toMatch(/3 h/)
    // Un reloj atrasado nunca dice «dentro de».
    expect(haceCuanto('2026-11-14T12:00:30Z', AHORA)).not.toMatch(/dentro/)
  })
})

describe('resumen de la bandeja', () => {
  it('calcula críticas abiertas, atendidas 7 d (50+) y atención media', () => {
    const atendidas = Array.from({ length: 50 }, (_, i) =>
      alerta({ id: `at-${i}`, estado: 'atendida', created_at: '2026-11-14T08:00:00Z', atendida_en: '2026-11-14T08:30:00Z' }),
    )
    const r = resumirBandeja(
      [alerta({ id: 'p1', created_at: '2026-11-14T07:00:00Z' }), alerta({ id: 'p2', nivel_riesgo: 'riesgo_preventivo' })],
      [alerta({ id: 'r1', nivel_riesgo: 'riesgo_preventivo', estado: 'reconocida' })],
      atendidas,
      50,
      AHORA,
    )
    expect(r).toMatchObject({ pendientes: 2, revisadas: 1, criticasAbiertas: 1, masAntigua: '2026-11-14T07:00:00Z' })
    expect(r.atendidas7d).toBe(50)
    expect(r.atendidas7dTruncado).toBe(true)
    expect(r.atencionMedia7d).toBe(1800)
  })

  it('incidentes activos primero; atendidas recientes según filas visibles', () => {
    const lista = ordenarIncidentes([
      incidente({ id: 'r', estado: 'resuelto', recuperado_en: '2026-11-14T11:30:00Z' }),
      incidente({ id: 'a' }),
    ])
    expect(lista.map((i) => i.id)).toEqual(['a', 'r'])
    expect([0, 2, 3, 4, 5].map(cuantasAtendidas)).toEqual([5, 5, 3, 3, 0])
  })
})
