import { describe, expect, it } from 'vitest'

import type { LecturaTermica } from '@/domain/entities/LecturaTermica'
import { fallaSensor, umbralPuerta, UMBRAL_PUERTA_ABIERTA_POR_DEFECTO } from '@/presentation/pages/dashboard/puerta'

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
