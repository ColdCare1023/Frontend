import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { LecturaTermica } from '@/domain/entities/LecturaTermica'

const useMonitoreoTermico = vi.hoisted(() => vi.fn())
// HU-13: estado del nodo según el backend. Por defecto vacío, igual que cuando
// el endpoint no responde en pruebas.
const equiposOperativos = vi.hoisted(() => ({ lista: [] as unknown[] }))

vi.mock('@/application/hooks/useMonitoreoTermico', () => ({ useMonitoreoTermico }))
vi.mock('@/application/hooks/useEstadoOperativo', () => ({
  useEstadoOperativo: () => ({ equipos: equiposOperativos.lista, consultar: async () => {} }),
}))

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
    equiposOperativos.lista = []
  })

  it('HU-13: muestra el estado del NODO y desde cuándo, no el de la última lectura', () => {
    // La lectura se envió conectada (siempre lo está al enviarse); el LWT
    // posterior dejó al nodo offline en el backend.
    equiposOperativos.lista = [
      {
        id: 'FARM-01-CDL',
        estado_conectividad: 'offline',
        conectividad_cambiada_en: '2026-07-25T12:40:00Z',
        estado_operativo: 'OPERATIVO',
        ultimo_reporte_en: '2026-07-25T12:34:56Z',
      },
    ]
    renderizar(lectura({ estado_conectividad: 'online' }))

    expect(screen.getByTestId('conectividad-dispositivo')).toHaveTextContent(/Sin conexión desde las/)
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
    const enLinea = screen.getAllByText('En vivo')
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

    expect(screen.getAllByText(/temperatura salió del rango/i).length).toBeGreaterThan(0)
  })

  it('no afirma una excursión confirmada si solo la IA la clasificó y la temperatura sigue en rango', () => {
    // Criterio 4 de HU-34: model_class = excursión crítica pero riesgo
    // efectivo distinto — se muestra diferenciado, sin alarmar como
    // confirmado.
    renderizar(
      lectura({ nivel_riesgo: 'excursion_critica', riesgo_efectivo: 'normal', excursion_confirmada: false }),
    )

    expect(screen.queryByText(/temperatura salió del rango/i)).not.toBeInTheDocument()
    expect(screen.getAllByText(/análisis automático sugiere revisar/i).length).toBeGreaterThan(0)
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

    expect(screen.getAllByText(/no hay lectura de temperatura/i).length).toBeGreaterThan(0)
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

  it('explica cuando la lectura real supera la escala visual fija del indicador', () => {
    renderizar(lectura({ temperatura_interna: 12.4, nivel_riesgo: 'excursion_critica', riesgo_efectivo: 'excursion_critica', excursion_confirmada: true }))

    expect(screen.getByText(/sobre la escala del indicador \(0–10 °C\)/i)).toBeInTheDocument()
    expect(screen.getByText(/Valor real: 12\.4 °C/i)).toBeInTheDocument()
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

  // Con `apertura_continua_segundos` (backend actual), la duración mostrada es
  // la de la apertura en curso, no la de la ventana de muestreo.
  it('muestra cuánto lleva abierta la puerta sin cerrarse', () => {
    renderizar(lectura({
      apertura_refrigerador: true, duracion_apertura_segundos: 10,
      apertura_continua_segundos: 95, umbral_puerta_abierta_segundos: 120,
    }))

    expect(screen.getByText(/desde hace 1:35/)).toBeInTheDocument()
    expect(screen.getByTestId('puerta-advertencia')).not.toHaveAttribute('role', 'alert')
  })

  it('avisa la apertura prolongada aunque la ventana de muestreo sea corta', () => {
    renderizar(lectura({
      apertura_refrigerador: true, duracion_apertura_segundos: 10,
      apertura_continua_segundos: 75, umbral_puerta_abierta_segundos: 60,
    }))

    expect(screen.getByTestId('puerta-advertencia')).toHaveAttribute('role', 'alert')
  })

  it('una apertura ya cerrada se muestra como cerrada con su duración', () => {
    renderizar(lectura({
      apertura_refrigerador: true, duracion_apertura_segundos: 24,
      apertura_continua_segundos: null, umbral_puerta_abierta_segundos: 60,
    }))

    expect(screen.queryByTestId('puerta-advertencia')).not.toBeInTheDocument()
    expect(screen.getByText(/se abrió 24 s desde la lectura anterior/i)).toBeInTheDocument()
  })

  it('no presenta una falsa "puerta cerrada" cuando el dispositivo no tiene MC-38', () => {
    renderizar(lectura({ apertura_refrigerador: null }))

    expect(screen.getAllByText(/no disponible/i).length).toBeGreaterThan(0)
    expect(screen.queryAllByText(/puerta: abierta/i)).toHaveLength(0)
    expect(screen.queryAllByText(/puerta: cerrada/i)).toHaveLength(0)
  })
})
