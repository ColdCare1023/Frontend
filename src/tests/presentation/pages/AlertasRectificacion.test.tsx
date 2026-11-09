import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuthStore } from '@/application/stores/authStore'
import type { AccionCorrectiva, AlertaTermica } from '@/domain/entities/AlertaTermica'
import type { Rol } from '@/domain/value-objects/Rol'

const useAlertas = vi.hoisted(() => vi.fn())
vi.mock('@/application/hooks/useAlertas', () => ({ useAlertas }))

import { AlertasPage } from '@/presentation/pages/AlertasPage'

const ALERTA: AlertaTermica = {
  id: 'al-1',
  reading_id: 'l-1',
  device_id: 'FARM-01-CDL',
  nivel_riesgo: 'excursion_critica',
  mensaje: 'Temperatura fuera del rango 2-8 °C',
  revisada: true,
  revisada_por: 'u-9',
  revisada_por_nombre: 'Q.F. Ana Ríos',
  created_at: '2026-07-25T12:00:00Z',
  estado: 'atendida',
  reconocida_en: '2026-07-25T12:05:00Z',
  atendida_en: '2026-07-25T12:20:00Z',
}

const ORIGINAL: AccionCorrectiva = {
  id: 'ac-1',
  alert_id: 'al-1',
  usuario_id: 'u-tec',
  usuario_nombre: 'María Técnica',
  descripcion: 'Traslado del lote a las 03:40.',
  created_at: '2026-07-25T12:20:00Z',
  corrige_accion_id: null,
  vigente: true,
}

function sesionCon(rol: Rol, id = 'u-1') {
  useAuthStore.setState({
    usuario: { id, email: `${rol}@upc.pe`, rol, expiraEn: Date.now() + 3600_000 },
    autenticado: true,
  })
}

function montar(ciclo: AccionCorrectiva[], rectificarAccion = vi.fn().mockResolvedValue('ok')) {
  useAlertas.mockReturnValue({
    alertas: [ALERTA],
    cargando: false,
    filtro: 'todas',
    setFiltro: vi.fn(),
    reconocerAlerta: vi.fn(),
    registrarAccionCorrectiva: vi.fn(),
    obtenerCicloAtencion: vi.fn().mockResolvedValue(ciclo),
    rectificarAccion,
  })
  render(<MemoryRouter><AlertasPage /></MemoryRouter>)
  return rectificarAccion
}

async function abrirCronologia() {
  const usuario = userEvent.setup()
  await usuario.click(screen.getByRole('button', { name: /opciones/i }))
  await usuario.click(await screen.findByRole('menuitem', { name: /FARM-01-CDL/i }))
  return { usuario, dialogo: await screen.findByRole('dialog') }
}

describe('AlertasPage — HU-28: rectificación trazable', () => {
  beforeEach(() => {
    useAlertas.mockReset()
  })

  it('muestra nombres, la acción rectificada y el motivo de la rectificación', async () => {
    sesionCon('auditor')
    montar([
      { ...ORIGINAL, vigente: false, rectificada_por_id: 'ac-2' },
      {
        ...ORIGINAL,
        id: 'ac-2',
        corrige_accion_id: 'ac-1',
        descripcion: 'Traslado del lote a las 03:10.',
        motivo_rectificacion: 'Se registró la hora equivocada.',
        created_at: '2026-07-25T13:00:00Z',
      },
    ])
    const { dialogo } = await abrirCronologia()

    expect(await within(dialogo).findByText(/Q\.F\. Ana Ríos/)).toBeInTheDocument()
    expect(within(dialogo).getAllByText(/María Técnica/)).toHaveLength(2)
    expect(within(dialogo).getByText('Rectificada')).toBeInTheDocument()
    expect(within(dialogo).getByText(/Rectifica la acción del/)).toBeInTheDocument()
    expect(within(dialogo).getByText(/Se registró la hora equivocada/)).toBeInTheDocument()
    // El auditor nunca rectifica.
    expect(within(dialogo).queryByRole('button', { name: /^rectificar$/i })).not.toBeInTheDocument()
  })

  it('un farmacéutico rectifica la versión vigente con su motivo', async () => {
    sesionCon('farmaceutico')
    const rectificar = montar([ORIGINAL])
    const { usuario, dialogo } = await abrirCronologia()

    await usuario.click(await within(dialogo).findByRole('button', { name: /^rectificar$/i }))
    const texto = within(dialogo).getByLabelText(/descripción corregida/i)
    await usuario.clear(texto)
    await usuario.type(texto, 'Traslado del lote a las 03:10.')
    const guardar = within(dialogo).getByRole('button', { name: /guardar rectificación/i })
    expect(guardar).toBeDisabled() // sin motivo todavía
    await usuario.type(within(dialogo).getByLabelText(/motivo de la rectificación/i), 'Hora equivocada en el registro.')
    await usuario.click(guardar)

    expect(rectificar).toHaveBeenCalledWith('ac-1', 'Traslado del lote a las 03:10.', 'Hora equivocada en el registro.')
  })

  it('un técnico solo puede rectificar sus propias acciones', async () => {
    sesionCon('tecnico', 'u-otro')
    montar([ORIGINAL])
    const { dialogo } = await abrirCronologia()
    await within(dialogo).findByText(/María Técnica/)
    expect(within(dialogo).queryByRole('button', { name: /^rectificar$/i })).not.toBeInTheDocument()
  })

  it('una acción ya rectificada no ofrece volver a rectificarla', async () => {
    sesionCon('farmaceutico')
    montar([{ ...ORIGINAL, vigente: false, rectificada_por_id: 'ac-2' }])
    const { dialogo } = await abrirCronologia()
    await within(dialogo).findByText('Rectificada')
    expect(within(dialogo).queryByRole('button', { name: /^rectificar$/i })).not.toBeInTheDocument()
  })
})
