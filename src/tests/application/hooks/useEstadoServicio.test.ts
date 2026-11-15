import { act, renderHook, waitFor } from '@testing-library/react'
import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { INTERVALO_ESTADO_SERVICIO_MS, useEstadoServicio } from '@/application/hooks/useEstadoServicio'
import { apiClient, setAccessToken } from '@/infrastructure/api/apiClient'
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

  it.each([
    [403, 'sin_permiso'],
    [401, 'sin_sesion'],
  ] as const)('un %i tras una consulta exitosa descarta los datos ya cargados (%s)', async (codigo, motivo) => {
    let status = 200
    adaptador = instalarAdaptadorFalso(() => ({ status, data: status === 200 ? ESTADO : { detail: 'No autorizado' } }))
    const { result } = renderHook(() => useEstadoServicio())
    await waitFor(() => expect(result.current.datos?.status).toBe('ok'))
    status = codigo
    await act(() => result.current.actualizar())
    expect(result.current.error).toBe(motivo)
    expect(result.current.datos).toBeNull()
  })

  it('solo «Actualizar» marca refrescandoManual; el sondeo cada 30 s no', async () => {
    vi.useFakeTimers()
    const pendientes: Array<() => void> = []
    const previo = apiClient.defaults.adapter
    apiClient.defaults.adapter = (config: InternalAxiosRequestConfig) =>
      new Promise<AxiosResponse>((resolve) => {
        pendientes.push(() => resolve({ data: ESTADO, status: 200, statusText: '', headers: {}, config }))
      })
    const responder = () =>
      act(async () => {
        await vi.advanceTimersByTimeAsync(0)
        pendientes.shift()?.()
        await vi.advanceTimersByTimeAsync(0)
      })
    try {
      const { result } = renderHook(() => useEstadoServicio())
      // Primera consulta, automática.
      expect(result.current.refrescando).toBe(true)
      expect(result.current.refrescandoManual).toBe(false)
      await responder()
      expect(result.current.refrescando).toBe(false)

      // Sondeo: hay consulta en curso, pero no es «manual».
      await act(() => vi.advanceTimersByTimeAsync(INTERVALO_ESTADO_SERVICIO_MS))
      expect(result.current.refrescando).toBe(true)
      expect(result.current.refrescandoManual).toBe(false)
      await responder()

      // «Actualizar».
      act(() => void result.current.actualizar())
      expect(result.current.refrescandoManual).toBe(true)
      await responder()
      expect(result.current.refrescandoManual).toBe(false)
      expect(result.current.refrescando).toBe(false)
    } finally {
      apiClient.defaults.adapter = previo
    }
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
