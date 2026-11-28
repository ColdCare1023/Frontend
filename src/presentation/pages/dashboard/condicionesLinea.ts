import { estadoCalibracion, umbralSilencioSegundos, type Dispositivo } from '@/domain/entities/Dispositivo'

export type EstadoCarga = 'cargando' | 'listo' | 'error'

export type CondicionLinea =
  | { tipo: 'criticas'; total: number; criticas: number }
  | { tipo: 'pendientes'; total: number }
  | { tipo: 'sin_datos'; equipos: Dispositivo[]; total: number }
  | { tipo: 'falla'; equipo: Dispositivo }
  | { tipo: 'calibracion_vencida' | 'calibracion_por_vencer'; equipo: Dispositivo }
  | { tipo: 'alertas_error' }
  | { tipo: 'todo_en_orden'; reportando: number; total: number }

export interface EntradaLinea {
  alertas: { estado: EstadoCarga; total: number; criticas: number }
  equipos: readonly Dispositivo[]
  hoy?: Date
}

const SIN_DATOS: ReadonlyArray<Dispositivo['estado_operativo']> = ['SIN_DATOS', 'MONITOREO_SUSPENDIDO']

/**
 * Línea de estado del monitoreo (TA, PLAN H2): lo peor de la farmacia en una
 * frase, por prioridad. Devuelve todas las condiciones vigentes en orden; la
 * línea presenta la incidencia prioritaria.
 *
 * Sin falsos verdes: «Todo en orden» solo si las alertas cargaron y hay
 * equipos conocidos. Con las alertas en error nunca se afirma que no hay.
 */
export function condicionesLineaEstado({ alertas, equipos, hoy = new Date() }: EntradaLinea): CondicionLinea[] {
  const condiciones: CondicionLinea[] = []
  if (alertas.estado === 'listo' && alertas.criticas > 0) {
    condiciones.push({ tipo: 'criticas', total: alertas.total, criticas: alertas.criticas })
  } else if (alertas.estado === 'listo' && alertas.total > 0) {
    condiciones.push({ tipo: 'pendientes', total: alertas.total })
  }

  const sinDatos = equipos.filter((equipo) =>
    SIN_DATOS.includes(equipo.estado_operativo) ||
    equipo.estado_conectividad === 'offline' ||
    (equipo.ultimo_reporte_en && hoy.getTime() - Date.parse(equipo.ultimo_reporte_en) >= umbralSilencioSegundos(equipo) * 1000),
  )
  if (sinDatos.length > 0) condiciones.push({ tipo: 'sin_datos', equipos: sinDatos, total: equipos.length })

  const conFalla = equipos.find((equipo) => equipo.estado_operativo === 'FALLA_SENSOR')
  if (conFalla) condiciones.push({ tipo: 'falla', equipo: conFalla })

  const vencida = equipos.find((equipo) => estadoCalibracion(equipo, hoy) === 'vencida')
  if (vencida) condiciones.push({ tipo: 'calibracion_vencida', equipo: vencida })
  else {
    const porVencer = equipos.find((equipo) => estadoCalibracion(equipo, hoy) === 'proxima_a_vencer')
    if (porVencer) condiciones.push({ tipo: 'calibracion_por_vencer', equipo: porVencer })
  }

  if (alertas.estado === 'error') condiciones.push({ tipo: 'alertas_error' })

  if (condiciones.length === 0 && alertas.estado === 'listo' && equipos.length > 0) {
    const reportando = equipos.filter((equipo) => equipo.estado_operativo === undefined || equipo.estado_operativo === 'OPERATIVO').length
    condiciones.push({ tipo: 'todo_en_orden', reportando, total: equipos.length })
  }
  return condiciones
}
