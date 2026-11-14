import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuthStore } from '@/application/stores/authStore'
import type { AlertaTermica } from '@/domain/entities/AlertaTermica'
import type { IncidenteOperativo } from '@/domain/entities/Dispositivo'

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

const incidente = (over: Partial<IncidenteOperativo> = {}): IncidenteOperativo => ({
  id: 'i-1',
  device_id: 'FARM-02-CDL',
  tipo: 'sin_datos',
  estado: 'activo',
  detectado_en: '2026-07-25T11:00:00Z',
  ultimo_reporte_en: null,
  umbral_silencio_segundos: 90,
  recuperado_en: null,
  ...over,
})

function montar({
  alertas = [alerta()],
  incidentes = { incidentes: [] as IncidenteOperativo[], cargando: false, errorCarga: false, consultar: vi.fn() },
  atendidas = [] as AlertaTermica[],
} = {}) {
  useAlertas.mockReturnValue({
    alertas,
    cargando: false,
    errorCarga: false,
    filtro: 'pendiente',
    setFiltro: vi.fn(),
    reconocerAlerta: vi.fn(),
    registrarAccionCorrectiva: vi.fn(),
    obtenerCicloAtencion: vi.fn().mockResolvedValue([]),
  })
  useIncidentesOperativos.mockReturnValue(incidentes)
  useAtendidasRecientes.mockReturnValue({ alertas: atendidas, estado: 'listo', limite: 50, recargar: vi.fn() })
  render(
    <MemoryRouter>
      <AlertasPage />
    </MemoryRouter>,
  )
  return incidentes
}

const tarjeta = () => screen.getByRole('region', { name: 'Incidentes operativos' })

describe('Rail de Alertas (HU-54, cinta 24 h, atendidas recientes)', () => {
  beforeEach(() => {
    useAuthStore.setState({
      usuario: { id: 'u-1', email: 'f@upc.pe', rol: 'farmaceutico', expiraEn: Date.now() + 3600_000 },
      autenticado: true,
    })
  })

  it('incidentes: activos primero, con icono y texto por tipo', () => {
    montar({
      incidentes: {
        incidentes: [
          incidente({ id: 'r', device_id: 'FARM-03-CDL', estado: 'resuelto', recuperado_en: '2026-07-25T11:30:00Z', tipo: 'monitoreo_suspendido' }),
          incidente({ id: 'a' }),
        ],
        cargando: false,
        errorCarga: false,
        consultar: vi.fn(),
      },
    })

    const items = within(tarjeta()).getAllByRole('listitem')
    expect(items[0]).toHaveTextContent('FARM-02-CDL')
    expect(items[0]).toHaveTextContent('Sin datos')
    expect(items[1]).toHaveTextContent('Monitoreo suspendido por rotación')
    expect(within(tarjeta()).getByText('1 activo')).toBeInTheDocument()
  })

  it('sin datos activo no se pinta como excursión crítica', () => {
    montar({ incidentes: { incidentes: [incidente()], cargando: false, errorCarga: false, consultar: vi.fn() } })

    const insignia = within(tarjeta()).getByText('Activo')
    expect(insignia.className).toContain('bg-nodata-100')
    expect(insignia.className).not.toContain('critical')
  })

  it('error de incidentes ofrece reintentar', async () => {
    const consulta = montar({ incidentes: { incidentes: [], cargando: false, errorCarga: true, consultar: vi.fn() } })

    expect(within(tarjeta()).getByText(/no pudimos cargar los incidentes/i)).toBeInTheDocument()
    await userEvent.setup().click(within(tarjeta()).getByRole('button', { name: 'Volver a intentar' }))
    expect(consulta.consultar).toHaveBeenCalled()
  })

  it('la tarjeta de incidentes se muestra vacía con su texto', () => {
    montar()
    expect(within(tarjeta()).getByText('Sin incidentes operativos recientes.')).toBeInTheDocument()
  })

  it('atendidas recientemente aparece con pocas filas y desaparece con 5 o más', () => {
    const atendidas = [alerta({ id: 'at-1', estado: 'atendida', device_id: 'FARM-09-CDL', atendida_en: '2026-07-25T13:00:00Z' })]
    montar({ atendidas })
    expect(screen.getByRole('heading', { name: 'Atendidas recientemente' })).toBeInTheDocument()
  })

  it('con 5 pendientes no muestra atendidas recientemente', () => {
    const atendidas = [alerta({ id: 'at-1', estado: 'atendida', atendida_en: '2026-07-25T13:00:00Z' })]
    montar({ alertas: Array.from({ length: 5 }, (_, i) => alerta({ id: `p-${i}` })), atendidas })
    expect(screen.queryByRole('heading', { name: 'Atendidas recientemente' })).not.toBeInTheDocument()
  })
})
