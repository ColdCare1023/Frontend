import { describe, expect, it } from 'vitest'

import type { LecturaTermica } from '@/domain/entities/LecturaTermica'
import {
  HUECO_SIN_DATOS_MS,
  construirOpcionCurvaTermica,
  episodiosDeExcursion,
  huecosSinDatos,
  umbralHueco,
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

  it('una serie remuestreada cada 10 min se dibuja continua y conserva sus huecos reales', () => {
    const cada10Min = Array.from({ length: 12 }, (_, i) => lectura(i * 600, 5))
    // Dos horas sin lecturas en medio de la serie.
    const conApagon = [...cada10Min, ...Array.from({ length: 6 }, (_, i) => lectura(11 * 600 + 7_200 + i * 600, 6))]
    expect(umbralHueco(cada10Min)).toBe(600_000 * 2.5)
    expect(huecosSinDatos(cada10Min)).toHaveLength(0)
    expect(huecosSinDatos(conApagon)).toEqual([[BASE + 6_600_000, BASE + 13_800_000]])
    const interna = (construirOpcionCurvaTermica(conApagon, ETIQUETAS).series as Serie[])[0]
    expect(interna.data.filter(([, valor]) => valor === null)).toHaveLength(1)
  })

  it('a la cadencia del nodo (30 s) mantiene el umbral de SIN_DATOS', () => {
    expect(umbralHueco([lectura(0, 5), lectura(30, 5), lectura(60, 5), lectura(400, 5)])).toBe(HUECO_SIN_DATOS_MS)
  })

  it('con varios equipos dibuja una línea por equipo en vez de saltar entre ellos', () => {
    const intercaladas = Array.from({ length: 8 }, (_, i) => ({
      ...lectura(i * 120, i % 2 === 0 ? 5.2 : 3.8),
      device_id: i % 2 === 0 ? 'FARM-01' : 'FARM-02',
    }))
    const series = construirOpcionCurvaTermica(intercaladas, ETIQUETAS).series as Array<Serie & { name: string }>
    expect(series.map((s) => s.name)).toEqual(['FARM-01', 'FARM-02'])
    expect(series[0].data.map(([, valor]) => valor)).toEqual([5.2, 5.2, 5.2, 5.2])
    expect(series[1].data.map(([, valor]) => valor)).toEqual([3.8, 3.8, 3.8, 3.8])
  })

  it('si la ventana avanza menos de un píxel, devuelve la misma opción: la gráfica no repinta', () => {
    const serie = [lectura(0, 5), lectura(30, 5)]
    const dia = 24 * 60 * 60 * 1000
    // En 24 h, un paso del eje son 54 s: se parte del comienzo de uno para no cruzar al siguiente.
    const hasta = Math.ceil(BASE / 54_000) * 54_000
    const primera = construirOpcionCurvaTermica(serie, ETIQUETAS, { desde: hasta - dia, hasta })
    const quinceSegundos = 15_000
    const igual = construirOpcionCurvaTermica(serie, ETIQUETAS, { desde: hasta + quinceSegundos - dia, hasta: hasta + quinceSegundos })
    expect(igual).toBe(primera)

    const otraLectura = construirOpcionCurvaTermica([...serie, lectura(60, 5)], ETIQUETAS, { desde: hasta - dia, hasta })
    expect(otraLectura).not.toBe(primera)
    const otroTema = construirOpcionCurvaTermica(serie, ETIQUETAS, { desde: hasta - dia, hasta }, 'dark')
    expect(otroTema).not.toBe(primera)
  })

  it('sin animaciones: cada cuadro repintaría miles de puntos', () => {
    expect(construirOpcionCurvaTermica([lectura(0, 5), lectura(30, 5)], ETIQUETAS).animation).toBe(false)
  })

  it('la línea va en rojo fuera de 2–8 °C: un color fijo en `lineStyle` anularía el mapa', () => {
    const opcion = construirOpcionCurvaTermica([lectura(0, 5), lectura(30, 9)], ETIQUETAS)
    expect(opcion.visualMap).toMatchObject({ seriesIndex: 0, dimension: 1, pieces: [{ gte: 2, lte: 8 }] })
    const interna = (opcion.series as Array<{ lineStyle: { color?: string } }>)[0]
    expect(interna.lineStyle.color).toBeUndefined()
  })

  it('el mismo equipo lleva siempre el mismo color, llegue en el orden que llegue', () => {
    const de = (equipo: string, segundos: number) => ({ ...lectura(segundos, 5), device_id: equipo })
    const nombres = (serie: LecturaTermica[]) =>
      (construirOpcionCurvaTermica(serie, ETIQUETAS).series as Array<{ name: string }>).map((s) => s.name)
    expect(nombres([de('FARM-02', 0), de('FARM-01', 30)])).toEqual(['FARM-01', 'FARM-02'])
  })

  it('con varios equipos, cada línea tiene su propio mapa de rango', () => {
    const de = (equipo: string, segundos: number) => ({ ...lectura(segundos, 5), device_id: equipo })
    const opcion = construirOpcionCurvaTermica([de('FARM-01', 0), de('FARM-02', 30)], ETIQUETAS)
    expect((opcion.visualMap as unknown[]).map((v) => (v as { seriesIndex: number }).seriesIndex)).toEqual([0, 1])
  })

  it('con ventana, la última lectura lleva su punto y su cifra', () => {
    const hasta = BASE + 60_000
    const opcion = construirOpcionCurvaTermica([lectura(0, 5), lectura(30, 4.56)], ETIQUETAS, { desde: BASE - 1000, hasta })
    const puntos = (opcion.series as Array<{ markPoint?: { data: Array<{ label?: { formatter?: string } }> } }>)[0].markPoint?.data
    expect(puntos?.at(-1)?.label?.formatter).toBe('4.6 °C')
  })

  it('rotula una excursión con su hora y deja sin rótulo las que se pisarían', () => {
    const lejos = [lectura(0, 5), lectura(300, 9, true), lectura(600, 5), lectura(900, 9, true), lectura(1200, 5), lectura(36_000, 5)]
    const puntos = (construirOpcionCurvaTermica(lejos, ETIQUETAS).series as Array<{ markPoint: { data: Array<{ label: { show: boolean; formatter?: string } }> } }>)[0].markPoint.data
    expect(puntos).toHaveLength(2)
    expect(puntos.filter((p) => p.label.show)).toHaveLength(1)
    expect(puntos.find((p) => p.label.show)?.label.formatter).toMatch(/^Excursión · \d{2}:\d{2}$/)
  })

  it('el tooltip escapa lo que viene del backend y marca lo que está fuera de rango', () => {
    const opcion = construirOpcionCurvaTermica([lectura(0, 5), lectura(30, 9)], ETIQUETAS)
    const { formatter } = opcion.tooltip as { formatter: (p: unknown) => string }
    const html = formatter([
      { seriesName: '<img src=x onerror=alert(1)>', axisValue: BASE, value: [BASE, 9.25], color: '#123456' },
      { seriesName: '__contexto', axisValue: BASE, value: [BASE, 1] },
    ])
    expect(html).not.toContain('<img')
    expect(html).toContain('&#60;img')
    expect(html).toContain('9.3 °C')
    expect(html).not.toContain('__contexto')
  })

  it('en un hueco, el tooltip dice que no hay datos en vez de una cifra', () => {
    const opcion = construirOpcionCurvaTermica([lectura(0, 5), lectura(30, 9)], ETIQUETAS)
    const { formatter } = opcion.tooltip as { formatter: (p: unknown) => string }
    expect(formatter([{ seriesName: 'Refrigerador', axisValue: BASE, value: [BASE, null] }])).toContain('Sin datos')
  })

  it('con ventana, el eje termina en «ahora» y descarta lo anterior al inicio', () => {
    const hasta = BASE + 3_600_000
    const serie = [lectura(-60, 5), lectura(0, 5), lectura(3_590, 5)]
    const opcion = construirOpcionCurvaTermica(serie, ETIQUETAS, { desde: BASE, hasta })
    expect(opcion.xAxis).toMatchObject({ type: 'time', min: BASE, max: hasta })
    expect((opcion.series as Serie[])[0].data.filter(([, valor]) => valor !== null)).toHaveLength(2)
  })
})
