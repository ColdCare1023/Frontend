import { describe, expect, it } from 'vitest'

import type { AlertaTermica } from '@/domain/entities/AlertaTermica'
import { accionesDisponibles, ordenarBandeja, temperaturaDeAlerta } from '@/presentation/pages/alertas/bandeja'

function alerta(over: Partial<AlertaTermica> = {}): AlertaTermica {
  return {
    id: 'a',
    reading_id: 'l',
    device_id: 'FARM-01-CDL',
    nivel_riesgo: 'riesgo_preventivo',
    mensaje: 'Aviso',
    revisada: false,
    revisada_por: null,
    created_at: '2026-07-25T12:00:00Z',
    estado: 'pendiente',
    reconocida_en: null,
    atendida_en: null,
    ...over,
  }
}

describe('temperaturaDeAlerta', () => {
  it('prefiere el pico registrado por el backend', () => {
    expect(temperaturaDeAlerta(alerta({ temperatura_pico: 11.5, mensaje: 'Temperatura interna 8.6 °C' }))).toBe(11.5)
  })

  it('lee la lectura escrita en el mensaje de las alertas anteriores a la migración', () => {
    expect(temperaturaDeAlerta(alerta({ mensaje: 'Temperatura interna 8.6 °C fuera del rango de conservación 2–8 °C' }))).toBe(8.6)
    expect(temperaturaDeAlerta(alerta({ mensaje: 'Temperatura interna -1.5 °C fuera del rango' }))).toBe(-1.5)
    expect(temperaturaDeAlerta(alerta({ mensaje: 'Temperatura interna 7,2 °C' }))).toBe(7.2)
  })

  it.each([
    'Temperatura fuera del rango 2-8 °C',
    'Temperatura fuera del rango 2–8 °C',
    'Fuera del rango de 2 a 8 °C',
    'Out of range 2-8 °C',
    'Se perdió la conexión con el nodo',
  ])('no confunde el rango de referencia con una medición: %s', (mensaje) => {
    expect(temperaturaDeAlerta(alerta({ mensaje }))).toBeNull()
  })
})

describe('ordenarBandeja', () => {
  it('pone las pendientes primero, y dentro de ellas lo más grave y lo más reciente', () => {
    const orden = ordenarBandeja([
      alerta({ id: 'atendida-critica', estado: 'atendida', nivel_riesgo: 'excursion_critica' }),
      alerta({ id: 'revisada', estado: 'reconocida' }),
      alerta({ id: 'preventiva-vieja', created_at: '2026-07-20T12:00:00Z' }),
      alerta({ id: 'preventiva-nueva', created_at: '2026-07-25T12:00:00Z' }),
      alerta({ id: 'critica', nivel_riesgo: 'excursion_critica', created_at: '2026-07-01T12:00:00Z' }),
    ]).map((a) => a.id)
    expect(orden).toEqual(['critica', 'preventiva-nueva', 'preventiva-vieja', 'revisada', 'atendida-critica'])
  })

  it('no reordena la lista recibida', () => {
    const original = [alerta({ id: 'b', estado: 'atendida' }), alerta({ id: 'a' })]
    ordenarBandeja(original)
    expect(original.map((a) => a.id)).toEqual(['b', 'a'])
  })
})

describe('accionesDisponibles (HU-23, HU-41)', () => {
  it('reconocer solo sobre pendientes y con permiso', () => {
    expect(accionesDisponibles(alerta(), true, true).reconocer).toBe(true)
    expect(accionesDisponibles(alerta({ estado: 'reconocida' }), true, true).reconocer).toBe(false)
    expect(accionesDisponibles(alerta(), false, true).reconocer).toBe(false)
  })

  it('registrar en todo lo no atendido y con permiso', () => {
    expect(accionesDisponibles(alerta({ estado: 'reconocida' }), false, true).registrar).toBe(true)
    expect(accionesDisponibles(alerta({ estado: 'atendida' }), true, true).registrar).toBe(false)
    expect(accionesDisponibles(alerta(), true, false).registrar).toBe(false)
  })
})
