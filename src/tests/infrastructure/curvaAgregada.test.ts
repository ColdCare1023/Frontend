import { describe, expect, it } from 'vitest'

import type { LecturaTermica } from '@/domain/entities/LecturaTermica'
import {
  construirOpcionCurvaAgregada,
  hayCorte,
  puntosCurvaAgregada,
  type PuntoCurva,
} from '@/infrastructure/charts/curvaAgregada'
import { serieTermicaDemo } from '@/infrastructure/demo/serieDemo'

/**
 * HU-31 (P0-2 de la auditoría): «24 h a 10 s y 7 d a 30 s deben dibujarse
 * completas». Con lecturas crudas el dashboard pedía 5000 filas: a 10 s eso
 * son ~13,9 h y la curva de 24 h quedaba sin su primera mitad. La serie
 * agregada (aquí calculada con el mismo criterio que el backend) cubre todo.
 */
const AHORA = Date.parse('2026-11-14T12:00:00Z')
const HORA = 3_600_000
const ETIQUETAS = {
  interna: 'Temperatura del refrigerador',
  ambiental: 'Temperatura ambiental',
  rangoEsperado: 'Rango esperado',
  ahora: 'Ahora',
  excursion: 'Excursión confirmada',
  sinDatos: 'Sin datos',
  bufferAgotado: 'Buffer lleno',
}

function lectura(ms: number, temperatura = 5, over: Partial<LecturaTermica> = {}): LecturaTermica {
  return {
    id: `l-${ms}`,
    device_id: 'FARM-01',
    timestamp: new Date(ms).toISOString(),
    temperatura_ambiental: 22,
    humedad_ambiental: 60,
    temperatura_interna: temperatura,
    apertura_refrigerador: false,
    duracion_apertura_segundos: 0,
    estado_conectividad: 'online',
    nivel_riesgo: 'normal',
    confianza_ia: 0.9,
    modelo_version: '4',
    origen_clasificacion: 'random_forest',
    estado_inferencia: 'completada',
    motivo_no_inferencia: null,
    excursion_confirmada: temperatura < 2 || temperatura > 8,
    riesgo_efectivo: temperatura < 2 || temperatura > 8 ? 'excursion_critica' : 'normal',
    ...over,
  }
}

/** Una lectura cada `segundos` durante las `horas` que terminan en AHORA. */
function lecturasCada(segundos: number, horas: number, temperatura: (ms: number) => number = () => 5): LecturaTermica[] {
  const total = Math.floor((horas * HORA) / (segundos * 1000))
  return Array.from({ length: total }, (_, i) => {
    const ms = AHORA - (total - 1 - i) * segundos * 1000
    return lectura(ms, temperatura(ms))
  })
}

type SerieOpcion = { name: string; data: Array<[number, number | null]>; stack?: string; z?: number; areaStyle?: unknown; markArea?: { data: unknown[] }; markPoint?: { data: unknown[] } }

function curva(lecturas: LecturaTermica[], horas: number, extra: Partial<Parameters<typeof serieTermicaDemo>[0]> = {}, enVivo: LecturaTermica[] = []) {
  const ventana = { desde: AHORA - horas * HORA, hasta: AHORA }
  const serie = serieTermicaDemo({
    lecturas,
    deviceId: 'FARM-01',
    desde: ventana.desde,
    hasta: ventana.hasta,
    bucket: 'auto',
    intervaloReporteSegundos: 10,
    ...extra,
  })
  const puntos = puntosCurvaAgregada(serie, enVivo)
  const opcion = construirOpcionCurvaAgregada(puntos, serie, ETIQUETAS, { desde: ventana.desde, hasta: AHORA + 60_000 })
  const series = (opcion as { series: SerieOpcion[] }).series
  return { serie, puntos, series, ventana }
}

const conValor = (datos: Array<[number, number | null]>) => datos.filter(([, v]) => v !== null)

describe('HU-31: la curva agregada cubre la ventana completa', () => {
  it('24 h a 10 s (8640 lecturas): de un extremo al otro, en ≤ 1500 puntos', () => {
    const lecturas = lecturasCada(10, 24)
    expect(lecturas).toHaveLength(8640)
    const { serie, series, ventana } = curva(lecturas, 24)

    expect(serie.bucket_segundos).toBe(60)
    expect(serie.total_lecturas).toBe(8640)
    const linea = conValor(series[0].data)
    expect(linea.length).toBeLessThanOrEqual(1500)
    // El primer punto está en el primer minuto de la ventana y el último en el
    // último: con 5000 lecturas crudas la curva empezaba ~13,9 h atrás.
    expect(linea[0][0] - ventana.desde).toBeLessThanOrEqual(60_000)
    expect(ventana.hasta - linea.at(-1)![0]).toBeLessThanOrEqual(60_000)
    const cobertura = linea.at(-1)![0] - linea[0][0]
    expect(cobertura).toBeGreaterThan(23.9 * HORA)
    expect(5000 * 10_000).toBeLessThan(cobertura) // lo que cubría el tope anterior
  })

  it('7 d a 30 s (20 160 lecturas): la semana entera en intervalos de 10 min', () => {
    const lecturas = lecturasCada(30, 24 * 7)
    expect(lecturas).toHaveLength(20_160)
    const { serie, series, ventana } = curva(lecturas, 24 * 7, { intervaloReporteSegundos: 30 })

    expect(serie.bucket_segundos).toBe(600)
    expect(serie.brechas).toEqual([])
    const linea = conValor(series[0].data)
    expect(linea.length).toBeLessThanOrEqual(1500)
    expect(linea[0][0] - ventana.desde).toBeLessThanOrEqual(600_000)
    expect(ventana.hasta - linea.at(-1)![0]).toBeLessThanOrEqual(600_000)
    // Sin brechas, la línea no se corta.
    expect(series[0].data.some(([, v]) => v === null)).toBe(false)
  })
})

describe('HU-31 esc. 3: el promedio no esconde un pico', () => {
  it('la franja mín.–máx. conserva el pico y lo pinta en carmesí', () => {
    const pico = AHORA - 2 * HORA + 10_000
    const lecturas = lecturasCada(10, 24, (ms) => (ms === pico ? 9.4 : 5))
    expect(lecturas.some((l) => l.temperatura_interna === 9.4)).toBe(true)
    const { series } = curva(lecturas, 24)

    const promedio = series[0]
    // El promedio del minuto del pico queda dentro de 2–8 °C…
    expect(Math.max(...conValor(promedio.data).map(([, v]) => v as number))).toBeLessThan(8)
    // …pero la franja apilada (mínimo + amplitud) llega a 9,4 °C.
    const [minimo, amplitud] = series.filter((s) => s.stack === '__envolvente')
    expect(minimo.name).toBe(ETIQUETAS.interna)
    const i = amplitud.data.findIndex(([, v]) => v !== null && v > 4)
    expect((minimo.data[i][1] as number) + (amplitud.data[i][1] as number)).toBeCloseTo(9.4, 5)
    // Hay un trazo carmesí (z 3) con el mismo nombre que la línea, y el
    // episodio lleva su marcador de inicio.
    const fuera = series.filter((s) => s.z === 3 && s.name === ETIQUETAS.interna)
    expect(fuera.length).toBeGreaterThan(0)
    expect(fuera.some((s) => s.data.some(([, v]) => v === 9.4))).toBe(true)
    expect(promedio.markPoint?.data).toHaveLength(1)
  })
})

describe('HU-31/HU-48: tramos sin datos con su causa', () => {
  it('un silencio corta la línea y se rotula «Sin datos»', () => {
    const lecturas = lecturasCada(10, 24).filter((l) => {
      const ms = Date.parse(l.timestamp)
      return ms < AHORA - 6 * HORA || ms > AHORA - 5 * HORA
    })
    const { serie, series } = curva(lecturas, 24)

    expect(serie.brechas).toHaveLength(1)
    expect(serie.brechas[0].causa).toBe('sin_datos')
    expect(series[0].data.filter(([, v]) => v === null)).toHaveLength(1)
    const contexto = series.find((s) => s.name === '__contexto')!
    const etiquetas = (contexto.markArea!.data as Array<[{ label: { formatter: string } }, unknown]>).map(([a]) => a.label.formatter)
    expect(etiquetas).toContain('Sin datos')
  })

  it('una brecha por buffer lleno se rotula como tal (HU-48 esc. 2)', () => {
    const lecturas = lecturasCada(10, 24).filter((l) => {
      const ms = Date.parse(l.timestamp)
      return ms < AHORA - 4 * HORA || ms > AHORA - 3 * HORA
    })
    const { series } = curva(lecturas, 24, {
      brechasBuffer: [
        {
          desde: new Date(AHORA - 4 * HORA).toISOString(),
          hasta: new Date(AHORA - 3 * HORA).toISOString(),
          muestras_perdidas: 360,
          perdidas: 360,
          causa: 'buffer_agotado',
          registrada_en: new Date(AHORA - 3 * HORA).toISOString(),
        },
      ],
    })
    const contexto = series.find((s) => s.name === '__contexto')!
    const etiquetas = (contexto.markArea!.data as Array<[{ label?: { formatter: string } }, unknown]>).map(([a]) => a.label?.formatter)
    expect(etiquetas).toContain('Buffer lleno')
    expect(etiquetas).not.toContain('Sin datos')
  })

  it('una brecha breve dentro de un intervalo largo no parte la línea', () => {
    const a = { x: 0, inicio: -300_000, fin: 300_000 } as PuntoCurva
    const b = { x: 600_000, inicio: 300_000, fin: 900_000 } as PuntoCurva
    expect(hayCorte(a, b, 90_000, [{ desde: 100_000, hasta: 200_000 }])).toBe(false)
    expect(hayCorte(a, b, 90_000, [{ desde: 100_000, hasta: 500_000 }])).toBe(true)
    // Un intervalo vacío entre ambos, mayor que el umbral, sí corta.
    expect(hayCorte(a, { ...b, inicio: 500_000, x: 800_000 }, 90_000, [])).toBe(true)
  })
})

describe('HU-31: lecturas en vivo y sin hora', () => {
  it('añade las lecturas posteriores a la serie y omite las que ya contiene', () => {
    const lecturas = lecturasCada(10, 24)
    const nueva = lectura(AHORA + 20_000, 6.2)
    const repetida = lecturas.at(-1)!
    const { puntos } = curva(lecturas, 24, {}, [repetida, nueva])
    expect(puntos.at(-1)?.lectura).toBe(nueva)
    expect(puntos.filter((p) => p.lectura)).toHaveLength(1)
  })

  it('HU-07: una lectura sin hora se cuenta aparte y no se dibuja', () => {
    const lecturas = [...lecturasCada(10, 1), lectura(AHORA - 1000, 5, { time_quality: 'unsynced', sin_hora: true })]
    const { serie, puntos } = curva(lecturas, 24, {}, [lectura(AHORA + 5000, 5, { sin_hora: true, time_quality: 'unsynced' })])
    expect(serie.lecturas_sin_hora).toBe(1)
    expect(serie.total_lecturas).toBe(360)
    expect(puntos.some((p) => p.lectura)).toBe(false)
  })
})

describe('HU-31: eje temporal de 7 d', () => {
  it('rotula días en vez de repetir la misma hora', () => {
    const ventana = { desde: AHORA - 7 * 24 * HORA, hasta: AHORA }
    const serie = serieTermicaDemo({ lecturas: lecturasCada(600, 24 * 7), deviceId: 'FARM-01', ...ventana, bucket: 'auto', intervaloReporteSegundos: 600 })
    const semana = construirOpcionCurvaAgregada(puntosCurvaAgregada(serie), serie, ETIQUETAS, ventana) as {
      xAxis: { axisLabel: { formatter: (v: number) => string } }
    }
    const dia = construirOpcionCurvaAgregada([], serie, ETIQUETAS, { desde: AHORA - 24 * HORA, hasta: AHORA }) as typeof semana
    const medianoche = Date.parse('2026-11-12T05:00:00Z')
    expect(semana.xAxis.axisLabel.formatter(medianoche)).not.toBe(semana.xAxis.axisLabel.formatter(medianoche + 24 * HORA))
    expect(dia.xAxis.axisLabel.formatter(medianoche)).toBe(dia.xAxis.axisLabel.formatter(medianoche + 24 * HORA))
  })
})
