import { describe, expect, it } from 'vitest'

import { numeroCsv, textoCsv } from '@/lib/csv'

/** FE-010: CWE-1236 sin alterar los números de la evidencia exportada. */
describe('textoCsv', () => {
  it.each([
    ['=1+1', "'=1+1"],
    ['+1', "'+1"],
    ['-1+1', "'-1+1"],
    ['@SUM(A1)', "'@SUM(A1)"],
    ['\t=1+1', "'\t=1+1"],
    ['  =HYPERLINK("x")', `"'  =HYPERLINK(""x"")"`],
    ['＝1+1', "'＝1+1"],
    ['＋1', "'＋1"],
    ['－1', "'－1"],
    ['＠x', "'＠x"],
  ])('neutraliza %j', (entrada, salida) => {
    expect(textoCsv(entrada)).toBe(salida)
  })

  it('un retorno de carro inicial se neutraliza y obliga a entrecomillar', () => {
    expect(textoCsv('\r=1+1')).toBe(`"'\r=1+1"`)
  })

  it('escapa comillas, separador y saltos de línea', () => {
    expect(textoCsv('a"b')).toBe('"a""b"')
    expect(textoCsv('a;b')).toBe('"a;b"')
    expect(textoCsv('a\r\nb')).toBe('"a\r\nb"')
  })

  it('no toca texto normal', () => {
    expect(textoCsv('FARM-01-CDL')).toBe('FARM-01-CDL')
    expect(textoCsv('Puerta cerrada')).toBe('Puerta cerrada')
  })
})

describe('numeroCsv', () => {
  it('conserva los negativos como números', () => {
    expect(numeroCsv(-3.5, 1)).toBe('-3.5')
    expect(numeroCsv(5.04, 1)).toBe('5.0')
  })

  it('deja vacío un dato ausente', () => {
    expect(numeroCsv(null, 1)).toBe('')
    expect(numeroCsv(undefined, 0)).toBe('')
    expect(numeroCsv(Number.NaN, 1)).toBe('')
  })
})
