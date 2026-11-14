import { describe, expect, it } from 'vitest'

import { anotarCalibracionVencida, SERIE_CALIBRACION } from '@/infrastructure/charts/calibracionCurva'
import { construirOpcionCurvaTermica } from '@/infrastructure/charts/curvaTermica'
import type { LecturaTermica } from '@/domain/entities/LecturaTermica'

const ETIQUETAS = { interna: 'Interna', ambiental: 'Ambiente', rangoEsperado: '2–8 °C', ahora: 'Ahora', excursion: 'Excursión', sinDatos: 'Sin datos' }
const BASE = Date.UTC(2026, 6, 25, 12, 0, 0)

function lectura(minuto: number): LecturaTermica {
  return {
    id: `l-${minuto}`,
    device_id: 'FARM-01',
    timestamp: new Date(BASE + minuto * 60_000).toISOString(),
    temperatura_ambiental: 20,
    humedad_ambiental: 60,
    temperatura_interna: 5,
    apertura_refrigerador: false,
    duracion_apertura_segundos: 0,
    estado_conectividad: 'online',
    nivel_riesgo: 'normal',
    excursion_confirmada: false,
    riesgo_efectivo: 'normal',
    confianza_ia: null,
    modelo_version: null,
    origen_clasificacion: null,
    estado_inferencia: null,
    motivo_no_inferencia: null,
  }
}

type Serie = { name: string; markArea?: { data: Array<[{ xAxis: number; label: { formatter: string } }, { xAxis: number }]> }; markLine?: { data: Array<{ xAxis: number }> } }

/** HU-30 esc. 3: el tramo medido con el certificado vencido se marca sobre la curva. */
describe('anotarCalibracionVencida', () => {
  const base = construirOpcionCurvaTermica([lectura(0), lectura(30), lectura(60)], ETIQUETAS)

  it('añade el tramo como serie de contexto sin tocar las series de la curva', () => {
    const opcion = anotarCalibracionVencida(base, [{ desde: BASE + 30 * 60_000, hasta: BASE + 60 * 60_000, etiqueta: 'Calibración vencida' }])
    const series = opcion.series as Serie[]
    expect(series.slice(0, -1)).toEqual(base.series)
    const ultima = series.at(-1)!
    expect(ultima.name).toBe(SERIE_CALIBRACION)
    expect(ultima.markArea?.data[0][0]).toMatchObject({ xAxis: BASE + 30 * 60_000, label: { formatter: 'Calibración vencida' } })
    expect(ultima.markArea?.data[0][1]).toEqual({ xAxis: BASE + 60 * 60_000 })
    expect(ultima.markLine?.data).toEqual([{ xAxis: BASE + 30 * 60_000 }])
  })

  it('sin tramos válidos devuelve la opción intacta', () => {
    expect(anotarCalibracionVencida(base, [])).toBe(base)
    expect(anotarCalibracionVencida(base, [{ desde: 10, hasta: 5, etiqueta: 'x' }])).toBe(base)
  })
})
