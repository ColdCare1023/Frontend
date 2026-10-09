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
  // D7: nombre de quien reconoció, resuelto por el backend (anonimizado si
  // el usuario fue desactivado, HU-45).
  revisada_por_nombre?: string | null
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
  // D7: nombre del responsable ya resuelto por el backend.
  usuario_nombre?: string | null
  // HU-28: motivo de la rectificación, quién la rectificó a ella y si es la
  // versión vigente (la única que se puede volver a rectificar).
  motivo_rectificacion?: string | null
  rectificada_por_id?: string | null
  vigente?: boolean
}
