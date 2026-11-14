import type { Dispositivo } from '@/domain/entities/Dispositivo'

/**
 * Disponibilidad de 24 h de un equipo (HU-13/48/54): 48 tramos de 30 min
 * alineados al reloj, pintados con lo que el backend ya entrega en el estado
 * operativo (incidentes, brechas del buffer, estado actual). No mezcla el
 * riesgo térmico: dice si el equipo reportó, no si la temperatura fue buena.
 */
export type EstadoTramo = 'operativo' | 'sin_datos' | 'perdida' | 'falla_sensor' | 'suspendido' | 'sin_registro'

export interface TramoDisponibilidad {
  inicio: number
  fin: number
  estado: EstadoTramo
}

const PRIORIDAD: Record<EstadoTramo, number> = {
  perdida: 5,
  suspendido: 4,
  sin_datos: 3,
  falla_sensor: 2,
  operativo: 1,
  sin_registro: 0,
}

const TRAMO_MS = 30 * 60 * 1000

type Intervalo = { desde: number; hasta: number; estado: EstadoTramo }

function ms(iso: string | null | undefined): number | null {
  if (!iso) return null
  const valor = Date.parse(iso)
  return Number.isNaN(valor) ? null : valor
}

const ESTADO_ACTUAL: Partial<Record<NonNullable<Dispositivo['estado_operativo']>, EstadoTramo>> = {
  SIN_DATOS: 'sin_datos',
  FALLA_SENSOR: 'falla_sensor',
  MONITOREO_SUSPENDIDO: 'suspendido',
}

/** Intervalos de incidentes y brechas que pintan la cinta de un equipo. */
function intervalosDe(equipo: Dispositivo, ahora: number): Intervalo[] {
  const intervalos: Intervalo[] = []
  for (const incidente of equipo.incidencias_operativas ?? []) {
    const estado: EstadoTramo | null =
      incidente.tipo === 'sin_datos'
        ? 'sin_datos'
        : incidente.tipo === 'monitoreo_suspendido' || incidente.tipo === 'colision_clave'
          ? 'suspendido'
          : incidente.tipo === 'sensor_fault'
            ? 'falla_sensor'
            : null
    if (!estado) continue
    const desde = ms(incidente.tipo === 'sin_datos' ? (incidente.ultimo_reporte_en ?? incidente.detectado_en) : incidente.detectado_en)
    const hasta = incidente.estado === 'activo' ? ahora : (ms(incidente.recuperado_en) ?? ahora)
    if (desde !== null) intervalos.push({ desde, hasta, estado })
  }
  for (const brecha of equipo.buffer_littlefs?.brechas ?? []) {
    const desde = ms(brecha.desde)
    const hasta = ms(brecha.hasta)
    if (desde !== null && hasta !== null) intervalos.push({ desde, hasta: Math.max(hasta, desde + 1), estado: 'perdida' })
  }
  return intervalos
}

/** 48 tramos (por defecto) que terminan en `ahora`; el último es «hh:30–ahora». */
export function tramosDisponibilidad(
  equipo: Dispositivo,
  ahora: number,
  { tramos = 48 }: { tramos?: number } = {},
): TramoDisponibilidad[] {
  const ultimoInicio = Math.floor(ahora / TRAMO_MS) * TRAMO_MS
  const primero = ultimoInicio - (tramos - 1) * TRAMO_MS
  const registrado = ms(equipo.registrado_en)
  const intervalos = intervalosDe(equipo, ahora)

  const resultado: TramoDisponibilidad[] = Array.from({ length: tramos }, (_, i) => {
    const inicio = primero + i * TRAMO_MS
    const fin = i === tramos - 1 ? Math.max(ahora, inicio + 1) : inicio + TRAMO_MS
    let estado: EstadoTramo = registrado !== null && fin <= registrado ? 'sin_registro' : 'operativo'
    for (const intervalo of intervalos) {
      if (intervalo.desde < fin && intervalo.hasta > inicio && PRIORIDAD[intervalo.estado] > PRIORIDAD[estado]) {
        estado = intervalo.estado
      }
    }
    return { inicio, fin, estado }
  })

  // Estado actual sin un incidente que lo cubra: al menos el último tramo lo dice.
  const actual = equipo.estado_operativo ? ESTADO_ACTUAL[equipo.estado_operativo] : undefined
  const ultimo = resultado[resultado.length - 1]
  if (actual && ultimo && PRIORIDAD[actual] > PRIORIDAD[ultimo.estado]) ultimo.estado = actual
  return resultado
}

/**
 * Porcentaje del tiempo registrado con datos, redondeado hacia abajo (99,6 →
 * 99). `null` si no hay tiempo registrado en la ventana: no es «0 %».
 */
export function porcentajeConDatos(tramos: readonly TramoDisponibilidad[]): number | null {
  let total = 0
  let conDatos = 0
  for (const tramo of tramos) {
    if (tramo.estado === 'sin_registro') continue
    const duracion = tramo.fin - tramo.inicio
    total += duracion
    if (tramo.estado === 'operativo') conDatos += duracion
  }
  return total === 0 ? null : Math.floor((conDatos / total) * 100)
}

/** Tramos contiguos con el mismo estado, fusionados (para el resumen accesible). */
export function fusionarTramos(tramos: readonly TramoDisponibilidad[]): TramoDisponibilidad[] {
  const fusion: TramoDisponibilidad[] = []
  for (const tramo of tramos) {
    const previo = fusion[fusion.length - 1]
    if (previo && previo.estado === tramo.estado && previo.fin === tramo.inicio) previo.fin = tramo.fin
    else fusion.push({ ...tramo })
  }
  return fusion
}
