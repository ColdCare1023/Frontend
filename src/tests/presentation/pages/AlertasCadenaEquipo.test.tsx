import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuthStore } from '@/application/stores/authStore'
import type { AlertaTermica } from '@/domain/entities/AlertaTermica'
import { ROLES, type Rol } from '@/domain/value-objects/Rol'

const useAlertas = vi.hoisted(() => vi.fn())
vi.mock('@/application/hooks/useAlertas', () => ({ useAlertas }))
vi.mock('@/application/hooks/useIncidentesOperativos', () => ({
  useIncidentesOperativos: () => ({ incidentes: [], cargando: false, errorCarga: false, consultar: vi.fn() }),
}))
vi.mock('@/application/hooks/useAtendidasRecientes', () => ({
  useAtendidasRecientes: () => ({ alertas: [], estado: 'listo', limite: 50, recargar: vi.fn() }),
}))

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

function Destino() {
  const { pathname, search } = useLocation()
  return <p data-testid="destino">{`${pathname}${search}`}</p>
}

function sesionCon(rol: Rol | null) {
  useAuthStore.setState(
    rol
      ? { usuario: { id: 'u-1', email: `${rol}@upc.pe`, rol, expiraEn: Date.now() + 3600_000 }, autenticado: true }
      : { usuario: null, autenticado: false },
  )
}

function montar() {
  useAlertas.mockReturnValue({
    alertas: [ALERTA],
    cargando: false,
    filtro: 'todas',
    setFiltro: vi.fn(),
    reconocerAlerta: vi.fn(),
    registrarAccionCorrectiva: vi.fn(),
    obtenerCicloAtencion: vi.fn().mockResolvedValue([]),
    rectificarAccion: vi.fn(),
  })
  render(
    <MemoryRouter initialEntries={['/alertas']}>
      <Routes>
        <Route path="/alertas" element={<AlertasPage />} />
        <Route path="/trazabilidad" element={<Destino />} />
      </Routes>
    </MemoryRouter>,
  )
}

async function abrirCronologia() {
  const usuario = userEvent.setup()
  await usuario.click(screen.getByRole('button', { name: /cronología de atención.*FARM-01-CDL/i }))
  return { usuario, dialogo: await screen.findByRole('dialog') }
}

/**
 * HU-28 esc. 3 (P2 de la revalidación R2): desde la Cronología de una alerta el
 * Auditor llega a Trazabilidad con la cadena de ese equipo ya elegida, para
 * comprobar la integridad del ciclo por su chain_id.
 */
describe('AlertasPage — HU-28: «Verificar cadena del equipo» desde la Cronología', () => {
  beforeEach(() => {
    useAlertas.mockReset()
  })

  it.each(ROLES)('%s (puede abrir /trazabilidad) ve el enlace a la cadena del equipo', async (rol) => {
    sesionCon(rol)
    montar()
    const { dialogo } = await abrirCronologia()

    const enlace = await within(dialogo).findByRole('link', { name: 'Verificar cadena del equipo' })
    expect(enlace).toHaveAttribute('href', '/trazabilidad?cadena=FARM-01-CDL')
  })

  it('el enlace lleva a Trazabilidad con la cadena preseleccionada en la URL', async () => {
    sesionCon('auditor')
    montar()
    const { usuario, dialogo } = await abrirCronologia()

    await usuario.click(await within(dialogo).findByRole('link', { name: 'Verificar cadena del equipo' }))

    expect(await screen.findByTestId('destino')).toHaveTextContent('/trazabilidad?cadena=FARM-01-CDL')
  })

  it('sin sesión no se ofrece (no podría abrir /trazabilidad)', async () => {
    sesionCon(null)
    montar()
    const { dialogo } = await abrirCronologia()

    await within(dialogo).findByText(/Sin acciones correctivas registradas/i)
    expect(within(dialogo).queryByRole('link', { name: 'Verificar cadena del equipo' })).not.toBeInTheDocument()
  })
})
