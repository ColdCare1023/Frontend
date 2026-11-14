import {
  CircleAlert,
  CircleCheck,
  Hourglass,
  OctagonAlert,
  PowerOff,
  ShieldAlert,
  TriangleAlert,
  WifiOff,
  type LucideIcon,
} from 'lucide-react'

import { estadoCalibracion, type Dispositivo, type EstadoCalibracion } from '@/domain/entities/Dispositivo'
import type { NivelRiesgo } from '@/domain/value-objects/NivelRiesgo'
import type { TonoEstado } from '../../components/ui/estado-tonos'

/**
 * Estado visual de un equipo en la lista y en su detalle (SPEC P5b §5.4).
 * Cada estado tiene icono de forma propia y texto: el color nunca va solo.
 * «Sin datos» es un estado operativo, no una excursión (HU-54): se pinta con
 * reloj de arena y tono gris, nunca en rojo.
 */
export type EstadoVisual =
  | 'baja'
  | 'retenida'
  | 'critico'
  | 'falla_sensor'
  | 'sin_datos'
  | 'sin_conexion'
  | 'preventivo'
  | 'esperando'
  | 'normal'

export interface LecturaBreve {
  temperatura: number | null
  riesgo: NivelRiesgo | null
  timestamp: string
}

const RANGO: Record<EstadoVisual, number> = {
  retenida: 0,
  critico: 1,
  falla_sensor: 2,
  sin_datos: 3,
  sin_conexion: 4,
  preventivo: 5,
  esperando: 6,
  normal: 9,
  baja: 10,
}

export const ICONO_EQUIPO: Record<EstadoVisual, LucideIcon> = {
  baja: PowerOff,
  retenida: ShieldAlert,
  critico: OctagonAlert,
  falla_sensor: CircleAlert,
  sin_datos: Hourglass,
  sin_conexion: WifiOff,
  preventivo: TriangleAlert,
  esperando: Hourglass,
  normal: CircleCheck,
}

export const TEXTO_EQUIPO: Record<EstadoVisual, string> = {
  baja: 'text-faint',
  retenida: 'text-critical',
  critico: 'text-critical',
  falla_sensor: 'text-warning-700',
  sin_datos: 'text-nodata-700',
  sin_conexion: 'text-nodata-700',
  preventivo: 'text-warning-700',
  esperando: 'text-muted',
  normal: 'text-success-700',
}

/** Tono de la Regla y de la cinta para cada estado visual. */
export function tonoDeEstado(estado: EstadoVisual): TonoEstado {
  if (estado === 'critico' || estado === 'retenida') return 'critico'
  if (estado === 'preventivo' || estado === 'falla_sensor') return 'preventivo'
  if (estado === 'sin_datos') return 'sin_datos'
  if (estado === 'sin_conexion') return 'sin_conexion'
  if (estado === 'normal') return 'normal'
  return 'neutro'
}

/** Estado por precedencia: lo que pide actuar antes gana. */
export function estadoVisualEquipo(d: Dispositivo, ultima?: LecturaBreve | null): EstadoVisual {
  if (!d.activo) return 'baja'
  if (d.rotacion_por_compromiso || d.estado_operativo === 'MONITOREO_SUSPENDIDO') return 'retenida'
  const operativo = d.estado_operativo === undefined || d.estado_operativo === 'OPERATIVO'
  if (operativo && ultima?.riesgo === 'excursion_critica') return 'critico'
  if (d.estado_operativo === 'FALLA_SENSOR') return 'falla_sensor'
  if (d.estado_operativo === 'SIN_DATOS') return 'sin_datos'
  if (d.estado_conectividad !== 'online') return 'sin_conexion'
  if (operativo && ultima?.riesgo === 'riesgo_preventivo') return 'preventivo'
  if (!d.ultimo_reporte_en && !ultima) return 'esperando'
  return 'normal'
}

/** Orden de la lista: primero lo que requiere atención; los de baja al final. */
export function rangoAtencion(d: Dispositivo, estado: EstadoVisual, hoy: Date = new Date()): number {
  let rango = RANGO[estado]
  if (estado === 'baja') return rango
  const calibracion = estadoCalibracion(d, hoy)
  if (d.broker_pendiente || d.posesion_pendiente || calibracion === 'vencida') rango = Math.min(rango, 7)
  if (calibracion === 'proxima_a_vencer') rango = Math.min(rango, 8)
  return rango
}

/** Umbral de «Con atención» en el filtro de la lista. */
export const RANGO_ATENCION_MAXIMO = 8

export interface ResumenFlota {
  total: number
  enLinea: number
  deBaja: number
  sinDatos: number
  fallas: number
  buffer: number
  calibracionVencidas: number
  calibracionPorVencer: number
  consola: number
  retenida: Dispositivo | null
  calibracionVencida: Dispositivo | null
  sinDatosDesde: string | null
}

/** Cifras de la tira de estado. «Sin datos» cuenta solo equipos activos. */
export function resumenFlota(dispositivos: readonly Dispositivo[], hoy: Date = new Date()): ResumenFlota {
  const activos = dispositivos.filter((d) => d.activo)
  const sinDatos = activos.filter((d) => d.estado_operativo === 'SIN_DATOS')
  const calibraciones = activos.map((d) => [d, estadoCalibracion(d, hoy)] as const)
  const desdes = sinDatos.map((d) => d.ultimo_reporte_en).filter((v): v is string => Boolean(v)).sort()
  return {
    total: dispositivos.length,
    enLinea: activos.filter((d) => d.estado_conectividad === 'online').length,
    deBaja: dispositivos.length - activos.length,
    sinDatos: sinDatos.length,
    fallas: activos.filter((d) => d.estado_operativo === 'FALLA_SENSOR').length,
    buffer: dispositivos.reduce((total, d) => total + (d.buffer_littlefs?.pendientes ?? 0), 0),
    calibracionVencidas: calibraciones.filter(([, e]) => e === 'vencida').length,
    calibracionPorVencer: calibraciones.filter(([, e]) => e === 'proxima_a_vencer').length,
    consola: activos.filter((d) => d.broker_pendiente).length + activos.filter((d) => d.posesion_pendiente).length,
    retenida: activos.find((d) => d.rotacion_por_compromiso || d.estado_operativo === 'MONITOREO_SUSPENDIDO') ?? null,
    calibracionVencida: calibraciones.find(([, e]) => e === 'vencida')?.[0] ?? null,
    sinDatosDesde: desdes[0] ?? null,
  }
}

export type FraseGuia =
  | { clave: 'retenida'; id: string }
  | { clave: 'sinDatos'; n: number; total: number; desde: string | null }
  | { clave: 'falla'; n: number; id: string }
  | { clave: 'calibracion'; id: string }
  | { clave: 'consola'; n: number }
  | { clave: 'normal'; n: number }

/** Frase guía de la tira: el problema más grave primero (DIRECTION §5.1). */
export function fraseGuia(resumen: ResumenFlota, dispositivos: readonly Dispositivo[]): FraseGuia {
  if (resumen.retenida) return { clave: 'retenida', id: resumen.retenida.id }
  if (resumen.sinDatos > 0) {
    return { clave: 'sinDatos', n: resumen.sinDatos, total: resumen.total - resumen.deBaja, desde: resumen.sinDatosDesde }
  }
  if (resumen.fallas > 0) {
    const id = dispositivos.find((d) => d.activo && d.estado_operativo === 'FALLA_SENSOR')?.id ?? ''
    return { clave: 'falla', n: resumen.fallas, id }
  }
  if (resumen.calibracionVencida) return { clave: 'calibracion', id: resumen.calibracionVencida.id }
  if (resumen.consola > 0) return { clave: 'consola', n: resumen.consola }
  return { clave: 'normal', n: resumen.enLinea }
}

/** Acción contextual de una fila: una sola, por prioridad. Nada destructivo. */
export type AccionFila = 'confirmar' | 'reenviar' | 'calibrar' | null

export function accionFila(d: Dispositivo, calibracion: EstadoCalibracion = estadoCalibracion(d)): AccionFila {
  if (!d.activo) return null
  if (d.broker_pendiente) return 'confirmar'
  if (d.posesion_pendiente) return 'reenviar'
  if (calibracion === 'vencida' || calibracion === 'sin_registrar') return 'calibrar'
  return null
}

/** Búsqueda sin mayúsculas ni tildes sobre código, nombre y ubicación. */
export function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

export function coincide(d: Dispositivo, consulta: string): boolean {
  const q = normalizar(consulta)
  if (!q) return true
  return [d.id, d.nombre ?? '', d.ubicacion ?? ''].some((campo) => normalizar(campo).includes(q))
}

/** Días enteros entre hoy y una fecha ISO (negativo si ya pasó). */
export function diasHasta(iso: string | null | undefined, hoy: Date = new Date()): number | null {
  if (!iso) return null
  const fecha = new Date(`${iso.slice(0, 10)}T00:00:00`)
  if (Number.isNaN(fecha.getTime())) return null
  const base = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())
  return Math.round((fecha.getTime() - base.getTime()) / 86_400_000)
}

/** Pestañas del detalle, en orden. */
export const PESTANAS_EQUIPO = ['monitoreo', 'historial', 'calibracion', 'ubicacion', 'configuracion', 'seguridad'] as const
export type PestanaEquipo = (typeof PESTANAS_EQUIPO)[number]

export function esPestanaEquipo(valor: string | null): valor is PestanaEquipo {
  return valor !== null && (PESTANAS_EQUIPO as readonly string[]).includes(valor)
}

/** Campos del historial de configuración por grupo (HU-49). */
export const CAMPOS_CALIBRACION = [
  'fecha_ultima_calibracion',
  'numero_certificado_calibracion',
  'fecha_proxima_calibracion',
  'margen_aviso_calibracion_dias',
  'observaciones_calibracion',
] as const
export const CAMPOS_UBICACION = ['ubicacion', 'fecha_instalacion', 'observaciones_instalacion'] as const
export const CAMPOS_RESPONSABLE = ['responsable_nombre', 'responsable_email', 'responsable_telefono'] as const
