import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/infrastructure/sse/sseClient', () => ({ suscribirseTiempoReal: () => () => {} }))

import { useDispositivos } from '@/application/hooks/useDispositivos'
import { instalarAdaptadorFalso } from '../../ayudas'

/**
 * HU-51: el PATCH de `/instalacion` conserva los campos que no se envían
 * (backend r2). Un campo vaciado en el formulario se envía como `null` para
 * que se borre; antes se omitía (`|| undefined`) y el backend respondía 200
 * conservando el valor anterior.
 */
describe('useDispositivos — instalación', () => {
  let adaptador: ReturnType<typeof instalarAdaptadorFalso>

  afterEach(() => adaptador?.restaurar())

  async function montar() {
    adaptador = instalarAdaptadorFalso((config) =>
      config.method === 'patch' ? { data: { id: 'FARM-01' } } : { data: [] },
    )
    const hook = renderHook(() => useDispositivos())
    await waitFor(() => expect(hook.result.current.cargando).toBe(false))
    return hook
  }

  function cuerpoDelPatch() {
    const peticion = adaptador.peticiones.find((p) => p.method === 'patch')
    expect(peticion?.url).toBe('/api/dispositivos/FARM-01/instalacion')
    return JSON.parse(peticion?.data as string)
  }

  it('envía null en los campos vaciados para que se borren', async () => {
    const { result } = await montar()

    let resultado: string | undefined
    await act(async () => {
      resultado = await result.current.actualizarInstalacion('FARM-01', '', '', '')
    })

    expect(resultado).toBe('ok')
    expect(cuerpoDelPatch()).toEqual({ ubicacion: null, fecha_instalacion: null, observaciones: null })
  })

  it('envía los valores escritos y null solo en los vacíos', async () => {
    const { result } = await montar()

    await act(async () => {
      await result.current.actualizarInstalacion('FARM-01', 'Estante 1', '2026-08-01', undefined)
    })

    expect(cuerpoDelPatch()).toEqual({ ubicacion: 'Estante 1', fecha_instalacion: '2026-08-01', observaciones: null })
  })
})
