import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Dispositivo } from '@/domain/entities/Dispositivo'

const useDispositivos = vi.hoisted(() => vi.fn())
vi.mock('@/application/hooks/useDispositivos', () => ({ useDispositivos }))

import { DispositivosPage } from '@/presentation/pages/DispositivosPage'

function dispositivo(over: Partial<Dispositivo> = {}): Dispositivo {
  return {
    id: 'FARM-01-CDL',
    nombre: 'Refrigerador principal',
    ubicacion: 'Sala 1',
    estado_conectividad: 'online',
    activo: true,
    firmware_version: '1.0.0',
    motivo_baja: null,
    descripcion_baja: null,
    dado_de_baja_en: null,
    reemplaza_a_device_id: null,
    fecha_ultima_calibracion: null,
    numero_certificado_calibracion: null,
    fecha_proxima_calibracion: null,
    observaciones_calibracion: null,
    fecha_instalacion: null,
    instalado_por: null,
    observaciones_instalacion: null,
    responsable_nombre: null,
    responsable_email: null,
    responsable_telefono: null,
    ...over,
  }
}

function montar(dispositivos: Dispositivo[], extra: Record<string, unknown> = {}) {
  useDispositivos.mockReturnValue({
    dispositivos,
    cargando: false,
    consultar: vi.fn(),
    darDeBaja: vi.fn(),
    registrarCalibracion: vi.fn(),
    actualizarInstalacion: vi.fn(),
    actualizarResponsable: vi.fn(),
    obtenerHistorialConfiguracion: vi.fn().mockResolvedValue([]),
    ...extra,
  })
  return render(<DispositivosPage />)
}

describe('DispositivosPage (HU-43, RF-18)', () => {
  beforeEach(() => useDispositivos.mockReset())

  it('muestra el device_id y su versión de firmware', async () => {
    montar([dispositivo()])

    expect(screen.getByText('FARM-01-CDL')).toBeInTheDocument()
    await userEvent.setup().click(screen.getByRole('button', { name: /sensores/i }))
    expect(screen.getByText('1.0.0')).toBeInTheDocument()
  })

  it('distingue un nodo en línea de uno sin conexión', () => {
    // El estado se muestra traducido, no como el literal del backend: la
    // interfaz es bilingüe y «online»/«offline» eran las dos únicas cadenas
    // que se colaban sin pasar por i18n.
    montar([dispositivo({ id: 'FARM-01-CDL', estado_conectividad: 'online' })])
    expect(screen.getByText('En línea')).toBeInTheDocument()

    montar([dispositivo({ id: 'FARM-02-CDL', estado_conectividad: 'offline' })])
    expect(screen.getByText('Sin conexión')).toBeInTheDocument()
  })

  it('marca visiblemente un dispositivo dado de baja', () => {
    // HU-43: la baja no borra el histórico, así que el equipo tiene que poder
    // distinguir de un vistazo qué nodos ya no están en servicio.
    montar([dispositivo({ activo: false, motivo_baja: 'falla_hardware' })])

    expect(screen.getByText(/dado de baja/i)).toBeInTheDocument()
  })

  it('avisa cuando no hay dispositivos registrados', () => {
    montar([])
    expect(screen.getByText(/no hay dispositivos|sin dispositivos/i)).toBeInTheDocument()
  })
})

describe('DispositivosPage — credenciales MQTT (FE-003)', () => {
  beforeEach(() => useDispositivos.mockReset())

  async function abrirAccion(nombre: RegExp) {
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /Opciones: FARM-01-CDL/ }))
    await user.click(await screen.findByRole('menuitem', { name: nombre }))
    return user
  }

  it('pide motivo para rotar y muestra el token una sola vez', async () => {
    const rotarCredencial = vi.fn().mockResolvedValue({
      device_id: 'FARM-01-CDL',
      token: 'token-visible-una-vez',
      generado_en: '2026-10-21T10:00:00Z',
      sesion_broker_cerrada: true,
    })
    montar([dispositivo({ mqtt_token_activo: true })], { rotarCredencial, revocarCredencial: vi.fn() })

    const user = await abrirAccion(/Rotar credencial/)
    const enviar = screen.getByRole('button', { name: 'Rotar credencial' })
    expect(enviar).toBeDisabled()
    await user.type(screen.getByLabelText('Motivo'), 'Rotación periódica')
    await user.click(enviar)

    expect(rotarCredencial).toHaveBeenCalledWith('FARM-01-CDL', 'Rotación periódica')
    expect(await screen.findByTestId('token-rotado')).toHaveTextContent('token-visible-una-vez')
    expect(screen.getByText(/cerró la sesión anterior/)).toBeInTheDocument()

    const cerrar = screen.getAllByRole('button', { name: 'Cerrar' })
    await user.click(cerrar[cerrar.length - 1])
    expect(screen.queryByText('token-visible-una-vez')).toBeNull()
  })

  it('revoca con motivo obligatorio', async () => {
    const revocarCredencial = vi.fn().mockResolvedValue('revocada')
    montar([dispositivo({ mqtt_token_activo: true })], { rotarCredencial: vi.fn(), revocarCredencial })

    const user = await abrirAccion(/Revocar credencial/)
    await user.type(screen.getByLabelText('Motivo'), 'Equipo extraviado')
    await user.click(screen.getByRole('button', { name: 'Revocar credencial' }))

    expect(revocarCredencial).toHaveBeenCalledWith('FARM-01-CDL', 'Equipo extraviado')
  })

  it('una credencial revocada en el backend no ofrece revocar de nuevo', async () => {
    montar([dispositivo({ mqtt_token_activo: false, mqtt_credencial_actualizada_en: '2026-10-20T10:00:00Z' })], {
      rotarCredencial: vi.fn(),
      revocarCredencial: vi.fn(),
    })
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /Opciones: FARM-01-CDL/ }))
    await screen.findByRole('menuitem', { name: /Rotar credencial/ })
    expect(screen.queryByRole('menuitem', { name: /Revocar credencial/ })).toBeNull()
  })
})
