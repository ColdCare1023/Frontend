import { create } from 'zustand'

import type { AlertaTermica } from '@/domain/entities/AlertaTermica'
import type { Dispositivo } from '@/domain/entities/Dispositivo'
import type { NivelRiesgo } from '@/domain/value-objects/NivelRiesgo'
import { ordenarAlertas } from '@/lib/ordenAlertas'

/**
 * Estado en vivo del shell (píldora de la cabecera y contador del riel). Lo
 * alimenta un único hook montado en AppLayout (`useFuenteEstadoVivo`): una
 * carga, la conexión SSE compartida y un sondeo de 30 s con la pestaña
 * visible. Píldora e insignia leen de aquí; ninguna vuelve a pedir datos.
 */

export type Tono = 'ok' | 'aviso' | 'critico' | 'neutro'
export type ClaveEstado =
  | 'normal'
  | 'riesgo_preventivo'
  | 'excursion_critica'
  | 'falla_sensor'
  | 'sin_datos'
  | 'suspendido'
  | 'sin_conexion'
  | 'sin_lectura'

export interface EquipoVivo {
  id: string
  nombre: string | null
  estadoOperativo?: Dispositivo['estado_operativo']
  conectividad: string
  ultimoReporteEn: string | null
}

export interface LecturaVivo {
  temperatura: number | null
  /** riesgo_efectivo ?? nivel_riesgo */
  riesgo: NivelRiesgo | null
  timestamp: string
}

export interface ResumenAlertas {
  /** «Sin atender»: pendiente + reconocida, igual que el Dashboard (HU-21/23). */
  total: number
  criticas: number
  /** Alguna página volvió llena (200): el total es un mínimo. */
  truncado: boolean
  /** Las 3 más urgentes (orden de triage de Alertas) para el panel. */
  recientes: AlertaTermica[]
  /**
   * Pendientes y revisadas tal como llegaron (Alertas: tira de estado y cinta
   * 24 h sin volver a pedirlas). Opcional para no romper resúmenes armados a mano.
   */
  pendientes?: AlertaTermica[]
  revisadas?: AlertaTermica[]
}

export type CargaVivo = 'cargando' | 'listo' | 'parcial' | 'error'

interface EstadoVivo {
  carga: CargaVivo
  conectado: boolean | null
  equipos: EquipoVivo[]
  ultimas: Record<string, LecturaVivo>
  /** `null` = no disponible (falló la consulta). */
  alertas: ResumenAlertas | null
  actualizadoEn: number | null
  refrescar: () => void
  refrescarAlertas: () => void
  registrar: (fns: { refrescar: () => void; refrescarAlertas: () => void }) => void
  reiniciar: () => void
}

const INICIAL = {
  carga: 'cargando' as CargaVivo,
  conectado: null,
  equipos: [] as EquipoVivo[],
  ultimas: {} as Record<string, LecturaVivo>,
  alertas: null as ResumenAlertas | null,
  actualizadoEn: null as number | null,
}

const nada = () => {}

export const useEstadoVivoStore = create<EstadoVivo>((set) => ({
  ...INICIAL,
  refrescar: nada,
  refrescarAlertas: nada,
  registrar: ({ refrescar, refrescarAlertas }) => set({ refrescar, refrescarAlertas }),
  reiniciar: () => set({ ...INICIAL, refrescar: nada, refrescarAlertas: nada }),
}))

/** Convierte un dispositivo del backend al resumen que guarda el shell. */
export function aEquipoVivo(d: Dispositivo): EquipoVivo {
  return {
    id: d.id,
    nombre: d.nombre,
    estadoOperativo: d.estado_operativo,
    conectividad: d.estado_conectividad,
    ultimoReporteEn: d.ultimo_reporte_en ?? null,
  }
}

/** Solo acepta una lectura más nueva que la vigente. */
export function aplicarLectura(ultimas: Record<string, LecturaVivo>, deviceId: string, lectura: LecturaVivo) {
  const vigente = ultimas[deviceId]
  if (vigente && vigente.timestamp >= lectura.timestamp) return ultimas
  return { ...ultimas, [deviceId]: lectura }
}

/** Resume alertas sin atender (las dos páginas de 200 de la API). */
export function resumirAlertas(paginas: AlertaTermica[][], limite = 200): ResumenAlertas {
  const alertas = paginas.flat()
  return {
    total: alertas.length,
    criticas: alertas.filter((a) => a.nivel_riesgo === 'excursion_critica').length,
    truncado: paginas.some((p) => p.length >= limite),
    // Mismo orden que la bandeja de Alertas: críticas primero y, en cada nivel,
    // la que más lleva esperando.
    recientes: ordenarAlertas(alertas, 'pendiente').slice(0, 3),
    pendientes: paginas[0] ?? [],
    revisadas: paginas[1] ?? [],
  }
}

export interface EstadoEquipo {
  clave: ClaveEstado
  tono: Tono
  severidad: number
}

/** Estado de un equipo, en el orden de la tabla del spec del shell (§3.1). */
export function estadoDeEquipo(e: EquipoVivo, l: LecturaVivo | undefined): EstadoEquipo {
  if (e.estadoOperativo === 'FALLA_SENSOR') return { clave: 'falla_sensor', tono: 'critico', severidad: 5 }
  if (l?.riesgo === 'excursion_critica') return { clave: 'excursion_critica', tono: 'critico', severidad: 4 }
  if (e.estadoOperativo === 'SIN_DATOS') return { clave: 'sin_datos', tono: 'aviso', severidad: 3 }
  if (e.estadoOperativo === 'MONITOREO_SUSPENDIDO') return { clave: 'suspendido', tono: 'aviso', severidad: 3 }
  if (e.conectividad === 'offline') return { clave: 'sin_conexion', tono: 'aviso', severidad: 3 }
  if (l?.riesgo === 'riesgo_preventivo') return { clave: 'riesgo_preventivo', tono: 'aviso', severidad: 2 }
  if (l) return { clave: 'normal', tono: 'ok', severidad: 1 }
  return { clave: 'sin_lectura', tono: 'neutro', severidad: 0 }
}

export interface FilaEquipo {
  equipo: EquipoVivo
  lectura: LecturaVivo | undefined
  estado: EstadoEquipo
}

/** Equipos con su estado, los que tienen problema primero. */
export function filasEquipos(equipos: EquipoVivo[], ultimas: Record<string, LecturaVivo>): FilaEquipo[] {
  return equipos
    .map((equipo) => ({ equipo, lectura: ultimas[equipo.id], estado: estadoDeEquipo(equipo, ultimas[equipo.id]) }))
    .sort((a, b) => b.estado.severidad - a.estado.severidad)
}

/**
 * Equipo foco de la píldora: entre los que tienen lectura y un estado
 * térmico (5, 4, 2, 1), el más grave y, a igualdad, la lectura más nueva. Si
 * ninguno califica, el más grave en general. Sin equipos, `null`.
 */
export function seleccionarFoco(equipos: EquipoVivo[], ultimas: Record<string, LecturaVivo>): FilaEquipo | null {
  const filas = equipos.map((equipo) => ({ equipo, lectura: ultimas[equipo.id], estado: estadoDeEquipo(equipo, ultimas[equipo.id]) }))
  if (filas.length === 0) return null
  const termicos = filas.filter((f) => f.lectura && [5, 4, 2, 1].includes(f.estado.severidad))
  const candidatos = termicos.length > 0 ? termicos : filas
  return [...candidatos].sort(
    (a, b) => b.estado.severidad - a.estado.severidad || (b.lectura?.timestamp ?? '').localeCompare(a.lectura?.timestamp ?? ''),
  )[0]
}

/** Equipos fuera del foco con una incidencia operativa (severidad ≥ 3). */
export function seleccionarIncidencias(
  equipos: EquipoVivo[],
  ultimas: Record<string, LecturaVivo>,
  focoId: string | null,
): { cantidad: number; tono: Tono } {
  const otros = equipos
    .filter((e) => e.id !== focoId)
    .map((e) => estadoDeEquipo(e, ultimas[e.id]))
    .filter((s) => s.severidad >= 3)
  return { cantidad: otros.length, tono: otros.some((s) => s.tono === 'critico') ? 'critico' : 'aviso' }
}
