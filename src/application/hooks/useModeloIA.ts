import { useCallback, useEffect, useState } from 'react'
import axios from 'axios'

import { apiClient } from '@/infrastructure/api/apiClient'

export interface MetricasPorClase {
  precision: number
  recall: number
  'f1-score': number
  support: number
}

export interface MetricasModelo {
  model_name: string
  model_version: string
  trained_at: string
  sklearn_version: string
  random_state: number
  n_samples: number
  n_samples_train: number
  n_samples_test: number
  classes: string[]
  accuracy: number
  f1_weighted: number
  classification_report: Record<string, MetricasPorClase | number>
  confusion_matrix: number[][]
  cross_validation: {
    folds: number
    scoring: string
    grouped_by: string
    mean: number
    std: number
    scores: number[]
  }
  feature_importances: Record<string, number>
  dataset_hash?: string
  model_hash?: string
  particion?: string
}

export interface MetadataModelo {
  model_version?: string
  trained_at?: string
  dataset_hash?: string
  model_hash?: string
}

interface RespuestaModelo {
  modelo_disponible: boolean
  metadata: MetadataModelo | null
  metricas: MetricasModelo
}

/**
 * RNF-04: el backend ya publicaba la evidencia del modelo, pero ninguna
 * pantalla la consumía. Sin esta vista, afirmar en la sustentación que el
 * clasificador alcanza cierto F1 no era verificable desde el propio sistema.
 */
export function useModeloIA() {
  const [datos, setDatos] = useState<RespuestaModelo | null>(null)
  const [cargando, setCargando] = useState(true)
  // El modelo puede no estar entrenado en un entorno dado (503): es un estado
  // legítimo que la vista debe explicar, no un error genérico.
  const [noEntrenado, setNoEntrenado] = useState(false)
  const [error, setError] = useState(false)

  const consultar = useCallback(async () => {
    setCargando(true)
    setError(false)
    setNoEntrenado(false)
    try {
      const { data } = await apiClient.get<RespuestaModelo>('/api/ia/modelo')
      setDatos(data)
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 503) setNoEntrenado(true)
      else setError(true)
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    void consultar()
  }, [consultar])

  return { datos, cargando, noEntrenado, error, consultar }
}
