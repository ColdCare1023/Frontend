import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { LecturaTermica } from '@/domain/entities/LecturaTermica'

const useHistorial = vi.hoisted(() => vi.fn())
vi.mock('@/application/hooks/useHistorial', () => ({ useHistorial }))

// HU-36 criterio 1: jsdom no implementa ResizeObserver, que EChartWrapper
// necesita — mismo mock que DashboardPage.test.tsx.
vi.mock('@/infrastructure/charts/EChartWrapper', () => ({
  EChartWrapper: () => <div data-testid="grafica" />,
}))

import { HistorialPage } from '@/presentation/pages/HistorialPage'

function lectura(over: Partial<LecturaTermica> = {}): LecturaTermica {
  return {
    id: 'l-1',
    device_id: 'FARM-01-CDL',
    timestamp: '2026-07-25T12:00:00Z',
    temperatura_ambiental: 5.2,
    humedad_ambiental: 62,
    temperatura_interna: 4.5,
    apertura_refrigerador: false,
    duracion_apertura_segundos: 0,
    estado_conectividad: 'online',
    nivel_riesgo: 'normal',
    excursion_confirmada: false,
    riesgo_efectivo: 'normal',
    confianza_ia: 0.98,
    modelo_version: '3.0.0',
    origen_clasificacion: 'random_forest',
    estado_inferencia: 'completada',
    motivo_no_inferencia: null,
    ...over,
  }
}

function montar(lecturas: LecturaTermica[], consultar = vi.fn()) {
  useHistorial.mockReturnValue({ lecturas, cargando: false, consultar })
  render(<HistorialPage />)
  return consultar
}

describe('HistorialPage (RF-12, HU-36)', () => {
  beforeEach(() => useHistorial.mockReset())

  it('muestra las lecturas consultadas', () => {
    montar([lectura()])

    expect(screen.getByText('FARM-01-CDL')).toBeInTheDocument()
    expect(screen.getByText(/4[.,]5/)).toBeInTheDocument()
  })

  it('ofrece los filtros que exige RF-12', () => {
    montar([lectura()])

    // Dispositivo, nivel de riesgo y rango de fechas: los ejes por los que se
    // reconstruye un episodio en una auditoría.
    expect(screen.getAllByText(/filtros/i).length).toBeGreaterThan(0)
    expect(screen.getByText(/nivel de riesgo/i)).toBeInTheDocument()
    expect(screen.getByText(/^desde$/i)).toBeInTheDocument()
    expect(screen.getByText(/^hasta$/i)).toBeInTheDocument()
  })

  it('vuelve a consultar el backend al aplicar un filtro', async () => {
    // El filtrado debe ocurrir server-side: si se filtrara en memoria, el
    // historial quedaría limitado a la página ya descargada.
    const consultar = montar([lectura()])
    consultar.mockClear()

    await userEvent.click(screen.getByRole('button', { name: /consultar|filtrar|buscar|aplicar/i }))

    expect(consultar).toHaveBeenCalled()
  })

  it('avisa cuando no hay lecturas para el filtro', () => {
    montar([])
    expect(screen.getByText(/no hay lecturas|sin lecturas|sin resultados/i)).toBeInTheDocument()
  })

  it('muestra la gráfica cuando hay lecturas (HU-36 criterio 1)', () => {
    montar([lectura()])
    expect(screen.getByTestId('grafica')).toBeInTheDocument()
  })

  it('no muestra la gráfica cuando no hay lecturas', () => {
    montar([])
    expect(screen.queryByTestId('grafica')).not.toBeInTheDocument()
  })

  it('bloquea la consulta en el frontend cuando el rango está invertido (HU-36 criterio 3)', async () => {
    const consultar = montar([lectura()])
    consultar.mockClear()

    await userEvent.type(screen.getByLabelText(/^desde$/i), '2026-07-25T12:00')
    await userEvent.type(screen.getByLabelText(/^hasta$/i), '2026-07-20T12:00')
    await userEvent.click(screen.getByRole('button', { name: /consultar|filtrar|buscar|aplicar/i }))

    expect(screen.getByRole('alert')).toHaveTextContent(/desde.*no puede ser posterior|posterior.*hasta/i)
    expect(consultar).not.toHaveBeenCalled()
  })
})

describe('HistorialPage — HU-34/HU-35: riesgo efectivo y puerta MC-38 opcional', () => {
  beforeEach(() => useHistorial.mockReset())

  it('muestra el riesgo efectivo de la lectura, no la clase cruda de la IA', () => {
    montar([lectura({ nivel_riesgo: 'riesgo_preventivo', riesgo_efectivo: 'excursion_critica' })])

    // La celda de riesgo debe reflejar `riesgo_efectivo`, no `nivel_riesgo`.
    expect(screen.getByRole('cell', { name: /excursión crítica/i })).toBeInTheDocument()
  })

  it('marca la puerta con un icono distinto cuando no hay MC-38 instalado, no como cerrada', () => {
    montar([lectura({ apertura_refrigerador: null })])

    expect(screen.getByRole('img', { name: /sin sensor mc-38/i })).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: /^cerrada$/i })).not.toBeInTheDocument()
  })
})
