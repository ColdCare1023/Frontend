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
}

export interface VerificacionIntegridad {
  integra: boolean
  total_registros: number
  primer_registro_inconsistente: number | null
  detalle_inconsistencia: DetalleInconsistencia | null
  registros_posteriores_afectados: number
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
}
