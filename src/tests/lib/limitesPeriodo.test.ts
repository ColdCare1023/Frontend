import { describe, expect, it } from 'vitest'

import { instanteDelPeriodo } from '@/lib/limitesPeriodo'

/** HU-37 esc. 1: extremos del rango temporal de la verificación por periodo. */
describe('instanteDelPeriodo', () => {
  it('sin hora: el inicio a las 00:00 y el fin al último milisegundo del día', () => {
    expect(instanteDelPeriodo('2026-07-25', '', 'inicio')).toEqual(new Date(2026, 6, 25, 0, 0, 0, 0))
    expect(instanteDelPeriodo('2026-07-25', '', 'fin')).toEqual(new Date(2026, 6, 25, 23, 59, 59, 999))
  })

  it('con hora: el inicio en ese minuto y el fin incluye el minuto entero', () => {
    expect(instanteDelPeriodo('2026-07-25', '08:30', 'inicio')).toEqual(new Date(2026, 6, 25, 8, 30, 0, 0))
    expect(instanteDelPeriodo('2026-07-25', '10:15', 'fin')).toEqual(new Date(2026, 6, 25, 10, 15, 59, 999))
  })

  it.each([
    ['', '', 'inicio'],
    ['25/07/2026', '', 'inicio'],
    ['2026-02-31', '', 'inicio'],
    ['2026-07-25', '24:00', 'fin'],
    ['2026-07-25', '8:3', 'inicio'],
  ] as const)('rechaza %s %s', (fecha, hora, extremo) => {
    expect(instanteDelPeriodo(fecha, hora, extremo)).toBeNull()
  })
})
