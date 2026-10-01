import { apiClient } from '@/infrastructure/api/apiClient'

export interface EvidenciaInferencia {
  reading_id: string
  model_version: string | null
  inference_at: string | null
  inference_status: 'completada' | 'omitida' | 'fallida' | 'modelo_no_disponible' | null
  model_class: string | null
  probabilities: Record<string, number> | null
  feature_vector: Record<string, number | boolean | null>
  excursion_confirmada: boolean
  effective_risk: string | null
  datos_simulados?: boolean
}

export async function obtenerEvidenciaInferencia(readingId: string): Promise<EvidenciaInferencia> {
  const { data } = await apiClient.get<EvidenciaInferencia>(
    `/api/ia/inferencias/${encodeURIComponent(readingId)}`,
  )
  return data
}
