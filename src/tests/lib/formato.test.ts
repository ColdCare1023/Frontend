import { describe, expect, it } from 'vitest'

import { fechaHora, fechaISOlocal, hora } from '@/lib/formato'

describe('fechaISOlocal', () => {
  it('usa el día calendario local y rellena mes y día', () => {
    const fecha = new Date(2026, 0, 3, 23, 50)

    expect(fechaISOlocal(fecha)).toBe('2026-01-03')
  })

  it('toma la fecha actual local cuando no se pasa una fecha', () => {
    const ahora = new Date()
    const esperada = [ahora.getFullYear(), String(ahora.getMonth() + 1).padStart(2, '0'), String(ahora.getDate()).padStart(2, '0')].join('-')

    expect(fechaISOlocal()).toBe(esperada)
  })
})

describe('fechaHora y hora', () => {
  it('mantienen la hora unida a «a. m.» para que no se parta en celdas estrechas', () => {
    const texto = fechaHora('2026-10-28T14:50:40Z')

    expect(texto).toMatch(/\d:\d{2}:\d{2}\u00a0[ap]\.\u00a0m\.$/)
    expect(hora('2026-10-28T14:50:40Z')).not.toMatch(/ [ap]\. ?m\./)
  })
})
