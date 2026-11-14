import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { useHistorialConfiguracion } from '@/application/hooks/useHistorialConfiguracion'
import { instalarAdaptadorFalso } from '../../ayudas'
import { existeRuta } from '../../contrato/validarOpenApi'

describe('useHistorialConfiguracion — HU-49 (auditor, solo lectura)', () => {
  let adaptador: ReturnType<typeof instalarAdaptadorFalso>
  afterEach(() => adaptador?.restaurar())

  it('obtiene los equipos de las cadenas (incluidos los de baja) y de los nodos activos, sin /api/dispositivos', async () => {
    adaptador = instalarAdaptadorFalso((config) => {
      if (config.url === '/api/trazabilidad/cadenas') {
        return { data: [{ chain_id: 'SISTEMA', es_sistema: true, total_registros: 2 }, { chain_id: 'FARM-00-BAJA', es_sistema: false, total_registros: 9 }] }
      }
      if (config.url === '/api/dispositivos/estado-operativo') return { data: [{ id: 'FARM-01-CDL' }] }
      return { data: [] }
    })
    const { result } = renderHook(() => useHistorialConfiguracion())
    await waitFor(() => expect(result.current.equipos).toEqual(['FARM-00-BAJA', 'FARM-01-CDL']))
    expect(adaptador.peticiones.some((p) => p.url === '/api/dispositivos')).toBe(false)
  })

  it('consulta con categoría y periodo que acepta el backend', async () => {
    adaptador = instalarAdaptadorFalso(() => ({ data: [] }))
    const { result } = renderHook(() => useHistorialConfiguracion())
    await act(async () => {
      await result.current.consultar('FARM-01-CDL', { categoria: 'calibracion', desde: '2026-10-01T00:00' })
    })
    const peticion = adaptador.peticiones.find((p) => p.url.endsWith('/historial-configuracion'))!
    expect(peticion.url).toBe('/api/dispositivos/FARM-01-CDL/historial-configuracion')
    expect(existeRuta('get', peticion.url)).toBe(true)
    expect(peticion.params).toMatchObject({ categoria: 'calibracion' })
    expect(typeof peticion.params.desde).toBe('string')
  })

  it('un 404 se informa como equipo no encontrado', async () => {
    adaptador = instalarAdaptadorFalso((config) => (config.url?.endsWith('/historial-configuracion') ? { status: 404 } : { data: [] }))
    const { result } = renderHook(() => useHistorialConfiguracion())
    await act(async () => {
      await result.current.consultar('NO-EXISTE')
    })
    expect(result.current.error).toBe('no_encontrado')
    expect(result.current.cambios).toEqual([])
  })
})
