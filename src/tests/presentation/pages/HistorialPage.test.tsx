import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuthStore } from '@/application/stores/authStore'
import type { Dispositivo } from '@/domain/entities/Dispositivo'
import type { LecturaTermica } from '@/domain/entities/LecturaTermica'
import type { SerieTermica } from '@/domain/entities/SerieTermica'
import type { Rol } from '@/domain/value-objects/Rol'

const useHistorial = vi.hoisted(() => vi.fn())
vi.mock('@/application/hooks/useHistorial', () => ({ useHistorial }))

// HU-30: vigencia de calibración por equipo (estado-operativo?todos=true).
const useCalibracionEquipos = vi.hoisted(() => vi.fn(() => ({ equipos: [] as Partial<Dispositivo>[], consultar: vi.fn() })))
vi.mock('@/application/hooks/useCalibracion', () => ({ useCalibracionEquipos }))

// HU-36 criterio 1: jsdom no implementa ResizeObserver, que EChartWrapper
// necesita — mismo mock que DashboardPage.test.tsx. Guarda la última opción
// para afirmar sobre la curva (HU-30 esc. 3).
const grafica = vi.hoisted(() => ({ opcion: null as null | { series?: Array<{ name?: string; markArea?: { data: unknown[] } }> } }))
vi.mock('@/infrastructure/charts/EChartWrapper', () => ({
  EChartWrapper: ({ option }: { option: typeof grafica.opcion }) => {
    grafica.opcion = option
    return <div data-testid="grafica" />
  },
}))

import { HistorialPage } from '@/presentation/pages/HistorialPage'

function sesion(rol: Rol) {
  useAuthStore.setState({ usuario: { id: 'u-1', email: `${rol}@upc.pe`, rol, expiraEn: Date.now() + 3_600_000 }, autenticado: true })
}

beforeEach(() => sesion('farmaceutico'))
afterEach(() => useAuthStore.setState({ usuario: null, autenticado: false }))

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

/**
 * Serie agregada mínima a partir de lecturas: un intervalo de 1 min por
 * lectura (como si el backend agregara un periodo con pocas lecturas).
 */
function serieDe(lecturas: LecturaTermica[], extra: Partial<SerieTermica> = {}): SerieTermica[] {
  const porEquipo = new Map<string, LecturaTermica[]>()
  for (const l of lecturas) porEquipo.set(l.device_id, [...(porEquipo.get(l.device_id) ?? []), l])
  return [...porEquipo.entries()].map(([device_id, propias]) => {
    const asc = [...propias].sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp))
    const temps = asc.flatMap((l) => (l.temperatura_interna == null ? [] : [l.temperatura_interna]))
    const est = (v: number | null) => ({ min: v, max: v, promedio: v, n: v == null ? 0 : 1 })
    return {
      device_id,
      desde: '2026-07-19T00:00:00Z',
      hasta: '2026-07-26T00:00:00Z',
      bucket_segundos: 60,
      bucket_automatico: true,
      intervalo_reporte_segundos: 30,
      umbral_brecha_segundos: 90,
      total_lecturas: asc.length,
      lecturas_sin_hora: 0,
      lecturas_manuales: 0,
      buckets: asc.map((l) => ({
        inicio: l.timestamp,
        fin: new Date(Date.parse(l.timestamp) + 60_000).toISOString(),
        lecturas: 1,
        temperatura_interna: est(l.temperatura_interna),
        temperatura_ambiental: est(l.temperatura_ambiental),
        humedad_ambiental: est(l.humedad_ambiental),
        fuera_de_rango: l.temperatura_interna != null && (l.temperatura_interna < 2 || l.temperatura_interna > 8) ? 1 : 0,
        excursiones: l.excursion_confirmada ? 1 : 0,
      })),
      brechas: [],
      resumen: {
        lecturas: asc.length,
        temperatura_interna: { min: Math.min(...temps), max: Math.max(...temps), promedio: temps.reduce((a, b) => a + b, 0) / temps.length, n: temps.length },
        temperatura_ambiental: { min: null, max: null, promedio: null, n: 0 },
        humedad_ambiental: { min: null, max: null, promedio: null, n: 0 },
        fuera_de_rango: temps.filter((t) => t < 2 || t > 8).length,
        excursiones: asc.filter((l) => l.excursion_confirmada).length,
      },
      ...extra,
    }
  })
}

interface Opciones {
  consultar?: ReturnType<typeof vi.fn>
  irAPagina?: ReturnType<typeof vi.fn>
  series?: SerieTermica[]
  total?: number
  errorSerie?: 'no_encontrado' | 'error' | null
}

function estadoHook(lecturas: LecturaTermica[], opciones: Opciones = {}) {
  return {
    lecturas,
    total: opciones.total ?? lecturas.length,
    pagina: 1,
    irAPagina: opciones.irAPagina ?? vi.fn(),
    cargando: false,
    errorCarga: false,
    consultar: opciones.consultar ?? vi.fn(),
    series: opciones.series ?? serieDe(lecturas),
    cargandoSerie: false,
    errorSerie: opciones.errorSerie ?? null,
    periodo: { desde: '2026-07-24T12:00:00.000Z', hasta: '2026-07-25T12:00:00.000Z', porDefecto: true },
    equiposConocidos: [],
  }
}

function montar(lecturas: LecturaTermica[], consultar = vi.fn(), opciones: Omit<Opciones, 'consultar'> = {}) {
  useHistorial.mockReturnValue(estadoHook(lecturas, { ...opciones, consultar }))
  render(<HistorialPage />)
  return consultar
}

describe('HistorialPage (RF-12, HU-36)', () => {
  beforeEach(() => useHistorial.mockReset())

  it('muestra las lecturas consultadas', () => {
    montar([lectura()])

    expect(screen.getAllByText('FARM-01-CDL').length).toBeGreaterThan(0)
    expect(screen.getByRole('cell', { name: /4[.,]5/ })).toBeInTheDocument()
  })

  it('ofrece los filtros que exige RF-12', () => {
    montar([lectura()])

    // Dispositivo, nivel de riesgo y rango de fechas: los ejes por los que se
    // reconstruye un episodio en una auditoría.
    expect(screen.getAllByText(/filtros/i).length).toBeGreaterThan(0)
    expect(screen.getByLabelText(/nivel de riesgo/i)).toBeInTheDocument()
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

  it('avisa con el texto literal del criterio cuando el rango no tiene datos (HU-36 esc. 2)', () => {
    montar([])
    expect(screen.getByText('Sin datos registrados en el rango seleccionado')).toBeInTheDocument()
  })

  it('muestra la gráfica cuando hay lecturas (HU-36 criterio 1)', async () => {
    montar([lectura()])
    // ECharts se carga bajo demanda (PERFORMANCE B2): la gráfica llega tras el esqueleto.
    expect(await screen.findByTestId('grafica')).toBeInTheDocument()
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

    expect(screen.getByRole('img', { name: /no disponible/i })).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: /^cerrada$/i })).not.toBeInTheDocument()
  })
})

describe('HistorialPage — rediseño P6 (registros)', () => {
  beforeEach(() => useHistorial.mockReset())

  it('agrupa las lecturas por día con el resumen del día', () => {
    montar([
      lectura({ id: 'l-1', timestamp: '2026-07-25T15:00:00Z', temperatura_interna: 4.5 }),
      lectura({ id: 'l-2', timestamp: '2026-07-25T14:00:00Z', temperatura_interna: 6.1 }),
      lectura({ id: 'l-3', timestamp: '2026-07-20T15:00:00Z', temperatura_interna: 3.2 }),
    ])
    const cabeceras = screen.getAllByRole('columnheader').filter((th) => th.getAttribute('scope') === 'colgroup')
    expect(cabeceras).toHaveLength(2)
    expect(cabeceras[0]).toHaveTextContent(/2 lecturas · mín 4[.,]5 · máx 6[.,]1/)
  })

  it('el detalle de fila muestra ambiente, humedad, conexión y calidad de hora', async () => {
    montar([lectura({ time_quality: 'backfilled' })])
    const boton = screen.getByRole('button', { name: /ver detalle de la lectura/i })
    expect(boton).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(boton)
    expect(boton).toHaveAttribute('aria-expanded', 'true')
    const detalle = document.getElementById(boton.getAttribute('aria-controls') as string) as HTMLElement
    expect(detalle).toHaveTextContent(/temp\. ambiente/i)
    expect(detalle).toHaveTextContent(/humedad/i)
    expect(detalle).toHaveTextContent(/conexión/i)
    expect(detalle).toHaveTextContent(/recuperada del buffer/i)
    expect(screen.getByRole('button', { name: /ver origen del riesgo/i })).toBeEnabled()
  })

  it('solo una fila expandida a la vez y Escape la cierra', async () => {
    montar([lectura({ id: 'l-1' }), lectura({ id: 'l-2', timestamp: '2026-07-25T11:00:00Z' })])
    const [primero, segundo] = screen.getAllByRole('button', { name: /ver detalle de la lectura/i })
    await userEvent.click(primero)
    await userEvent.click(segundo)
    expect(screen.getAllByRole('button', { expanded: true })).toHaveLength(1)
    await userEvent.keyboard('{Tab}')
    await userEvent.keyboard('{Escape}')
    expect(screen.queryAllByRole('button', { expanded: true })).toHaveLength(0)
  })

  it('la tira resume lecturas, % en rango y excursiones', () => {
    montar([lectura(), lectura({ id: 'l-2', timestamp: '2026-07-25T11:59:00Z', temperatura_interna: 9.4 })])
    const tira = screen.getByRole('region', { name: /resumen del periodo/i })
    expect(tira).toHaveTextContent(/lecturas\s*2/i)
    expect(tira).toHaveTextContent(/en rango/i)
    expect(tira).toHaveTextContent(/excursiones\s*0/i)
  })

  it('oculta la columna Equipo cuando hay un solo equipo', () => {
    montar([lectura()])
    expect(screen.queryByRole('columnheader', { name: /^equipo$/i })).not.toBeInTheDocument()
    montarOtraVez([lectura(), lectura({ id: 'l-2', device_id: 'FARM-02-CDL' })])
    expect(screen.getByRole('columnheader', { name: /^equipo$/i })).toBeInTheDocument()
  })

  it('«Filtros» (solo bajo 640 px) despliega riesgo y periodo sin quitarlos del formulario', async () => {
    montar([lectura()])
    const boton = screen.getByRole('button', { name: /^filtros$/i })
    const bloque = document.getElementById(boton.getAttribute('aria-controls') as string) as HTMLElement
    expect(boton).toHaveAttribute('aria-expanded', 'false')
    // Los campos siguen en el formulario: desde 640 px se ven siempre.
    expect(bloque).toContainElement(screen.getByLabelText(/nivel de riesgo/i))
    expect(bloque.className).toMatch(/max-sm:hidden/)
    await userEvent.click(boton)
    expect(boton).toHaveAttribute('aria-expanded', 'true')
    expect(bloque.className).not.toMatch(/max-sm:hidden/)
  })

  it('la cabecera de día abarca solo las columnas montadas (sin columnas fantasma)', () => {
    montar([lectura(), lectura({ id: 'l-2', device_id: 'FARM-02-CDL' })])
    const columnas = screen.getAllByRole('columnheader').filter((th) => th.getAttribute('scope') === 'col')
    const dia = screen.getAllByRole('columnheader').find((th) => th.getAttribute('scope') === 'colgroup') as HTMLTableCellElement
    expect(dia.colSpan).toBe(columnas.length)
  })

  it('el estado vacío dice qué periodo se consultó', () => {
    montar([])
    expect(screen.getByText(/periodo consultado: últimas 24 h/i)).toBeInTheDocument()
  })
})

describe('HistorialPage — HU-36: periodo completo, tabla paginada en el servidor', () => {
  beforeEach(() => useHistorial.mockReset())

  it('la tira y la curva usan la serie del periodo, no solo la página cargada', async () => {
    // Una página de 1 fila de un periodo con 8640 lecturas.
    const pagina = [lectura()]
    const series = serieDe([lectura(), lectura({ id: 'l-2', timestamp: '2026-07-25T11:00:00Z', temperatura_interna: 9.1 })], { total_lecturas: 8640 })
    series[0].resumen.lecturas = 8640
    montar(pagina, vi.fn(), { series, total: 8640 })
    const tira = screen.getByRole('region', { name: /resumen del periodo/i })
    expect(tira).toHaveTextContent(/lecturas\s*8640/i)
    expect(tira).toHaveTextContent(/máxima\s*9[.,]1/i)
    expect(screen.getByText(/8640 lecturas en el periodo/i)).toBeInTheDocument()
    expect(await screen.findByTestId('grafica')).toBeInTheDocument()
  })

  it('«Página siguiente» pide al servidor la página 2', async () => {
    const irAPagina = vi.fn()
    montar([lectura()], vi.fn(), { total: 30, irAPagina })
    await userEvent.click(screen.getByRole('button', { name: /página siguiente/i }))
    expect(irAPagina).toHaveBeenCalledWith(2)
  })

  it('«Ver en la tabla» acota la consulta al episodio de excursión y a su equipo', async () => {
    const consultar = montar([
      lectura({ id: 'l-1', timestamp: '2026-07-25T12:00:00Z', temperatura_interna: 9.4, excursion_confirmada: true, riesgo_efectivo: 'excursion_critica' }),
      lectura({ id: 'l-2', timestamp: '2026-07-25T11:59:00Z', temperatura_interna: 9.1, excursion_confirmada: true, riesgo_efectivo: 'excursion_critica' }),
    ])
    consultar.mockClear()
    await userEvent.click(screen.getByRole('button', { name: /ver en la tabla: FARM-01-CDL/i }))
    expect(consultar).toHaveBeenCalledTimes(1)
    const filtros = consultar.mock.calls[0][0]
    expect(filtros.device_id).toBe('FARM-01-CDL')
    expect(Date.parse(filtros.desde)).toBeLessThan(Date.parse('2026-07-25T11:59:00Z'))
    expect(Date.parse(filtros.hasta)).toBeGreaterThan(Date.parse('2026-07-25T12:01:00Z'))
  })

  it('con filtro de riesgo y un periodo con datos, el vacío habla del filtro', async () => {
    const consultar = montar([lectura()])
    useHistorial.mockReturnValue(estadoHook([], { consultar, series: serieDe([lectura()]), total: 0 }))
    await userEvent.selectOptions(screen.getByLabelText(/nivel de riesgo/i), 'excursion_critica')
    expect(screen.getByText(/sin lecturas para estos filtros/i)).toBeInTheDocument()
    expect(screen.queryByText('Sin datos registrados en el rango seleccionado')).not.toBeInTheDocument()
  })

  it('declara las lecturas que cuenta pero no dibuja (sin hora o manuales)', () => {
    montar([lectura()], vi.fn(), { series: serieDe([lectura()], { lecturas_sin_hora: 2, lecturas_manuales: 1 }) })
    expect(screen.getByText(/2 lecturas sin hora de captura/i)).toBeInTheDocument()
    expect(screen.getByText(/1 lectura manual/i)).toBeInTheDocument()
  })

  it('avisa cuando el equipo filtrado no existe en vez de dibujar una curva vacía', () => {
    useHistorial.mockReturnValue({ ...estadoHook([lectura()], { series: [], errorSerie: 'no_encontrado' }) })
    window.history.replaceState({}, '', '/historial?device_id=NO-EXISTE')
    render(<HistorialPage />)
    window.history.replaceState({}, '', '/')
    expect(screen.getByText(/no encontramos el equipo «NO-EXISTE»/i)).toBeInTheDocument()
    expect(screen.queryByTestId('grafica')).not.toBeInTheDocument()
  })
})

function montarOtraVez(lecturas: LecturaTermica[]) {
  document.body.innerHTML = ''
  useHistorial.mockReturnValue(estadoHook(lecturas))
  render(<HistorialPage />)
}

describe('HistorialPage — HU-47/HU-18: evidencia de la inferencia según el rol', () => {
  beforeEach(() => useHistorial.mockReset())

  async function abrirDetalle() {
    await userEvent.click(screen.getByRole('button', { name: /ver detalle de la lectura/i }))
  }

  it.each(['farmaceutico', 'auditor', 'administrador'] as const)('%s ve «Ver origen del riesgo»', async (rol) => {
    sesion(rol)
    montar([lectura()])
    await abrirDetalle()
    expect(screen.getByRole('button', { name: /ver origen del riesgo/i })).toBeEnabled()
  })

  it('el técnico no recibe el botón (el backend le respondería 403)', async () => {
    sesion('tecnico')
    montar([lectura()])
    await abrirDetalle()
    expect(screen.queryByRole('button', { name: /ver origen del riesgo/i })).not.toBeInTheDocument()
    // El resto del detalle sigue disponible.
    expect(screen.getByText('Hora del equipo')).toBeInTheDocument()
  })
})

describe('HistorialPage — HU-30 esc. 3: calibración vencida', () => {
  beforeEach(() => {
    useHistorial.mockReset()
    grafica.opcion = null
  })

  const vencido = { id: 'FARM-01-CDL', fecha_ultima_calibracion: '2025-01-10', fecha_proxima_calibracion: '2026-07-20', margen_aviso_calibracion_dias: 30 }

  it('avisa del equipo con la calibración vencida y marca las lecturas posteriores', async () => {
    useCalibracionEquipos.mockReturnValue({ equipos: [vencido], consultar: vi.fn() })
    montar([
      lectura({ id: 'l-desp', timestamp: '2026-07-25T12:00:00Z' }),
      lectura({ id: 'l-antes', timestamp: '2026-07-19T12:00:00Z' }),
    ])

    const aviso = screen.getByRole('note', { name: 'Calibración vencida' })
    expect(aviso).toHaveTextContent(/FARM-01-CDL: la calibración del sensor venció el 20\/7\/2026/)
    // Solo la lectura capturada después del vencimiento lleva la marca.
    expect(screen.getAllByRole('img', { name: 'Capturada con la calibración vencida' })).toHaveLength(1)

    const [posterior] = screen.getAllByRole('button', { name: /ver detalle de la lectura/i })
    await userEvent.click(posterior)
    const detalle = document.getElementById(posterior.getAttribute('aria-controls') as string) as HTMLElement
    expect(within(detalle).getByText('Calibración del sensor')).toBeInTheDocument()

    // La curva lleva el tramo sin certificado vigente, fuera de la leyenda.
    await screen.findByTestId('grafica')
    const serie = grafica.opcion?.series?.find((s) => s.name === '__calibracion')
    expect(serie?.markArea?.data).toHaveLength(1)
  })

  it('sin calibración vencida no hay aviso ni marca', async () => {
    useCalibracionEquipos.mockReturnValue({
      equipos: [{ ...vencido, fecha_proxima_calibracion: '2099-01-01' }],
      consultar: vi.fn(),
    })
    montar([lectura()])
    expect(screen.queryByRole('note', { name: 'Calibración vencida' })).not.toBeInTheDocument()
    expect(screen.queryByRole('img', { name: 'Capturada con la calibración vencida' })).not.toBeInTheDocument()
    await screen.findByTestId('grafica')
    expect(grafica.opcion?.series?.some((s) => s.name === '__calibracion')).toBe(false)
  })
})
