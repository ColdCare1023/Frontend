import { ESTADOS_RIESGO, type EstadoRiesgo } from '@/domain/entities/LecturaTermica'
import { apiClient } from '@/infrastructure/api/apiClient'
import { MODO_DEMO } from '@/infrastructure/demo/modoDemo'
import { rutaApi } from '@/lib/rutaApi'

export interface EvidenciaInferencia {
  reading_id: string
  model_version: string | null
  inference_at: string | null
  inference_status: 'completada' | 'omitida' | 'fallida' | 'modelo_no_disponible' | null
  model_class: string | null
  probabilities: Record<string, number> | null
  /**
   * HU-18 esc. 1 / HU-47 esc. 1: false = salida de predict_proba que el modelo
   * no declara calibrada; null = no consta (modelo legado o backend anterior).
   */
  probabilities_calibrated?: boolean | null
  feature_vector: Record<string, number | boolean | null>
  horizon_min?: number | null
  feature_schema_version?: string | null
  operating_policy?: string | null
  excursion_confirmada: boolean
  effective_risk: string | null
  /**
   * HU-34 esc. 4: estado que se rotula (distingue «sin clasificación IA» y
   * «falla de sensor» de Normal). null si el backend no lo informa.
   */
  estado_riesgo?: EstadoRiesgo | null
  /** Solo en modo demostración: evidencia simulada, no del modelo real. */
  datos_simulados?: boolean
  /** HU-47: la clasificación la hizo el modelo en modo experimental (no aprobado). */
  ia_experimental?: boolean
  /**
   * HU-47 esc. 2: la versión que clasificó era la activa y aprobada en ese
   * momento. null = no hubo inferencia que cruzar con el versionado (HU-46).
   */
  version_activa_y_aprobada?: boolean | null
  /** Versión registrada que estaba activa al clasificar (null si ninguna). */
  version_activa_en_ese_momento?: string | null
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
  version_activa_en_ese_momento?: string | null
  /** HU-18/HU-47: ausente en backends anteriores. */
  probabilidades_calibradas?: boolean | null
  estado_inferencia: EvidenciaInferencia['inference_status']
  excursion_confirmada: boolean
  riesgo_efectivo: string | null
  /** HU-34 esc. 4: ausente en backends anteriores. */
  estado_riesgo?: string | null
  ia_experimental: boolean
  horizonte_min?: number | null
  feature_schema_version?: string | null
  politica_operativa?: string | null
}

export function aEvidencia(api: InferenciaLecturaApi): EvidenciaInferencia {
  return {
    reading_id: api.lectura_id,
    model_version: api.modelo_version,
    inference_at: api.timestamp_inferencia,
    inference_status: api.estado_inferencia ?? null,
    model_class: api.clasificacion_final,
    probabilities: api.probabilidades_por_clase,
    probabilities_calibrated: typeof api.probabilidades_calibradas === 'boolean' ? api.probabilidades_calibradas : null,
    feature_vector: api.vector_features ?? {},
    excursion_confirmada: api.excursion_confirmada,
    effective_risk: api.riesgo_efectivo,
    estado_riesgo: (ESTADOS_RIESGO as readonly string[]).includes(api.estado_riesgo ?? '')
      ? (api.estado_riesgo as EstadoRiesgo)
      : null,
    // HU-47: «Ejemplo simulado» solo en la demo; con datos reales, el modelo
    // experimental se rotula como tal (antes `ia_experimental` se tomaba como demo).
    datos_simulados: MODO_DEMO,
    ia_experimental: api.ia_experimental === true,
    version_activa_y_aprobada: api.version_era_activa_y_aprobada_en_ese_momento ?? null,
    version_activa_en_ese_momento: api.version_activa_en_ese_momento ?? null,
    horizon_min: api.horizonte_min ?? null,
    feature_schema_version: api.feature_schema_version ?? null,
    operating_policy: api.politica_operativa ?? null,
  }
}

export async function obtenerEvidenciaInferencia(readingId: string): Promise<EvidenciaInferencia> {
  const { data } = await apiClient.get<InferenciaLecturaApi>(rutaApi`/api/ia/inferencia/${readingId}`)
  return aEvidencia(data)
}
