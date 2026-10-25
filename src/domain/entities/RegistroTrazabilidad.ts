export interface RegistroTrazabilidad {
  id: string
  tipo_evento: string
  device_id: string | null
  usuario_id: string | null
  payload: Record<string, unknown>
  timestamp: string
  previous_hash: string
  hash_actual: string
}

export interface DetalleInconsistencia {
  id: string
  tipo_evento: string
  timestamp: string
  hash_esperado: string
  hash_almacenado: string
  mensaje: string
  // HU-26 escenario 2 (opcionales: el modo demo y backends previos no los envían).
  chain_id?: string | null
  indice?: number | null
  tipo_discrepancia?: TipoDiscrepancia | null
  aislada?: boolean
}

export type TipoDiscrepancia = 'payload_alterado' | 'enlace_roto' | 'no_verificable'

/** HU-26: con todas las rupturas aisladas, la cadena vuelve a ser verificable. */
export type EstadoVerificacion = 'integra' | 'ruptura_aislada' | 'ruptura_detectada'

export interface VerificacionIntegridad {
  integra: boolean
  total_registros: number
  primer_registro_inconsistente: number | null
  detalle_inconsistencia: DetalleInconsistencia | null
  registros_posteriores_afectados: number
  estado?: EstadoVerificacion
  total_rupturas?: number
  rupturas?: DetalleInconsistencia[]
  registros_posteriores_consistentes?: number
  integra_desde?: string | null
  /** HU-26 escenario 4: qué certifica el resultado (no es certificación DIGEMID). */
  alcance?: string
}

export interface EstadoCadena {
  cadena_comprometida: boolean
}

// HU-37: verificación de integridad acotada a un dispositivo y un periodo —
// distinta de VerificacionIntegridad (cadena completa, HU-26).
export interface EstadoRegistroSegmento {
  id: string
  tipo_evento: string
  timestamp: string
  integro: boolean
}

export interface VerificacionSegmento {
  device_id: string
  desde: string
  hasta: string
  integra: boolean
  total_bloques_verificados: number
  registros_del_dispositivo: EstadoRegistroSegmento[]
  primer_registro_inconsistente: string | null
  alcance?: string
}
