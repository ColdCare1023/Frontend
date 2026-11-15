import { describe, expect, it } from 'vitest'

import type { LecturaTermica } from '@/domain/entities/LecturaTermica'
import { estadoPuerta, fallaSensor, umbralPuerta, UMBRAL_PUERTA_ABIERTA_POR_DEFECTO } from '@/presentation/pages/dashboard/puerta'

const base = { temperatura_interna: 5, temperatura_ambiental: 22, humedad_ambiental: 60 } as LecturaTermica

describe('HU-35: umbral de puerta abierta', () => {
  it('manda el de la lectura, luego el del equipo y por último el del backend (60 s)', () => {
    expect(umbralPuerta({ umbral_puerta_abierta_segundos: 90 }, 300)).toBe(90)
    expect(umbralPuerta({ umbral_puerta_abierta_segundos: null }, 300)).toBe(300)
    expect(umbralPuerta({ umbral_puerta_abierta_segundos: 0 }, null)).toBe(60)
    expect(umbralPuerta(null)).toBe(UMBRAL_PUERTA_ABIERTA_POR_DEFECTO)
    expect(UMBRAL_PUERTA_ABIERTA_POR_DEFECTO).toBe(60)
  })
})

describe('HU-33: falla de sensor por campo', () => {
  it('manda estado_sensores del backend', () => {
    expect(fallaSensor({ ...base, estado_sensores: { humedad_ambiental: 'invalido' } }, 'humedad_ambiental')).toBe(true)
    expect(fallaSensor({ ...base, estado_sensores: { humedad_ambiental: 'valido' } }, 'humedad_ambiental')).toBe(false)
  })

  it('sin estado_sensores, un valor imposible es falla; null no lo es (es «sin lectura»)', () => {
    expect(fallaSensor({ ...base, humedad_ambiental: 140 }, 'humedad_ambiental')).toBe(true)
    expect(fallaSensor({ ...base, humedad_ambiental: -1 }, 'humedad_ambiental')).toBe(true)
    expect(fallaSensor({ ...base, temperatura_ambiental: Number.NaN }, 'temperatura_ambiental')).toBe(true)
    expect(fallaSensor({ ...base, humedad_ambiental: null }, 'humedad_ambiental')).toBe(false)
    expect(fallaSensor(base, 'humedad_ambiental')).toBe(false)
  })
})

describe('HU-35 esc. 1: cambio de puerta en vivo (evento SSE `puerta`)', () => {
  const cerrada = {
    ...base, timestamp: '2026-11-14T12:00:00Z', apertura_refrigerador: false,
    duracion_apertura_segundos: 0, apertura_continua_segundos: 0,
  } as LecturaTermica

  it('un evento posterior a la última lectura manda: abierta y contando desde el cambio', () => {
    const estado = estadoPuerta(cerrada, 20, false, 60, { abierta: true, desde: '2026-11-14T12:00:05Z', segundosDesde: 15 })
    expect(estado.abiertaAhora).toBe(true)
    expect(estado.aperturaEnCurso).toBe(15)
    expect(estado.aperturaProlongada).toBe(false)
    expect(estadoPuerta(cerrada, 80, false, 60, { abierta: true, desde: '2026-11-14T12:00:05Z', segundosDesde: 75 }).aperturaProlongada).toBe(true)
  })

  it('un evento anterior o igual a la última lectura no cambia el estado', () => {
    const estado = estadoPuerta(cerrada, 20, false, 60, { abierta: true, desde: '2026-11-14T11:59:50Z', segundosDesde: 30 })
    expect(estado.abiertaAhora).toBe(false)
    expect(estado.aperturaEnCurso).toBeNull()
  })

  it('el cierre en vivo quita la advertencia de una apertura en curso', () => {
    const abierta = { ...cerrada, apertura_refrigerador: true, apertura_continua_segundos: 120 } as LecturaTermica
    expect(estadoPuerta(abierta, 5, false, 60).aperturaProlongada).toBe(true)
    const estado = estadoPuerta(abierta, 5, false, 60, { abierta: false, desde: '2026-11-14T12:00:03Z', segundosDesde: 2 })
    expect(estado.abiertaAhora).toBe(false)
    expect(estado.aperturaProlongada).toBe(false)
    expect(estado.huboAperturaCerrada).toBe(true)
  })

  it('con el dato desactualizado se muestra abierta pero sin inventar cuánto lleva', () => {
    const estado = estadoPuerta(cerrada, 400, true, 60, { abierta: true, desde: '2026-11-14T12:00:05Z', segundosDesde: 395 })
    expect(estado.abiertaAhora).toBe(true)
    expect(estado.aperturaEnCurso).toBeNull()
  })
})
