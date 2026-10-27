import { apiClient } from '@/infrastructure/api/apiClient'
import { rutaApi } from '@/lib/rutaApi'

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

/** B-13: respuesta real de `GET /api/ia/inferencia/{lectura_id}` (HU-47). */
export interface InferenciaLecturaApi {
  lectura_id: string
  device_id: string
  timestamp_inferencia: string
  modelo_version: string | null
  vector_features: Record<string, number> | null
  probabilidades_por_clase: Record<string, number> | null
  clasificacion_final: string | null
  confianza: number | null
  origen_clasificacion: string | null
  version_era_activa_y_aprobada_en_ese_momento: boolean | null
  estado_inferencia: EvidenciaInferencia['inference_status']
  excursion_confirmada: boolean
  riesgo_efectivo: string | null
  ia_experimental: boolean
}

export function aEvidencia(api: InferenciaLecturaApi): EvidenciaInferencia {
  return {
    reading_id: api.lectura_id,
    model_version: api.modelo_version,
    inference_at: api.timestamp_inferencia,
    inference_status: api.estado_inferencia ?? null,
    model_class: api.clasificacion_final,
    probabilities: api.probabilidades_por_clase,
    feature_vector: api.vector_features ?? {},
    excursion_confirmada: api.excursion_confirmada,
    effective_risk: api.riesgo_efectivo,
    datos_simulados: api.ia_experimental,
  }
}

export async function obtenerEvidenciaInferencia(readingId: string): Promise<EvidenciaInferencia> {
  const { data } = await apiClient.get<InferenciaLecturaApi>(rutaApi`/api/ia/inferencia/${readingId}`)
  return aEvidencia(data)
}
