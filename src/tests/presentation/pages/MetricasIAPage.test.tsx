import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const useModeloIA = vi.hoisted(() => vi.fn())
vi.mock('@/application/hooks/useModeloIA', () => ({ useModeloIA }))

import { MetricasIAPage } from '@/presentation/pages/MetricasIAPage'

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
    expect(screen.getByText(/96[.,]71 %/)).toBeInTheDocument()
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
    expect(screen.getByText(/3\.0\.0-reproducible/)).toBeInTheDocument()
  })

  it('mantiene la cantidad de casos de prueba separada del total de registros', () => {
    montar()
    expect(screen.getByText('4,032')).toBeInTheDocument()
    expect(screen.getByText(/20,160/)).toBeInTheDocument()
    expect(screen.queryByText(/muestras de entrenamiento/i)).not.toBeInTheDocument()
  })
})
