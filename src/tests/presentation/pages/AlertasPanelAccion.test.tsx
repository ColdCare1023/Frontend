import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuthStore } from '@/application/stores/authStore'
import type { AlertaTermica } from '@/domain/entities/AlertaTermica'
import type { Rol } from '@/domain/value-objects/Rol'

const useAlertas = vi.hoisted(() => vi.fn())
const useIncidentesOperativos = vi.hoisted(() => vi.fn())
const useAtendidasRecientes = vi.hoisted(() => vi.fn())
vi.mock('@/application/hooks/useAlertas', () => ({ useAlertas }))
vi.mock('@/application/hooks/useIncidentesOperativos', () => ({ useIncidentesOperativos }))
vi.mock('@/application/hooks/useAtendidasRecientes', () => ({ useAtendidasRecientes }))

import { AlertasPage } from '@/presentation/pages/AlertasPage'

const alerta = (over: Partial<AlertaTermica> = {}): AlertaTermica => ({
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
})

function sesionCon(rol: Rol) {
  useAuthStore.setState({
    usuario: { id: 'u-1', email: `${rol}@upc.pe`, rol, expiraEn: Date.now() + 3600_000 },
    autenticado: true,
  })
}

function montar(alertas: AlertaTermica[], over: Record<string, unknown> = {}) {
  const valor = {
    alertas,
    cargando: false,
    errorCarga: false,
    filtro: 'pendiente',
    setFiltro: vi.fn(),
    reintentar: vi.fn(),
    reconocerAlerta: vi.fn().mockResolvedValue('ok'),
    registrarAccionCorrectiva: vi.fn().mockResolvedValue('ok'),
    obtenerCicloAtencion: vi.fn().mockResolvedValue([]),
    rectificarAccion: vi.fn().mockResolvedValue('ok'),
    ...over,
  }
  useAlertas.mockReturnValue(valor)
  render(
    <MemoryRouter>
      <AlertasPage />
    </MemoryRouter>,
  )
  return valor
}

async function abrirAccion(usuario = userEvent.setup(), equipo = 'FARM-01-CDL') {
  await usuario.click(screen.getByRole('button', { name: new RegExp(`registrar acción correctiva para la alerta de ${equipo}`, 'i') }))
  return { usuario, dialogo: await screen.findByRole('dialog') }
}

async function completar(usuario: ReturnType<typeof userEvent.setup>, dialogo: HTMLElement) {
  await usuario.type(within(dialogo).getByLabelText('Decisión adoptada'), '  Inmovilizar  ')
  await usuario.type(within(dialogo).getByLabelText('Descripción de la acción correctiva'), 'Se reubicaron los viales ')
  await usuario.type(within(dialogo).getByLabelText('Justificación'), ' Superó 8 °C')
}

describe('Panel de acción correctiva (HU-27)', () => {
  beforeEach(() => {
    useAlertas.mockReset()
    useIncidentesOperativos.mockReturnValue({ incidentes: [], cargando: false, errorCarga: false, consultar: vi.fn() })
    useAtendidasRecientes.mockReturnValue({ alertas: [], estado: 'listo', limite: 50, recargar: vi.fn() })
    sesionCon('farmaceutico')
  })

  it('abre el panel en la pestaña Acción con las tres casillas de HU-27 en orden', async () => {
    montar([alerta()])
    const { dialogo } = await abrirAccion()

    expect(within(dialogo).getByRole('tab', { name: 'Acción correctiva' })).toHaveAttribute('aria-selected', 'true')
    const campos = within(dialogo).getAllByRole('textbox').map((c) => c.id)
    expect(campos).toEqual(['accion-decision', 'accion-descripcion', 'accion-justificacion'])
    expect(document.activeElement).toBe(within(dialogo).getByLabelText('Decisión adoptada'))
  })

  it('Guardar queda aria-disabled y explica qué falta hasta completar los tres campos', async () => {
    const { registrarAccionCorrectiva } = montar([alerta()])
    const { usuario, dialogo } = await abrirAccion()

    const guardar = within(dialogo).getByRole('button', { name: /guardar acción/i })
    expect(guardar).toHaveAttribute('aria-disabled', 'true')
    expect(guardar).toHaveAccessibleDescription(/falta completar: decisión adoptada/i)
    await usuario.click(guardar)
    expect(registrarAccionCorrectiva).not.toHaveBeenCalled()
  })

  it('envía decisión, descripción y justificación recortadas', async () => {
    const { registrarAccionCorrectiva } = montar([alerta()])
    const { usuario, dialogo } = await abrirAccion()
    await completar(usuario, dialogo)
    await usuario.click(within(dialogo).getByRole('button', { name: /guardar acción/i }))

    expect(registrarAccionCorrectiva).toHaveBeenCalledWith('al-1', {
      decision: 'Inmovilizar',
      descripcion: 'Se reubicaron los viales',
      justificacion: 'Superó 8 °C',
    })
  })

  it('tras guardar anuncia, pasa a Cronología y no se cierra', async () => {
    montar([alerta()])
    const { usuario, dialogo } = await abrirAccion()
    await completar(usuario, dialogo)
    await usuario.click(within(dialogo).getByRole('button', { name: /guardar acción/i }))

    expect(await within(dialogo).findByText('Acción correctiva registrada.')).toBeInTheDocument()
    await waitFor(() => expect(within(dialogo).getByRole('heading', { name: 'Cronología de atención' })).toBeInTheDocument())
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('conflicto 409 conserva el borrador y ofrece ver la cronología', async () => {
    montar([alerta()], { registrarAccionCorrectiva: vi.fn().mockResolvedValue('conflicto') })
    const { usuario, dialogo } = await abrirAccion()
    await completar(usuario, dialogo)
    await usuario.click(within(dialogo).getByRole('button', { name: /guardar acción/i }))

    expect(await within(dialogo).findByRole('alert')).toHaveTextContent(/actualizada por otra persona/i)
    expect(within(dialogo).getByLabelText('Decisión adoptada')).toHaveValue('  Inmovilizar  ')
    expect(within(dialogo).getByRole('button', { name: 'Ver cronología' })).toBeInTheDocument()
  })

  it('error de red conserva el borrador y muestra el error', async () => {
    montar([alerta()], { registrarAccionCorrectiva: vi.fn().mockResolvedValue('error') })
    const { usuario, dialogo } = await abrirAccion()
    await completar(usuario, dialogo)
    await usuario.click(within(dialogo).getByRole('button', { name: /guardar acción/i }))

    expect(await within(dialogo).findByRole('alert')).toHaveTextContent(/no se pudo guardar la acción/i)
    expect(within(dialogo).getByLabelText('Justificación')).toHaveValue(' Superó 8 °C')
  })

  it('el borrador de una alerta no aparece en otra', async () => {
    montar([alerta(), alerta({ id: 'al-2', device_id: 'FARM-02-CDL', created_at: '2026-07-25T13:00:00Z' })])
    const usuario = userEvent.setup()
    const { dialogo } = await abrirAccion(usuario)
    await usuario.type(within(dialogo).getByLabelText('Decisión adoptada'), 'Inmovilizar')
    await usuario.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    const otra = await abrirAccion(usuario, 'FARM-02-CDL')
    expect(within(otra.dialogo).getByLabelText('Decisión adoptada')).toHaveValue('')
    await usuario.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    // Esc conserva el borrador de la primera.
    const primera = await abrirAccion(usuario)
    expect(within(primera.dialogo).getByLabelText('Decisión adoptada')).toHaveValue('Inmovilizar')
  })

  it('Ctrl+Enter guarda cuando el formulario es válido', async () => {
    const { registrarAccionCorrectiva } = montar([alerta()])
    const { usuario, dialogo } = await abrirAccion()
    await completar(usuario, dialogo)
    await usuario.keyboard('{Control>}{Enter}{/Control}')

    expect(registrarAccionCorrectiva).toHaveBeenCalledTimes(1)
  })

  it('al cerrar devuelve el foco al botón que lo abrió', async () => {
    montar([alerta()])
    const usuario = userEvent.setup()
    const boton = screen.getByRole('button', { name: /registrar acción correctiva/i })
    await usuario.click(boton)
    await screen.findByRole('dialog')
    await usuario.keyboard('{Escape}')

    await waitFor(() => expect(document.activeElement).toBe(boton))
  })

  it('auditor y alertas atendidas no tienen pestaña Acción', async () => {
    montar([alerta({ estado: 'atendida' })], { filtro: 'atendida' })
    const usuario = userEvent.setup()
    await usuario.click(screen.getByRole('button', { name: /cronología de atención/i }))
    const dialogo = await screen.findByRole('dialog')

    expect(within(dialogo).queryByRole('tablist')).not.toBeInTheDocument()
    expect(within(dialogo).queryByLabelText('Decisión adoptada')).not.toBeInTheDocument()
  })
})
