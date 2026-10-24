import { describe, expect, it } from 'vitest'

import type { LecturaTermica } from '@/domain/entities/LecturaTermica'
import {
  HUECO_SIN_DATOS_MS,
  construirOpcionCurvaTermica,
  episodiosDeExcursion,
  huecosSinDatos,
} from '@/infrastructure/charts/curvaTermica'

const BASE = Date.parse('2026-10-24T13:00:00Z')
const ETIQUETAS = {
  interna: 'Refrigerador',
  ambiental: 'Ambiental',
  rangoEsperado: 'Rango',
  ahora: 'Ahora',
  excursion: 'Excursión',
  sinDatos: 'Sin datos',
}

function lectura(segundos: number, temperatura: number, excursion = false): LecturaTermica {
  return {
    id: String(segundos),
    timestamp: new Date(BASE + segundos * 1000).toISOString(),
    temperatura_interna: temperatura,
    temperatura_ambiental: 22,
    excursion_confirmada: excursion,
  } as LecturaTermica
}

type Serie = { data: Array<[number, number | null]>; markPoint?: { data: unknown[] }; markArea?: { data: unknown[] } }

describe('curva térmica', () => {
  it('agrupa lecturas consecutivas en un solo episodio de excursión', () => {
    const serie = [lectura(0, 5), lectura(30, 9, true), lectura(60, 10, true), lectura(90, 5), lectura(120, 11, true)]
    const episodios = episodiosDeExcursion(serie)
    expect(episodios).toHaveLength(2)
    expect(episodios[0]).toMatchObject({ inicio: BASE + 30_000, fin: BASE + 60_000, recortado: false })
  })

  it('no marca como inicio un episodio que ya estaba en curso en la primera lectura', () => {
    const serie = [lectura(0, 25, true), lectura(30, 25, true)]
    const opcion = construirOpcionCurvaTermica(serie, ETIQUETAS)
    const interna = (opcion.series as Serie[])[0]
    expect(interna.markPoint?.data).toEqual([])
  })

  it('corta la línea en un hueco sin datos en vez de unir las muestras', () => {
    const serie = [lectura(0, 5), lectura(30, 5), lectura(30 + HUECO_SIN_DATOS_MS / 1000 + 60, 6)]
    expect(huecosSinDatos(serie)).toHaveLength(1)
    const interna = (construirOpcionCurvaTermica(serie, ETIQUETAS).series as Serie[])[0]
    expect(interna.data.map(([, valor]) => valor)).toEqual([5, 5, null, 6])
  })

  it('con ventana, el eje termina en «ahora» y descarta lo anterior al inicio', () => {
    const hasta = BASE + 3_600_000
    const serie = [lectura(-60, 5), lectura(0, 5), lectura(3_590, 5)]
    const opcion = construirOpcionCurvaTermica(serie, ETIQUETAS, { desde: BASE, hasta })
    expect(opcion.xAxis).toMatchObject({ type: 'time', min: BASE, max: hasta })
    expect((opcion.series as Serie[])[0].data.filter(([, valor]) => valor !== null)).toHaveLength(2)
  })
})
