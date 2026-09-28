import type { NivelRiesgo } from '../value-objects/NivelRiesgo'

/** Origen real de la clasificación (AIV-04): quién decidió el nivel de riesgo. */
export type OrigenClasificacion =
  | 'random_forest'
  | 'salvaguarda_determinista'
  | 'dato_insuficiente'
  | 'fallo_sensor'

/** Estado real de la inferencia (AIV-07): distingue "no hubo inferencia" de
 * "el modelo decidió con confianza matemática 0". */
export type EstadoInferencia = 'completada' | 'omitida' | 'fallida' | 'modelo_no_disponible'
export type EstadoSensor = 'valido' | 'ausente' | 'invalido' | 'fisicamente_imposible'

export interface LecturaTermica {
  id: string | null
  device_id: string
  timestamp: string
  temperatura_ambiental: number | null
  humedad_ambiental: number | null
  temperatura_interna: number | null
  // HU-04: null cuando el dispositivo no tiene MC-38 instalado — no un
  // valor falso que simularía una puerta cerrada que no existe.
  apertura_refrigerador: boolean | null
  // HU-35: duración acumulada de ESTA apertura, tal como la reporta el nodo.
  // null si el firmware no lo reportó (dispositivo desactualizado) o si no
  // hay MC-38 instalado.
  duracion_apertura_segundos: number | null
  estado_conectividad: string
  // HU-18/21/34: `nivel_riesgo` es la clase cruda del pipeline IA/salvaguarda
  // (model_class) — NUNCA se debe presentar como "excursión confirmada" sin
  // pasar por `riesgo_efectivo`/`excursion_confirmada`.
  nivel_riesgo: NivelRiesgo | null
  /** null cuando no hubo inferencia real (AIV-07) — nunca 0 como centinela. */
  confianza_ia: number | null
  modelo_version: string | null
  model_version?: string | null
  origen_clasificacion: OrigenClasificacion | null
  estado_inferencia: EstadoInferencia | null
  motivo_no_inferencia: string | null
  estado_sensores?: Record<string, EstadoSensor> | null
  reading_id?: string | null
  schema_version?: number | null
  // HU-34: excursión confirmada por la regla directa de rango (2–8 °C),
  // independiente de la IA — nunca se infiere desde `nivel_riesgo`.
  excursion_confirmada: boolean
  // HU-34: la política determinista que combina excursión confirmada +
  // clasificación IA. Es lo que debe mostrarse como "estado actual" — no
  // `nivel_riesgo` directamente.
  riesgo_efectivo: NivelRiesgo | null
}
