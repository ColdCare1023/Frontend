import { describe, expect, it } from 'vitest'

import { capturadaConCalibracionVencida, inicioCalibracionVencida, type Dispositivo } from '@/domain/entities/Dispositivo'

const equipo = (fecha_proxima_calibracion: string | null) => ({ fecha_proxima_calibracion, margen_aviso_calibracion_dias: 30 }) as Dispositivo

/** HU-30 esc. 3: desde cuándo una lectura se captura con el certificado vencido. */
describe('inicioCalibracionVencida', () => {
  const hoy = new Date(2026, 10, 14)

  it('es la medianoche local del día siguiente al vencimiento', () => {
    expect(inicioCalibracionVencida(equipo('2026-07-20'), hoy)).toBe(new Date(2026, 6, 21).getTime())
  })

  it('es null con el certificado vigente, por vencer o sin registrar', () => {
    expect(inicioCalibracionVencida(equipo('2027-07-20'), hoy)).toBeNull()
    expect(inicioCalibracionVencida(equipo('2026-11-30'), hoy)).toBeNull()
    expect(inicioCalibracionVencida(equipo(null), hoy)).toBeNull()
  })

  it('el mismo día del vencimiento todavía está vigente', () => {
    expect(inicioCalibracionVencida(equipo('2026-11-14'), hoy)).toBeNull()
  })
})

describe('capturadaConCalibracionVencida', () => {
  const desde = new Date(2026, 6, 21).getTime()

  it('marca solo lo capturado desde el vencimiento', () => {
    expect(capturadaConCalibracionVencida(new Date(desde).toISOString(), desde)).toBe(true)
    expect(capturadaConCalibracionVencida(new Date(desde - 1).toISOString(), desde)).toBe(false)
    expect(capturadaConCalibracionVencida('no-es-fecha', desde)).toBe(false)
    expect(capturadaConCalibracionVencida(new Date(desde).toISOString(), null)).toBe(false)
  })
})
