import { act, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { OyentesTiempoReal } from '@/infrastructure/sse/sseClient'

const suscriptores = vi.hoisted(() => [] as OyentesTiempoReal[])
vi.mock('@/infrastructure/sse/sseClient', () => ({
  suscribirseTiempoReal: (oyentes: OyentesTiempoReal) => {
    suscriptores.push(oyentes)
    return () => {}
  },
}))

import i18n from '@/infrastructure/i18n'
import { AvisosTiempoReal } from '@/presentation/components/AvisosTiempoReal'

/** FE-008: lo que no es una lectura también se ve en tiempo real. */
describe('AvisosTiempoReal', () => {
  beforeEach(async () => {
    suscriptores.length = 0
    await i18n.changeLanguage('es')
  })

  it('muestra la desconexión del nodo y la alerta como avisos críticos', () => {
    render(<AvisosTiempoReal />)
    const oyentes = suscriptores[0]

    act(() => {
      oyentes.onConectividad?.({ device_id: 'FARM-01', estado: 'offline', desde: 'x', boot_id: null, origen: 'lwt' })
      oyentes.onAlerta?.({ tipo: 'alerta', device_id: 'FARM-02' })
    })

    const criticos = screen.getAllByRole('alert')
    expect(criticos.map((n) => n.textContent)).toEqual([
      'FARM-01 se desconectó del broker.',
      'Nueva alerta térmica en FARM-02.',
    ])
  })

  it('unifica los nombres heredados del buffer', () => {
    render(<AvisosTiempoReal />)
    act(() => {
      suscriptores[0].onAvisoDispositivo?.({ tipo: 'saturacion_buffer', device_id: 'FARM-03', timestamp: 'x', detalle: null })
    })
    expect(screen.getByRole('alert')).toHaveTextContent('El buffer local de FARM-03 se saturó')
  })

  it('una reconexión no genera ruido', () => {
    render(<AvisosTiempoReal />)
    act(() => {
      suscriptores[0].onConectividad?.({ device_id: 'FARM-01', estado: 'online', desde: 'x', boot_id: null, origen: 'online' })
    })
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('avisa del uso de la consola del nodo (IOT-002)', () => {
    render(<AvisosTiempoReal />)
    act(() => {
      suscriptores[0].onAvisoDispositivo?.({
        tipo: 'config_modificada', device_id: 'FARM-01', timestamp: 'x', detalle: { clave: 'mqtt_host', accion: 'set' },
      })
      suscriptores[0].onAvisoDispositivo?.({ tipo: 'consola_desbloqueo_fallido', device_id: 'FARM-01', timestamp: 'x', detalle: { intentos: 5 } })
    })
    expect(screen.getByRole('status')).toHaveTextContent('Se cambió la configuración de FARM-01 desde su consola (mqtt_host).')
    expect(screen.getByRole('alert')).toHaveTextContent('Intentos fallidos repetidos de desbloquear la consola de FARM-01.')
  })
})
