import type { LecturaTermica } from '@/domain/entities/LecturaTermica'
import { apiClient, API_BASE_URL, getAccessToken } from '../api/apiClient'
import { generarLecturaEnVivo, puedeTransmitirLecturaDemo } from '../demo/datosDemo'
import { MODO_DEMO } from '../demo/modoDemo'

const SSE_URL = import.meta.env.VITE_SSE_URL ?? `${API_BASE_URL}/api/sse/lecturas`
// HU-32: reconexión con backoff exponencial (1 s → 2 s → 4 s … tope 30 s);
// vuelve a 1 s en cuanto la conexión se reabre.
export const REINTENTO_BASE_MS = 1000
export const REINTENTO_MAX_MS = 30_000
const INTERVALO_DEMO_MS = 8000

/** HU-13: cambio de conectividad normalizado que emite el backend (evento `conectividad`). */
export interface CambioConectividad {
  device_id: string
  estado: 'online' | 'offline'
  desde: string
  boot_id: number | null
  origen: 'online' | 'lwt' | 'telemetria'
}

export interface OyentesTiempoReal {
  onLectura?: (lectura: LecturaTermica) => void
  onConectividad?: (cambio: CambioConectividad) => void
  onEstado?: (conectado: boolean) => void
}

const oyentes = new Set<OyentesTiempoReal>()
let cerrarConexion: (() => void) | null = null
let ultimoEstado: boolean | null = null

function avisarEstado(conectado: boolean) {
  ultimoEstado = conectado
  oyentes.forEach((o) => o.onEstado?.(conectado))
}

/** Stream simulado para el modo demo: emite una lectura nueva cada pocos segundos. */
function simularStream(): () => void {
  const conexion = setTimeout(() => avisarEstado(true), 700)
  const emisor = setInterval(() => {
    if (!puedeTransmitirLecturaDemo()) return
    const lectura = generarLecturaEnVivo()
    oyentes.forEach((o) => o.onLectura?.(lectura))
  }, INTERVALO_DEMO_MS)
  return () => {
    clearTimeout(conexion)
    clearInterval(emisor)
  }
}

/**
 * Conexión SSE real (RF-11). El stream está autenticado: EventSource no puede
 * enviar el header Authorization, así que primero se solicita un ticket
 * efímero (JWT de audiencia exclusiva SSE, vida de segundos) y se pasa como
 * query param. Si la conexión cae o el ticket expira, se reintenta con ticket
 * nuevo.
 */
function abrirConexion(): () => void {
  let source: EventSource | null = null
  let temporizador: ReturnType<typeof setTimeout> | null = null
  let cancelado = false
  let espera = REINTENTO_BASE_MS

  const reintentar = () => {
    if (cancelado) return
    temporizador = setTimeout(conectar, espera)
    espera = Math.min(espera * 2, REINTENTO_MAX_MS)
  }

  const conectar = () => {
    if (cancelado || !getAccessToken()) return

    apiClient
      .post<{ ticket: string }>('/api/auth/sse-ticket')
      .then(({ data }) => {
        if (cancelado) return
        source = new EventSource(`${SSE_URL}?ticket=${encodeURIComponent(data.ticket)}`)

        source.onopen = () => {
          espera = REINTENTO_BASE_MS
          avisarEstado(true)
        }
        source.onerror = () => {
          // Ticket expirado o red caída: cerramos y reconectamos con ticket fresco.
          avisarEstado(false)
          source?.close()
          source = null
          reintentar()
        }
        const recibirLectura = (event: MessageEvent) => {
          try {
            const lectura = JSON.parse(event.data) as LecturaTermica
            oyentes.forEach((o) => o.onLectura?.(lectura))
          } catch {
            // Mensaje keep-alive o malformado: se ignora.
          }
        }
        source.addEventListener('lectura', recibirLectura)
        source.addEventListener('fallo_sensor', recibirLectura)
        source.addEventListener('inferencia_omitida', recibirLectura)
        source.addEventListener('conectividad', (event: MessageEvent) => {
          try {
            const cambio = JSON.parse(event.data) as CambioConectividad
            oyentes.forEach((o) => o.onConectividad?.(cambio))
          } catch {
            // Mensaje malformado: se ignora.
          }
        })
      })
      .catch(() => {
        avisarEstado(false)
        reintentar()
      })
  }

  conectar()

  return () => {
    cancelado = true
    if (temporizador) clearTimeout(temporizador)
    source?.close()
  }
}

/**
 * Suscripción al tiempo real del backend. Todas las pantallas comparten UNA
 * conexión SSE (un solo ticket y un solo stream por pestaña): se abre con el
 * primer oyente y se cierra con el último. Devuelve la función de limpieza.
 */
export function suscribirseTiempoReal(nuevos: OyentesTiempoReal): () => void {
  const propio = { ...nuevos }
  oyentes.add(propio)
  if (cerrarConexion === null) {
    cerrarConexion = MODO_DEMO ? simularStream() : abrirConexion()
  } else if (ultimoEstado !== null) {
    propio.onEstado?.(ultimoEstado)
  }
  return () => {
    oyentes.delete(propio)
    if (oyentes.size === 0 && cerrarConexion !== null) {
      cerrarConexion()
      cerrarConexion = null
      ultimoEstado = null
    }
  }
}

/** Flujo de lecturas térmicas en tiempo real (RF-11). */
export function suscribirseLecturas(
  onLectura: (lectura: LecturaTermica) => void,
  onEstado?: (conectado: boolean) => void,
): () => void {
  return suscribirseTiempoReal({ onLectura, onEstado })
}
