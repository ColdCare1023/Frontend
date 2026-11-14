import { useEffect, useMemo, useState } from 'react'

import type { LecturaTermica } from '@/domain/entities/LecturaTermica'
import { apiClient } from '@/infrastructure/api/apiClient'
import { suscribirseLecturas } from '@/infrastructure/sse/sseClient'

/** Un punto de la tendencia corta: instante (ms) y temperatura interna. */
export interface PuntoTendencia {
  t: number
  v: number | null
}

export type SentidoTendencia = 'sube' | 'baja' | 'estable'

export interface Tendencia {
  /** °C por hora (pendiente de la recta de mínimos cuadrados). */
  pendiente: number
  sentido: SentidoTendencia
  /** Inicio de la ventana usada (ms). */
  desde: number
}

/** Lecturas por equipo para la tendencia: las 48 más recientes (SPEC P5b §4.3). */
export const LECTURAS_TENDENCIA = 48
/** Por debajo de esto (°C/h) la temperatura se considera estable. */
export const UMBRAL_ESTABLE = 0.3
const VENTANA_MS = 60 * 60 * 1000
const CACHE_MS = 120_000
const EN_PARALELO = 3

/**
 * Pendiente de la última hora (o de toda la serie si es más corta) por
 * mínimos cuadrados, en °C/h. Necesita al menos 3 puntos con valor que
 * abarquen 10 min; si no, no hay tendencia que mostrar (`null`).
 */
export function calcularTendencia(puntos: readonly PuntoTendencia[]): Tendencia | null {
  const validos = puntos.filter((p): p is { t: number; v: number } => p.v !== null && Number.isFinite(p.t))
  if (validos.length < 3) return null
  const fin = validos[validos.length - 1].t
  let ventana = validos.filter((p) => p.t >= fin - VENTANA_MS)
  if (ventana.length < 3) ventana = validos.slice(-3)
  const desde = ventana[0].t
  if (fin - desde < 10 * 60 * 1000) return null
  const n = ventana.length
  const mediaT = ventana.reduce((s, p) => s + p.t, 0) / n
  const mediaV = ventana.reduce((s, p) => s + p.v, 0) / n
  let num = 0
  let den = 0
  for (const p of ventana) {
    num += (p.t - mediaT) * (p.v - mediaV)
    den += (p.t - mediaT) ** 2
  }
  if (den === 0) return null
  const pendiente = (num / den) * 3_600_000
  const sentido: SentidoTendencia = Math.abs(pendiente) < UMBRAL_ESTABLE ? 'estable' : pendiente > 0 ? 'sube' : 'baja'
  return { pendiente, sentido, desde }
}

/* ── Caché de módulo: ir y volver del detalle no repite las peticiones ── */

interface Entrada {
  puntos: PuntoTendencia[]
  cargadoEn: number
  estado: 'cargando' | 'listo' | 'error'
}

const cache = new Map<string, Entrada>()
const oyentes = new Set<() => void>()
const avisar = () => oyentes.forEach((o) => o())

const aPunto = (l: LecturaTermica): PuntoTendencia => ({ t: Date.parse(l.timestamp), v: l.temperatura_interna ?? null })

function anadirLectura(lectura: LecturaTermica) {
  const entrada = cache.get(lectura.device_id)
  if (!entrada || entrada.estado !== 'listo') return
  const punto = aPunto(lectura)
  if (entrada.puntos.some((p) => p.t === punto.t)) return
  const puntos = [...entrada.puntos, punto].sort((a, b) => a.t - b.t).slice(-LECTURAS_TENDENCIA)
  cache.set(lectura.device_id, { ...entrada, puntos })
  avisar()
}

let enCurso = 0
const cola: string[] = []

function bombear() {
  while (enCurso < EN_PARALELO && cola.length > 0) {
    const id = cola.shift()!
    enCurso += 1
    apiClient
      .get<LecturaTermica[]>('/api/lecturas', { params: { device_id: id, limite: LECTURAS_TENDENCIA } })
      .then(({ data }) => {
        const puntos = (Array.isArray(data) ? data : [])
          .filter((l) => l.device_id === id || !l.device_id)
          .map(aPunto)
          .filter((p) => Number.isFinite(p.t))
          .sort((a, b) => a.t - b.t)
        cache.set(id, { puntos, cargadoEn: Date.now(), estado: 'listo' })
      })
      .catch(() => {
        const previa = cache.get(id)
        cache.set(id, { puntos: previa?.puntos ?? [], cargadoEn: Date.now(), estado: previa?.puntos.length ? 'listo' : 'error' })
      })
      .finally(() => {
        enCurso -= 1
        avisar()
        bombear()
      })
  }
}

function pedir(ids: readonly string[]) {
  const ahora = Date.now()
  for (const id of ids) {
    const entrada = cache.get(id)
    const vigente = entrada && (entrada.estado === 'cargando' || ahora - entrada.cargadoEn < CACHE_MS)
    if (vigente || cola.includes(id)) continue
    cache.set(id, { puntos: entrada?.puntos ?? [], cargadoEn: entrada?.cargadoEn ?? 0, estado: entrada?.puntos.length ? 'listo' : 'cargando' })
    cola.push(id)
  }
  bombear()
}

/** Solo para pruebas: vacía la caché compartida. */
export function reiniciarTendencias() {
  cache.clear()
  cola.length = 0
}

/**
 * Tendencia corta de los equipos visibles: `GET /api/lecturas?device_id=&limite=48`
 * (el mismo endpoint de Historial y del detalle), como máximo 3 a la vez, con
 * caché de 2 min, y las lecturas que llegan por SSE se añaden en vivo. Solo se
 * pide para las filas de la página visible.
 */
export function useTendencias(ids: readonly string[]): ReadonlyMap<string, Entrada> {
  const [version, forzar] = useState(0)
  const clave = ids.join('|')

  useEffect(() => {
    const oyente = () => forzar((n) => n + 1)
    oyentes.add(oyente)
    return () => {
      oyentes.delete(oyente)
    }
  }, [])

  useEffect(() => {
    if (clave) pedir(clave.split('|'))
  }, [clave])

  useEffect(() => suscribirseLecturas(anadirLectura), [])

  return useMemo(() => {
    const mapa = new Map<string, Entrada>()
    for (const id of clave ? clave.split('|') : []) {
      const entrada = cache.get(id)
      if (entrada) mapa.set(id, entrada)
    }
    return mapa
    // `version` cambia cuando la caché avisa: la caché vive fuera de React.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave, version])
}
