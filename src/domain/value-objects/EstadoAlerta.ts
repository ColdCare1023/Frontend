// HU-23: máquina de estados de acuse y seguimiento de alertas críticas.
// Espejo de `EstadoAlerta` (backend, src/domain/value_objects/estado_alerta.py).
//
// PENDIENTE -> RECONOCIDA -> ATENDIDA, aunque ATENDIDA también se alcanza
// directamente desde PENDIENTE si se registra una acción correctiva antes de
// que alguien reconozca la alerta (ver `AlertaTermica.marcar_atendida` en el
// backend: solo rechaza si YA está atendida, no exige RECONOCIDA primero).
export type EstadoAlerta = 'pendiente' | 'reconocida' | 'atendida'

export const ESTADOS_ALERTA: EstadoAlerta[] = ['pendiente', 'reconocida', 'atendida']
