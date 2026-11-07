import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { LecturaTermica } from '@/domain/entities/LecturaTermica'

const useMonitoreoTermico = vi.hoisted(() => vi.fn())
// HU-13: estado del nodo según el backend. Por defecto vacío, igual que cuando
// el endpoint no responde en pruebas.
const equiposOperativos = vi.hoisted(() => ({ lista: [] as unknown[] }))
const dibujosGrafica = vi.hoisted(() => ({ total: 0 }))
const alertasPendientes = vi.hoisted(() => ({ lista: [] as unknown[] }))

vi.mock('@/application/hooks/useMonitoreoTermico', () => ({ useMonitoreoTermico }))
vi.mock('@/application/hooks/useEstadoOperativo', () => ({
  useEstadoOperativo: () => ({ equipos: equiposOperativos.lista, consultar: async () => {} }),
}))
vi.mock('@/application/hooks/useAlertas', () => ({
  useAlertas: () => ({ alertas: alertasPendientes.lista, cargando: false, errorCarga: false, reintentar: () => {} }),
}))

// ECharts monta sobre un canvas real, que jsdom no implementa. La gráfica no es
// lo que se está afirmando aquí, así que se sustituye por un marcador.
vi.mock('@/infrastructure/charts/EChartWrapper', () => ({
  EChartWrapper: () => {
    dibujosGrafica.total += 1
    return <div data-testid="grafica" />
  },
}))

import { useAuthStore } from '@/application/stores/authStore'
import type { Rol } from '@/domain/value-objects/Rol'
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

function renderizar(ultima: LecturaTermica, sseConectado = true, estadoHistorial: string = 'completo') {
  useMonitoreoTermico.mockReturnValue({ ultima, serie: ultima ? [ultima] : [], sseConectado, estadoHistorial, reintentar: vi.fn() })
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

describe('DashboardPage — «Normal» sin clasificación de la IA', () => {
  beforeEach(() => {
    useMonitoreoTermico.mockReset()
  })

  it('rotula «Sin clasificación IA» junto a Normal cuando el modelo no clasificó', () => {
    renderizar(lectura({ nivel_riesgo: null, riesgo_efectivo: 'normal', estado_inferencia: 'omitida', confianza_ia: null }))

    expect(screen.getByText('Sin clasificación IA')).toBeInTheDocument()
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

describe('DashboardPage — el campo de color dice el estado', () => {
  beforeEach(() => {
    useMonitoreoTermico.mockReset()
    equiposOperativos.lista = []
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  function campo() {
    return document.querySelector<HTMLElement>('.panel-equipo')!
  }

  function ahora(overrides: Partial<LecturaTermica> = {}) {
    return lectura({ timestamp: new Date().toISOString(), ...overrides })
  }

  it('el rojo y la miel los decide el riesgo efectivo, no la temperatura', () => {
    renderizar(ahora({ temperatura_interna: 5, nivel_riesgo: 'excursion_critica', riesgo_efectivo: 'excursion_critica', excursion_confirmada: true }))
    expect(campo()).toHaveAttribute('data-tono', 'critico')
  })

  it('dentro de «normal», el color acompaña a la lectura sin cambiar la palabra', () => {
    const { unmount } = renderizar(ahora({ temperatura_interna: 7.4 }))
    expect(campo()).toHaveAttribute('data-tono', 'cerca')
    expect(campo()).toHaveAttribute('data-estado', 'normal')
    expect(within(campo()).getByText('Normal')).toBeInTheDocument()
    unmount()

    renderizar(ahora({ temperatura_interna: 2.6 }))
    expect(campo()).toHaveAttribute('data-tono', 'frio')
    expect(within(campo()).getByText('Normal')).toBeInTheDocument()
  })

  it('con el sensor caído el campo no se pinta de «dentro del rango»', () => {
    renderizar(ahora({ temperatura_interna: null, estado_sensores: { temperatura_interna: 'invalido' } }))

    expect(campo()).toHaveAttribute('data-tono', 'sinDatos')
    expect(within(campo()).getByRole('alert')).toHaveTextContent(/no hay lectura de temperatura/i)
  })

  it('sin dato nuevo lo primero que se lee es eso, y el riesgo queda como el de la última lectura', () => {
    renderizar(lectura())

    expect(campo()).toHaveAttribute('data-estado', 'sinDatos')
    // «Sin lectura hace 104 días»: la antigüedad en la unidad con que se dice, no en segundos.
    expect(within(campo()).getByText(/sin lectura hace \d+\sdías/i)).toBeInTheDocument()
    // El riesgo se atribuye a la última lectura y no se presenta como el estado de ahora.
    expect(within(campo()).getByText('Última lectura: Normal')).toBeInTheDocument()
    expect(within(campo()).queryByText('Normal')).not.toBeInTheDocument()
  })

  it('el reloj no vuelve a dibujar la gráfica: la ventana avanza cada 15 s', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-25T12:00:00.000Z'))
    renderizar(ahora())
    const dibujos = dibujosGrafica.total

    act(() => {
      vi.advanceTimersByTime(14_000)
    })
    expect(dibujosGrafica.total).toBe(dibujos)
    expect(within(campo()).getByText(/hace 14 s/i)).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(1_000)
    })
    expect(dibujosGrafica.total).toBe(dibujos + 1)
  })

  it('con dos equipos se elige tocando el campo o desde la línea del día', () => {
    equiposOperativos.lista = [
      { id: 'FARM-01-CDL', nombre: 'Refrigerador principal', estado_conectividad: 'online', estado_operativo: 'OPERATIVO', ultimo_reporte_en: new Date().toISOString() },
      { id: 'FARM-02-CDL', nombre: 'Cámara fría', estado_conectividad: 'online', estado_operativo: 'OPERATIVO', ultimo_reporte_en: '2026-01-01T00:00:00Z' },
    ]
    renderizar(ahora())

    expect(useMonitoreoTermico).toHaveBeenCalledWith(24, 'FARM-01-CDL')
    // El mock devuelve la misma lectura a los dos: el código que se ve es el suyo.
    fireEvent.click(screen.getByRole('button', { name: /Cámara fría FARM/ }))
    expect(useMonitoreoTermico).toHaveBeenCalledWith(24, 'FARM-02-CDL')
    expect(screen.getByRole('button', { name: /Cámara fría FARM/ })).toHaveAttribute('aria-pressed', 'true')

    useMonitoreoTermico.mockClear()
    const selector = screen.getByRole('group', { name: 'Equipo' })
    fireEvent.click(within(selector).getByRole('button', { name: 'Refrigerador principal' }))
    expect(useMonitoreoTermico).toHaveBeenCalledWith(24, 'FARM-01-CDL')
  })
})

describe('DashboardPage — carga, vacío y error', () => {
  beforeEach(() => {
    useMonitoreoTermico.mockReset()
    equiposOperativos.lista = []
  })

  function sinLectura(estadoHistorial: string) {
    return renderizar(null as unknown as LecturaTermica, false, estadoHistorial)
  }

  it('mientras carga lo anuncia y no inventa una cifra', () => {
    sinLectura('cargando')

    expect(screen.getAllByRole('status').some((estado) => /cargando/i.test(estado.textContent ?? ''))).toBe(true)
    expect(document.querySelector('.num-raiz')).toBeNull()
  })

  it('sin lecturas explica que espera al sensor', () => {
    sinLectura('completo')

    expect(screen.getByText(/esperando lecturas del sensor/i)).toBeInTheDocument()
    expect(screen.getByText(/se actualizará automáticamente/i)).toBeInTheDocument()
    expect(screen.queryByTestId('grafica')).not.toBeInTheDocument()
  })

  it('si la consulta falla lo dice y permite reintentar', () => {
    sinLectura('error')

    // AnuncioRiesgo mantiene siempre montada su propia región `alert`, vacía.
    expect(screen.getAllByRole('alert').some((aviso) => /no pudimos cargar las lecturas/i.test(aviso.textContent ?? ''))).toBe(true)
    expect(screen.getByRole('button', { name: /volver a intentar|reintentar/i })).toBeInTheDocument()
  })

  it('con lectura en pantalla, un fallo del historial no se lleva el campo', () => {
    renderizar(lectura({ timestamp: new Date().toISOString() }), true, 'error')

    expect(screen.getAllByRole('alert').some((aviso) => /no pudimos cargar las lecturas/i.test(aviso.textContent ?? ''))).toBe(true)
    expect(document.querySelector('.panel-equipo')).not.toBeNull()
  })

  it('el estado de un nodo sin telemetría se muestra aunque no haya lecturas', () => {
    equiposOperativos.lista = [
      { id: 'FARM-03-CDL', nombre: 'Cámara nueva', estado_conectividad: 'offline', estado_operativo: 'SIN_DATOS', ultimo_reporte_en: null },
    ]
    sinLectura('completo')

    expect(screen.getByRole('heading', { name: 'Incidentes de equipos' })).toBeInTheDocument()
    expect(screen.getByText(/aún no envía su primer reporte/i)).toBeInTheDocument()
  })
})

describe('DashboardPage — la frase de arriba responde «¿están bien mis medicamentos?»', () => {
  beforeEach(() => {
    useMonitoreoTermico.mockReset()
    equiposOperativos.lista = []
    alertasPendientes.lista = []
    useAuthStore.setState({ usuario: null, autenticado: false })
  })

  const frase = () => screen.getByRole('heading', { level: 1 })
  const ahora = (overrides: Partial<LecturaTermica> = {}) => lectura({ timestamp: new Date().toISOString(), ...overrides })
  const equipo = (id: string, nombre: string, extra: Record<string, unknown> = {}) => ({
    id, nombre, estado_conectividad: 'online', estado_operativo: 'OPERATIVO', ultimo_reporte_en: new Date().toISOString(), ...extra,
  })

  it('con el dato fresco y dentro del rango dice «Todo en orden»', () => {
    equiposOperativos.lista = [equipo('FARM-01-CDL', 'Refrigerador principal')]
    renderizar(ahora())

    expect(frase()).toHaveTextContent('Todo en orden')
    expect(screen.getByText(/Refrigerador principal está dentro del rango de 2–8 °C/)).toBeInTheDocument()
  })

  it('con un dato viejo nunca dice «Todo en orden»: dice cuánto hace de la última lectura', () => {
    equiposOperativos.lista = [equipo('FARM-01-CDL', 'Refrigerador principal')]
    renderizar(lectura({ timestamp: new Date(Date.now() - 125_000).toISOString() }))

    expect(frase()).not.toHaveTextContent('Todo en orden')
    expect(frase()).toHaveTextContent('Revisa el Refrigerador principal')
    expect(screen.getAllByText(/Sin lectura hace 2\smin/).length).toBeGreaterThan(0)
  })

  it('con una excursión nombra el equipo, la temperatura y qué hacer', () => {
    equiposOperativos.lista = [equipo('FARM-01-CDL', 'Refrigerador principal')]
    renderizar(ahora({ temperatura_interna: 9.2, riesgo_efectivo: 'excursion_critica', nivel_riesgo: 'excursion_critica', excursion_confirmada: true }))

    expect(frase()).toHaveTextContent('Revisa el Refrigerador principal')
    expect(screen.getByText(/Está a 9\.2 °C, fuera de 2–8 °C/)).toBeInTheDocument()
  })

  it('con dos equipos basta uno sin lectura para no decir «Todo en orden», y nombra a ese', () => {
    equiposOperativos.lista = [
      equipo('FARM-01-CDL', 'Refrigerador principal'),
      equipo('FARM-02-CDL', 'Cámara fría de vacunas', { estado_operativo: 'SIN_DATOS', estado_conectividad: 'offline', ultimo_reporte_en: new Date(Date.now() - 120_000).toISOString() }),
    ]
    renderizar(ahora())

    expect(frase()).toHaveTextContent('Revisa la Cámara fría de vacunas')
    expect(frase()).not.toHaveTextContent('Todo en orden')
  })

  it('mientras carga o si la consulta falla, no afirma nada', () => {
    const { unmount } = renderizar(null as unknown as LecturaTermica, false, 'cargando')
    expect(frase()).toHaveTextContent('Comprobando tus equipos')
    unmount()

    renderizar(null as unknown as LecturaTermica, false, 'error')
    expect(frase()).toHaveTextContent('No pudimos comprobar tus equipos')
  })

  it('una puerta abierta de más tampoco es «Todo en orden»', () => {
    equiposOperativos.lista = [equipo('FARM-01-CDL', 'Refrigerador principal')]
    renderizar(ahora({ apertura_refrigerador: true, duracion_apertura_segundos: 10, apertura_continua_segundos: 300, umbral_puerta_abierta_segundos: 120 }))

    expect(frase()).toHaveTextContent('Revisa el Refrigerador principal')
    expect(screen.getByText(/La puerta sigue abierta/)).toBeInTheDocument()
  })

  function sesion(rol: Rol) {
    useAuthStore.setState({ usuario: { id: 'u-1', email: `${rol}@upc.pe`, rol, expiraEn: Date.now() + 3600_000 }, autenticado: true })
  }
  const pendiente = (id: string) => ({ id, estado: 'pendiente', nivel_riesgo: 'excursion_critica' })

  it('con alertas pendientes lleva a Alertas, en las palabras de cada rol', () => {
    alertasPendientes.lista = [pendiente('a'), pendiente('b'), { id: 'c', estado: 'atendida', nivel_riesgo: 'normal' }]
    sesion('farmaceutico')
    const { unmount } = renderizar(ahora())
    expect(screen.getByRole('link', { name: /Tienes 2 alertas por revisar/ })).toHaveAttribute('href', '/alertas')
    unmount()

    sesion('tecnico')
    const segundo = renderizar(ahora())
    expect(screen.getByRole('link', { name: /Tienes 2 alertas por atender/ })).toBeInTheDocument()
    segundo.unmount()

    sesion('auditor')
    renderizar(ahora())
    expect(screen.getByRole('link', { name: /Hay 2 alertas pendientes/ })).toBeInTheDocument()
  })

  it('sin pendientes no muestra la llamada', () => {
    alertasPendientes.lista = [{ id: 'c', estado: 'atendida', nivel_riesgo: 'normal' }]
    sesion('farmaceutico')
    renderizar(ahora())
    expect(screen.queryByRole('link', { name: /alertas/i })).not.toBeInTheDocument()
  })

  it('el equipo elegido no cambia solo entre sondeos aunque otro reporte después', () => {
    const reciente = new Date().toISOString()
    const antes = new Date(Date.now() - 20_000).toISOString()
    equiposOperativos.lista = [
      equipo('FARM-01-CDL', 'Refrigerador principal', { ultimo_reporte_en: reciente }),
      equipo('FARM-02-CDL', 'Cámara fría', { ultimo_reporte_en: antes }),
    ]
    const { rerender } = renderizar(ahora())
    const ventanaDelDia = () => useMonitoreoTermico.mock.calls.filter(([horas]) => horas === 24).map(([, id]) => id)
    expect(ventanaDelDia().at(-1)).toBe('FARM-01-CDL')

    // Siguiente sondeo: ahora la cámara es la que reportó más recientemente.
    equiposOperativos.lista = [
      equipo('FARM-01-CDL', 'Refrigerador principal', { ultimo_reporte_en: antes }),
      equipo('FARM-02-CDL', 'Cámara fría', { ultimo_reporte_en: new Date(Date.now() + 1_000).toISOString() }),
    ]
    useMonitoreoTermico.mockClear()
    rerender(<MemoryRouter><DashboardPage /></MemoryRouter>)

    expect(ventanaDelDia().length).toBeGreaterThan(0)
    expect(ventanaDelDia().every((id) => id === 'FARM-01-CDL')).toBe(true)
    expect(screen.getByRole('button', { name: /Refrigerador principal FARM/ })).toHaveAttribute('aria-pressed', 'true')
  })
})
