import { describe, expect, it } from 'vitest'

import { cadenaDeEnlace, enlaceVerificarCadena, PARAMETRO_CADENA } from '@/lib/enlaceCadena'

/** HU-28: de la Cronología de una alerta a la cadena de su equipo en Trazabilidad. */
describe('enlace a la cadena de un equipo', () => {
  it('lleva a /trazabilidad con la cadena del equipo en ?cadena=', () => {
    expect(PARAMETRO_CADENA).toBe('cadena')
    expect(enlaceVerificarCadena('FARM-01-CDL')).toBe('/trazabilidad?cadena=FARM-01-CDL')
  })

  it('codifica el identificador: no puede añadir otros parámetros a la URL', () => {
    const enlace = enlaceVerificarCadena('FARM 01&tipo_evento=AUDITORIA')
    const parametros = new URLSearchParams(enlace.split('?')[1])
    expect([...parametros.keys()]).toEqual(['cadena'])
    expect(parametros.get('cadena')).toBe('FARM 01&tipo_evento=AUDITORIA')
  })
})

describe('cadena pedida por la URL', () => {
  const cadenas = [
    { chain_id: 'FARM-01-CDL', es_sistema: false, total_registros: 340 },
    { chain_id: 'SISTEMA', es_sistema: true, total_registros: 12 },
  ]

  it('acepta una cadena que existe', () => {
    expect(cadenaDeEnlace('FARM-01-CDL', cadenas)).toBe('FARM-01-CDL')
    expect(cadenaDeEnlace('SISTEMA', cadenas)).toBe('SISTEMA')
  })

  it('ignora valores vacíos, desconocidos o con otra forma', () => {
    expect(cadenaDeEnlace(null, cadenas)).toBeNull()
    expect(cadenaDeEnlace('', cadenas)).toBeNull()
    expect(cadenaDeEnlace('FARM-99-XXX', cadenas)).toBeNull()
    expect(cadenaDeEnlace(' FARM-01-CDL', cadenas)).toBeNull()
    expect(cadenaDeEnlace('farm-01-cdl', cadenas)).toBeNull()
  })

  it('sin la lista de cadenas (aún cargando o backend anterior) no preselecciona nada', () => {
    expect(cadenaDeEnlace('FARM-01-CDL', [])).toBeNull()
  })
})
