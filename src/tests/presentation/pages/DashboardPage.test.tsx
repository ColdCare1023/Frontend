import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { LecturaTermica } from '@/domain/entities/LecturaTermica'

const useMonitoreoTermico = vi.hoisted(() => vi.fn())

vi.mock('@/application/hooks/useMonitoreoTermico', () => ({ useMonitoreoTermico }))

// ECharts monta sobre un canvas real, que jsdom no implementa. La gráfica no es
// lo que se está afirmando aquí, así que se sustituye por un marcador.
vi.mock('@/infrastructure/charts/EChartWrapper', () => ({
  EChartWrapper: () => <div data-testid="grafica" />,
}))

import { DashboardPage } from '@/presentation/pages/DashboardPage'

function lectura(overrides: Partial<LecturaTermica> = {}): LecturaTermica {
  return {
    id: 'l-1',
    device_id: 'FARM-01-CDL',
    timestamp: '2026-07-25T12:34:56Z',
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
    modelo_version: '1.0.0',
    origen_clasificacion: 'random_forest',
    estado_inferencia: 'completada',
    motivo_no_inferencia: null,
    ...overrides,
  }
}

function renderizar(ultima: LecturaTermica, sseConectado = true) {
  useMonitoreoTermico.mockReturnValue({ ultima, serie: [ultima], sseConectado })
  return render(
    <MemoryRouter>
      <DashboardPage />
    </MemoryRouter>,
  )
}

describe('DashboardPage — RF-18: conectividad del dispositivo', () => {
  beforeEach(() => {
    useMonitoreoTermico.mockReset()
  })

  it('muestra el dispositivo en línea junto a su identificador', () => {
    renderizar(lectura({ estado_conectividad: 'online' }))

    expect(screen.getByText('FARM-01-CDL')).toBeInTheDocument()
    expect(screen.getByTestId('conectividad-dispositivo')).toHaveTextContent('En línea')
  })

  it('muestra el dispositivo sin conexión cuando el nodo dejó de reportar', () => {
    renderizar(lectura({ estado_conectividad: 'offline' }))

    expect(screen.getByTestId('conectividad-dispositivo')).toHaveTextContent('Sin conexión')
  })

  it('distingue la conectividad del nodo del estado del stream SSE', () => {
    // RF-18 se refiere al dispositivo registrado, no al EventSource del
    // navegador: un dashboard con SSE sano puede estar mirando un nodo caído,
    // y ese es justo el caso que la farmacia necesita ver.
    renderizar(lectura({ estado_conectividad: 'offline' }), true)

    const insignia = screen.getByTestId('conectividad-dispositivo')
    expect(insignia).toHaveTextContent('Sin conexión')

    // El indicador SSE sigue en línea, y no es la insignia del dispositivo:
    // ambos comparten vocabulario pero no estado.
    const enLinea = screen.getAllByText('En línea')
    expect(enLinea.length).toBeGreaterThan(0)
    expect(enLinea.some((el) => insignia.contains(el))).toBe(false)
  })
})

describe('DashboardPage — HU-34: riesgo efectivo vs. clasificación IA', () => {
  beforeEach(() => {
    useMonitoreoTermico.mockReset()
  })

  it('muestra el riesgo efectivo como estado principal, no la clase cruda de la IA', () => {
    renderizar(
      lectura({ nivel_riesgo: 'riesgo_preventivo', riesgo_efectivo: 'excursion_critica', excursion_confirmada: true }),
    )

    expect(screen.getAllByText(/excursión crítica/i).length).toBeGreaterThan(0)
  })

  it('marca la excursión como confirmada cuando la regla directa la respalda', () => {
    renderizar(lectura({ riesgo_efectivo: 'excursion_critica', excursion_confirmada: true }))

    expect(screen.getAllByText(/confirmada por temperatura/i).length).toBeGreaterThan(0)
  })

  it('no afirma una excursión confirmada si solo la IA la clasificó y la temperatura sigue en rango', () => {
    // Criterio 4 de HU-34: model_class = excursión crítica pero riesgo
    // efectivo distinto — se muestra diferenciado, sin alarmar como
    // confirmado.
    renderizar(
      lectura({ nivel_riesgo: 'excursion_critica', riesgo_efectivo: 'normal', excursion_confirmada: false }),
    )

    expect(screen.queryByText(/confirmada por temperatura/i)).not.toBeInTheDocument()
    expect(screen.getAllByText(/clasificó excursión crítica, pero la temperatura/i).length).toBeGreaterThan(0)
  })
})

describe('DashboardPage — HU-33 criterio 3: falla de sensor distinguible de "sin dato"', () => {
  beforeEach(() => {
    useMonitoreoTermico.mockReset()
  })

  it('muestra "falla de sensor" en vez de un valor null sin explicación', () => {
    renderizar(
      lectura({
        temperatura_interna: null,
        estado_sensores: { temperatura_interna: 'invalido', temperatura_ambiental: 'valido', humedad_ambiental: 'valido' },
      }),
    )

    expect(screen.getAllByText(/falla de sensor/i).length).toBeGreaterThan(0)
  })

  it('no marca falla cuando el sensor está válido, aunque el valor puntual sea 0', () => {
    renderizar(
      lectura({
        temperatura_interna: 0,
        estado_sensores: { temperatura_interna: 'valido', temperatura_ambiental: 'valido', humedad_ambiental: 'valido' },
      }),
    )

    expect(screen.queryByText(/falla de sensor/i)).not.toBeInTheDocument()
  })
})

describe('DashboardPage — HU-35: puerta MC-38 opcional', () => {
  beforeEach(() => {
    useMonitoreoTermico.mockReset()
  })

  it('muestra la puerta abierta con su duración', () => {
    renderizar(lectura({ apertura_refrigerador: true, duracion_apertura_segundos: 45 }))

    expect(screen.getAllByText(/abierta/i).length).toBeGreaterThan(0)
    expect(screen.getByText('· 0:45')).toBeInTheDocument()
  })

  it('resalta la advertencia cuando la apertura supera el umbral configurado', () => {
    renderizar(lectura({ apertura_refrigerador: true, duracion_apertura_segundos: 200 }))

    const advertencia = screen.getByTestId('puerta-advertencia')
    expect(advertencia).toHaveAttribute('role', 'alert')
    expect(advertencia).toHaveTextContent(/abierta/i)
    expect(advertencia).toHaveTextContent(/revisar el refrigerador/i)
  })

  it('no resalta una apertura corta, por debajo del umbral', () => {
    renderizar(lectura({ apertura_refrigerador: true, duracion_apertura_segundos: 30 }))

    expect(screen.getByTestId('puerta-advertencia')).not.toHaveAttribute('role', 'alert')
  })

  it('no presenta una falsa "puerta cerrada" cuando el dispositivo no tiene MC-38', () => {
    renderizar(lectura({ apertura_refrigerador: null }))

    expect(screen.getAllByText(/sin sensor mc-38/i).length).toBeGreaterThan(0)
    expect(screen.queryAllByText(/puerta: abierta/i)).toHaveLength(0)
    expect(screen.queryAllByText(/puerta: cerrada/i)).toHaveLength(0)
  })
})
