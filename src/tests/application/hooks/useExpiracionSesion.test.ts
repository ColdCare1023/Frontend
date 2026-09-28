import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  ANTELACION_AVISO_MS,
  formatearRestante,
  useExpiracionSesion,
} from '@/application/hooks/useExpiracionSesion'
import { useAuthStore } from '@/application/stores/authStore'

const AHORA = new Date('2026-07-25T12:00:00Z').getTime()

function sesionQueExpiraEn(ms: number) {
  useAuthStore.setState({
    usuario: { id: 'u-1', email: 'farmaceutico@upc.pe', rol: 'farmaceutico', expiraEn: AHORA + ms },
    autenticado: true,
    requierePrivacidad: false,
  })
}

describe('useExpiracionSesion (FS5)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(AHORA)
    useAuthStore.setState({ usuario: null, autenticado: false, requierePrivacidad: false })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('no avisa mientras queda tiempo de sobra', () => {
    sesionQueExpiraEn(30 * 60 * 1000)

    const { result } = renderHook(() => useExpiracionSesion(vi.fn()))

    expect(result.current.porExpirar).toBe(false)
  })

  it('avisa dentro de la antelación configurada', () => {
    sesionQueExpiraEn(ANTELACION_AVISO_MS - 1000)

    const { result } = renderHook(() => useExpiracionSesion(vi.fn()))

    expect(result.current.porExpirar).toBe(true)
  })

  it('el contador baja con el reloj', () => {
    sesionQueExpiraEn(4 * 60 * 1000)
    const { result } = renderHook(() => useExpiracionSesion(vi.fn()))

    act(() => {
      vi.advanceTimersByTime(60 * 1000)
    })

    expect(result.current.restanteMs).toBe(3 * 60 * 1000)
  })

  it('llama a alExpirar cuando se agota el plazo', () => {
    sesionQueExpiraEn(3000)
    const alExpirar = vi.fn()
    renderHook(() => useExpiracionSesion(alExpirar))

    act(() => {
      vi.advanceTimersByTime(3000)
    })

    expect(alExpirar).toHaveBeenCalledTimes(1)
  })

  it('expira aunque el equipo se suspenda y el temporizador despierte tarde', () => {
    // Con un `setTimeout` único calculado de una vez, la suspensión del equipo
    // retrasaría el disparo y la sesión seguiría viva en pantalla mucho después
    // de haber caducado el token.
    sesionQueExpiraEn(2 * 60 * 1000)
    const alExpirar = vi.fn()
    const { result } = renderHook(() => useExpiracionSesion(alExpirar))

    act(() => {
      vi.setSystemTime(AHORA + 10 * 60 * 1000)
      vi.advanceTimersByTime(1000)
    })

    expect(result.current.restanteMs).toBe(0)
    expect(alExpirar).toHaveBeenCalledTimes(1)
  })

  it('no vuelve a llamar a alExpirar tras haber expirado', () => {
    sesionQueExpiraEn(1000)
    const alExpirar = vi.fn()
    renderHook(() => useExpiracionSesion(alExpirar))

    act(() => {
      vi.advanceTimersByTime(10 * 1000)
    })

    expect(alExpirar).toHaveBeenCalledTimes(1)
  })

  it('un token ya caducado expira de inmediato', () => {
    sesionQueExpiraEn(-1000)
    const alExpirar = vi.fn()

    renderHook(() => useExpiracionSesion(alExpirar))

    expect(alExpirar).toHaveBeenCalled()
  })

  it('sin exp legible no inventa una caducidad ni expulsa al usuario', () => {
    useAuthStore.setState({
      usuario: { id: 'u-1', email: 'x@upc.pe', rol: 'tecnico', expiraEn: 0 },
      autenticado: true,
      requierePrivacidad: false,
    })
    const alExpirar = vi.fn()

    const { result } = renderHook(() => useExpiracionSesion(alExpirar))

    expect(alExpirar).not.toHaveBeenCalled()
    expect(result.current.porExpirar).toBe(false)
  })

  it('deja de contar al desmontarse', () => {
    sesionQueExpiraEn(2000)
    const alExpirar = vi.fn()
    const { unmount } = renderHook(() => useExpiracionSesion(alExpirar))

    unmount()
    act(() => {
      vi.advanceTimersByTime(5000)
    })

    expect(alExpirar).not.toHaveBeenCalled()
  })
})

describe('formatearRestante', () => {
  it('rellena los segundos a dos dígitos', () => {
    expect(formatearRestante(65_000)).toBe('1:05')
  })

  it('redondea hacia arriba para no mostrar 0:00 con tiempo restante', () => {
    expect(formatearRestante(1)).toBe('0:01')
  })

  it('cero es 0:00', () => {
    expect(formatearRestante(0)).toBe('0:00')
  })
})
