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

/**
 * HU-26: con todas las rupturas aisladas, la cadena vuelve a ser verificable.
 * `no_concluida`: hay eslabones v3 (HMAC) y la clave no está disponible; no se
 * informa como íntegra ni como alterada (esc. 1) y no dispara la alarma.
 */
export type EstadoVerificacion = 'integra' | 'ruptura_aislada' | 'ruptura_detectada' | 'no_concluida'

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
  /** Cadena verificada (null: todas a la vez). */
  chain_id?: string | null
  /** Versiones de fórmula de los eslabones verificados (1/2: SHA-256; 3: HMAC). */
  versiones_hash?: number[]
  /** Eslabones v3 que no se pudieron verificar por falta de clave. */
  total_no_verificables?: number
  no_verificables?: DetalleInconsistencia[]
  hash_final?: string | null
}

/** HU-26: una cadena existente para elegir el `chain_id` a verificar. */
export interface CadenaTrazabilidad {
  chain_id: string
  /** La cadena de SISTEMA (usuarios, bitácora): no pertenece a un equipo. */
  es_sistema: boolean
  total_registros: number
  ultimo_registro_en?: string | null
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
  /** HU-37 esc. 2: «corrupto» se rotula «Corrupta» con su ID; `no_verificable` no es alteración. */
  estado?: 'integro' | 'corrupto' | 'no_verificable'
  tipo_discrepancia?: TipoDiscrepancia | null
  chain_seq?: number | null
}

export type EstadoSegmento = 'integra' | 'corrupta' | 'no_concluida'

export interface VerificacionSegmento {
  device_id: string
  desde: string
  hasta: string
  integra: boolean
  total_bloques_verificados: number
  registros_del_dispositivo: EstadoRegistroSegmento[]
  primer_registro_inconsistente: string | null
  alcance?: string
  estado?: EstadoSegmento
  total_corruptos?: number
  total_no_verificables?: number
  versiones_hash?: number[]
  hash_ancla?: string | null
}
