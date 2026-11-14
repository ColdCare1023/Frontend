import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuthStore } from '@/application/stores/authStore'
import type { Rol } from '@/domain/value-objects/Rol'

const useModeloIA = vi.hoisted(() => vi.fn())
vi.mock('@/application/hooks/useModeloIA', () => ({ useModeloIA }))
// HU-46: el versionado se prueba aparte (VersionesModelo.test.tsx); aquí, quién lo ve.
const useVersionesModelo = vi.hoisted(() =>
  vi.fn(() => ({ versiones: [], cargando: false, error: false, consultar: vi.fn(), registrar: vi.fn(), activar: vi.fn() })),
)
vi.mock('@/application/hooks/useVersionesModelo', () => ({ useVersionesModelo }))

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
    montar({ datos: null, noEntrenado: true })
    expect(screen.getByRole('heading', { name: 'Versiones del modelo' })).toBeInTheDocument()
  })
})
