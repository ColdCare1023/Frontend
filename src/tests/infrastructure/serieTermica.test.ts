import { describe, expect, it } from 'vitest'

import type { BucketSerie, SerieTermica } from '@/domain/entities/SerieTermica'
import { bucketAutomatico } from '@/domain/entities/SerieTermica'
import { construirOpcionSerieTermica, type EtiquetasSerieTermica } from '@/infrastructure/charts/serieTermica'
import { episodiosDeSerie, resumenDeSeries, resumenPorDiaDeSeries } from '@/lib/resumenSerie'

const ETIQUETAS: EtiquetasSerieTermica = {
  interna: 'Temperatura del refrigerador',
  ambiental: 'Temperatura ambiental',
  rangoEsperado: 'Rango esperado',
  ahora: 'Ahora',
  excursion: 'Excursión confirmada',
  sinDatos: 'Sin datos',
  banda: 'Mín.–máx. del intervalo',
  bufferAgotado: 'Buffer agotado',
  minimo: 'mín.',
  maximo: 'máx.',
  lecturas: 'lecturas',
}

const T0 = Date.parse('2026-11-14T10:00:00Z')

function bucket(minuto: number, min: number, max: number, extra: Partial<BucketSerie> = {}): BucketSerie {
  const inicio = T0 + minuto * 60_000
  const est = { min, max, promedio: (min + max) / 2, n: 6 }
  return {
    inicio: new Date(inicio).toISOString(),
    fin: new Date(inicio + 60_000).toISOString(),
    lecturas: 6,
    temperatura_interna: est,
    temperatura_ambiental: { min: 20, max: 21, promedio: 20.5, n: 6 },
    humedad_ambiental: { min: 60, max: 61, promedio: 60.5, n: 6 },
    fuera_de_rango: max > 8 || min < 2 ? 2 : 0,
    excursiones: 0,
    ...extra,
  }
}

function serie(buckets: BucketSerie[], extra: Partial<SerieTermica> = {}): SerieTermica {
  const n = buckets.reduce((s, b) => s + b.lecturas, 0)
  return {
    device_id: 'FARM-01-CDL',
    desde: new Date(T0).toISOString(),
    hasta: new Date(T0 + 60 * 60_000).toISOString(),
    bucket_segundos: 60,
    bucket_automatico: true,
    intervalo_reporte_segundos: 10,
    umbral_brecha_segundos: 30,
    total_lecturas: n,
    lecturas_sin_hora: 0,
    lecturas_manuales: 0,
    buckets,
    brechas: [],
    resumen: {
      lecturas: n,
      temperatura_interna: { min: Math.min(...buckets.map((b) => b.temperatura_interna.min ?? 99)), max: Math.max(...buckets.map((b) => b.temperatura_interna.max ?? -99)), promedio: 5, n },
      temperatura_ambiental: { min: 20, max: 21, promedio: 20.5, n },
      humedad_ambiental: { min: 60, max: 61, promedio: 60.5, n },
      fuera_de_rango: buckets.reduce((s, b) => s + (b.fuera_de_rango ?? 0), 0),
      excursiones: buckets.reduce((s, b) => s + (b.excursiones ?? 0), 0),
    },
    ...extra,
  }
}

type Serie = { id?: string; name: string; type: string; stack?: string; data: unknown[]; markArea?: { data: unknown[] }; markPoint?: { data: unknown[] } }
const series = (opcion: ReturnType<typeof construirOpcionSerieTermica>) => (opcion as { series: Serie[] }).series

describe('serie agregada (HU-31 / HU-36)', () => {
  it('elige el intervalo automático del backend: 24 h → 1 min, 7 días → 10 min, 30 días → 30 min', () => {
    expect(bucketAutomatico(0, 24 * 3_600_000)).toBe(60)
    expect(bucketAutomatico(0, 7 * 86_400_000)).toBe(600)
    expect(bucketAutomatico(0, 30 * 86_400_000)).toBe(1800)
  })

  it('un equipo: banda mín.–máx. apilada, promedio con la franja 2–8 °C y extremos fuera de rango', () => {
    const opcion = construirOpcionSerieTermica([serie([bucket(0, 4, 5), bucket(1, 5, 9.2), bucket(2, 4, 5)])], ETIQUETAS, { desde: T0, hasta: T0 + 3_600_000 })
    const s = series(opcion)
    const banda = s.filter((x) => x.stack === 'banda-min-max')
    expect(banda.map((x) => x.id)).toEqual(['banda-base', 'banda-alto'])
    // Base = mínimo; alto = máx − mín (el pico de 9,2 °C no se pierde al promediar).
    expect((banda[0].data[1] as number[])[1]).toBe(5)
    expect((banda[1].data[1] as number[])[1]).toBeCloseTo(4.2)
    const promedio = s.find((x) => x.name === ETIQUETAS.interna && x.type === 'line' && x.markArea)!
    expect(promedio.data).toHaveLength(3)
    expect(promedio.data[1]).toMatchObject({ min: 5, max: 9.2, n: 6 })
    const extremos = s.find((x) => x.id === 'extremos-fuera')!
    expect(extremos.data).toEqual([[T0 + 60_000 + 30_000, 9.2]])
    // El eje muestra el periodo consultado entero.
    expect((opcion as { xAxis: { min: number; max: number } }).xAxis).toMatchObject({ min: T0, max: T0 + 3_600_000 })
  })

  it('corta la línea en cada brecha y la sombrea con su causa', () => {
    const conBrecha = serie([bucket(0, 4, 5), bucket(10, 4, 5)], {
      brechas: [{ desde: new Date(T0 + 60_000).toISOString(), hasta: new Date(T0 + 10 * 60_000).toISOString(), duracion_segundos: 540, causa: 'buffer_agotado', perdidas: 54, abierta: false }],
    })
    const s = series(construirOpcionSerieTermica([conBrecha], ETIQUETAS, { desde: T0, hasta: T0 + 3_600_000 }))
    const promedio = s.find((x) => x.name === ETIQUETAS.interna && x.markArea)!
    expect(promedio.data).toHaveLength(3)
    expect((promedio.data[1] as [number, null])[1]).toBeNull()
    const contexto = s.find((x) => x.name === '__contexto')!
    const marca = contexto.markArea!.data[0] as Array<{ label?: { formatter?: string } }>
    expect(marca[0].label?.formatter).toBe('Buffer agotado')
  })

  it('agrupa intervalos consecutivos con excursión confirmada en un episodio con marcador', () => {
    const s = serie([bucket(0, 4, 5), bucket(1, 8.5, 9, { excursiones: 6 }), bucket(2, 8.4, 9.4, { excursiones: 6 }), bucket(3, 4, 5)])
    const episodios = episodiosDeSerie(s)
    expect(episodios).toHaveLength(1)
    expect(episodios[0]).toMatchObject({ inicio: T0 + 60_000, fin: T0 + 3 * 60_000, pico: 9.4, temperaturaInicio: 9 })
    const promedio = series(construirOpcionSerieTermica([s], ETIQUETAS, { desde: T0, hasta: T0 + 3_600_000 })).find((x) => x.markPoint)!
    expect(promedio.markPoint!.data).toHaveLength(1)
  })

  it('varios equipos: una línea por equipo, sin banda', () => {
    const otra = { ...serie([bucket(0, 3, 4)]), device_id: 'FARM-02-CDL' }
    const opcion = construirOpcionSerieTermica([otra, serie([bucket(0, 4, 5)])], ETIQUETAS, { desde: T0, hasta: T0 + 3_600_000 })
    const lineas = series(opcion).filter((x) => x.type === 'line')
    expect(lineas.map((x) => x.name)).toEqual(['FARM-01-CDL', 'FARM-02-CDL'])
    expect(series(opcion).some((x) => x.stack)).toBe(false)
  })

  it('el tooltip muestra promedio, mínimo, máximo y lecturas del intervalo', () => {
    const opcion = construirOpcionSerieTermica([serie([bucket(0, 4, 6)])], ETIQUETAS, { desde: T0, hasta: T0 + 3_600_000 }) as { tooltip: { formatter: (p: unknown) => string } }
    const dato = { value: [T0 + 30_000, 5], min: 4, max: 6, n: 6 }
    const html = opcion.tooltip.formatter([{ axisValue: T0 + 30_000, seriesName: '<b>x</b>', marker: '', data: dato }])
    expect(html).toContain('5.0 °C')
    expect(html).toContain('mín. 4.0 °C · máx. 6.0 °C · 6 lecturas')
    expect(html).toContain('&lt;b&gt;x&lt;/b&gt;')
  })
})

describe('resúmenes de la serie (HU-36)', () => {
  it('el % en rango se pondera por lecturas de todos los equipos y los extremos son exactos', () => {
    const a = serie([bucket(0, 4, 5), bucket(1, 5, 9.2)])
    const b = { ...serie([bucket(0, 1.5, 3)]), device_id: 'FARM-02-CDL' }
    const resumen = resumenDeSeries([a, b])
    expect(resumen.n).toBe(18)
    expect(resumen.min).toBe(1.5)
    expect(resumen.max).toBe(9.2)
    // 4 de 18 lecturas fuera de rango.
    expect(resumen.pctEnRango).toBeCloseTo(14 / 18)
    expect(resumen.equipos.map((e) => e.equipo)).toEqual(['FARM-01-CDL', 'FARM-02-CDL'])
  })

  it('las cabeceras de día suman las lecturas del día completo', () => {
    const dia = resumenPorDiaDeSeries([serie([bucket(0, 4, 5), bucket(1, 5, 9.2, { excursiones: 2 })])])
    const [valor] = [...dia.values()]
    expect(valor).toEqual({ n: 12, min: 4, max: 9.2, excursiones: 1 })
  })
})
