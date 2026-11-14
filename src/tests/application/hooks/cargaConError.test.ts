import { act, renderHook, waitFor } from '@testing-library/react'
import type { AxiosRequestConfig } from 'axios'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/infrastructure/sse/sseClient', () => ({ suscribirseTiempoReal: () => () => {} }))

import { useAuditoria } from '@/application/hooks/useAuditoria'
import { useDispositivos } from '@/application/hooks/useDispositivos'
import { useTrazabilidad } from '@/application/hooks/useTrazabilidad'
import { useUsuarios } from '@/application/hooks/useUsuarios'
import { instalarAdaptadorFalso } from '../../ayudas'

let adaptador: ReturnType<typeof instalarAdaptadorFalso>
afterEach(() => adaptador?.restaurar())

const esGet = (config: AxiosRequestConfig) => (config.method ?? 'get').toLowerCase() === 'get'

/**
 * Un fallo al cargar una lista no es lo mismo que una lista vacía. En auditoría
 * y trazabilidad «no hay registros» se lee como evidencia, así que el hook debe
 * decir que la carga falló.
 */
describe('las listas distinguen el fallo de carga de la lista vacía', () => {
  type EstadoLista = { cargando: boolean; errorCarga: boolean }
  const hooks: [string, () => EstadoLista][] = [
    ['useUsuarios', () => useUsuarios()],
    ['useDispositivos', () => useDispositivos()],
    ['useAuditoria', () => useAuditoria()],
    ['useTrazabilidad', () => useTrazabilidad()],
  ]

  it.each(hooks)('%s expone errorCarga cuando el servidor falla', async (_nombre, usar) => {
    adaptador = instalarAdaptadorFalso(() => ({ status: 500 }))

    const { result } = renderHook(usar)

    await waitFor(() => expect(result.current.cargando).toBe(false))
    expect(result.current.errorCarga).toBe(true)
  })

  it('useAuditoria no marca error cuando la lista llega vacía', async () => {
    adaptador = instalarAdaptadorFalso(() => ({ data: [] }))

    const { result } = renderHook(() => useAuditoria())

    await waitFor(() => expect(result.current.cargando).toBe(false))
    expect(result.current.errorCarga).toBe(false)
  })
})

/**
 * El backend entrega el secreto una sola vez. Si la operación ya se hizo y lo
 * único que falla es el refresco posterior de la lista, el secreto tiene que
 * llegar igual a la pantalla: de lo contrario se pierde para siempre.
 */
describe('el secreto de un solo uso sobrevive a un refresco fallido', () => {
  /** Las cargas iniciales responden bien; los GET posteriores a la mutación fallan. */
  function refrescoFallido(respuestaPost: unknown) {
    let mutado = false
    return instalarAdaptadorFalso((config) => {
      if (!esGet(config)) {
        mutado = true
        return { data: respuestaPost }
      }
      return mutado ? { status: 500 } : { data: [] }
    })
  }

  it('rotar credencial devuelve el token', async () => {
    adaptador = refrescoFallido({ device_id: 'FARM-01', token: 'token-de-un-solo-uso' })
    const { result } = renderHook(() => useDispositivos())
    await waitFor(() => expect(result.current.cargando).toBe(false))

    let credencial: Awaited<ReturnType<typeof result.current.rotarCredencial>> = null
    await act(async () => {
      credencial = await result.current.rotarCredencial('FARM-01', 'Rotación programada')
    })

    expect(credencial).toMatchObject({ token: 'token-de-un-solo-uso' })
  })

  it('el alta de dispositivo devuelve la credencial', async () => {
    adaptador = refrescoFallido({ credencial: { device_id: 'FARM-02', token: 'token-de-alta' } })
    const { result } = renderHook(() => useDispositivos())
    await waitFor(() => expect(result.current.cargando).toBe(false))

    let alta: Awaited<ReturnType<typeof result.current.registrarDispositivo>> | undefined
    await act(async () => {
      alta = await result.current.registrarDispositivo({
        device_id: 'FARM-02',
        nombre: 'Refrigerador 2',
        ubicacion: 'Almacén',
        sensores: [],
      })
    })

    expect(alta).toMatchObject({ resultado: 'ok', credencial: { token: 'token-de-alta' } })
  })

  it('la contraseña temporal se devuelve', async () => {
    adaptador = refrescoFallido({ password_temporal: 'Temporal-123' })
    const { result } = renderHook(() => useUsuarios())
    await waitFor(() => expect(result.current.cargando).toBe(false))

    let temporal: Awaited<ReturnType<typeof result.current.asignarTemporal>> = null
    await act(async () => {
      temporal = await result.current.asignarTemporal('u-1', 'restablecer-password')
    })

    expect(temporal).toMatchObject({ password_temporal: 'Temporal-123' })
  })
})
