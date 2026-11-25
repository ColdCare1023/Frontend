import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuthStore } from '@/application/stores/authStore'
import { useEstadoVivoStore, type ResumenAlertas } from '@/application/stores/estadoVivoStore'
import i18n from '@/infrastructure/i18n'
import type { AlertaTermica } from '@/domain/entities/AlertaTermica'
import type { Rol } from '@/domain/value-objects/Rol'
import { PildoraEstado } from '@/presentation/components/estado-vivo/PildoraEstado'

// El AppLayout monta el alimentador real; aquí solo importa lo que se pinta.
vi.mock('@/application/hooks/useEstadoVivo', () => ({ useFuenteEstadoVivo: () => {} }))

const ahora = new Date().toISOString()

function sesion(rol: Rol) {
  useAuthStore.setState({ usuario: { id: 'u', email: `${rol}@upc.pe`, rol, expiraEn: Date.now() + 3600_000 }, autenticado: true })
}

function estadoDemo(alertas: ResumenAlertas | null = { total: 2, criticas: 1, truncado: false, recientes: [] }) {
  useEstadoVivoStore.setState({
    carga: 'listo',
    conectado: true,
    actualizadoEn: Date.now(),
    equipos: [
      { id: 'FARM-01', nombre: 'Refrigerador principal', estadoOperativo: 'OPERATIVO', conectividad: 'online', ultimoReporteEn: ahora },
      { id: 'FARM-02', nombre: 'Cámara fría de vacunas', estadoOperativo: 'SIN_DATOS', conectividad: 'online', ultimoReporteEn: null },
    ],
    ultimas: { 'FARM-01': { temperatura: 5.2, riesgo: 'normal', timestamp: ahora } },
    alertas,
  })
}

function Ubicacion() {
  const ubicacion = useLocation()
  return <p data-testid="ruta">{ubicacion.pathname}{ubicacion.hash}</p>
}

function montar() {
  return render(
    <MemoryRouter initialEntries={['/historial']}>
      <PildoraEstado />
      <Routes>
        <Route path="*" element={<Ubicacion />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(async () => {
  await i18n.changeLanguage('es')
  sesion('farmaceutico')
})
afterEach(() => useEstadoVivoStore.getState().reiniciar())

describe('PildoraEstado', () => {
  it('el nombre accesible resume equipo, temperatura, estado, incidencias, alertas y conexión', () => {
    estadoDemo()
    montar()
    expect(
      screen.getByRole('button', {
        name: 'Estado en vivo. Requiere atención. Refrigerador principal: 5.2\u202F°C, Normal. 1 equipo más con incidencia. 2 alertas sin atender, 1 crítica. Conectado en vivo',
      }),
    ).toBeInTheDocument()
  })

  it('HU-32 esc. 3: con el tope de flujos dice «Demasiadas pestañas en tiempo real», no «Sin conexión»', async () => {
    estadoDemo()
    useEstadoVivoStore.setState({ conectado: false, motivoDesconexion: 'demasiados_flujos' })
    montar()

    const boton = screen.getByRole('button', { name: /Estado en vivo/ })
    expect(boton).toHaveAccessibleName(/Demasiadas pestañas en tiempo real/)
    expect(boton).not.toHaveAccessibleName(/Sin conexión en vivo/)
    await userEvent.setup().click(boton)
    const panel = await screen.findByRole('dialog')
    expect(within(panel).getByText('Demasiadas pestañas en tiempo real')).toBeInTheDocument()
  })

  it('señala la incidencia de la flota aunque el equipo principal esté en rango', () => {
    estadoDemo()
    montar()
    expect(screen.getByRole('button', { name: /Estado en vivo/ })).toHaveTextContent('Requiere atención')
  })

  it('abre el panel con Enter, lista los equipos como enlaces y Escape devuelve el foco', async () => {
    const usuario = userEvent.setup()
    estadoDemo()
    montar()
    const pildora = screen.getByRole('button', { name: /^Estado en vivo/ })
    pildora.focus()
    await usuario.keyboard('{Enter}')
    const panel = await screen.findByRole('dialog', { name: 'Estado en vivo' })
    expect(panel).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Refrigerador principal/ })).toHaveAttribute('href', '/dashboard')
    expect(screen.getByRole('link', { name: /Cámara fría de vacunas/ })).toHaveTextContent('Sin datos')
    await usuario.keyboard('{Escape}')
    await waitFor(() => expect(pildora).toHaveFocus())
  })

  it('«Ver alertas» lleva al área de atención del farmacéutico y cierra el panel', async () => {
    const usuario = userEvent.setup()
    estadoDemo({
      total: 1,
      criticas: 1,
      truncado: false,
      recientes: [{ id: 'a1', device_id: 'FARM-01', nivel_riesgo: 'excursion_critica', created_at: ahora } as AlertaTermica],
    })
    montar()
    await usuario.click(screen.getByRole('button', { name: /^Estado en vivo/ }))
    await usuario.click(await screen.findByRole('link', { name: /Ver alertas/ }))
    expect(screen.getByTestId('ruta')).toHaveTextContent('/dashboard#alertas-monitoreo')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('sin alertas muestra «Sin alertas pendientes»', async () => {
    const usuario = userEvent.setup()
    estadoDemo({ total: 0, criticas: 0, truncado: false, recientes: [] })
    montar()
    await usuario.click(screen.getByRole('button', { name: /^Estado en vivo/ }))
    expect(await screen.findByText('Sin alertas pendientes')).toBeInTheDocument()
  })

  it('sin equipos muestra el estado vacío y solo el administrador ve «Registrar equipo»', async () => {
    const usuario = userEvent.setup()
    useEstadoVivoStore.setState({ carga: 'listo', conectado: true, equipos: [], ultimas: {}, alertas: { total: 0, criticas: 0, truncado: false, recientes: [] } })
    const { unmount } = montar()
    await usuario.click(screen.getByRole('button', { name: /^Estado en vivo/ }))
    expect(await screen.findByText('Aún no hay equipos registrados.')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Registrar equipo' })).not.toBeInTheDocument()
    unmount()

    sesion('administrador')
    montar()
    await usuario.click(screen.getByRole('button', { name: /^Estado en vivo/ }))
    expect(await screen.findByRole('link', { name: 'Registrar equipo' })).toHaveAttribute('href', '/dispositivos')
  })

  it('un error de carga ofrece Reintentar', async () => {
    const usuario = userEvent.setup()
    const refrescar = vi.fn()
    useEstadoVivoStore.setState({ carga: 'error', conectado: false, equipos: [], ultimas: {}, alertas: null, refrescar })
    montar()
    expect(screen.getByRole('button', { name: /Sin estado/ })).toBeInTheDocument()
    await usuario.click(screen.getByRole('button', { name: /^Estado en vivo/ }))
    await usuario.click(await screen.findByRole('button', { name: 'Volver a intentar' }))
    expect(refrescar).toHaveBeenCalledTimes(1)
  })
})
