import { useEffect, useState } from 'react'

import { umbralSilencioSegundos, type Dispositivo } from '@/domain/entities/Dispositivo'
import type { AlertaTermica } from '@/domain/entities/AlertaTermica'
import type { LecturaTermica } from '@/domain/entities/LecturaTermica'
import { apiClient, getAccessToken } from '@/infrastructure/api/apiClient'
import { suscribirseTiempoReal } from '@/infrastructure/sse/sseClient'

export type EstadoEquipoIsla = 'critico' | 'aviso' | 'normal' | 'sinDatos'

export interface EquipoIsla {
  id: string
  nombre: string | null
  lectura: LecturaTermica | null
  estado: EstadoEquipoIsla
  /** Segundos desde la última lectura; null si nunca hubo una. */
  antiguedad: number | null
}

export interface ResumenIsla {
  equipos: EquipoIsla[]
  /** El equipo que la isla cuenta: el peor con dato vigente. */
  principal: EquipoIsla | null
  /** null mientras no se sabe: nunca se presenta como «cero alertas». */
  alertas: { total: number; criticas: number } | null
  conectado: boolean | null
  cargando: boolean
}

const LECTURAS_INICIALES = 100
const ALERTAS_MAXIMO = 200
const REPASO_MS = 15_000
const SONDEO_ALERTAS_MS = 30_000
const PRIORIDAD: Record<EstadoEquipoIsla, number> = { critico: 0, aviso: 1, normal: 2, sinDatos: 3 }

/**
 * Lo que dice cada equipo ahora. Una lectura vieja o sin temperatura no es un cero ni una
 * excursión: es «sin datos», aunque la última lectura haya sido crítica.
 */
export function estadoEquipo(
  lectura: LecturaTermica | null,
  dispositivo: Dispositivo | null,
  ahora: number,
): { estado: EstadoEquipoIsla; antiguedad: number | null } {
  if (!lectura) return { estado: 'sinDatos', antiguedad: null }
  const antiguedad = Math.max(0, Math.round((ahora - new Date(lectura.timestamp).getTime()) / 1000))
  const operativo = dispositivo?.estado_operativo
  if (
    lectura.temperatura_interna == null ||
    antiguedad > umbralSilencioSegundos(dispositivo) ||
    operativo === 'SIN_DATOS' ||
    operativo === 'FALLA_SENSOR' ||
    operativo === 'MONITOREO_SUSPENDIDO'
  ) {
    return { estado: 'sinDatos', antiguedad }
  }
  if (lectura.excursion_confirmada || lectura.riesgo_efectivo === 'excursion_critica') return { estado: 'critico', antiguedad }
  if (lectura.riesgo_efectivo === 'riesgo_preventivo') return { estado: 'aviso', antiguedad }
  return { estado: 'normal', antiguedad }
}

/** Ordena lo que se sabe de los equipos: primero lo más grave, luego lo más reciente. */
export function ordenarEquipos(equipos: EquipoIsla[]): EquipoIsla[] {
  return [...equipos].sort(
    (a, b) => PRIORIDAD[a.estado] - PRIORIDAD[b.estado] || (a.antiguedad ?? Infinity) - (b.antiguedad ?? Infinity) || a.id.localeCompare(b.id),
  )
}

/**
 * Datos de la isla: última lectura por equipo y alertas pendientes. Pide lo justo al
 * montar y luego vive del tiempo real, con un sondeo lento de alertas porque reconocer
 * una no llega por SSE. Si algo falla, la isla lo dice; no se inventa ningún dato.
 */
export function useResumenIsla({ verLecturas, verAlertas, refresco }: { verLecturas: boolean; verAlertas: boolean; refresco?: unknown }): ResumenIsla {
  const [lecturas, setLecturas] = useState<Record<string, LecturaTermica>>({})
  const [dispositivos, setDispositivos] = useState<Dispositivo[]>([])
  const [alertas, setAlertas] = useState<ResumenIsla['alertas']>(null)
  const [conectado, setConectado] = useState<boolean | null>(null)
  const [cargando, setCargando] = useState(true)
  const [ahora, setAhora] = useState(() => Date.now())

  // La frescura depende del reloj: se repasa sin esperar a la siguiente lectura.
  useEffect(() => {
    const reloj = window.setInterval(() => {
      if (!document.hidden) setAhora(Date.now())
    }, REPASO_MS)
    return () => window.clearInterval(reloj)
  }, [])

  useEffect(() => {
    if (!getAccessToken() || !verLecturas) {
      setCargando(false)
      return
    }
    let vigente = true
    void Promise.allSettled([
      apiClient.get<LecturaTermica[]>('/api/lecturas', { params: { limite: LECTURAS_INICIALES } }),
      apiClient.get<Dispositivo[]>('/api/dispositivos/estado-operativo', { params: { todos: true } }),
    ]).then(([respuestaLecturas, respuestaEquipos]) => {
      if (!vigente) return
      if (respuestaLecturas.status === 'fulfilled') {
        setLecturas((previas) => {
          const siguientes = { ...previas }
          for (const lectura of respuestaLecturas.value.data) {
            const conocida = siguientes[lectura.device_id]
            if (!conocida || lectura.timestamp > conocida.timestamp) siguientes[lectura.device_id] = lectura
          }
          return siguientes
        })
      }
      if (respuestaEquipos.status === 'fulfilled') setDispositivos(respuestaEquipos.value.data)
      setAhora(Date.now())
      setCargando(false)
    })
    return () => {
      vigente = false
    }
  }, [verLecturas])

  useEffect(() => {
    if (!getAccessToken() || !verAlertas) return
    let vigente = true
    let enCurso = false
    const consultar = async () => {
      if (enCurso || document.hidden) return
      enCurso = true
      try {
        const { data } = await apiClient.get<AlertaTermica[]>('/api/alertas', { params: { estado: 'pendiente', limite: String(ALERTAS_MAXIMO) } })
        if (vigente) setAlertas({ total: data.length, criticas: data.filter((a) => a.nivel_riesgo === 'excursion_critica').length })
      } catch {
        if (vigente) setAlertas(null)
      } finally {
        enCurso = false
      }
    }
    void consultar()
    const sondeo = window.setInterval(() => void consultar(), SONDEO_ALERTAS_MS)
    const cerrar = suscribirseTiempoReal({ onAlerta: () => void consultar() })
    return () => {
      vigente = false
      window.clearInterval(sondeo)
      cerrar()
    }
  }, [verAlertas, refresco])

  useEffect(() => {
    if (!verLecturas) return
    return suscribirseTiempoReal({
      onLectura: (lectura) => {
        setLecturas((previas) => {
          const conocida = previas[lectura.device_id]
          return conocida && lectura.timestamp <= conocida.timestamp ? previas : { ...previas, [lectura.device_id]: lectura }
        })
        setAhora(Date.now())
      },
      onEstado: setConectado,
    })
  }, [verLecturas])

  const porId = new Map(dispositivos.map((d) => [d.id, d]))
  const dadosDeBaja = new Set(dispositivos.filter((d) => d.activo === false).map((d) => d.id))
  const ids = new Set([...dispositivos.map((d) => d.id), ...Object.keys(lecturas)].filter((id) => !dadosDeBaja.has(id)))
  const equipos = ordenarEquipos(
    [...ids].map((id) => {
      const dispositivo = porId.get(id) ?? null
      const lectura = lecturas[id] ?? null
      return { id, nombre: dispositivo?.nombre ?? null, lectura, ...estadoEquipo(lectura, dispositivo, ahora) }
    }),
  )

  return { equipos, principal: equipos[0] ?? null, alertas, conectado, cargando }
}
