import type { EstadoAlerta } from '../value-objects/EstadoAlerta'
import type { NivelRiesgo } from '../value-objects/NivelRiesgo'

export interface AlertaTermica {
  id: string
  reading_id: string
  device_id: string
  nivel_riesgo: NivelRiesgo
  mensaje: string
  // `revisada`/`revisada_por` se conservan por compatibilidad (el backend
  // los sigue enviando en sincronía con `estado`), pero HU-23 hace de
  // `estado` la fuente de verdad para la UI — no derivar nada de estos dos.
  revisada: boolean
  revisada_por: string | null
  created_at: string | null
  // HU-23: máquina de estados PENDIENTE -> RECONOCIDA -> ATENDIDA.
  estado: EstadoAlerta
  reconocida_en: string | null
  atendida_en: string | null
}

export interface AccionCorrectiva {
  id: string
  alert_id: string
  usuario_id: string
  descripcion: string
  created_at: string | null
  // HU-28: referencia a la acción que esta rectifica (null si es la original).
  corrige_accion_id: string | null
}
