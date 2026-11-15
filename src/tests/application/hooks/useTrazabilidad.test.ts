import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { useTrazabilidad } from '@/application/hooks/useTrazabilidad'
import { instalarAdaptadorFalso } from '../../ayudas'
import { existeRuta } from '../../contrato/validarOpenApi'

describe('useTrazabilidad — HU-26: verificación de una cadena por chain_id', () => {
  let adaptador: ReturnType<typeof instalarAdaptadorFalso>
  afterEach(() => adaptador?.restaurar())

  it('carga las cadenas y envía el chain_id elegido a /verificar', async () => {
    adaptador = instalarAdaptadorFalso((config) => {
      if (config.url === '/api/trazabilidad/cadenas') return { data: [{ chain_id: 'SISTEMA', es_sistema: true, total_registros: 3 }] }
      if (config.url === '/api/trazabilidad/verificar') return { data: { integra: true, estado: 'integra', total_registros: 3, chain_id: 'SISTEMA' } }
      return { data: [] }
    })
    const { result } = renderHook(() => useTrazabilidad())
    await waitFor(() => expect(result.current.cadenas).toHaveLength(1))
    expect(existeRuta('get', '/api/trazabilidad/cadenas')).toBe(true)

    await act(async () => {
      await result.current.verificarIntegridad('SISTEMA')
    })
    const peticion = adaptador.peticiones.find((p) => p.url === '/api/trazabilidad/verificar')!
    expect(peticion.params).toEqual({ chain_id: 'SISTEMA' })
    expect(result.current.verificacion?.chain_id).toBe('SISTEMA')
  })

  it('sin cadena no envía chain_id (todas las cadenas)', async () => {
    adaptador = instalarAdaptadorFalso(() => ({ data: { integra: true, total_registros: 0 } }))
    const { result } = renderHook(() => useTrazabilidad())
    await act(async () => {
      await result.current.verificarIntegridad()
    })
    const peticion = adaptador.peticiones.find((p) => p.url === '/api/trazabilidad/verificar')!
    expect(peticion.params).toEqual({})
  })

  it('un 404 (cadena sin registros) no se presenta como cadena íntegra', async () => {
    adaptador = instalarAdaptadorFalso((config) =>
      config.url === '/api/trazabilidad/verificar' ? { status: 404, data: { detail: 'Cadena sin registros' } } : { data: [] },
    )
    const { result } = renderHook(() => useTrazabilidad())
    await act(async () => {
      await result.current.verificarIntegridad('FARM-99')
    })
    expect(result.current.errorVerificacion).toBe('sin_registros')
    expect(result.current.verificacion).toBeNull()
    expect(result.current.verificando).toBe(false)
  })

  it('aislar una ruptura de una cadena no concluida (409) se informa como conflicto', async () => {
    adaptador = instalarAdaptadorFalso((config) => (config.method === 'post' ? { status: 409, data: { detail: 'no_concluida' } } : { data: [] }))
    const { result } = renderHook(() => useTrazabilidad())
    let resultado = ''
    await act(async () => {
      resultado = await result.current.aislarCorrupcion('r-1')
    })
    expect(resultado).toBe('conflicto')
  })
})
