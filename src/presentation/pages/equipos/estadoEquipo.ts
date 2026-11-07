import type { Transition } from 'motion/react'
import { useTranslation } from 'react-i18next'

import { estadoCalibracion, type Dispositivo, type EstadoCalibracion } from '@/domain/entities/Dispositivo'
import { hora, localeActual } from '@/lib/formato'

/**
 * El color de un equipo, de mayor a menor gravedad. Separa dos cosas que antes parecían
 * una: «sin conexión» (el nodo se fue, gris) y «sin datos» (superó su umbral de silencio y
 * alguien debe mirarlo, miel). El rojo queda para lo que impide confiar en las lecturas.
 */
export type TonoEquipo = 'enLinea' | 'sinConexion' | 'sinDatos' | 'critico' | 'baja'

export function tonoEquipo(d: Dispositivo): TonoEquipo {
  if (!d.activo) return 'baja'
  if (d.estado_operativo === 'FALLA_SENSOR' || d.estado_operativo === 'MONITOREO_SUSPENDIDO' || d.rotacion_por_compromiso) return 'critico'
  if (d.estado_operativo === 'SIN_DATOS') return 'sinDatos'
  return d.estado_conectividad === 'online' ? 'enLinea' : 'sinConexion'
}

/** Clases del campo de color por estado. Los tokens ya traen su versión de tema oscuro. */
export const CAMPO: Record<TonoEquipo, { capa: string; tinta: string; suave: string }> = {
  enLinea: { capa: 'bg-campo-rango', tinta: 'text-campo-rango-tinta', suave: 'opacity-75' },
  sinConexion: { capa: 'bg-campo-sin-datos', tinta: 'text-campo-sin-datos-tinta', suave: 'opacity-75' },
  sinDatos: { capa: 'bg-campo-preventivo', tinta: 'text-campo-preventivo-tinta', suave: 'opacity-80' },
  // Sobre rojo, el blanco ya va justo de contraste: sin atenuar.
  critico: { capa: 'bg-campo-critico', tinta: 'text-campo-critico-tinta', suave: '' },
  baja: { capa: 'bg-cream-300', tinta: 'text-foreground', suave: 'opacity-75' },
}

/** Sensores instalados y cuántos responden. Un MC-38 «no instalado» no cuenta como falla. */
export function resumenSensores(d: Dispositivo): { activos: number; total: number } {
  const instalados = (d.sensores ?? []).filter((sensor) => sensor.estado !== 'no_instalado')
  return { activos: instalados.filter((sensor) => sensor.estado === 'ok').length, total: instalados.length }
}

/**
 * Parte consumida de la vigencia de la calibración, de 0 a 1. Sin las dos fechas no hay
 * nada que medir y devuelve null: nunca se dibuja una barra inventada.
 */
export function vigenciaConsumida(d: Dispositivo, hoy: Date = new Date()): number | null {
  if (!d.fecha_ultima_calibracion || !d.fecha_proxima_calibracion) return null
  const desde = Date.parse(d.fecha_ultima_calibracion.slice(0, 10))
  const hasta = Date.parse(d.fecha_proxima_calibracion.slice(0, 10))
  if (!Number.isFinite(desde) || !Number.isFinite(hasta) || hasta <= desde) return null
  return Math.min(1, Math.max(0, (hoy.getTime() - desde) / (hasta - desde)))
}

/** Lo principal que dice el estado del equipo y, si hace falta, lo que lo acompaña. */
export function useEstadoEquipo(d: Dispositivo): { principal: string; segundo: string | null } {
  const { t } = useTranslation()
  const conexion =
    d.estado_conectividad === 'online'
      ? t('dashboard.dispositivoOnline')
      : d.conectividad_cambiada_en
        ? t('dashboard.nodoSinConexionDesde', { hora: hora(d.conectividad_cambiada_en) })
        : t('dashboard.dispositivoOffline')
  if (!d.activo) return { principal: t('dispositivos.inactivo'), segundo: d.motivo_baja ? t(`dispositivos.motivos.${d.motivo_baja}`, { defaultValue: d.motivo_baja }) : null }
  if (d.estado_operativo && d.estado_operativo !== 'OPERATIVO') {
    return { principal: t(`dispositivos.estadoOperativo.${d.estado_operativo}`), segundo: conexion }
  }
  return { principal: conexion, segundo: null }
}

/**
 * El mes y el año de una fecha `yyyy-MM-dd` en el idioma de la interfaz: «noviembre de 2027». Se lee
 * como fecha de calendario, sin pasar por UTC, para que el día 1 no caiga en el mes anterior.
 */
export function mesYAnio(iso: string | null | undefined): string | null {
  const [anio, mes] = (iso ?? '').slice(0, 10).split('-').map(Number)
  if (!anio || !mes) return null
  return new Date(anio, mes - 1, 1).toLocaleDateString(localeActual(), { month: 'long', year: 'numeric' })
}

/** La calibración dicha en una frase: «Calibrado hasta noviembre de 2027». */
export function useFraseCalibracion(d: Dispositivo): { frase: string; estado: EstadoCalibracion; destacar: boolean } {
  const { t } = useTranslation()
  const estado = estadoCalibracion(d)
  const mes = mesYAnio(d.fecha_proxima_calibracion)
  const frase = mes || estado === 'sin_registrar' ? t(`dispositivos.calibracionFrase.${estado}`, { mes }) : t(`dispositivos.calibracionEstado.${estado}`)
  return { frase, estado, destacar: estado === 'vencida' || estado === 'proxima_a_vencer' }
}

/** El nombre que se lee primero; el código va en segundo plano. */
export function nombreEquipo(d: Dispositivo): string {
  return d.nombre || d.ubicacion || d.id
}

/** Lo que acompaña al nombre, en letra chica: dónde está y su código. */
export function datosSecundarios(d: Dispositivo): string {
  return [d.nombre ? d.ubicacion : null, d.id].filter(Boolean).join(' · ')
}

/** La pieza crece hasta ser su ficha (y vuelve): un resorte corto, sin rebote exagerado. */
export const MUELLE_FICHA: Transition = { type: 'spring', duration: 0.34, bounce: 0.08 }
