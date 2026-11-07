import { cleanup, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const useModeloIA = vi.hoisted(() => vi.fn())
vi.mock('@/application/hooks/useModeloIA', () => ({ useModeloIA }))

import { MetricasIAPage } from '@/presentation/pages/MetricasIAPage'
import { aciertosDeCada100 } from '@/presentation/pages/clasificador/aciertos'
import { matrizOrdenada } from '@/presentation/pages/clasificador/matrizOrdenada'

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

  it('en la vista inicial dice qué es, cuántas acertó y qué mira, en palabras simples', () => {
    montar()
    const resumen = screen.getByRole('region', { name: /qué es y cómo le fue/i })
    expect(within(resumen).getByText(/intenta anticipar riesgos\. aún no está validado y no decide nada: la regla de 2.*8.*°C decide/i)).toBeInTheDocument()
    // 0.9668 de exactitud en pantalla: 97 de cada 100, y se dice que es una muestra de ejemplo.
    expect(within(resumen).getByText('Acertó 97 de cada 100 en esta muestra de ejemplo')).toBeInTheDocument()
    expect(within(resumen).getByRole('heading', { name: 'Lo que más mira' })).toBeInTheDocument()
    expect(within(resumen).getByRole('listitem')).toHaveTextContent('Temperatura interna')
    // F1 y matriz no están en la vista inicial: van plegados tras «Ver detalles técnicos».
    expect(within(resumen).queryByText(/F1/)).toBeNull()
    expect(screen.getByText(/96[.,]71 %/).closest('[inert]')).not.toBeNull()
    expect(screen.getByRole('heading', { name: 'Matriz de confusión' }).closest('[inert]')).not.toBeNull()
  })

  it('con origen verificable no dice «muestra de ejemplo» ni «sin validar», y sigue sin decidir nada', () => {
    montar({
      datos: {
        modelo_disponible: true,
        datos_simulados: false,
        metadata: null,
        metricas: metricas({ dataset_hash: 'dataset-hash', model_hash: 'model-hash', particion: 'test' }),
      },
    })
    expect(screen.getByText('Acertó 97 de cada 100 en la evaluación de prueba')).toBeInTheDocument()
    expect(screen.getByText(/todavía no está aceptado y no decide nada/i)).toBeInTheDocument()
    expect(screen.queryByText(/muestra de ejemplo/i)).not.toBeInTheDocument()
  })

  it('identifica la versión del modelo para poder auditar qué clasificó', () => {
    montar()
    expect(screen.getByText(/3\.0\.0-reproducible/)).toBeInTheDocument()
  })

  it('la cifra lleva a su lado el timbre de muestra y el aviso de modo sombra', () => {
    montar()
    expect(screen.getByText(/^valor ilustrativo, no reportable$/i)).toBeInTheDocument()
    expect(screen.getByText(/modo sombra.*sin aceptar/i)).toBeInTheDocument()
    // Las variables y la matriz también se marcan: una captura suelta no pasa por medición.
    expect(screen.getAllByText(/^muestra ilustrativa$/i)).toHaveLength(2)
  })

  it('con origen verificable no se llama muestra, pero el modelo sigue en sombra', () => {
    montar({
      datos: {
        modelo_disponible: true,
        datos_simulados: false,
        metadata: null,
        metricas: metricas({ dataset_hash: 'dataset-hash', model_hash: 'model-hash', particion: 'test' }),
      },
    })
    expect(screen.queryByText(/valor ilustrativo, no reportable/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/^muestra ilustrativa$/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/datos sintéticos/i)).not.toBeInTheDocument()
    expect(screen.getByText(/modo sombra/i)).toBeInTheDocument()
  })

  it('un origen simulado nunca alcanza el criterio, aunque el F1 lo supere', () => {
    montar({
      datos: {
        modelo_disponible: true,
        datos_simulados: true,
        metadata: null,
        metricas: metricas({ dataset_hash: 'dataset-hash', model_hash: 'model-hash', particion: 'test', f1_weighted: 0.99 }),
      },
    })
    expect(screen.getByTestId('veredicto-umbral')).toHaveTextContent(/evaluación no verificada/i)
    expect(screen.queryByText(/alcanza el criterio de evaluación/i)).not.toBeInTheDocument()
  })

  it('conserva las advertencias tras los detalles plegados', () => {
    montar()
    expect(screen.getByRole('button', { name: /ver detalles técnicos/i })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByText(/regla independiente/i)).toBeInTheDocument()
    expect(screen.getByText(/no sustituye la revisión profesional/i)).toBeInTheDocument()
    expect(screen.getByText(/no indica por sí solo una causa/i)).toBeInTheDocument()
  })

  it('dibuja la matriz en orden de lectura sin cambiar qué cuenta cada celda', () => {
    montar({
      datos: {
        modelo_disponible: true,
        metadata: null,
        metricas: metricas({
          confusion_matrix: [
            [980, 22, 6],
            [18, 1976, 22],
            [8, 25, 975],
          ],
        }),
      },
    })
    const matriz = screen.getByRole('table', { name: /matriz de confusión/i })
    const filas = within(matriz).getAllByRole('row')
    // Dos filas de cabecera y una por clase: normal, preventivo, crítica.
    expect(within(filas[2]).getByRole('rowheader')).toHaveTextContent(/normal/i)
    expect(within(filas[2]).getAllByRole('cell').map((c) => c.textContent)).toEqual(['1,976', '22', '18'])
    expect(within(filas[4]).getByRole('rowheader')).toHaveTextContent(/excursión crítica/i)
    expect(within(filas[4]).getAllByRole('cell').map((c) => c.textContent)).toEqual(['22', '6', '980'])
    // Si la matriz trae la clase crítica, se aclara que en operación la decide la regla.
    expect(screen.getByText(/en la operación la confirma la regla/i)).toBeInTheDocument()
  })

  it('una matriz incompleta no se dibuja a medias', () => {
    montar()
    expect(screen.queryByRole('table', { name: /matriz de confusión/i })).not.toBeInTheDocument()
    expect(screen.getByText(/no incluye una matriz completa/i)).toBeInTheDocument()
  })

  it('explica el modelo sin entrenar y permite reintentar un error de carga', () => {
    montar({ datos: null, noEntrenado: true })
    expect(screen.getByRole('status')).toHaveTextContent(/aún no hay una evaluación disponible/i)
    expect(screen.queryByRole('button', { name: /volver a intentar/i })).not.toBeInTheDocument()
    cleanup()

    montar({ datos: null, error: true })
    expect(screen.getByRole('alert')).toHaveTextContent(/no pudimos cargar los resultados/i)
    expect(screen.getByRole('button', { name: /volver a intentar/i })).toBeInTheDocument()
  })

  it('mientras carga no muestra ninguna cifra', () => {
    montar({ cargando: true, datos: null })
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.queryByText(/%/)).not.toBeInTheDocument()
  })

  it('mantiene la cantidad de casos de prueba separada del total de registros', () => {
    montar()
    expect(screen.getByText('4,032')).toBeInTheDocument()
    expect(screen.getByText(/20,160/)).toBeInTheDocument()
    expect(screen.queryByText(/muestras de entrenamiento/i)).not.toBeInTheDocument()
  })
})

describe('aciertosDeCada100', () => {
  it('redondea la exactitud a aciertos de cada 100', () => {
    expect(aciertosDeCada100(0.9668)).toBe(97)
    expect(aciertosDeCada100(0.5)).toBe(50)
    expect(aciertosDeCada100(1)).toBe(100)
  })

  it('con un solo error no llega a «100 de cada 100»', () => {
    expect(aciertosDeCada100(0.996)).toBe(99)
  })
})

describe('matrizOrdenada', () => {
  it('reordena filas y columnas juntas', () => {
    expect(
      matrizOrdenada(
        ['excursion_critica', 'normal'],
        [
          [1, 2],
          [3, 4],
        ],
      ),
    ).toEqual({
      clases: ['normal', 'excursion_critica'],
      filas: [
        [4, 3],
        [2, 1],
      ],
    })
  })

  it('rechaza una matriz que no es cuadrada o no coincide con las clases', () => {
    expect(matrizOrdenada(['a', 'b', 'c'], [[1, 0, 0]])).toBeNull()
    expect(matrizOrdenada(['a', 'b'], [[1], [2]])).toBeNull()
    expect(matrizOrdenada([], [])).toBeNull()
  })
})
