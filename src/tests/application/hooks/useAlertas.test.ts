import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { AlertaTermica } from '@/domain/entities/AlertaTermica'

vi.mock('@/infrastructure/sse/sseClient', () => ({ suscribirseTiempoReal: () => () => {} }))

import { useAlertas } from '@/application/hooks/useAlertas'
import { useAuthStore } from '@/application/stores/authStore'
import { instalarAdaptadorFalso } from '@/tests/ayudas'

const pendiente = (over: Partial<AlertaTermica> = {}): AlertaTermica => ({
  id: 'al-1',
  reading_id: 'l-1',
  device_id: 'FARM-01-CDL',
  nivel_riesgo: 'excursion_critica',
  mensaje: 'Fuera de rango',
  revisada: false,
  revisada_por: null,
  created_at: '2026-07-25T12:00:00Z',
  estado: 'pendiente',
  reconocida_en: null,
  atendida_en: null,
  ...over,
})

const ACCION = { decision: 'Inmovilizar', descripcion: 'Se trasladó el lote', justificacion: 'Superó 8 °C' }

/**
 * HU-23 / HU-27 / H16 contra el contrato del backend (fix/backlog-r2-alertas):
 * POST /acciones-correctivas sobre una PENDIENTE la reconoce y la atiende en
 * el mismo instante; 409 si ya estaba atendida; 403 si el rol no puede.
 */
describe('useAlertas: acción correctiva y reconocimiento', () => {
  let adaptador: ReturnType<typeof instalarAdaptadorFalso>
  let respuestaPost: { status: number; data?: unknown }

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    respuestaPost = { status: 201, data: {} }
    useAuthStore.setState({
      usuario: { id: 'u-farma', email: 'qf@upc.pe', rol: 'farmaceutico', expiraEn: Date.now() + 3_600_000 },
      autenticado: true,
    })
    adaptador = instalarAdaptadorFalso((config) => {
      if (config.method === 'get') return { data: [pendiente()] }
      return respuestaPost
    })
  })

  afterEach(() => {
    adaptador.restaurar()
    vi.useRealTimers()
  })

  async function montar() {
    const vista = renderHook(() => useAlertas())
    await waitFor(() => expect(vista.result.current.cargando).toBe(false))
    return vista
  }

  it('sobre una PENDIENTE la deja ATENDIDA y reconocida por quien registra, en el mismo instante', async () => {
    const { result } = await montar()

    let resultado: string | undefined
    await act(async () => {
      resultado = await result.current.registrarAccionCorrectiva('al-1', ACCION)
    })

    expect(resultado).toBe('ok')
    const alerta = result.current.alertas.find((a) => a.id === 'al-1')!
    expect(alerta.estado).toBe('atendida')
    expect(alerta.revisada).toBe(true)
    expect(alerta.revisada_por).toBe('u-farma')
    expect(alerta.reconocida_en).not.toBeNull()
    expect(alerta.reconocida_en).toBe(alerta.atendida_en)
    const envio = adaptador.peticiones.find((p) => p.method === 'post')!
    expect(envio.url).toBe('/api/alertas/al-1/acciones-correctivas')
    expect(JSON.parse(String(envio.data))).toEqual(ACCION)
  })

  it('sobre una RECONOCIDA conserva su reconocimiento previo', async () => {
    adaptador.restaurar()
    adaptador = instalarAdaptadorFalso((config) =>
      config.method === 'get'
        ? { data: [pendiente({ estado: 'reconocida', revisada: true, revisada_por: 'u-otra', reconocida_en: '2026-07-25T12:05:00Z' })] }
        : respuestaPost,
    )
    const { result } = await montar()

    await act(async () => {
      await result.current.registrarAccionCorrectiva('al-1', ACCION)
    })

    const alerta = result.current.alertas[0]
    expect(alerta.estado).toBe('atendida')
    expect(alerta.revisada_por).toBe('u-otra')
    expect(alerta.reconocida_en).toBe('2026-07-25T12:05:00Z')
  })

  it.each([
    [403, 'prohibido'],
    [409, 'conflicto'],
    [500, 'error'],
  ])('un %i al registrar devuelve «%s»', async (status, esperado) => {
    respuestaPost = { status, data: { detail: 'x' } }
    const { result } = await montar()

    let resultado: string | undefined
    await act(async () => {
      resultado = await result.current.registrarAccionCorrectiva('al-1', ACCION)
    })
    expect(resultado).toBe(esperado)
  })

  it('un 403 al reconocer devuelve «prohibido»', async () => {
    respuestaPost = { status: 403, data: { detail: 'No tiene permisos' } }
    const { result } = await montar()

    let resultado: string | undefined
    await act(async () => {
      resultado = await result.current.reconocerAlerta('al-1')
    })
    expect(resultado).toBe('prohibido')
  })
})
