import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuthStore } from '@/application/stores/authStore'
import type { AlertaTermica } from '@/domain/entities/AlertaTermica'
import type { RegistroTrazabilidad } from '@/domain/entities/RegistroTrazabilidad'

const useTrazabilidad = vi.hoisted(() => vi.fn())
const useModeloIA = vi.hoisted(() => vi.fn())
const useReportesBPA = vi.hoisted(() => vi.fn())
const useAlertas = vi.hoisted(() => vi.fn())

vi.mock('@/application/hooks/useTrazabilidad', () => ({ useTrazabilidad }))
vi.mock('@/application/hooks/useModeloIA', () => ({ useModeloIA }))
vi.mock('@/application/hooks/useAlertas', () => ({ useAlertas }))
vi.mock('@/application/hooks/useReportesBPA', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/application/hooks/useReportesBPA')>()),
  useReportesBPA,
}))

import { AlertasPage } from '@/presentation/pages/AlertasPage'
import { MetricasIAPage } from '@/presentation/pages/MetricasIAPage'
import { ReportesPage } from '@/presentation/pages/ReportesPage'
import { TrazabilidadPage } from '@/presentation/pages/TrazabilidadPage'

/**
 * Pruebas de comportamiento de las cuatro pantallas que sostienen la
 * sustentación: la cadena de custodia (RF-14/RF-15), la evidencia del modelo
 * (RNF-04), la exportación de cumplimiento (RF-13) y el ciclo de alerta →
 * acción correctiva (RF-09/RF-10).
 *
 * Se afirma sobre lo que la pantalla *hace* —qué llama, qué anuncia, qué
 * impide—, no sobre qué clases CSS pinta.
 */

// ── Trazabilidad ────────────────────────────────────────────────────────────

function registro(over: Partial<RegistroTrazabilidad> = {}): RegistroTrazabilidad {
  return {
    id: 'r-1',
    tipo_evento: 'LECTURA_TERMICA',
    device_id: 'FARM-01-CDL',
    usuario_id: null,
    payload: {},
    timestamp: '2026-07-25T12:00:00Z',
    previous_hash: 'a'.repeat(64),
    hash_actual: 'b'.repeat(64),
    ...over,
  }
}

const DETALLE = {
  id: 'r-17',
  tipo_evento: 'ALERTA_TERMICA',
  timestamp: '2026-07-25T11:00:00Z',
  hash_esperado: 'c'.repeat(64),
  hash_almacenado: 'd'.repeat(64),
  mensaje: 'Hash no coincide',
}

const CADENA_ROTA = {
  integra: false,
  total_registros: 42,
  primer_registro_inconsistente: 17,
  detalle_inconsistencia: DETALLE,
  registros_posteriores_afectados: 25,
}

function montarTrazabilidad(over: Record<string, unknown> = {}) {
  const aislarCorrupcion = vi.fn().mockResolvedValue('ok')
  useTrazabilidad.mockReturnValue({
    registros: [registro(), registro({ id: 'r-17', hash_actual: 'd'.repeat(64) })],
    cargando: false,
    consultar: vi.fn(),
    verificacion: null,
    verificando: false,
    verificarIntegridad: vi.fn(),
    estadoCadena: { cadena_comprometida: false },
    aislarCorrupcion,
    ...over,
  })
  render(<TrazabilidadPage />)
  return { aislarCorrupcion }
}

describe('Trazabilidad — cadena de custodia (RF-14, RF-15, HU-47)', () => {
  beforeEach(() => {
    useTrazabilidad.mockReset()
    useAuthStore.setState({
      usuario: {
        id: 'u-1',
        email: 'admin@upc.pe',
        rol: 'administrador',
        expiraEn: Date.now() + 3600_000,
      },
      autenticado: true,
      requierePrivacidad: false,
    })
  })

  it('identifica CUÁL registro se alteró, no solo que la cadena está rota', () => {
    // RF-15. «Rota en la posición 17» no permite actuar: el auditor necesita
    // el identificador, el tipo de evento y el instante del registro.
    montarTrazabilidad({ verificacion: CADENA_ROTA })

    const detalle = screen.getByTestId('detalle-inconsistencia')
    expect(within(detalle).getByText('r-17')).toBeInTheDocument()
    expect(within(detalle).getByText('ALERTA_TERMICA')).toBeInTheDocument()
  })

  it('contrasta el sello recalculado con el almacenado', () => {
    // Es la prueba material de la alteración: si ambos sellos coincidieran no
    // habría nada que denunciar. Mostrar solo uno no demuestra nada.
    montarTrazabilidad({ verificacion: CADENA_ROTA })

    const detalle = screen.getByTestId('detalle-inconsistencia')
    expect(within(detalle).getByText('c'.repeat(64))).toBeInTheDocument()
    expect(within(detalle).getByText('d'.repeat(64))).toBeInTheDocument()
  })

  it('declara cuántos registros posteriores quedan invalidados', () => {
    // En una cadena de hashes, romper un eslabón invalida todo lo que sigue.
    // Omitirlo haría parecer el daño mucho menor de lo que es.
    montarTrazabilidad({ verificacion: CADENA_ROTA })

    const detalle = screen.getByTestId('detalle-inconsistencia')
    expect(within(detalle).getByText('25')).toBeInTheDocument()
  })

  it('marca la fila del registro alterado dentro de la tabla', () => {
    montarTrazabilidad({ verificacion: CADENA_ROTA })
    expect(screen.getByTestId('fila-corrupta')).toBeInTheDocument()
  })

  it('no inventa un detalle cuando la cadena está íntegra', () => {
    montarTrazabilidad({
      verificacion: {
        integra: true,
        total_registros: 42,
        primer_registro_inconsistente: null,
        detalle_inconsistencia: null,
        registros_posteriores_afectados: 0,
      },
    })

    expect(screen.queryByTestId('detalle-inconsistencia')).toBeNull()
    expect(screen.queryByTestId('fila-corrupta')).toBeNull()
  })

  it('anuncia la cadena comprometida a tecnología asistiva, no solo la pinta', () => {
    // HU-47 + WCAG 4.1.3. El banner se dibujaba en rojo y nada más: quien no
    // ve la pantalla no se enteraba de que la evidencia dejó de ser fiable.
    montarTrazabilidad({ estadoCadena: { cadena_comprometida: true } })

    const alerta = screen.getByRole('alert')
    expect(alerta).toHaveTextContent(/alteración crítica detectada en la cadena/i)
  })

  it('anuncia también el resultado de la verificación', () => {
    montarTrazabilidad({ verificacion: CADENA_ROTA })
    expect(screen.getByRole('status')).toHaveTextContent(/alteración detectada/i)
  })

  it('pide confirmación antes de aislar un registro', async () => {
    // Era la única acción destructiva del sistema que se ejecutaba con un
    // solo clic. Aislar excluye el registro de la cadena verificable.
    const usuario = userEvent.setup()
    const { aislarCorrupcion } = montarTrazabilidad({
      estadoCadena: { cadena_comprometida: true },
      verificacion: CADENA_ROTA,
    })

    await usuario.click(screen.getByRole('button', { name: /aislar/i }))

    expect(aislarCorrupcion).not.toHaveBeenCalled()
    expect(await screen.findByRole('alertdialog')).toBeInTheDocument()
  })

  it('aísla el registro señalado solo tras confirmar', async () => {
    const usuario = userEvent.setup()
    const { aislarCorrupcion } = montarTrazabilidad({
      estadoCadena: { cadena_comprometida: true },
      verificacion: CADENA_ROTA,
    })

    await usuario.click(screen.getByRole('button', { name: /aislar/i }))
    const dialogo = await screen.findByRole('alertdialog')
    await usuario.click(within(dialogo).getByRole('button', { name: /aislar/i }))

    expect(aislarCorrupcion).toHaveBeenCalledWith('r-17')
  })

  it('no ofrece aislar a quien no es administrador', () => {
    useAuthStore.setState({
      usuario: {
        id: 'u-2',
        email: 'farma@upc.pe',
        rol: 'farmaceutico',
        expiraEn: Date.now() + 3600_000,
      },
      autenticado: true,
      requierePrivacidad: false,
    })
    montarTrazabilidad({
      estadoCadena: { cadena_comprometida: true },
      verificacion: CADENA_ROTA,
    })

    expect(screen.queryByRole('button', { name: /aislar/i })).toBeNull()
  })
})

// ── Métricas de IA ──────────────────────────────────────────────────────────

function metricas(over: Record<string, unknown> = {}) {
  return {
    model_name: 'RandomForestClassifier',
    model_version: '3.0.0',
    trained_at: '2026-07-20T09:00:00Z',
    sklearn_version: '1.5.2',
    random_state: 42,
    n_samples: 20160,
    n_samples_train: 16128,
    n_samples_test: 4032,
    classes: ['excursion_critica', 'normal', 'riesgo_preventivo'],
    accuracy: 0.9668,
    f1_weighted: 0.9671,
    classification_report: {
      normal: { precision: 0.98, recall: 0.98, 'f1-score': 0.9807, support: 2000 },
    },
    confusion_matrix: [[1, 0, 0]],
    cross_validation: {
      folds: 5,
      scoring: 'f1_weighted',
      grouped_by: 'escenario',
      mean: 0.96,
      std: 0.01,
      scores: [0.96],
    },
    feature_importances: { temperatura_interna: 0.4 },
    ...over,
  }
}

function montarMetricas(over: Record<string, unknown> = {}) {
  useModeloIA.mockReturnValue({
    datos: { modelo_disponible: true, metadata: null, metricas: metricas(over) },
    cargando: false,
    noEntrenado: false,
    error: null,
    consultar: vi.fn(),
  })
  render(<MetricasIAPage />)
}

describe('Métricas de IA — veredicto frente al umbral RNF-04', () => {
  beforeEach(() => useModeloIA.mockReset())

  it('declara el incumplimiento cuando F1 cae por debajo de 0.85', () => {
    // Un tablero que solo sabe felicitar no es evidencia. Si el modelo no
    // llega al umbral, la pantalla tiene que decirlo con todas las letras.
    montarMetricas({ f1_weighted: 0.72 })

    const veredicto = screen.getByTestId('veredicto-umbral')
    expect(veredicto).toHaveTextContent(/NO alcanza el umbral/i)
  })

  it('explica la consecuencia del incumplimiento, no solo lo constata', () => {
    montarMetricas({ f1_weighted: 0.72 })

    expect(screen.getByTestId('veredicto-umbral')).toHaveTextContent(
      /deben confirmarse manualmente/i,
    )
  })

  it('anuncia el veredicto como estado, no como decoración', () => {
    montarMetricas({ f1_weighted: 0.72 })
    expect(screen.getByTestId('veredicto-umbral')).toHaveAttribute('role', 'status')
  })

  it('el veredicto no se distingue solo por el color', () => {
    // WCAG 1.4.1: antes, cumplir e incumplir usaban el mismo icono con distinto
    // tinte. Deben ser iconos distintos.
    montarMetricas({ f1_weighted: 0.96 })
    const cumple = screen.getByTestId('veredicto-umbral').querySelector('svg')?.outerHTML
    document.body.innerHTML = ''

    montarMetricas({ f1_weighted: 0.72 })
    const incumple = screen.getByTestId('veredicto-umbral').querySelector('svg')?.outerHTML

    expect(cumple).toBeDefined()
    expect(incumple).not.toBe(cumple)
  })

  it('respeta el límite exacto: 0.85 cumple', () => {
    montarMetricas({ f1_weighted: 0.85 })
    expect(screen.getByTestId('veredicto-umbral')).toHaveTextContent(/cumple el umbral/i)
  })

  it('justo por debajo del límite ya no cumple', () => {
    montarMetricas({ f1_weighted: 0.8499 })
    expect(screen.getByTestId('veredicto-umbral')).toHaveTextContent(/NO alcanza el umbral/i)
  })
})

// ── Reportes ────────────────────────────────────────────────────────────────

const REPORTE = {
  device_id: 'FARM-01-CDL',
  fecha_desde: '2026-07-01T00:00:00Z',
  fecha_hasta: '2026-07-25T00:00:00Z',
  lecturas: [],
  alertas: [],
  registros_trazabilidad: [],
}

function montarReportes(over: Record<string, unknown> = {}) {
  const acciones = {
    generar: vi.fn(),
    descargarJson: vi.fn(),
    descargarCsv: vi.fn(),
    descargarPdf: vi.fn(),
  }
  useReportesBPA.mockReturnValue({
    reporte: null,
    generando: false,
    error: null,
    descargandoPdf: false,
    ...acciones,
    ...over,
  })
  render(<ReportesPage />)
  return acciones
}

describe('Reportes BPA — RF-13 y manejo del error de descarga', () => {
  beforeEach(() => useReportesBPA.mockReset())

  it('ofrece los tres formatos que exige RF-13 una vez generado', () => {
    montarReportes({ reporte: REPORTE })

    expect(screen.getByRole('button', { name: /pdf/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /csv/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /json/i })).toBeInTheDocument()
  })

  it('cada formato dispara su propia descarga', async () => {
    const usuario = userEvent.setup()
    const acciones = montarReportes({ reporte: REPORTE })

    await usuario.click(screen.getByRole('button', { name: /csv/i }))
    expect(acciones.descargarCsv).toHaveBeenCalledTimes(1)

    await usuario.click(screen.getByRole('button', { name: /json/i }))
    expect(acciones.descargarJson).toHaveBeenCalledTimes(1)

    await usuario.click(screen.getByRole('button', { name: /pdf/i }))
    expect(acciones.descargarPdf).toHaveBeenCalledTimes(1)
  })

  it('el PDF se pide con el mismo periodo que se ve en pantalla', async () => {
    const usuario = userEvent.setup()
    const acciones = montarReportes({ reporte: REPORTE })

    await usuario.click(screen.getByRole('button', { name: /pdf/i }))

    const [desde, hasta] = acciones.descargarPdf.mock.calls[0] as string[]
    expect(desde).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(hasta).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(desde <= hasta).toBe(true)
  })

  it('explica que la cuota se agotó en vez de dar un error genérico', () => {
    montarReportes({ error: 'cuota' })
    expect(screen.getByRole('alert')).toHaveTextContent(/espera un minuto/i)
  })

  it('nombra el límite real cuando el periodo es excesivo', () => {
    montarReportes({ error: 'periodo_excesivo' })
    expect(screen.getByRole('alert')).toHaveTextContent(/366/)
  })

  it('distingue el rango invertido', () => {
    montarReportes({ error: 'rango_invertido' })
    expect(screen.getByRole('alert')).toHaveTextContent(/posterior a la final/i)
  })

  it('cae al mensaje genérico ante un fallo no clasificado', () => {
    montarReportes({ error: 'generico' })
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('no ofrece descargas mientras no haya reporte', () => {
    montarReportes({ reporte: null })

    expect(screen.queryByRole('button', { name: /csv/i })).toBeNull()
    // Dos regiones de estado: el recuento del periodo y la caja de vacío.
    expect(screen.getAllByRole('status').length).toBeGreaterThan(0)
    expect(screen.getByText(/genera el reporte para ver el resumen/i)).toBeInTheDocument()
  })
})

// ── Alertas ─────────────────────────────────────────────────────────────────

function alerta(over: Partial<AlertaTermica> = {}): AlertaTermica {
  return {
    id: 'a-1',
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
  }
}

function montarAlertas(over: Record<string, unknown> = {}) {
  const registrarAccionCorrectiva = vi.fn().mockResolvedValue('ok')
  const reconocerAlerta = vi.fn().mockResolvedValue('ok')
  useAlertas.mockReturnValue({
    alertas: [alerta()],
    cargando: false,
    filtro: 'pendiente',
    setFiltro: vi.fn(),
    reconocerAlerta,
    registrarAccionCorrectiva,
    ...over,
  })
  render(<AlertasPage />)
  return { registrarAccionCorrectiva, reconocerAlerta }
}

describe('Alertas — ciclo completo de acción correctiva (RF-09, RF-10)', () => {
  beforeEach(() => {
    useAlertas.mockReset()
    useAuthStore.setState({
      usuario: {
        id: 'u-1',
        email: 'farma@upc.pe',
        rol: 'farmaceutico',
        expiraEn: Date.now() + 3600_000,
      },
      autenticado: true,
      requierePrivacidad: false,
    })
  })

  it('registra la acción correctiva de la alerta elegida', async () => {
    const usuario = userEvent.setup()
    const { registrarAccionCorrectiva } = montarAlertas()

    await usuario.click(screen.getByRole('button', { name: /acción correctiva/i }))
    const dialogo = await screen.findByRole('dialog')
    await usuario.type(
      within(dialogo).getByLabelText(/descripción/i),
      'Se reubicaron los viales',
    )
    await usuario.click(within(dialogo).getByRole('button', { name: /guardar/i }))

    expect(registrarAccionCorrectiva).toHaveBeenCalledWith('a-1', 'Se reubicaron los viales')
  })

  it('avisa cuando otro usuario ya atendió la alerta primero (HU-27 Escenario 2)', async () => {
    const usuario = userEvent.setup()
    montarAlertas({ registrarAccionCorrectiva: vi.fn().mockResolvedValue('conflicto') })

    await usuario.click(screen.getByRole('button', { name: /acción correctiva/i }))
    const dialogo = await screen.findByRole('dialog')
    await usuario.type(within(dialogo).getByLabelText(/descripción/i), 'Termostato ajustado')
    await usuario.click(within(dialogo).getByRole('button', { name: /guardar/i }))

    expect(await within(dialogo).findByRole('alert')).toHaveTextContent(/actualizada por otra persona/i)
  })

  it('no deja guardar una acción vacía', async () => {
    const usuario = userEvent.setup()
    const { registrarAccionCorrectiva } = montarAlertas()

    await usuario.click(screen.getByRole('button', { name: /acción correctiva/i }))
    const dialogo = await screen.findByRole('dialog')

    // Un registro de acción correctiva en blanco es peor que no tenerlo:
    // aparenta cumplimiento en la trazabilidad sin describir qué se hizo.
    expect(within(dialogo).getByRole('button', { name: /guardar/i })).toBeDisabled()
    expect(registrarAccionCorrectiva).not.toHaveBeenCalled()
  })

  it('descarta una descripción de solo espacios', async () => {
    const usuario = userEvent.setup()
    const { registrarAccionCorrectiva } = montarAlertas()

    await usuario.click(screen.getByRole('button', { name: /acción correctiva/i }))
    const dialogo = await screen.findByRole('dialog')
    await usuario.type(within(dialogo).getByLabelText(/descripción/i), '   ')

    expect(within(dialogo).getByRole('button', { name: /guardar/i })).toBeDisabled()
    expect(registrarAccionCorrectiva).not.toHaveBeenCalled()
  })

  it('confirma el registro con un mensaje anunciado', async () => {
    const usuario = userEvent.setup()
    montarAlertas()

    await usuario.click(screen.getByRole('button', { name: /acción correctiva/i }))
    const dialogo = await screen.findByRole('dialog')
    await usuario.type(within(dialogo).getByLabelText(/descripción/i), 'Termostato ajustado')
    await usuario.click(within(dialogo).getByRole('button', { name: /guardar/i }))

    await waitFor(() =>
      expect(within(dialogo).getByRole('status')).toHaveTextContent(/registrada/i),
    )
  })

  it('el campo de la acción tiene etiqueta propia, no solo marcador de posición', async () => {
    const usuario = userEvent.setup()
    montarAlertas()

    await usuario.click(screen.getByRole('button', { name: /acción correctiva/i }))
    const dialogo = await screen.findByRole('dialog')

    // El `placeholder` desaparece al escribir: no sirve como etiqueta.
    expect(within(dialogo).getByLabelText(/descripción/i)).toBeInTheDocument()
  })

  it('un técnico no puede reconocer la alerta (RBAC en la vista)', () => {
    useAuthStore.setState({
      usuario: {
        id: 'u-3',
        email: 'tecnico@upc.pe',
        rol: 'tecnico',
        expiraEn: Date.now() + 3600_000,
      },
      autenticado: true,
      requierePrivacidad: false,
    })
    montarAlertas()

    expect(screen.queryByRole('button', { name: /reconocer/i })).toBeNull()
  })

  it('el farmacéutico reconoce la alerta pendiente', async () => {
    const usuario = userEvent.setup()
    const { reconocerAlerta } = montarAlertas()

    await usuario.click(screen.getByRole('button', { name: /reconocer/i }))

    expect(reconocerAlerta).toHaveBeenCalledWith('a-1')
  })
})
