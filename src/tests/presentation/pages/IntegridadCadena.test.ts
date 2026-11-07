import { describe, expect, it } from 'vitest'

import type { RegistroTrazabilidad, VerificacionIntegridad } from '@/domain/entities/RegistroTrazabilidad'
import { armarCadena, temperaturaDelRegistro, veredictoDe } from '@/presentation/pages/integridad/cadena'

/** Cadena real: cada sello coincide con el anterior. La API entrega primero lo más reciente. */
function cadena(n: number): RegistroTrazabilidad[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `r-${i}`,
    tipo_evento: 'LECTURA_TERMICA',
    device_id: 'FARM-01-CDL',
    usuario_id: null,
    payload: {},
    timestamp: new Date(Date.UTC(2026, 6, 25, i)).toISOString(),
    previous_hash: i === 0 ? '0' : `h-${i - 1}`,
    hash_actual: `h-${i}`,
  })).reverse()
}

const INTEGRA: VerificacionIntegridad = {
  integra: true,
  total_registros: 10,
  primer_registro_inconsistente: null,
  detalle_inconsistencia: null,
  registros_posteriores_afectados: 0,
}

function rota(id: string, timestamp: string, posteriores = 0): VerificacionIntegridad {
  return {
    integra: false,
    total_registros: 10,
    primer_registro_inconsistente: 3,
    detalle_inconsistencia: { id, tipo_evento: 'ALERTA_TERMICA', timestamp, hash_esperado: 'esperado', hash_almacenado: 'almacenado', mensaje: 'x' },
    registros_posteriores_afectados: posteriores,
  }
}

describe('veredictoDe (HU-26)', () => {
  it('sin verificación todavía no hay veredicto', () => {
    expect(veredictoDe(null)).toBe('sin_revisar')
  })
  it('un backend previo solo envía `integra`', () => {
    expect(veredictoDe(INTEGRA)).toBe('integra')
    expect(veredictoDe({ ...INTEGRA, integra: false })).toBe('rota')
  })
  it('respeta el estado cuando llega', () => {
    expect(veredictoDe({ ...INTEGRA, integra: false, estado: 'ruptura_aislada' })).toBe('aislada')
  })
})

describe('armarCadena', () => {
  it('sin revisar: los últimos registros, en orden y sin timbre', () => {
    const eslabones = armarCadena(cadena(8), null)
    expect(eslabones.map((e) => e.id)).toEqual(['r-3', 'r-4', 'r-5', 'r-6', 'r-7'])
    expect(eslabones.every((e) => e.estado === 'pendiente')).toBe(true)
    expect(eslabones.map((e) => e.enlace)).toEqual(['inicio', 'unido', 'unido', 'unido', 'unido'])
  })

  it('íntegra: todos coinciden', () => {
    expect(armarCadena(cadena(3), INTEGRA).every((e) => e.estado === 'coincide')).toBe(true)
  })

  it('rota: rodea al registro alterado y marca lo anterior y lo posterior', () => {
    const eslabones = armarCadena(cadena(10), rota('r-5', new Date(Date.UTC(2026, 6, 25, 5)).toISOString()))
    expect(eslabones.map((e) => [e.id, e.estado])).toEqual([
      ['r-3', 'coincide'],
      ['r-4', 'coincide'],
      ['r-5', 'no_coincide'],
      ['r-6', 'afectado'],
      ['r-7', 'afectado'],
    ])
    expect(eslabones[2].hash).toBe('almacenado')
    expect(eslabones[2].hashEsperado).toBe('esperado')
    expect(eslabones.map((e) => e.enlace)).toEqual(['inicio', 'unido', 'unido', 'roto', 'unido'])
  })

  it('dibuja el registro alterado aunque no esté entre los cargados y cuenta lo que no se muestra', () => {
    const eslabones = armarCadena(cadena(6), rota('viejo', '2026-07-24T00:00:00Z', 20))
    expect(eslabones[0]).toMatchObject({ id: 'viejo', estado: 'no_coincide', hash: 'almacenado', hashEsperado: 'esperado' })
    expect(eslabones[1]).toMatchObject({ id: 'r-0', estado: 'afectado', enlace: 'roto', saltados: 14 })
    expect(eslabones).toHaveLength(5)
  })

  it('una ruptura aislada solo da por buenos los registros desde que la cadena es íntegra', () => {
    const eslabones = armarCadena(cadena(5), {
      ...INTEGRA,
      integra: false,
      estado: 'ruptura_aislada',
      integra_desde: new Date(Date.UTC(2026, 6, 25, 3)).toISOString(),
    })
    expect(eslabones.map((e) => e.estado)).toEqual(['pendiente', 'pendiente', 'pendiente', 'coincide', 'coincide'])
  })

  it('no une con un eslabón registros que no son consecutivos (lista filtrada)', () => {
    const [a, , c] = cadena(3)
    expect(armarCadena([a, c], null).map((e) => e.enlace)).toEqual(['inicio', 'hueco'])
  })

  it('sin registros no hay cadena', () => {
    expect(armarCadena([], null)).toEqual([])
  })
})

describe('temperaturaDelRegistro', () => {
  it('solo acepta una cifra real', () => {
    expect(temperaturaDelRegistro({ temperatura_interna: 4.7 })).toBe(4.7)
    expect(temperaturaDelRegistro({ temperatura_interna: null })).toBeNull()
    expect(temperaturaDelRegistro({ temperatura_interna: '4.7' })).toBeNull()
    expect(temperaturaDelRegistro({})).toBeNull()
  })
})
