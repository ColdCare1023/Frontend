import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/infrastructure/sse/sseClient', () => ({ suscribirseTiempoReal: () => () => {} }))

import { useDispositivos } from '@/application/hooks/useDispositivos'
import { instalarAdaptadorFalso } from '../../ayudas'

/**
 * FE-003: rotar y revocar usan el contrato real del backend (HU-44):
 * `/credenciales/...` (plural), motivo obligatorio y token devuelto una vez.
 * Antes llamaban a `/credencial/...` sin cuerpo: 404 contra el backend.
 */
describe('useDispositivos — credenciales MQTT', () => {
  let adaptador: ReturnType<typeof instalarAdaptadorFalso>

  afterEach(() => adaptador?.restaurar())

  async function montar() {
    adaptador = instalarAdaptadorFalso((config) => {
      if (config.url?.endsWith('/credenciales/rotar')) {
        return {
          data: { device_id: 'FARM-01', token: 'token-de-un-solo-uso', generado_en: '2026-10-21T10:00:00Z', sesion_broker_cerrada: true },
        }
      }
      if (config.url?.endsWith('/credenciales/revocar')) return { status: 204, data: null }
      return { data: [] }
    })
    const hook = renderHook(() => useDispositivos())
    await waitFor(() => expect(hook.result.current.cargando).toBe(false))
    return hook
  }

  it('rota con motivo y devuelve el token emitido', async () => {
    const { result } = await montar()

    let credencial: Awaited<ReturnType<typeof result.current.rotarCredencial>> = null
    await act(async () => {
      credencial = await result.current.rotarCredencial('FARM-01', 'Sospecha de compromiso')
    })

    const peticion = adaptador.peticiones.find((p) => p.method === 'post')
    expect(peticion?.url).toBe('/api/dispositivos/FARM-01/credenciales/rotar')
    expect(JSON.parse(peticion?.data as string)).toEqual({ motivo: 'Sospecha de compromiso' })
    expect(credencial).toMatchObject({ token: 'token-de-un-solo-uso', sesion_broker_cerrada: true })
  })

  it('revoca con motivo', async () => {
    const { result } = await montar()

    let resultado: string | undefined
    await act(async () => {
      resultado = await result.current.revocarCredencial('FARM-01', 'Equipo robado')
    })

    const peticion = adaptador.peticiones.find((p) => p.method === 'post')
    expect(peticion?.url).toBe('/api/dispositivos/FARM-01/credenciales/revocar')
    expect(JSON.parse(peticion?.data as string)).toEqual({ motivo: 'Equipo robado' })
    expect(resultado).toBe('revocada')
  })
})
