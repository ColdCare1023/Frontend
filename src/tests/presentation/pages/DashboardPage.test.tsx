import { fireEvent, render, screen, within } from '@testing-library/react'
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

  it('el equipo mostrado por defecto no cambia solo cuando otro nodo reporta después', () => {
    const equipo = (id: string, ultimo: string) => ({
      id,
      estado_conectividad: 'online',
      estado_operativo: 'OPERATIVO',
      ultimo_reporte_en: ultimo,
    })
    equiposOperativos.lista = [equipo('FARM-A', '2026-07-25T12:00:30Z'), equipo('FARM-B', '2026-07-25T12:00:00Z')]
    const vista = renderizar(lectura({ device_id: 'FARM-A' }))
    expect(useMonitoreoTermico.mock.lastCall?.[1]).toBe('FARM-A')

    // Sondeo siguiente: ahora el último en reportar es B.
    equiposOperativos.lista = [equipo('FARM-A', '2026-07-25T12:00:30Z'), equipo('FARM-B', '2026-07-25T12:00:45Z')]
    vista.rerender(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    )
    expect(useMonitoreoTermico.mock.lastCall?.[1]).toBe('FARM-A')

    // Un sondeo fallido deja la lista vacía: tampoco se suelta el equipo.
    equiposOperativos.lista = []
    vista.rerender(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    )
    expect(useMonitoreoTermico.mock.lastCall?.[1]).toBe('FARM-A')
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

describe('DashboardPage — «Normal» sin clasificación de la IA', () => {
  beforeEach(() => {
    useMonitoreoTermico.mockReset()
  })

  it('rotula «Sin clasificación IA» junto a Normal cuando el modelo no clasificó', () => {
    renderizar(lectura({ nivel_riesgo: null, riesgo_efectivo: 'normal', estado_inferencia: 'omitida', confianza_ia: null }))

    expect(screen.getByText('Sin clasificación IA')).toBeInTheDocument()
  })

  it('HU-54: sin datos recientes no presenta el equipo como Normal', () => {
    renderizar(lectura({ riesgo_efectivo: 'normal' }))

    // Lecturas recientes, ahora siempre visibles, pueden rotular «Normal» una
    // lectura HISTÓRICA; lo que no puede decirlo es la lectura actual.
    const celda = within(screen.getByTestId('celda-lectura'))
    expect(celda.getByText('Sin datos recientes')).toBeInTheDocument()
    expect(celda.queryByText('Normal')).not.toBeInTheDocument()
  })

  it('no lo rotula si el modelo sí clasificó', () => {
    renderizar(lectura())

    expect(screen.queryByText('Sin clasificación IA')).not.toBeInTheDocument()
  })

  it('no lo rotula durante una excursión', () => {
    renderizar(lectura({ nivel_riesgo: null, riesgo_efectivo: 'excursion_critica', excursion_confirmada: true }))

    expect(screen.queryByText('Sin clasificación IA')).not.toBeInTheDocument()
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

describe('DashboardPage — bento P5c', () => {
  beforeEach(() => {
    useMonitoreoTermico.mockReset()
    equiposOperativos.lista = []
  })

  it('cifra: data-valor en ASCII y texto para lector de pantalla', () => {
    renderizar(lectura({ temperatura_interna: 4.5 }))
    const valor = screen.getByTestId('valor-actual')
    expect(valor).toHaveAttribute('data-valor', '4.5')
    expect(valor).toHaveTextContent('4.5')
    expect(valor).toHaveTextContent('°C')
  })

  it('Lecturas recientes y Estado de equipos visibles sin incidencias', () => {
    equiposOperativos.lista = [
      { id: 'FARM-01-CDL', nombre: 'Vacunas', estado_conectividad: 'online', estado_operativo: 'OPERATIVO', ultimo_reporte_en: '2026-07-25T12:34:56Z' },
    ]
    renderizar(lectura())
    expect(screen.getByRole('heading', { name: 'Lecturas recientes' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Estado operativo de equipos' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Mostrar Vacunas en el monitoreo' })).toBeInTheDocument()
    // La cinta de 24 h resume la disponibilidad en un nombre accesible.
    expect(screen.getByRole('img', { name: /Últimas 24 h de Vacunas/ })).toBeInTheDocument()
  })

  it('Estado de equipos: el botón de fila cambia el equipo de useMonitoreoTermico', () => {
    equiposOperativos.lista = [
      { id: 'FARM-A', nombre: 'A', estado_conectividad: 'online', estado_operativo: 'OPERATIVO', ultimo_reporte_en: '2026-07-25T12:00:30Z' },
      { id: 'FARM-B', nombre: 'B', estado_conectividad: 'offline', estado_operativo: 'SIN_DATOS', ultimo_reporte_en: '2026-07-25T12:00:00Z' },
    ]
    renderizar(lectura({ device_id: 'FARM-A' }))
    expect(useMonitoreoTermico.mock.lastCall?.[1]).toBe('FARM-A')
    // Problemas primero: B (sin datos) va arriba aunque no esté seleccionado.
    const filas = screen.getAllByRole('button', { name: /^Mostrar .* en el monitoreo$/ })
    expect(filas[0]).toHaveAccessibleName('Mostrar B en el monitoreo')
    fireEvent.click(filas[0])
    expect(useMonitoreoTermico.mock.lastCall?.[1]).toBe('FARM-B')
  })

  it('HU-30: calibración vencida y por vencer en la celda Equipo', () => {
    equiposOperativos.lista = [
      { id: 'FARM-01-CDL', estado_conectividad: 'online', estado_operativo: 'OPERATIVO', fecha_proxima_calibracion: '2020-01-01' },
    ]
    renderizar(lectura())
    expect(screen.getByText(/^Vencida el/)).toBeInTheDocument()
  })

  it('HU-48: anillo con n/max, pérdidas y brecha visible sin abrir el panel', () => {
    equiposOperativos.lista = [
      {
        id: 'FARM-01-CDL',
        nombre: 'Vacunas',
        estado_conectividad: 'offline',
        estado_operativo: 'OPERATIVO',
        buffer_littlefs: {
          pendientes: 120,
          limite: 30000,
          desde: '2026-07-25T11:00:00Z',
          hasta: '2026-07-25T12:00:00Z',
          perdidas: 3,
          brechas: [{ desde: '2026-07-25T10:00:00Z', hasta: '2026-07-25T10:15:00Z', muestras_perdidas: 3 }],
        },
      },
    ]
    renderizar(lectura())
    expect(screen.getByRole('img', { name: /Buffer local: 120 de 30,000|Buffer local: 120 de 30.000|Buffer local: 120 de 30000/ })).toBeInTheDocument()
    expect(screen.getByText(/Se perdieron 3 lecturas/)).toBeInTheDocument()
  })

  it('Curva: vista Lista paginada con 5 filas', () => {
    const serie = Array.from({ length: 7 }, (_, i) =>
      lectura({ id: `l-${i}`, timestamp: new Date(Date.UTC(2026, 6, 25, 12, i)).toISOString(), temperatura_interna: 4 + i / 10 }),
    )
    useMonitoreoTermico.mockReturnValue({ ultima: serie.at(-1), serie, sseConectado: true, estadoHistorial: 'completo' })
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    )
    fireEvent.click(within(screen.getByRole('group', { name: 'Vista de la curva' })).getByRole('button', { name: 'Lista' }))
    const tabla = screen.getByRole('table')
    // Cabecera + 5 filas; la más reciente primero.
    expect(within(tabla).getAllByRole('row')).toHaveLength(6)
    expect(within(tabla).getAllByRole('row')[1]).toHaveTextContent('4.6')
  })

  it('Panel de detalle: ficha técnica completa sin enlace a Dispositivos para no administradores', async () => {
    equiposOperativos.lista = [
      { id: 'FARM-01-CDL', nombre: 'Vacunas', estado_conectividad: 'online', estado_operativo: 'OPERATIVO', firmware_version: '2.1.0' },
    ]
    renderizar(lectura())
    fireEvent.click(screen.getByRole('button', { name: 'Detalles de Vacunas' }))
    const panel = await screen.findByRole('dialog')
    expect(within(panel).getByText('Ficha técnica')).toBeInTheDocument()
    expect(within(panel).getByText('2.1.0')).toBeInTheDocument()
    expect(within(panel).queryByRole('link', { name: 'Gestionar en Dispositivos' })).not.toBeInTheDocument()
  })

  it('Simulador: oculto fuera de la demostración', () => {
    renderizar(lectura())
    expect(screen.queryByRole('button', { name: /Probar estados del dashboard/ })).not.toBeInTheDocument()
  })
})
