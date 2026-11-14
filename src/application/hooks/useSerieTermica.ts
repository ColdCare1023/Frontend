import { useCallback, useEffect, useRef, useState } from 'react'

import type { SerieTermica } from '@/domain/entities/SerieTermica'
import { apiClient } from '@/infrastructure/api/apiClient'

/**
 * HU-31: desde esta ventana la curva y su resumen salen de la serie agregada.
 * La de 1 h (≈ 360 lecturas a 10 s) sigue con lecturas crudas, que caben
 * enteras y conservan cada muestra.
 */
export const HORAS_MINIMAS_SERIE_AGREGADA = 24

/** Refresco de la serie: un intervalo del backend, entre 1 y 5 min. */
const REFRESCO_MINIMO_MS = 60_000
const REFRESCO_MAXIMO_MS = 5 * 60_000

/**
 * - `inactiva`: ventana corta o sin equipo; la curva usa lecturas crudas.
 * - `no_disponible`: el backend no la ofrece (versión anterior) o falló; la
 *   curva vuelve a las lecturas crudas y avisa si quedaron recortadas.
 */
export type EstadoSerieTermica = 'inactiva' | 'cargando' | 'lista' | 'no_disponible'

export interface SerieTermicaVentana {
  serie: SerieTermica | null
  estado: EstadoSerieTermica
  recargar: () => void
}

/**
 * Serie agregada (mín., máx., promedio por intervalo) del periodo completo de
 * la ventana del dashboard (HU-31). Se vuelve a pedir cada intervalo para
 * incorporar lo que el nodo sincronice desde su buffer (HU-48 esc. 3); las
 * lecturas en vivo posteriores a `hasta` las añade la curva.
 */
export function useSerieTermica(deviceId: string | null, horasVentana: number): SerieTermicaVentana {
  const activa = deviceId !== null && horasVentana >= HORAS_MINIMAS_SERIE_AGREGADA
  const [serie, setSerie] = useState<SerieTermica | null>(null)
  const [estado, setEstado] = useState<EstadoSerieTermica>(activa ? 'cargando' : 'inactiva')
  const [intento, setIntento] = useState(0)
  const recargar = useCallback(() => setIntento((actual) => actual + 1), [])
  const clave = activa ? `${deviceId}|${horasVentana}` : null
  const claveAnterior = useRef<string | null>(clave)
  const bucket = serie?.bucket_segundos ?? null
  const serieMostrada = useRef<SerieTermica | null>(null)
  serieMostrada.current = serie

  useEffect(() => {
    if (!activa || !deviceId) {
      setSerie(null)
      setEstado('inactiva')
      claveAnterior.current = null
      return
    }
    // Otro equipo u otra ventana: lo mostrado ya no corresponde. Un refresco
    // de la misma ventana conserva la serie mientras llega la nueva.
    if (claveAnterior.current !== clave) {
      claveAnterior.current = clave
      serieMostrada.current = null
      setSerie(null)
      setEstado('cargando')
    }
    let activo = true
    const hasta = new Date()
    const desde = new Date(hasta.getTime() - horasVentana * 3_600_000)
    apiClient
      .get<SerieTermica>('/api/lecturas/serie', {
        params: { device_id: deviceId, desde: desde.toISOString(), hasta: hasta.toISOString(), bucket: 'auto' },
      })
      .then(({ data }) => {
        if (!activo) return
        if (!data || !Array.isArray(data.buckets) || !data.resumen) throw new Error('Serie sin el formato esperado')
        setSerie(data)
        setEstado('lista')
      })
      .catch(() => {
        if (!activo) return
        // Un refresco fallido conserva la serie ya mostrada de esta ventana.
        setEstado(serieMostrada.current ? 'lista' : 'no_disponible')
      })
    return () => {
      activo = false
    }
  }, [activa, clave, deviceId, horasVentana, intento])

  // Refresco periódico con la pestaña visible (PERFORMANCE C1). Si el backend
  // no la ofrecía, se reintenta con calma: puede actualizarse sin recargar.
  useEffect(() => {
    if (!activa || estado === 'cargando') return
    const espera =
      estado === 'lista' ? Math.min(REFRESCO_MAXIMO_MS, Math.max(REFRESCO_MINIMO_MS, (bucket ?? 0) * 1000)) : REFRESCO_MAXIMO_MS
    const timer = window.setInterval(() => {
      if (!document.hidden) recargar()
    }, espera)
    return () => window.clearInterval(timer)
  }, [activa, estado, bucket, recargar])

  return { serie: activa ? serie : null, estado: activa ? estado : 'inactiva', recargar }
}
