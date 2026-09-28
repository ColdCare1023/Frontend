import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { useChecklistBPA } from '@/application/hooks/useChecklistBPA'
import { ITEMS_CHECKLIST_BPA, type ChecklistBPARequest } from '@/domain/entities/ChecklistBPA'
import { instalarAdaptadorFalso } from '../../ayudas'

const PAYLOAD: ChecklistBPARequest = {
  fecha: '2026-07-25',
  observaciones: null,
  ...(Object.fromEntries(ITEMS_CHECKLIST_BPA.map((i) => [i, true])) as Record<string, boolean>),
} as ChecklistBPARequest

const RESPUESTA = {
  id: 'c-1',
  usuario_id: 'u-1',
  fecha: '2026-07-25',
  observaciones: null,
  total_conformes: 10,
  conforme: true,
  created_at: '2026-07-25T09:00:00Z',
  updated_at: '2026-07-25T09:00:00Z',
  ...(Object.fromEntries(ITEMS_CHECKLIST_BPA.map((i) => [i, true])) as Record<string, boolean>),
}

describe('useChecklistBPA', () => {
  let adaptador: ReturnType<typeof instalarAdaptadorFalso>

  beforeEach(() => {
    adaptador = instalarAdaptadorFalso(() => ({ data: null }))
  })

  afterEach(() => {
    adaptador.restaurar()
  })

  it('consulta el checklist del día al montar', async () => {
    const { result } = renderHook(() => useChecklistBPA())

    await waitFor(() => expect(result.current.cargando).toBe(false))
    expect(adaptador.peticiones[0].url).toBe('/api/checklist-bpa')
    expect(adaptador.peticiones[0].method).toBe('get')
  })

  it('trata el null del backend como "aún sin verificar", no como error', async () => {
    // El backend devuelve null en vez de 404 a propósito: no haber registrado
    // todavía la verificación es un estado normal del flujo diario.
    const { result } = renderHook(() => useChecklistBPA())

    await waitFor(() => expect(result.current.cargando).toBe(false))
    expect(result.current.checklist).toBeNull()
    expect(result.current.errorCarga).toBe(false)
  })

  it('marca errorCarga si la consulta falla', async () => {
    adaptador.restaurar()
    adaptador = instalarAdaptadorFalso(() => ({ status: 500, data: {} }))

    const { result } = renderHook(() => useChecklistBPA())

    await waitFor(() => expect(result.current.errorCarga).toBe(true))
    expect(result.current.cargando).toBe(false)
  })

  it('guardar devuelve true y refleja la respuesta del backend', async () => {
    adaptador.restaurar()
    adaptador = instalarAdaptadorFalso((config) =>
      config.method?.toLowerCase() === 'post' ? { data: RESPUESTA } : { data: null },
    )
    const { result } = renderHook(() => useChecklistBPA())
    await waitFor(() => expect(result.current.cargando).toBe(false))

    let ok: boolean | undefined
    await act(async () => {
      ok = await result.current.guardar(PAYLOAD)
    })

    expect(ok).toBe(true)
    // El estado local se toma de la respuesta, no del formulario: `conforme` y
    // `total_conformes` los calcula el backend y son los que quedan en la
    // cadena de trazabilidad.
    expect(result.current.checklist).toMatchObject({ conforme: true, total_conformes: 10 })
    expect(result.current.errorGuardado).toBe(false)
  })

  it('guardar devuelve false y no altera el checklist si el backend falla', async () => {
    adaptador.restaurar()
    adaptador = instalarAdaptadorFalso((config) =>
      config.method?.toLowerCase() === 'post' ? { status: 500, data: {} } : { data: null },
    )
    const { result } = renderHook(() => useChecklistBPA())
    await waitFor(() => expect(result.current.cargando).toBe(false))

    let ok: boolean | undefined
    await act(async () => {
      ok = await result.current.guardar(PAYLOAD)
    })

    expect(ok).toBe(false)
    expect(result.current.errorGuardado).toBe(true)
    expect(result.current.checklist).toBeNull()
  })

  it('no deja el indicador de guardado colgado tras un fallo', async () => {
    adaptador.restaurar()
    adaptador = instalarAdaptadorFalso((config) =>
      config.method?.toLowerCase() === 'post' ? { status: 500, data: {} } : { data: null },
    )
    const { result } = renderHook(() => useChecklistBPA())
    await waitFor(() => expect(result.current.cargando).toBe(false))

    await act(async () => {
      await result.current.guardar(PAYLOAD)
    })

    expect(result.current.guardando).toBe(false)
  })
})
