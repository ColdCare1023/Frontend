import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { INTERVALO_ESTADO_SERVICIO_MS, useEstadoServicio } from '@/application/hooks/useEstadoServicio'
import { setAccessToken } from '@/infrastructure/api/apiClient'
import { instalarAdaptadorFalso } from '../../ayudas'
import { existeRuta } from '../../contrato/validarOpenApi'

const ESTADO = { status: 'ok', timestamp: '2026-11-15T15:30:00+00:00', db: 'ok', alembic_revision: 'r1', alembic_head: 'r1', broker_api: 'ok' }

describe('useEstadoServicio — GET /health/detalle', () => {
  let adaptador: ReturnType<typeof instalarAdaptadorFalso>
  afterEach(() => {
    adaptador?.restaurar()
    setAccessToken(null)
    vi.useRealTimers()
    Object.defineProperty(document, 'hidden', { configurable: true, value: false })
  })

  it('consulta la ruta del backend con el Bearer de la sesión', async () => {
    setAccessToken('token-admin')
    adaptador = instalarAdaptadorFalso(() => ({ data: ESTADO }))
    const { result } = renderHook(() => useEstadoServicio())
    await waitFor(() => expect(result.current.cargando).toBe(false))
    expect(existeRuta('get', '/health/detalle')).toBe(true)
    expect(adaptador.ultima()).toMatchObject({ method: 'get', url: '/health/detalle' })
    expect(adaptador.ultima().headers.Authorization).toBe('Bearer token-admin')
    expect(result.current.datos?.status).toBe('ok')
    expect(result.current.error).toBeNull()
  })

  it('vuelve a consultar cada 30 s con la pestaña visible, y no en segundo plano', async () => {
    vi.useFakeTimers()
    adaptador = instalarAdaptadorFalso(() => ({ data: ESTADO }))
    renderHook(() => useEstadoServicio())
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(adaptador.peticiones).toHaveLength(1)

    await act(() => vi.advanceTimersByTimeAsync(INTERVALO_ESTADO_SERVICIO_MS))
    expect(adaptador.peticiones).toHaveLength(2)

    Object.defineProperty(document, 'hidden', { configurable: true, value: true })
    await act(() => vi.advanceTimersByTimeAsync(INTERVALO_ESTADO_SERVICIO_MS * 2))
    expect(adaptador.peticiones).toHaveLength(2)

    // Al volver a la pestaña consulta de inmediato.
    Object.defineProperty(document, 'hidden', { configurable: true, value: false })
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'))
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(adaptador.peticiones).toHaveLength(3)
  })

  it('403 es «sin permiso» y descarta los datos', async () => {
    adaptador = instalarAdaptadorFalso(() => ({ status: 403, data: { detail: 'No tiene permisos para esta operación' } }))
    const { result } = renderHook(() => useEstadoServicio())
    await waitFor(() => expect(result.current.error).toBe('sin_permiso'))
    expect(result.current.datos).toBeNull()
  })

  it('una falla tras una consulta exitosa conserva los últimos datos', async () => {
    let status = 200
    adaptador = instalarAdaptadorFalso(() => ({ status, data: status === 200 ? ESTADO : {} }))
    const { result } = renderHook(() => useEstadoServicio())
    await waitFor(() => expect(result.current.datos?.status).toBe('ok'))
    status = 503
    await act(() => result.current.actualizar())
    expect(result.current.error).toBe('error')
    expect(result.current.datos?.status).toBe('ok')
  })
})
