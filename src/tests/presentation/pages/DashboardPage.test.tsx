import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { LecturaTermica } from '@/domain/entities/LecturaTermica'

const useMonitoreoTermico = vi.hoisted(() => vi.fn())
// HU-31: serie agregada; por defecto no disponible (curva con lecturas crudas).
const serieAgregada = vi.hoisted(() => ({ valor: null as unknown }))
// HU-13: estado del nodo según el backend. Por defecto vacío, igual que cuando
// el endpoint no responde en pruebas.
const equiposOperativos = vi.hoisted(() => ({ lista: [] as unknown[] }))

vi.mock('@/application/hooks/useMonitoreoTermico', () => ({ useMonitoreoTermico }))
vi.mock('@/application/hooks/useSerieTermica', () => ({
  useSerieTermica: () => ({ serie: serieAgregada.valor, estado: serieAgregada.valor ? 'lista' : 'no_disponible', recargar: () => {} }),
}))
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
    serieAgregada.valor = null
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

  // HU-34 esc. 4: antes se rotulaba «Sin clasificación IA» JUNTO a «Normal».
  // El criterio prohíbe presentarla como Normal: la insignia es neutra y única.
  it('HU-34 esc. 4: sin clasificación del modelo la insignia es neutra, no «Normal»', () => {
    renderizar(lectura({ timestamp: new Date().toISOString(), nivel_riesgo: null, riesgo_efectivo: 'normal', estado_inferencia: 'omitida', confianza_ia: null }))

    const celda = within(screen.getByTestId('celda-lectura'))
    expect(celda.getByTestId('riesgo-sin-clasificacion')).toHaveTextContent('Sin clasificación IA')
    expect(celda.queryByText('Normal')).not.toBeInTheDocument()
    expect(celda.getAllByText(/el modelo no clasificó esta lectura/i).length).toBeGreaterThan(0)
  })

  it('HU-34 esc. 4: usa el estado_riesgo del backend aunque riesgo_efectivo diga normal', () => {
    renderizar(lectura({ timestamp: new Date().toISOString(), estado_riesgo: 'sin_clasificacion_ia' }))

    const celda = within(screen.getByTestId('celda-lectura'))
    expect(celda.getByText('Sin clasificación IA')).toBeInTheDocument()
    expect(celda.queryByText('Normal')).not.toBeInTheDocument()
  })

  it('HU-34 esc. 4: con falla del DS18B20 rotula «Falla de sensor», no Normal', () => {
    renderizar(
      lectura({
        timestamp: new Date().toISOString(),
        temperatura_interna: null,
        riesgo_efectivo: 'normal',
        estado_riesgo: 'falla_sensor',
        estado_sensores: { temperatura_interna: 'invalido', temperatura_ambiental: 'valido', humedad_ambiental: 'valido' },
      }),
    )

    const celda = within(screen.getByTestId('celda-lectura'))
    expect(celda.getByText('Falla de sensor')).toBeInTheDocument()
    expect(celda.queryByText('Normal')).not.toBeInTheDocument()
  })

  it('HU-34: las lecturas recientes tampoco rotulan Normal una lectura sin clasificación', () => {
    renderizar(lectura({ timestamp: new Date().toISOString(), estado_riesgo: 'sin_clasificacion_ia' }))

    const recientes = within(screen.getByRole('region', { name: 'Lecturas recientes' }))
    expect(recientes.getByText('Sin clasificación IA')).toBeInTheDocument()
    expect(recientes.queryByText('Normal')).not.toBeInTheDocument()
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

describe('DashboardPage — HU-33: falla por sensor en las tarjetas KPI', () => {
  beforeEach(() => {
    useMonitoreoTermico.mockReset()
    equiposOperativos.lista = []
  })

  const condiciones = () => within(screen.getByRole('region', { name: 'Condiciones' }))

  it('humedad inválida: «Falla de sensor» de la humedad, no «No hay lectura de temperatura» ni el valor', () => {
    renderizar(
      lectura({
        humedad_ambiental: 140,
        estado_sensores: { temperatura_interna: 'valido', temperatura_ambiental: 'valido', humedad_ambiental: 'fisicamente_imposible' },
      }),
    )

    const kpi = condiciones().getByTestId('kpi-humedad_ambiental-sin-valor')
    expect(kpi).toHaveTextContent('Falla de sensor: sin humedad válida.')
    expect(kpi).toHaveAttribute('role', 'alert')
    expect(condiciones().queryByText(/no hay lectura de temperatura/i)).not.toBeInTheDocument()
    expect(condiciones().queryByText('140')).not.toBeInTheDocument()
    // La temperatura ambiente del mismo SHT31 sigue mostrándose.
    expect(condiciones().getByText('5.2')).toBeInTheDocument()
  })

  it('sin estado_sensores (backend anterior), una humedad imposible también es falla', () => {
    renderizar(lectura({ humedad_ambiental: 140 }))

    expect(condiciones().getByTestId('kpi-humedad_ambiental-sin-valor')).toHaveTextContent('Falla de sensor: sin humedad válida.')
  })

  it('falla del SHT31 en el ambiente: texto propio del ambiente', () => {
    renderizar(
      lectura({
        temperatura_ambiental: null,
        estado_sensores: { temperatura_interna: 'valido', temperatura_ambiental: 'invalido', humedad_ambiental: 'valido' },
      }),
    )

    expect(condiciones().getByTestId('kpi-temperatura_ambiental-sin-valor')).toHaveTextContent('Falla de sensor: sin temperatura ambiente válida.')
    expect(condiciones().queryByText(/no hay lectura de temperatura/i)).not.toBeInTheDocument()
  })

  it('humedad null sin falla declarada: «Sin lectura disponible», como status', () => {
    renderizar(lectura({ humedad_ambiental: null }))

    const kpi = condiciones().getByTestId('kpi-humedad_ambiental-sin-valor')
    expect(kpi).toHaveTextContent('Sin lectura disponible para esta métrica.')
    expect(kpi).toHaveAttribute('role', 'status')
  })

  it('esc. 2: la lectura vencida dice cuánto hace que no llega una nueva', () => {
    renderizar(lectura({ timestamp: new Date(Date.now() - 10 * 60_000).toISOString() }))

    expect(within(screen.getByTestId('celda-lectura')).getByText(/^Sin lectura nueva hace \d+ s$/)).toBeInTheDocument()
  })

  it('esc. 1: lectura fresca sin aviso de antigüedad', () => {
    renderizar(lectura({ timestamp: new Date().toISOString() }))

    expect(screen.queryByText(/Sin lectura nueva hace/)).not.toBeInTheDocument()
    expect(screen.getByTestId('valor-actual')).toHaveTextContent('4.5')
  })
})

describe('DashboardPage — HU-35: umbral de puerta del backend', () => {
  beforeEach(() => {
    useMonitoreoTermico.mockReset()
    equiposOperativos.lista = []
  })

  const abierta = (segundos: number) =>
    lectura({
      timestamp: new Date().toISOString(),
      apertura_refrigerador: true,
      duracion_apertura_segundos: 10,
      apertura_continua_segundos: segundos,
      umbral_puerta_abierta_segundos: null,
    })

  it('sin umbral en la lectura usa el del equipo (estado operativo)', () => {
    equiposOperativos.lista = [{ id: 'FARM-01-CDL', estado_conectividad: 'online', estado_operativo: 'OPERATIVO', umbral_puerta_abierta_segundos: 300 }]
    renderizar(abierta(200))

    expect(screen.getByTestId('puerta-advertencia')).not.toHaveAttribute('role', 'alert')
  })

  it('sin umbral en ningún lado usa el del backend por defecto (60 s), no 120 s', () => {
    renderizar(abierta(90))

    expect(screen.getByTestId('puerta-advertencia')).toHaveAttribute('role', 'alert')
    expect(screen.getByText(/Abierta más de 60 s/)).toBeInTheDocument()
  })

  it('esc. 3: al cerrarse la advertencia desaparece y la apertura queda en el conteo', () => {
    const abiertaAntes = abierta(90)
    const cerrada = lectura({
      id: 'l-2',
      timestamp: new Date(Date.now() + 1000).toISOString(),
      apertura_refrigerador: false,
      apertura_continua_segundos: null,
      umbral_puerta_abierta_segundos: 60,
    })
    useMonitoreoTermico.mockReturnValue({ ultima: cerrada, serie: [abiertaAntes, cerrada], sseConectado: true })
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    )

    expect(screen.queryByTestId('puerta-advertencia')).not.toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Condiciones' })).getByText(/1 apertura/)).toBeInTheDocument()
  })
})

describe('DashboardPage — HU-48: rango, pérdidas y brechas del buffer', () => {
  beforeEach(() => {
    useMonitoreoTermico.mockReset()
    equiposOperativos.lista = []
  })

  const equipoConBuffer = (buffer: Record<string, unknown>) => [
    { id: 'FARM-01-CDL', nombre: 'Vacunas', estado_conectividad: 'offline', estado_operativo: 'OPERATIVO', buffer_littlefs: buffer },
  ]

  it('esc. 1: pendientes con el rango que cubren, marcado si es estimado, y las pérdidas', () => {
    equiposOperativos.lista = equipoConBuffer({
      pendientes: 120,
      limite: 30000,
      desde: '2026-07-25T11:00:00Z',
      hasta: '2026-07-25T12:00:00Z',
      rango_estimado: true,
      perdidas: 2,
      brechas: [],
    })
    renderizar(lectura())

    const rango = screen.getByTestId('buffer-rango')
    expect(rango).toHaveTextContent(/^Periodo en cola: .+ – .+ \(estimado\) · Perdidas: 2$/)
  })

  it('esc. 2: la brecha más reciente, en curso y sin hora del nodo, se identifica por su secuencia', () => {
    equiposOperativos.lista = equipoConBuffer({
      pendientes: 30000,
      limite: 30000,
      desde: null,
      hasta: null,
      perdidas: 45,
      // Orden del backend: de la más reciente a la más antigua.
      brechas: [
        {
          desde: null,
          hasta: null,
          muestras_perdidas: 40,
          perdidas: 40,
          causa: 'buffer_agotado',
          abierta: true,
          desde_boot_id: 7,
          desde_seq_no: 1200,
          hasta_seq_no: 1240,
          registrada_en: '2026-07-25T11:00:00Z',
        },
        { desde: '2026-07-24T10:00:00Z', hasta: '2026-07-24T10:15:00Z', muestras_perdidas: 5, perdidas: 5, causa: 'buffer_agotado', abierta: false, registrada_en: '2026-07-24T10:15:00Z' },
      ],
    })
    renderizar(lectura())

    const fila = screen.getByText(/Se perdieron 40 lecturas/)
    expect(fila).toHaveTextContent('buffer local lleno · en curso')
    expect(fila).toHaveTextContent('arranque 7, muestras 1200–1240')
    expect(screen.queryByText(/Se perdieron 5 lecturas/)).not.toBeInTheDocument()
  })

  it('el panel de detalle lista las brechas con su periodo y el último estado del buffer', async () => {
    equiposOperativos.lista = equipoConBuffer({
      pendientes: 0,
      limite: 30000,
      desde: null,
      hasta: null,
      perdidas: 3,
      cuarentena: 1,
      reportado_en: '2026-07-25T12:00:00Z',
      ultima_sincronizacion_en: '2026-07-25T12:00:00Z',
      brechas: [
        { desde: '2026-07-24T10:00:00Z', hasta: '2026-07-24T10:15:00Z', muestras_perdidas: 3, perdidas: 3, causa: 'buffer_agotado', abierta: false, registrada_en: '2026-07-24T10:15:00Z' },
      ],
    })
    renderizar(lectura())
    fireEvent.click(screen.getByRole('button', { name: 'Detalles de Vacunas' }))
    const panel = within(await screen.findByRole('dialog'))

    expect(panel.getByRole('list', { name: 'Brechas por buffer lleno' })).toHaveTextContent(/Periodo afectado: .+ – .+/)
    expect(panel.getByText(/Sin pendientes; sincronización recuperada/)).toBeInTheDocument()
    expect(panel.getByText(/Último estado del buffer/)).toBeInTheDocument()
    expect(panel.getByText('En cuarentena: 1')).toBeInTheDocument()
  })
})

describe('DashboardPage — HU-07: lecturas sin hora', () => {
  beforeEach(() => {
    useMonitoreoTermico.mockReset()
    equiposOperativos.lista = []
  })

  it('una lectura de un arranque sin hora se rotula «Sin hora», no con la hora de llegada', () => {
    const sinHora = lectura({ timestamp: new Date().toISOString(), time_quality: 'unsynced', sin_hora: true, origen_hora: 'recepcion' })
    renderizar(sinHora)

    const recientes = within(screen.getByRole('region', { name: 'Lecturas recientes' }))
    expect(recientes.getByText('Sin hora')).toBeInTheDocument()
    expect(recientes.queryByRole('time')).not.toBeInTheDocument()
    expect(within(screen.getByTestId('celda-lectura')).getByText('Sin hora')).toBeInTheDocument()
    // La curva lo dice: no se ubica en el eje.
    expect(screen.getByTestId('aviso-curva-sin-hora')).toHaveTextContent('1 lectura sin hora no se ubica en la curva.')
  })
})

describe('DashboardPage — HU-31: periodo completo y aviso de recorte', () => {
  beforeEach(() => {
    useMonitoreoTermico.mockReset()
    equiposOperativos.lista = [{ id: 'FARM-01-CDL', estado_conectividad: 'online', estado_operativo: 'OPERATIVO' }]
    serieAgregada.valor = null
  })

  const cobertura = { recibidas: 5000, total: 8640 }

  it('sin serie agregada y con el historial recortado, la curva lo avisa', () => {
    useMonitoreoTermico.mockReturnValue({ ultima: lectura(), serie: [lectura()], sseConectado: true, estadoHistorial: 'completo', cobertura })
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    )

    expect(screen.getByTestId('aviso-curva-recorte')).toHaveTextContent(/solo las 5[.,]?000 lecturas más recientes de 8[.,]?640/)
    // El conteo de aperturas es un mínimo, no el total de la ventana.
    expect(within(screen.getByRole('region', { name: 'Condiciones' })).getByText(/^≥0 aperturas/)).toBeInTheDocument()
  })

  it('con la serie agregada el resumen es el del periodo completo y no hay aviso de recorte en la gráfica', () => {
    serieAgregada.valor = {
      device_id: 'FARM-01-CDL',
      desde: new Date(Date.now() - 24 * 3_600_000).toISOString(),
      hasta: new Date().toISOString(),
      bucket_segundos: 60,
      bucket_automatico: true,
      intervalo_reporte_segundos: 10,
      umbral_brecha_segundos: 30,
      total_lecturas: 8640,
      lecturas_sin_hora: 0,
      lecturas_manuales: 0,
      buckets: [
        {
          inicio: new Date(Date.now() - 120_000).toISOString(),
          fin: new Date(Date.now() - 60_000).toISOString(),
          lecturas: 6,
          temperatura_interna: { min: 2.4, max: 9.1, promedio: 5, n: 6 },
          temperatura_ambiental: { min: 22, max: 22, promedio: 22, n: 6 },
          humedad_ambiental: { min: 60, max: 60, promedio: 60, n: 6 },
          excursiones: 1,
        },
      ],
      brechas: [],
      resumen: {
        lecturas: 8640,
        temperatura_interna: { min: 2.4, max: 9.1, promedio: 5, n: 8640 },
        temperatura_ambiental: { min: 20, max: 24, promedio: 22, n: 8640 },
        humedad_ambiental: { min: 50, max: 70, promedio: 60, n: 8640 },
        excursiones: 1,
      },
    }
    useMonitoreoTermico.mockReturnValue({ ultima: lectura(), serie: [lectura()], sseConectado: true, estadoHistorial: 'completo', cobertura })
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    )

    const curva = within(screen.getByRole('region', { name: 'Cómo cambió la temperatura' }))
    expect(curva.getByText(/8[.,]?640 lecturas · promedio cada 1 min/)).toBeInTheDocument()
    expect(curva.getByText('9.1 °C')).toBeInTheDocument()
    expect(curva.getByText('2.4 °C')).toBeInTheDocument()
    expect(screen.queryByTestId('aviso-curva-recorte')).not.toBeInTheDocument()
    // En la lista (lecturas crudas) sí se avisa que no cubre el periodo.
    fireEvent.click(within(screen.getByRole('group', { name: 'Vista de la curva' })).getByRole('button', { name: 'Lista' }))
    expect(screen.getByTestId('aviso-curva-lista')).toHaveTextContent(/la gráfica y el resumen cubren el periodo completo/)
  })
})
