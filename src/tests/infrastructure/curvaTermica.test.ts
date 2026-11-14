import { describe, expect, it } from 'vitest'

import type { LecturaTermica } from '@/domain/entities/LecturaTermica'
import {
  HUECO_SIN_DATOS_MS,
  construirOpcionCurvaTermica,
  episodiosDeExcursion,
  huecosSinDatos,
  tramosFueraDeRango,
  umbralHueco,
} from '@/infrastructure/charts/curvaTermica'
import { temaGrafica } from '@/infrastructure/charts/temaColdCare'

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
  it('HU-31: la franja 2–8 °C es una zona y lo que sale de ella se dibuja en rojo', () => {
    const opcion = construirOpcionCurvaTermica([lectura(0, 5), lectura(30, 9.5), lectura(60, 5)], ETIQUETAS)
    const series = opcion.series as Array<Serie & { name: string; lineStyle?: { color?: string; shadowBlur?: number }; areaStyle?: unknown }>
    const zonas = series.flatMap((s) => (s.markArea?.data ?? []) as Array<Array<{ yAxis?: number | string }>>)
    expect(zonas.map(([desde, hasta]) => [desde.yAxis, hasta.yAxis])).toContainEqual([2, 8])
    // Esc. 1 al pie de la letra: zonas rojas por debajo de 2 °C y por encima de
    // 8 °C hasta el borde del eje (sin cambiar la escala), además del trazo.
    expect(zonas.map(([desde, hasta]) => [desde.yAxis, hasta.yAxis])).toEqual(
      expect.arrayContaining([
        [Number.NEGATIVE_INFINITY, 2],
        [8, Number.POSITIVE_INFINITY],
      ]),
    )
    const tramos = series.filter((s) => s.name === 'Refrigerador')
    expect(tramos).toHaveLength(2)
    expect(tramos[1].lineStyle?.color).not.toBe(tramos[0].lineStyle?.color)
    expect(tramos[1].data.filter(([, v]) => v !== null).map(([, v]) => v)).toEqual([8, 9.5, 8])
  })

  it('HU-31: las zonas fuera de 2–8 °C son rojo tenue, sin rótulo, y la franja conserva el suyo', () => {
    const colores = temaGrafica('light')
    const series = construirOpcionCurvaTermica([lectura(0, 5), lectura(30, 6)], ETIQUETAS, undefined, 'light').series as Array<
      Serie & { markArea?: { itemStyle: { color: string }; label: { formatter: string }; data: unknown[] } }
    >
    const marcas = series.find((s) => s.markArea)!.markArea!
    type Extremo = { yAxis: number; itemStyle?: { color: string }; label?: { show: boolean } }
    const [franja, debajo, encima] = marcas.data as Array<[Extremo, Extremo]>
    expect(franja[0].itemStyle).toBeUndefined() // usa la `banda` del markArea
    expect(marcas.itemStyle.color).toBe(colores.banda)
    expect(marcas.label.formatter).toBe('Rango')
    for (const zona of [debajo, encima]) {
      expect(zona[0].itemStyle?.color).toBe(colores.zonaFuera)
      expect(zona[0].label?.show).toBe(false)
    }
    expect(colores.zonaFuera).not.toBe(colores.banda)
    expect(temaGrafica('dark').zonaFuera).not.toBe(colores.zonaFuera)
  })

  it('trazo de registrador: 1,75 px, sin brillo ni área degradada', () => {
    const interna = (construirOpcionCurvaTermica([lectura(0, 5), lectura(30, 6)], ETIQUETAS).series as Array<
      Serie & { lineStyle: { width: number; shadowBlur?: number }; areaStyle?: unknown }
    >)[0]
    expect(interna.lineStyle.width).toBe(1.75)
    expect(interna.lineStyle.shadowBlur).toBeUndefined()
    expect(interna.areaStyle).toBeUndefined()
  })

  it('sin lecturas fuera de rango no añade el trazo carmesí', () => {
    const series = construirOpcionCurvaTermica([lectura(0, 5), lectura(30, 6)], ETIQUETAS).series as Array<{ name: string }>
    expect(series.filter((s) => s.name === 'Refrigerador')).toHaveLength(1)
  })

  it('el tramo fuera de rango empieza y acaba justo en la cota que cruza', () => {
    const datos: Array<[number, number | null]> = [
      [0, 6],
      [10, 10], // cruza 8 °C en x = 5
      [20, 6], // vuelve a cruzarlo en x = 15
      [30, null],
      [40, 1], // empieza fuera tras un hueco
      [50, 11], // salta de bajo 2 a sobre 8 sin pasar por una muestra en rango
    ]
    expect(tramosFueraDeRango(datos)).toEqual([
      [5, 8],
      [10, 10],
      [15, 8],
      [15, null],
      [40, 1],
      [41, 2],
      [41, null],
      [47, 8],
      [50, 11],
    ])
  })

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

  it('con varios equipos no usa el rosa de marca y distingue cada línea por su trazo', () => {
    const intercaladas = Array.from({ length: 8 }, (_, i) => ({
      ...lectura(i * 120, 5),
      device_id: i % 2 === 0 ? 'FARM-01' : 'FARM-02',
    }))
    const series = construirOpcionCurvaTermica(intercaladas, ETIQUETAS, undefined, 'light').series as Array<{
      lineStyle: { color: string; type: string }
    }>
    expect(series.map((s) => s.lineStyle.type)).toEqual(['solid', 'dashed'])
    // Navy y gris de la paleta de gráficas; el rosa de marca (#FF7AA2) no aparece en datos.
    const tema = temaGrafica('light')
    expect(series.map((s) => s.lineStyle.color)).toEqual([tema.primary, tema.secondary])
    expect(series.map((s) => s.lineStyle.color.toUpperCase())).not.toContain('#FF7AA2')
  })

  it('con ventana, el eje termina en «ahora» y descarta lo anterior al inicio', () => {
    const hasta = BASE + 3_600_000
    const serie = [lectura(-60, 5), lectura(0, 5), lectura(3_590, 5)]
    const opcion = construirOpcionCurvaTermica(serie, ETIQUETAS, { desde: BASE, hasta })
    expect(opcion.xAxis).toMatchObject({ type: 'time', min: BASE, max: hasta })
    expect((opcion.series as Serie[])[0].data.filter(([, valor]) => valor !== null)).toHaveLength(2)
  })
})
