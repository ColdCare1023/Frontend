import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { AlertaTermica } from '@/domain/entities/AlertaTermica'
import { useAuthStore } from '@/application/stores/authStore'
import type { Rol } from '@/domain/value-objects/Rol'

const useAlertas = vi.hoisted(() => vi.fn())
vi.mock('@/application/hooks/useAlertas', () => ({ useAlertas }))

import { AlertasPage } from '@/presentation/pages/AlertasPage'

function alerta(over: Partial<AlertaTermica> = {}): AlertaTermica {
  return {
    id: 'al-1',
    reading_id: 'l-1',
    device_id: 'FARM-01-CDL',
    nivel_riesgo: 'excursion_critica',
    mensaje: 'Temperatura fuera del rango 2-8 °C',
    revisada: false,
    revisada_por: null,
    created_at: '2026-07-25T12:00:00Z',
    estado: 'pendiente',
    reconocida_en: null,
    atendida_en: null,
    ...over,
  }
}

function sesionCon(rol: Rol) {
  useAuthStore.setState({
    usuario: { id: 'u-1', email: `${rol}@upc.pe`, rol, expiraEn: Date.now() + 3600_000 },
    autenticado: true,
    requierePrivacidad: false,
  })
}

function montar(alertas: AlertaTermica[]) {
  const reconocerAlerta = vi.fn()
  useAlertas.mockReturnValue({
    alertas,
    cargando: false,
    filtro: 'pendiente',
    setFiltro: vi.fn(),
    reconocerAlerta,
    registrarAccionCorrectiva: vi.fn(),
    obtenerCicloAtencion: vi.fn().mockResolvedValue([]),
  })
  render(<MemoryRouter><AlertasPage /></MemoryRouter>)
  return reconocerAlerta
}

describe('AlertasPage (RF-09, RF-10, HU-20/21/23/27/41)', () => {
  beforeEach(() => {
    useAlertas.mockReset()
    sesionCon('farmaceutico')
  })

  it('muestra la alerta con su dispositivo y su mensaje', () => {
    montar([alerta()])

    expect(screen.getByText('FARM-01-CDL')).toBeInTheDocument()
    // `getAllByText`: el detalle del semáforo de riesgo («Fuera del rango
    // 2–8 °C…») se expone ahora como texto para lector de pantalla dentro de
    // la píldora, así que la frase aparece también fuera del mensaje.
    expect(screen.getAllByText(/fuera del rango/i).length).toBeGreaterThan(0)
    expect(screen.getByRole('cell', { name: /fuera del rango 2-8/i })).toBeInTheDocument()
  })

  it('ofrece los cuatro filtros de la máquina de estados', () => {
    montar([alerta()])

    const nombres = screen.getAllByRole('button').map((b) => b.textContent)
    expect(nombres).toEqual(
      expect.arrayContaining(['Pendientes', 'Reconocidas', 'Atendidas', 'Todas']),
    )
  })

  it('permite a un farmacéutico reconocer una alerta pendiente', () => {
    sesionCon('farmaceutico')
    montar([alerta({ estado: 'pendiente' })])

    expect(screen.getByRole('button', { name: /reconocer/i })).toBeInTheDocument()
  })

  it('abre detalle de alerta pendiente para consulta, incluso con rol auditor', async () => {
    sesionCon('auditor')
    montar([alerta({ estado: 'pendiente' })])

    await userEvent.setup().click(screen.getByRole('button', { name: /cronología de atención.*FARM-01-CDL/i }))

    const dialogo = await screen.findByRole('dialog')
    expect(dialogo).toHaveTextContent('FARM-01-CDL')
    expect(screen.getByRole('link', { name: /historial/i })).toHaveAttribute('href', '/historial')
  })

  it('informa fallo al cargar cronología sin afirmar que no hay acciones', async () => {
    sesionCon('auditor')
    montar([alerta()])
    useAlertas.mock.results[0].value.obtenerCicloAtencion.mockRejectedValue(new Error('red caída'))

    await userEvent.setup().click(screen.getByRole('button', { name: /cronología de atención.*FARM-01-CDL/i }))

    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.queryByText(/sin acciones/i)).not.toBeInTheDocument()
  })

  it('no ofrece el botón de reconocer a un técnico (RBAC en la vista)', () => {
    // El backend ya rechaza la acción por rol (require_roles(FARMACEUTICO));
    // la vista no debe ofrecer un botón que solo puede terminar en un 403.
    sesionCon('tecnico')
    montar([alerta({ estado: 'pendiente' })])

    expect(screen.queryByRole('button', { name: /reconocer/i })).not.toBeInTheDocument()
  })

  it('un técnico sí puede registrar la acción correctiva aunque no reconozca', () => {
    // HU-23: registrar la acción marca ATENDIDA directamente desde
    // PENDIENTE, sin exigir el paso de reconocimiento.
    sesionCon('tecnico')
    montar([alerta({ estado: 'pendiente' })])

    expect(screen.getByRole('button', { name: /acción correctiva/i })).toBeInTheDocument()
  })

  it('no ofrece ninguna acción a un auditor (rol de solo lectura)', () => {
    sesionCon('auditor')
    montar([alerta({ estado: 'pendiente' })])

    expect(screen.queryByRole('button', { name: /reconocer/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /acción correctiva/i })).not.toBeInTheDocument()
  })

  it('no ofrece ninguna acción sobre una alerta ya atendida', () => {
    sesionCon('farmaceutico')
    montar([alerta({ estado: 'atendida' })])

    expect(screen.queryByRole('button', { name: /reconocer/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /acción correctiva/i })).not.toBeInTheDocument()
  })

  it('avisa cuando no hay alertas para el filtro activo', () => {
    montar([])
    expect(screen.getByText(/no hay alertas|sin alertas/i)).toBeInTheDocument()
  })

  it('avisa cuando otro usuario ya reconoció la alerta (HU-27 Escenario 2)', async () => {
    const usuario = userEvent.setup()
    const reconocerAlerta = vi.fn().mockResolvedValue('conflicto')
    useAlertas.mockReturnValue({
      alertas: [alerta({ estado: 'pendiente' })],
      cargando: false,
      filtro: 'pendiente',
      setFiltro: vi.fn(),
      reconocerAlerta,
      registrarAccionCorrectiva: vi.fn(),
    obtenerCicloAtencion: vi.fn().mockResolvedValue([]),
    })
    render(<MemoryRouter><AlertasPage /></MemoryRouter>)

    await usuario.click(screen.getByRole('button', { name: /reconocer/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/actualizada por otra persona/i)
  })
})
