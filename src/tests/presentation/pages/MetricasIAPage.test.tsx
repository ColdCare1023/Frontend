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

describe('MetricasIAPage (RNF-04, hallazgo F-03)', () => {
  beforeEach(() => useModeloIA.mockReset())

  it('expone el F1 ponderado, que es la métrica que RNF-04 exige', () => {
    montar()
    expect(screen.getAllByText(/F1 ponderado/i).length).toBeGreaterThan(0)
  })

  it('declara que el modelo cumple el umbral cuando F1 ≥ 0.85', () => {
    montar()
    expect(screen.getByText(/cumple el umbral/i)).toBeInTheDocument()
  })

  it('declara el incumplimiento cuando F1 cae por debajo del umbral', () => {
    // Un tablero que solo sabe felicitar no sirve como evidencia: la pantalla
    // tiene que ser capaz de decir que el modelo NO cumple.
    montar({
      datos: {
        modelo_disponible: true,
        metadata: null,
        metricas: metricas({ f1_weighted: 0.62, accuracy: 0.6 }),
      },
    })

    expect(screen.getByText(/NO alcanza el umbral/i)).toBeInTheDocument()
  })

  it('identifica la versión del modelo para poder auditar qué clasificó', () => {
    montar()
    expect(screen.getByText(/3\.0\.0-reproducible/)).toBeInTheDocument()
  })
})
