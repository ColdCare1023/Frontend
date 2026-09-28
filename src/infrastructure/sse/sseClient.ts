import type { LecturaTermica } from '@/domain/entities/LecturaTermica'
import { apiClient, API_BASE_URL, getAccessToken } from '../api/apiClient'
import { generarLecturaEnVivo } from '../demo/datosDemo'
import { MODO_DEMO } from '../demo/modoDemo'

const SSE_URL = import.meta.env.VITE_SSE_URL ?? `${API_BASE_URL}/api/sse/lecturas`
const REINTENTO_MS = 5000
const INTERVALO_DEMO_MS = 8000

/** Stream simulado para el modo demo: emite una lectura nueva cada pocos segundos. */
function simularStream(
  onLectura: (lectura: LecturaTermica) => void,
  onEstado?: (conectado: boolean) => void,
): () => void {
  const conexion = setTimeout(() => onEstado?.(true), 700)
  const emisor = setInterval(() => onLectura(generarLecturaEnVivo()), INTERVALO_DEMO_MS)
  return () => {
    clearTimeout(conexion)
    clearInterval(emisor)
  }
}

/**
 * Suscripción SSE al flujo de lecturas térmicas en tiempo real (RF-11).
 *
 * El stream está autenticado: EventSource no puede enviar el header
 * Authorization, así que primero se solicita un ticket efímero (JWT de
 * audiencia exclusiva SSE, vida de segundos) y se pasa como query param.
 * Si la conexión cae o el ticket expira, se reintenta con ticket nuevo.
 * Devuelve la función de limpieza para cerrar la conexión.
 */
export function suscribirseLecturas(
  onLectura: (lectura: LecturaTermica) => void,
  onEstado?: (conectado: boolean) => void,
): () => void {
  if (MODO_DEMO) return simularStream(onLectura, onEstado)

  let source: EventSource | null = null
  let temporizador: ReturnType<typeof setTimeout> | null = null
  let cancelado = false

  const reintentar = () => {
    if (cancelado) return
    temporizador = setTimeout(conectar, REINTENTO_MS)
  }

  const conectar = () => {
    if (cancelado || !getAccessToken()) return

    apiClient
      .post<{ ticket: string }>('/api/auth/sse-ticket')
      .then(({ data }) => {
        if (cancelado) return
        source = new EventSource(`${SSE_URL}?ticket=${encodeURIComponent(data.ticket)}`)

        source.onopen = () => onEstado?.(true)
        source.onerror = () => {
          // Ticket expirado o red caída: cerramos y reconectamos con ticket fresco.
          onEstado?.(false)
          source?.close()
          source = null
          reintentar()
        }
        const recibirLectura = (event: MessageEvent) => {
          try {
            onLectura(JSON.parse(event.data) as LecturaTermica)
          } catch {
            // Mensaje keep-alive o malformado: se ignora.
          }
        }
        source.addEventListener('lectura', recibirLectura)
        source.addEventListener('fallo_sensor', recibirLectura)
        source.addEventListener('inferencia_omitida', recibirLectura)
      })
      .catch(() => {
        onEstado?.(false)
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
