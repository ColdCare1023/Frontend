import { describe, expect, it } from 'vitest'

import type { LecturaTermica } from '@/domain/entities/LecturaTermica'
import {
  agruparPorDia,
  cintaDelDia,
  dentroDeVentana,
  duracionTexto,
  filtrosDeAtajo,
  fueraDelRango,
  resumir,
  resumirPeriodo,
  salidasDeRango,
  ventanaDe,
} from '@/presentation/pages/historial/agrupar'

function lectura(hora: string, over: Partial<LecturaTermica> = {}): LecturaTermica {
  return {
    id: hora,
    device_id: 'FARM-01-CDL',
    timestamp: new Date(hora).toISOString(),
    temperatura_ambiental: 20,
    humedad_ambiental: 60,
    temperatura_interna: 5,
    apertura_refrigerador: false,
    duracion_apertura_segundos: null,
    estado_conectividad: 'online',
    nivel_riesgo: 'normal',
    confianza_ia: null,
    modelo_version: null,
    origen_clasificacion: null,
    estado_inferencia: null,
    motivo_no_inferencia: null,
    excursion_confirmada: false,
    riesgo_efectivo: 'normal',
    ...over,
  }
}

describe('agruparPorDia', () => {
  it('agrupa por día local y conserva el orden recibido', () => {
    const dias = agruparPorDia([lectura('2026-07-25T10:00:00'), lectura('2026-07-25T08:00:00'), lectura('2026-07-24T23:30:00')])
    expect(dias.map((d) => [d.clave, d.lecturas.length])).toEqual([
      ['2026-07-25', 2],
      ['2026-07-24', 1],
    ])
  })
})

describe('resumir', () => {
  it('calcula mínimo, máximo y excursiones confirmadas', () => {
    expect(
      resumir([
        lectura('2026-07-25T10:00:00', { temperatura_interna: 3.2 }),
        lectura('2026-07-25T11:00:00', { temperatura_interna: 9.1, excursion_confirmada: true }),
      ]),
    ).toEqual({ total: 2, minima: 3.2, maxima: 9.1, fueraDeRango: 1 })
  })

  it('una lectura sin temperatura cuenta como lectura, no como cero grados', () => {
    expect(resumir([lectura('2026-07-25T10:00:00', { temperatura_interna: null })])).toEqual({ total: 1, minima: null, maxima: null, fueraDeRango: 0 })
  })

  it('el riesgo crudo de la IA no cuenta como fuera de rango (HU-34)', () => {
    expect(resumir([lectura('2026-07-25T10:00:00', { nivel_riesgo: 'excursion_critica' })]).fueraDeRango).toBe(0)
  })
})

describe('cintaDelDia', () => {
  it('un tramo sin lecturas queda vacío, no se pinta como normal', () => {
    const cinta = cintaDelDia([lectura('2026-07-25T00:10:00')], 48)
    expect(cinta[0]).toBe('normal')
    expect(cinta.slice(1).every((tramo) => tramo === null)).toBe(true)
  })

  it('cada tramo lleva el riesgo más grave que tuvo', () => {
    const cinta = cintaDelDia(
      [
        lectura('2026-07-25T12:01:00'),
        lectura('2026-07-25T12:10:00', { riesgo_efectivo: 'excursion_critica' }),
        lectura('2026-07-25T12:20:00', { riesgo_efectivo: 'riesgo_preventivo' }),
      ],
      48,
    )
    expect(cinta[24]).toBe('excursion_critica')
  })

  it('una lectura sin clasificar se distingue de una normal', () => {
    expect(cintaDelDia([lectura('2026-07-25T00:10:00', { riesgo_efectivo: null })], 48)[0]).toBe('sin_clasificar')
  })
})

const HORA = 60 * 60 * 1000

describe('fueraDelRango', () => {
  it('cuenta la regla confirmada y la cifra fuera de 2–8 °C, nunca la clase cruda de la IA', () => {
    expect(fueraDelRango(lectura('2026-07-25T10:00:00', { excursion_confirmada: true }))).toBe(true)
    expect(fueraDelRango(lectura('2026-07-25T10:00:00', { temperatura_interna: 8.4 }))).toBe(true)
    expect(fueraDelRango(lectura('2026-07-25T10:00:00', { temperatura_interna: 1.8 }))).toBe(true)
    expect(fueraDelRango(lectura('2026-07-25T10:00:00', { temperatura_interna: 8 }))).toBe(false)
    expect(fueraDelRango(lectura('2026-07-25T10:00:00', { nivel_riesgo: 'excursion_critica' }))).toBe(false)
    expect(fueraDelRango(lectura('2026-07-25T10:00:00', { temperatura_interna: null }))).toBe(false)
  })
})

describe('salidasDeRango', () => {
  const fuera = (hora: string, over: Partial<LecturaTermica> = {}) => lectura(hora, { temperatura_interna: 9, excursion_confirmada: true, ...over })

  it('une lecturas seguidas fuera del rango y corta al volver a él, por equipo y empezando por la más reciente', () => {
    const salidas = salidasDeRango([
      fuera('2026-07-25T10:00:00'),
      fuera('2026-07-25T10:10:00', { temperatura_interna: 9.8, apertura_refrigerador: true }),
      lectura('2026-07-25T10:20:00'),
      fuera('2026-07-25T10:30:00', { temperatura_interna: 1.5 }),
      fuera('2026-07-25T10:10:00', { device_id: 'FARM-02-CDL' }),
    ])
    // 10:30 en FARM-01, 10:10 en FARM-02 y la de 10:00 en FARM-01, que duró dos lecturas.
    expect(salidas.map((s) => [s.device_id, s.lecturas.length])).toEqual([
      ['FARM-01-CDL', 1],
      ['FARM-02-CDL', 1],
      ['FARM-01-CDL', 2],
    ])
    const primera = salidas[2]
    expect(primera.inicio).toBe(new Date('2026-07-25T10:00:00').toISOString())
    expect(primera.fin).toBe(new Date('2026-07-25T10:10:00').toISOString())
    expect(primera.extremo).toBe(9.8)
    expect(primera.puertaAbierta).toBe(true)
    // La más alejada del rango, también por debajo: 1.5 °C.
    expect(salidas[0].extremo).toBe(1.5)
    expect(salidas[0].hastaLaUltima).toBe(true)
  })

  it('un hueco sin lecturas corta la salida, como corta la curva', () => {
    const salidas = salidasDeRango([
      fuera('2026-07-25T10:00:00'),
      fuera('2026-07-25T10:10:00'),
      fuera('2026-07-25T10:20:00'),
      fuera('2026-07-25T14:00:00'),
    ])
    expect(salidas).toHaveLength(2)
  })
})

describe('resumirPeriodo', () => {
  const ahora = Date.parse('2026-07-25T12:00:00')
  const ventana = { inicio: ahora - 24 * HORA, fin: null }
  const cada10min = (desde: number, cuantas: number, over: (i: number) => Partial<LecturaTermica> = () => ({})) =>
    Array.from({ length: cuantas }, (_, i) => lectura(new Date(desde + i * 10 * 60_000).toISOString(), over(i)))

  it('todo dentro y cubierto: sin desde parcial ni huecos', () => {
    const lecturas = cada10min(ventana.inicio + 60_000, 144)
    expect(resumirPeriodo(lecturas, lecturas, ventana, ahora)).toEqual({ tipo: 'dentro', desdeParcial: null, huecoMs: 0 })
  })

  it('si lo cargado empieza tarde, dice desde cuándo', () => {
    const lecturas = cada10min(ahora - 3 * HORA, 18)
    const resumen = resumirPeriodo(lecturas, lecturas, ventana, ahora)
    expect(resumen).toMatchObject({ tipo: 'dentro', desdeParcial: new Date(ahora - 3 * HORA).toISOString() })
  })

  it('mide el hueco más largo de un mismo equipo, también el que llega hasta ahora', () => {
    const lecturas = cada10min(ventana.inicio + 60_000, 120)
    const resumen = resumirPeriodo(lecturas, lecturas, ventana, ahora)
    // Lo último llegó hace unas 4 horas.
    expect(resumen.tipo).toBe('dentro')
    expect(resumen.tipo === 'dentro' && resumen.huecoMs).toBeGreaterThanOrEqual(3.9 * HORA)
  })

  it('una salida que sigue hasta la última lectura se da como en curso', () => {
    const lecturas = cada10min(ventana.inicio + 60_000, 144, (i) => (i >= 140 ? { temperatura_interna: 9.2, excursion_confirmada: true } : {}))
    const resumen = resumirPeriodo(lecturas, lecturas, ventana, ahora)
    expect(resumen.tipo).toBe('fuera')
    expect(resumen.tipo === 'fuera' && resumen.enCurso?.lecturas).toHaveLength(4)
  })

  it('sin lecturas en la ventana, recuerda cuándo llegó la última', () => {
    const vieja = lectura('2026-07-20T08:00:00')
    expect(resumirPeriodo([vieja], [], ventana, ahora)).toEqual({ tipo: 'sin_lecturas', ultima: vieja.timestamp })
  })
})

describe('periodos', () => {
  it('«Ayer» pide de las 00:00 de ayer a las 00:00 de hoy, y la ventana deja fuera ese instante', () => {
    const ahora = new Date('2026-07-25T09:30:00')
    const filtros = filtrosDeAtajo('ayer', ahora)
    expect(filtros).toEqual({ desde: '2026-07-24T00:00', hasta: '2026-07-25T00:00' })
    const ventana = ventanaDe('ayer', filtros, ahora.getTime())
    const lecturas = [lectura('2026-07-24T23:59:30'), lectura('2026-07-25T00:00:00'), lectura('2026-07-23T23:59:00')]
    expect(dentroDeVentana(lecturas, ventana).map((l) => l.id)).toEqual(['2026-07-24T23:59:30'])
  })

  it('«7 días» empieza a las 00:00 de hace seis días; «24 horas» no filtra en el backend', () => {
    const ahora = new Date('2026-07-25T09:30:00')
    expect(filtrosDeAtajo('7d', ahora)).toEqual({ desde: '2026-07-19T00:00' })
    expect(filtrosDeAtajo('24h', ahora)).toEqual({})
    expect(ventanaDe('24h', {}, ahora.getTime())).toEqual({ inicio: ahora.getTime() - 24 * HORA, fin: null })
  })

  it('las duraciones se dicen en minutos y horas', () => {
    expect(duracionTexto(30 * 60_000)).toBe('30 min')
    expect(duracionTexto(3 * HORA)).toBe('3 h')
    expect(duracionTexto(3 * HORA + 10 * 60_000)).toBe('3 h 10 min')
  })
})
