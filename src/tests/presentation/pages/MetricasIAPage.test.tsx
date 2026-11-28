import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { aClasificacionPreventiva, type EstadoPreventivoApi } from '@/application/hooks/useClasificacionPreventiva'
import type { VersionModeloIA } from '@/application/hooks/useVersionesModelo'
import { useAuthStore } from '@/application/stores/authStore'
import type { Rol } from '@/domain/value-objects/Rol'

const useModeloIA = vi.hoisted(() => vi.fn())
vi.mock('@/application/hooks/useModeloIA', () => ({ useModeloIA }))
// HU-20 / HU-46: estado de la clasificación preventiva que informa el backend.
const useClasificacionPreventiva = vi.hoisted(() =>
  vi.fn(() => ({ clasificacion: null as unknown, cargando: false, operativa: false, recargar: vi.fn() })),
)
vi.mock('@/application/hooks/useClasificacionPreventiva', async (original) => ({
  ...(await original<typeof import('@/application/hooks/useClasificacionPreventiva')>()),
  useClasificacionPreventiva,
}))
// HU-46: el versionado se prueba aparte (VersionesModelo.test.tsx); aquí, quién lo ve.
const useVersionesModelo = vi.hoisted(() =>
  vi.fn(() => ({
    versiones: [] as unknown[],
    cargando: false,
    error: false,
    consultar: vi.fn(),
    registrar: vi.fn(),
    activar: vi.fn(),
    desactivar: vi.fn(),
  })),
)
vi.mock('@/application/hooks/useVersionesModelo', async (original) => ({
  ...(await original<typeof import('@/application/hooks/useVersionesModelo')>()),
  useVersionesModelo,
}))

import { MetricasIAPage } from '@/presentation/pages/MetricasIAPage'

function sesion(rol: Rol) {
  useAuthStore.setState({ usuario: { id: 'u-1', email: `${rol}@upc.pe`, rol, expiraEn: Date.now() + 3_600_000 }, autenticado: true })
}

afterEach(() => useAuthStore.setState({ usuario: null, autenticado: false }))

function metricas(over: Record<string, unknown> = {}) {
  return {
    model_name: 'RandomForestClassifier',
    model_version: '3.0.0-reproducible',
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
    cross_validation: { folds: 5, scoring: 'f1_weighted', grouped_by: 'escenario', mean: 0.96, std: 0.01, scores: [0.96] },
    feature_importances: { temperatura_interna: 0.4 },
    ...over,
  }
}

function montar(over: Record<string, unknown> = {}) {
  useModeloIA.mockReturnValue({
    datos: { modelo_disponible: true, metadata: null, metricas: metricas() },
    estado: 'disponible',
    motivo: null,
    cargando: false,
    noEntrenado: false,
    error: null,
    consultar: vi.fn(),
    ...over,
  })
  render(<MetricasIAPage />)
}

describe('MetricasIAPage', () => {
  beforeEach(() => useModeloIA.mockReset())

  it('presenta el F1 en porcentaje con contexto de evaluación', () => {
    montar()
    expect(screen.getAllByText(/F1 ponderado/i).length).toBeGreaterThan(0)
    expect(screen.getByTestId('f1-valor')).toHaveTextContent(/96[.,]71/)
    expect(screen.getByText(/no son mediciones de temperatura/i)).toBeInTheDocument()
  })

  it('no trata métricas de origen desconocido como evaluación aprobada', () => {
    montar()
    expect(screen.getByText(/evaluación no verificada/i)).toBeInTheDocument()
    expect(screen.getByText(/datos sintéticos/i)).toBeInTheDocument()
  })

  it('compara el umbral solo con origen y huellas explícitos', () => {
    montar({
      datos: {
        modelo_disponible: true,
        datos_simulados: false,
        metadata: null,
        metricas: metricas({ dataset_hash: 'dataset-hash', model_hash: 'model-hash', particion: 'test', f1_weighted: 0.62, accuracy: 0.6 }),
      },
    })

    expect(screen.getByText(/no alcanza el criterio de evaluación/i)).toBeInTheDocument()
  })

  it('permite informar criterio superado cuando evaluación tiene origen verificable', () => {
    montar({
      datos: {
        modelo_disponible: true,
        datos_simulados: false,
        metadata: null,
        metricas: metricas({ dataset_hash: 'dataset-hash', model_hash: 'model-hash', particion: 'test' }),
      },
    })
    expect(screen.getByText(/alcanza el criterio de evaluación/i)).toBeInTheDocument()
  })

  it('identifica la versión del modelo para poder auditar qué clasificó', () => {
    montar()
    expect(screen.getAllByText(/3\.0\.0-reproducible/).length).toBeGreaterThan(0)
  })

  it('mantiene la cantidad de casos de prueba separada del total de registros', () => {
    montar()
    expect(screen.getByText('4,032')).toBeInTheDocument()
    expect(screen.getByText(/20,160/)).toBeInTheDocument()
    expect(screen.queryByText(/muestras de entrenamiento/i)).not.toBeInTheDocument()
  })
})

describe('MetricasIAPage — HU-46: versiones del modelo según el rol', () => {
  beforeEach(() => useModeloIA.mockReset())

  it('el administrador gestiona las versiones', () => {
    sesion('administrador')
    montar()
    expect(screen.getByRole('heading', { name: 'Versiones del modelo' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Registrar versión' })).toBeInTheDocument()
  })

  it('el auditor las consulta en solo lectura', () => {
    sesion('auditor')
    montar()
    expect(screen.getByRole('heading', { name: 'Versiones del modelo' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Registrar versión' })).not.toBeInTheDocument()
    expect(screen.getByText(/Solo lectura/)).toBeInTheDocument()
  })

  it('el Químico Farmacéutico no ve la sección (el backend le respondería 403)', () => {
    sesion('farmaceutico')
    montar()
    expect(screen.queryByRole('heading', { name: 'Versiones del modelo' })).not.toBeInTheDocument()
    expect(useVersionesModelo).not.toHaveBeenCalled()
  })

  it('sin modelo cargado (503) el administrador sigue pudiendo registrar y activar', () => {
    sesion('administrador')
    montar({ datos: null, estado: 'no_entrenado', noEntrenado: true })
    expect(screen.getByRole('heading', { name: 'Versiones del modelo' })).toBeInTheDocument()
  })
})

/** HU-16 (P1-7): el 503 distingue «rechazado por verificación» de «no entrenado», y ambos de «disponible». */
describe('MetricasIAPage — HU-16: estado del modelo', () => {
  beforeEach(() => useModeloIA.mockReset())

  const estadoModelo = () => screen.getByTestId('estado-modelo')

  it('disponible: lo dice junto con la versión cargada y muestra la evaluación', () => {
    montar()
    expect(estadoModelo()).toHaveAttribute('data-estado', 'disponible')
    expect(estadoModelo()).toHaveTextContent('Modelo disponible. La versión 3.0.0-reproducible se cargó y superó la verificación de integridad.')
    expect(screen.getByTestId('f1-valor')).toBeInTheDocument()
  })

  it('rechazado por verificación: dice el motivo, que no clasifica y que el monitoreo sigue', () => {
    montar({ datos: null, estado: 'rechazado', motivo: 'checksum_invalido' })
    expect(estadoModelo()).toHaveAttribute('data-estado', 'rechazado')
    expect(estadoModelo()).toHaveTextContent('Modelo rechazado por verificación.')
    expect(estadoModelo()).toHaveTextContent('La huella del artefacto no coincide con la de su metadata')
    expect(estadoModelo()).toHaveTextContent('No se ejecuta ninguna clasificación con ese archivo.')
    expect(estadoModelo()).toHaveTextContent('las alertas críticas y el historial siguen operando')
    expect(screen.queryByText(/Modelo no entrenado/)).not.toBeInTheDocument()
    expect(screen.queryByTestId('f1-valor')).not.toBeInTheDocument()
  })

  it.each([
    ['hash_distinto_de_la_version_activa', 'no es el de la versión activa y aprobada del registro'],
    ['sin_verificacion_de_integridad', 'no tiene metadata de integridad'],
    ['incompatible', 'no es compatible con esta instalación'],
    ['error_de_lectura', 'No se pudo leer el artefacto'],
    [null, 'no superó la verificación de integridad o compatibilidad'],
  ])('rechazado con motivo %s', (motivo, texto) => {
    montar({ datos: null, estado: 'rechazado', motivo })
    expect(estadoModelo()).toHaveTextContent(texto)
  })

  it('no entrenado: no lo presenta como rechazo ni como error de carga', () => {
    montar({ datos: null, estado: 'no_entrenado', motivo: 'no_entrenado' })
    expect(estadoModelo()).toHaveAttribute('data-estado', 'no_entrenado')
    expect(estadoModelo()).toHaveTextContent('Modelo no entrenado. Este entorno no tiene un modelo Random Forest entrenado.')
    expect(screen.queryByText(/rechazado por verificación/)).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('no entrenado sin métricas lo explica aparte', () => {
    montar({ datos: null, estado: 'no_entrenado', motivo: 'sin_metricas' })
    expect(estadoModelo()).toHaveTextContent('no tiene métricas de entrenamiento registradas')
  })

  it('un error de red sigue siendo un error de carga con reintento', () => {
    montar({ datos: null, estado: 'error', error: true })
    expect(screen.queryByTestId('estado-modelo')).not.toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('No pudimos cargar los resultados del modelo.')
  })
})

function preventiva(api: Partial<EstadoPreventivoApi> = {}) {
  const clasificacion = aClasificacionPreventiva({ modo: 'desactivado', disponible: false, ...api })
  useClasificacionPreventiva.mockReturnValue({ clasificacion, cargando: false, operativa: clasificacion.operativa, recargar: vi.fn() })
}

/** HU-20 / HU-34 (P0-3): qué informa el backend sobre la clasificación preventiva. */
describe('MetricasIAPage — clasificación preventiva', () => {
  beforeEach(() => useModeloIA.mockReset())

  it('fuera de operación: dice el motivo y que el riesgo lo decide la regla de 2–8 °C', () => {
    sesion('farmaceutico')
    preventiva({ modo: 'activo', disponible: false, motivo_codigo: 'sin_version_activa_registrada', es_version_activa_registrada: false })
    montar()
    const tarjeta = screen.getByTestId('estado-preventivo')
    expect(tarjeta).toHaveAttribute('data-situacion', 'fuera')
    expect(tarjeta).toHaveTextContent('Fuera de operación')
    expect(tarjeta).toHaveTextContent('No hay una versión activa en el registro de versiones')
    expect(tarjeta).toHaveTextContent(/Hoy el estado lo define el rango 2.+8/)
    expect(tarjeta).toHaveTextContent('Versión activa del registro: ninguna')
  })

  it('P-12: tras /desactivar (respuesta real del backend) la versión configurada no se presenta como en operación', () => {
    sesion('administrador')
    // servicio.estado() sin modelo cargado: la versión configurada sigue en `version`,
    // pero el registro ya no tiene versión activa.
    preventiva({
      modo: 'activo',
      disponible: false,
      version: 'p-1.0.0',
      motivo: 'No hay una versión activa en el registro de modelos de la base',
      motivo_codigo: 'sin_version_activa_registrada',
      version_activa_registrada: null,
      es_version_activa_registrada: false,
    })
    montar()
    const tarjeta = screen.getByTestId('estado-preventivo')
    expect(tarjeta).toHaveAttribute('data-situacion', 'fuera')
    expect(tarjeta).toHaveTextContent('Fuera de operación')
    expect(tarjeta).not.toHaveTextContent('En operación')
    expect(tarjeta).toHaveTextContent('No hay una versión activa en el registro de versiones: sin ella no se carga ningún modelo preventivo.')
    expect(tarjeta).toHaveTextContent(/Hoy el estado lo define el rango 2.+8/)
    expect(tarjeta).toHaveTextContent('Versión activa del registro: ninguna')
    expect(tarjeta).not.toHaveTextContent('p-1.0.0')
  })

  it('en operación: solo cuando el backend informa modo activo, cargado y versión activa registrada', () => {
    sesion('auditor')
    preventiva({ modo: 'activo', disponible: true, version: 'p-1.0.0', version_activa_registrada: 'p-1.0.0', es_version_activa_registrada: true })
    montar()
    const tarjeta = screen.getByTestId('estado-preventivo')
    expect(tarjeta).toHaveAttribute('data-situacion', 'operativa')
    expect(within(tarjeta).getByText('En operación')).toBeInTheDocument()
    expect(tarjeta).toHaveTextContent('Modelo preventivo p-1.0.0: es la versión activa y aprobada del registro.')
  })

  it('modo sombra: registra evidencia, pero no decide ni abre alertas', () => {
    sesion('farmaceutico')
    preventiva({ modo: 'sombra', disponible: true, version: 'p-1.0.0' })
    montar()
    expect(screen.getByTestId('estado-preventivo')).toHaveAttribute('data-situacion', 'sombra')
    expect(screen.getByTestId('estado-preventivo')).toHaveTextContent('no decide el riesgo ni abre alertas preventivas')
  })

  it('backend anterior (sin motivo_codigo): con el modo desactivado lo dice y no afirma «ninguna» versión', () => {
    sesion('farmaceutico')
    preventiva({ modo: 'desactivado', disponible: false, motivo: 'modo_desactivado' })
    montar()
    const tarjeta = screen.getByTestId('estado-preventivo')
    expect(tarjeta).toHaveTextContent('La clasificación preventiva está desactivada en este entorno.')
    expect(tarjeta).not.toHaveTextContent('Versión activa del registro')
  })

  it('sin respuesta del backend no muestra la tarjeta', () => {
    sesion('farmaceutico')
    useClasificacionPreventiva.mockReturnValue({ clasificacion: null, cargando: false, operativa: false, recargar: vi.fn() })
    montar()
    expect(screen.queryByTestId('estado-preventivo')).not.toBeInTheDocument()
  })

  it('también con el modelo legado rechazado (503) se informa la preventiva', () => {
    sesion('farmaceutico')
    preventiva({ modo: 'desactivado', disponible: false, motivo_codigo: 'modo_desactivado' })
    montar({ datos: null, estado: 'rechazado', motivo: 'checksum_invalido' })
    expect(screen.getByTestId('estado-preventivo')).toHaveAttribute('data-situacion', 'fuera')
  })

  it('HU-46: el administrador ve qué artefacto se comprobará al activar (preventivo o legado)', () => {
    sesion('administrador')
    preventiva({ modo: 'activo', disponible: false, version: 'p-2.0.0', motivo_codigo: 'sin_version_activa_registrada' })
    montar()
    expect(screen.getByTestId('artefacto-gobernado')).toHaveAttribute('data-modelo', 'preventivo')
    expect(screen.getByTestId('artefacto-gobernado')).toHaveTextContent('artefacto del modelo preventivo desplegado (versión p-2.0.0)')
  })

  it('HU-46: con la preventiva desactivada se comprueba el artefacto legado', () => {
    sesion('administrador')
    preventiva({ modo: 'desactivado', disponible: false })
    montar()
    expect(screen.getByTestId('artefacto-gobernado')).toHaveAttribute('data-modelo', 'legado')
    expect(screen.getByTestId('artefacto-gobernado')).toHaveTextContent('artefacto del modelo legado desplegado')
  })
})

/** P-12: desactivar la versión activa desde la página del Clasificador. */
describe('MetricasIAPage — P-12: desactivar la versión activa', () => {
  beforeEach(() => useModeloIA.mockReset())

  const ACTIVA: VersionModeloIA = {
    version: 'p-1.0.0', model_hash: 'a'.repeat(64), feature_schema_version: '4', dataset_version: 'd',
    scikit_learn_version: '1.9.0', python_version: '3.12', trained_at: '2026-10-20T10:00:00Z',
    aprobado_por: 'u-1', activa: true, activable: true, motivos_bloqueo: [],
  }

  function estadoModelo(over: Record<string, unknown>) {
    return { datos: null, estado: 'rechazado', motivo: 'hash_distinto_de_la_version_activa', cargando: false, noEntrenado: false, error: null, consultar: vi.fn(), recargar: vi.fn(), ...over }
  }

  it('relee el estado preventivo y el del modelo sin volver a montar la sección (el aviso anunciado se conserva)', async () => {
    sesion('administrador')
    const recargarPreventiva = vi.fn()
    useClasificacionPreventiva.mockReturnValue({ clasificacion: null, cargando: false, operativa: false, recargar: recargarPreventiva })
    const desactivar = vi.fn(async () => ({ resultado: 'ok' as const, version: { ...ACTIVA, activa: false } }))
    useVersionesModelo.mockReturnValue({
      versiones: [ACTIVA], cargando: false, error: false, consultar: vi.fn(), registrar: vi.fn(), activar: vi.fn(), desactivar,
    })
    const recargarModelo = vi.fn()
    // Con la versión activa, el legado está rechazado por hash (503).
    useModeloIA.mockReturnValue(estadoModelo({ recargar: recargarModelo }))
    const { rerender } = render(<MetricasIAPage />)

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Desactivar la versión p-1.0.0' }))
    const dialogo = screen.getByRole('alertdialog')
    await user.type(within(dialogo).getByLabelText('Motivo de la desactivación'), 'Vuelta atrás por falsas alarmas')
    await user.click(within(dialogo).getByRole('button', { name: 'Desactivar versión' }))

    const seccion = screen.getByRole('region', { name: 'Versiones del modelo' })
    // La región de estado ya existía (vacía): se espera al texto, no al rol.
    await waitFor(() => expect(within(seccion).getByRole('status')).toHaveTextContent('Versión p-1.0.0 desactivada.'))
    expect(desactivar).toHaveBeenCalledWith('p-1.0.0', 'Vuelta atrás por falsas alarmas')
    expect(recargarPreventiva).toHaveBeenCalledTimes(1)
    expect(recargarModelo).toHaveBeenCalledTimes(1)

    // Sin versión activa vuelve la línea base: el modelo legado está disponible y la página cambia de forma.
    useModeloIA.mockReturnValue(estadoModelo({ datos: { modelo_disponible: true, metadata: null, metricas: metricas() }, estado: 'disponible', motivo: null }))
    rerender(<MetricasIAPage />)
    expect(screen.getByTestId('estado-modelo')).toHaveAttribute('data-estado', 'disponible')
    const misma = screen.getByRole('region', { name: 'Versiones del modelo' })
    expect(misma).toBe(seccion)
    expect(within(misma).getByRole('status')).toHaveTextContent('Versión p-1.0.0 desactivada.')
  })
})
