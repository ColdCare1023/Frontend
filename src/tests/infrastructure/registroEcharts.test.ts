import { afterEach, describe, expect, it, vi } from 'vitest'
import * as echarts from 'echarts/core'
import { SVGRenderer } from 'echarts/renderers'

// Efecto lateral: registra los módulos de ECharts con los que se dibuja en producción.
import '@/infrastructure/charts/EChartWrapper'
import { anotarCalibracionVencida } from '@/infrastructure/charts/calibracionCurva'
import { construirOpcionSerieTermica, type EtiquetasSerieTermica } from '@/infrastructure/charts/serieTermica'
import type { BucketSerie, SerieTermica } from '@/domain/entities/SerieTermica'

/**
 * Las pruebas de las páginas sustituyen `EChartWrapper` por un doble, así que
 * nunca ejecutan `setOption` con el registro real de módulos. Una serie de un
 * tipo no registrado no se crea y, con marcadores presentes, `setOption` lanza
 * «Cannot read properties of undefined (reading 'get')»: Historial caía entero
 * al límite de error en cuanto un intervalo salía de 2–8 °C (serie `scatter`
 * `extremos-fuera`, 22/11/2026). Aquí se dibujan las opciones reales en SSR.
 */
echarts.use([SVGRenderer])

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

const T0 = Date.parse('2026-11-22T04:00:00Z')
const VENTANA = { desde: T0, hasta: T0 + 60 * 60_000 }

function bucket(minuto: number, min: number, max: number): BucketSerie {
  const inicio = T0 + minuto * 60_000
  return {
    inicio: new Date(inicio).toISOString(),
    fin: new Date(inicio + 60_000).toISOString(),
    lecturas: 6,
    temperatura_interna: { min, max, promedio: (min + max) / 2, n: 6 },
    temperatura_ambiental: { min: 28, max: 29, promedio: 28.5, n: 6 },
    humedad_ambiental: { min: 73, max: 74, promedio: 73.5, n: 6 },
    fuera_de_rango: max > 8 || min < 2 ? 6 : 0,
    excursiones: max > 8 || min < 2 ? 6 : 0,
  }
}

function serie(deviceId: string, buckets: BucketSerie[]): SerieTermica {
  const n = buckets.reduce((s, b) => s + b.lecturas, 0)
  const fuera = buckets.reduce((s, b) => s + (b.fuera_de_rango ?? 0), 0)
  return {
    device_id: deviceId,
    desde: new Date(VENTANA.desde).toISOString(),
    hasta: new Date(VENTANA.hasta).toISOString(),
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
      temperatura_interna: { min: -5.25, max: 28.06, promedio: 22.6, n },
      temperatura_ambiental: { min: 28, max: 29, promedio: 28.5, n },
      humedad_ambiental: { min: 73, max: 74, promedio: 73.5, n },
      fuera_de_rango: fuera,
      excursiones: fuera,
    },
  } as SerieTermica
}

/** Sonda fuera del refrigerador (~27 °C), luego en el congelador y por último en rango. */
const FUERA_DE_RANGO = [
  ...Array.from({ length: 20 }, (_, i) => bucket(i, 27.4, 27.9)),
  ...Array.from({ length: 10 }, (_, i) => bucket(20 + i, -5.25, -4)),
  ...Array.from({ length: 10 }, (_, i) => bucket(30 + i, 4, 5)),
]

const graficas: echarts.ECharts[] = []

function dibujar(opcion: Parameters<echarts.ECharts['setOption']>[0]) {
  const grafica = echarts.init(null, null, { renderer: 'svg', ssr: true, width: 640, height: 280 })
  graficas.push(grafica)
  // Las mismas opciones de setOption que EChartWrapper.
  grafica.setOption(opcion, { replaceMerge: ['series'] })
  return grafica
}

afterEach(() => {
  graficas.splice(0).forEach((g) => g.dispose())
  vi.restoreAllMocks()
})

describe('registro de módulos de ECharts', () => {
  it('Historial dibuja la curva con extremos fuera de rango sin lanzar', () => {
    const avisos = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const opcion = construirOpcionSerieTermica([serie('ESP32_FARMACIA_01', FUERA_DE_RANGO)], ETIQUETAS, VENTANA)
    const tipos = new Set((opcion.series as Array<{ type: string }>).map((s) => s.type))
    expect(tipos.has('scatter')).toBe(true)

    expect(() => dibujar(opcion)).not.toThrow()
    expect(avisos.mock.calls.flat().join(' ')).not.toMatch(/is used but not imported/)
  })

  it('con calibración vencida y varios equipos también dibuja', () => {
    const avisos = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const unEquipo = anotarCalibracionVencida(
      construirOpcionSerieTermica([serie('ESP32_FARMACIA_01', FUERA_DE_RANGO)], ETIQUETAS, VENTANA),
      [{ desde: T0 + 10 * 60_000, hasta: VENTANA.hasta, etiqueta: 'Calibración vencida' }],
    )
    const variosEquipos = construirOpcionSerieTermica(
      [serie('ESP32_FARMACIA_01', FUERA_DE_RANGO), serie('ESP32_FARMACIA_02', FUERA_DE_RANGO)],
      ETIQUETAS,
      VENTANA,
    )

    expect(() => dibujar(unEquipo)).not.toThrow()
    expect(() => dibujar(variosEquipos)).not.toThrow()
    expect(avisos.mock.calls.flat().join(' ')).not.toMatch(/is used but not imported/)
  })
})
