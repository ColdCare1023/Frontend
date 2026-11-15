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
  /** El backend debe declarar el origen; si falta, la evaluación queda como no verificada. */
  datos_simulados?: boolean
  estado_evaluacion?: 'validada' | 'ilustrativa_no_reportable' | 'no_disponible'
}

/** HU-16 (P1-7): `motivo` del 503 cuando el artefacto no superó la verificación. */
export const MOTIVOS_RECHAZO = [
  'checksum_invalido',
  'hash_distinto_de_la_version_activa',
  'sin_verificacion_de_integridad',
  'incompatible',
  'error_de_lectura',
] as const
/** HU-16: `motivo` del 503 cuando simplemente no hay modelo que evaluar. */
export const MOTIVOS_NO_ENTRENADO = ['no_entrenado', 'sin_metricas'] as const
export type MotivoRechazo = (typeof MOTIVOS_RECHAZO)[number]
export type MotivoNoEntrenado = (typeof MOTIVOS_NO_ENTRENADO)[number]

/**
 * Estado del modelo según `GET /api/ia/modelo`: 200 (disponible) o 503, que
 * distingue un artefacto rechazado por verificación de un modelo que aún no
 * está entrenado. Cualquier otra falla es un error de carga.
 */
export type EstadoModeloIA = 'cargando' | 'disponible' | 'no_entrenado' | 'rechazado' | 'error'

export type ModeloNoDisponible =
  | { estado: 'rechazado'; motivo: MotivoRechazo | null }
  | { estado: 'no_entrenado'; motivo: MotivoNoEntrenado | null }

const incluye = <T extends string>(lista: readonly T[], valor: unknown): valor is T =>
  typeof valor === 'string' && (lista as readonly string[]).includes(valor)

/**
 * Cuerpo del 503: `{detail, motivo, rechazado_por_verificacion}`. Un backend
 * anterior solo envía `detail`; su texto de rechazo decía «no superó la
 * verificación», y con eso se distingue igual.
 */
export function interpretarModeloNoDisponible(cuerpo: unknown): ModeloNoDisponible {
  const c = (cuerpo && typeof cuerpo === 'object' ? cuerpo : {}) as {
    detail?: unknown
    motivo?: unknown
    rechazado_por_verificacion?: unknown
  }
  const rechazado =
    typeof c.rechazado_por_verificacion === 'boolean'
      ? c.rechazado_por_verificacion
      : incluye(MOTIVOS_RECHAZO, c.motivo) || (typeof c.detail === 'string' && /verificaci[oó]n/i.test(c.detail))
  return rechazado
    ? { estado: 'rechazado', motivo: incluye(MOTIVOS_RECHAZO, c.motivo) ? c.motivo : null }
    : { estado: 'no_entrenado', motivo: incluye(MOTIVOS_NO_ENTRENADO, c.motivo) ? c.motivo : null }
}

/**
 * RNF-04: el backend ya publicaba la evidencia del modelo, pero ninguna
 * pantalla la consumía. Sin esta vista, afirmar en la sustentación que el
 * clasificador alcanza cierto F1 no era verificable desde el propio sistema.
 *
 * HU-16: el 503 no es un error genérico. El modelo puede no estar entrenado en
 * un entorno (estado legítimo) o haber sido rechazado por la verificación de
 * integridad (no clasifica con ese archivo); la vista explica cada caso.
 */
export function useModeloIA() {
  const [datos, setDatos] = useState<RespuestaModelo | null>(null)
  const [estado, setEstado] = useState<EstadoModeloIA>('cargando')
  const [motivo, setMotivo] = useState<MotivoRechazo | MotivoNoEntrenado | null>(null)

  const consultar = useCallback(async () => {
    setEstado('cargando')
    setMotivo(null)
    try {
      const { data } = await apiClient.get<RespuestaModelo>('/api/ia/modelo')
      setDatos(data)
      setEstado('disponible')
    } catch (err) {
      setDatos(null)
      if (axios.isAxiosError(err) && err.response?.status === 503) {
        const noDisponible = interpretarModeloNoDisponible(err.response.data)
        setEstado(noDisponible.estado)
        setMotivo(noDisponible.motivo)
      } else {
        setEstado('error')
      }
    }
  }, [])

  useEffect(() => {
    void consultar()
  }, [consultar])

  return {
    datos,
    estado,
    motivo,
    cargando: estado === 'cargando',
    noEntrenado: estado === 'no_entrenado',
    rechazado: estado === 'rechazado',
    error: estado === 'error',
    consultar,
  }
}
