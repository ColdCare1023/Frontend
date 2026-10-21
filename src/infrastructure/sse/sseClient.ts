import type { LecturaTermica } from '@/domain/entities/LecturaTermica'
import { apiClient, API_BASE_URL, getAccessToken } from '../api/apiClient'
import { MODO_DEMO } from '../demo/modoDemo'

const SSE_URL = import.meta.env.VITE_SSE_URL ?? `${API_BASE_URL}/api/sse/lecturas`
// HU-32: reconexión con backoff exponencial (1 s → 2 s → 4 s … tope 30 s);
// vuelve a 1 s en cuanto la conexión se reabre.
export const REINTENTO_BASE_MS = 1000
export const REINTENTO_MAX_MS = 30_000
const INTERVALO_DEMO_MS = 8000

/** HU-13: cambio de conectividad normalizado (ver `normalizarConectividad`). */
export interface CambioConectividad {
  device_id: string
  estado: 'online' | 'offline'
  desde: string
  boot_id: number | null
  origen: 'online' | 'lwt' | 'telemetria'
}

/**
 * FE-008: catálogo de eventos SSE que emite el backend (main.py /
 * lecturas_router.py / sse_router.py). Antes el cliente solo escuchaba
 * lecturas y un `conectividad` que el backend no emite: desconexiones del
 * nodo, alertas y avisos de buffer no llegaban en tiempo real.
 */
export const EVENTOS_LECTURA = ['lectura', 'fallo_sensor', 'inferencia_omitida'] as const
export const EVENTOS_ALERTA = ['alerta', 'episodio_actualizado', 'recuperacion'] as const
/** Contrato v1.0 (`event_type`) y eventos heredados (`tipo_sse`). */
const EVENTOS_OFFLINE = ['lwt_offline', 'desconexion'] as const
const EVENTOS_ONLINE = ['online', 'reconexion'] as const
export const EVENTOS_AVISO_DISPOSITIVO = [
  'buffer_80', 'capacidad_buffer_alta',
  'buffer_saturado', 'saturacion_buffer',
  'registros_en_cuarentena',
  'wifi_reconexion_prolongada', 'reconexion_prolongada',
  'conmutacion_respaldo', 'suministro_restablecido',
  'respaldo_autonomia_critica', 'respaldo_bajo',
  'credencial_rotada', 'puerta', 'arranque', 'firmware_actualizado',
] as const

export type TipoEventoAlerta = (typeof EVENTOS_ALERTA)[number]
export type TipoAvisoDispositivo = (typeof EVENTOS_AVISO_DISPOSITIVO)[number]

export interface EventoAlerta {
  tipo: TipoEventoAlerta
  device_id: string
  temperatura_interna?: number | null
  timestamp?: string
}

export interface AvisoDispositivo {
  tipo: TipoAvisoDispositivo
  device_id: string
  timestamp: string
  detalle: Record<string, unknown> | null
}

export interface OyentesTiempoReal {
  onLectura?: (lectura: LecturaTermica) => void
  onConectividad?: (cambio: CambioConectividad) => void
  onAlerta?: (evento: EventoAlerta) => void
  onAvisoDispositivo?: (aviso: AvisoDispositivo) => void
  onEstado?: (conectado: boolean) => void
}

/** Eventos de dispositivo del backend: `{device_id, timestamp, boot_id?}`. */
export function normalizarConectividad(
  datos: { device_id: string; timestamp?: string; boot_id?: number | null },
  estado: 'online' | 'offline',
): CambioConectividad {
  return {
    device_id: datos.device_id,
    estado,
    desde: datos.timestamp ?? new Date().toISOString(),
    boot_id: datos.boot_id ?? null,
    origen: estado === 'offline' ? 'lwt' : 'online',
  }
}

function datosDe(event: MessageEvent): Record<string, unknown> | null {
  try {
    const datos: unknown = JSON.parse(event.data)
    return datos && typeof datos === 'object' ? (datos as Record<string, unknown>) : null
  } catch {
    // Mensaje keep-alive o malformado: se ignora.
    return null
  }
}

const oyentes = new Set<OyentesTiempoReal>()
let cerrarConexion: (() => void) | null = null
let ultimoEstado: boolean | null = null

function avisarEstado(conectado: boolean) {
  ultimoEstado = conectado
  oyentes.forEach((o) => o.onEstado?.(conectado))
}

/**
 * Stream simulado para el modo demo: emite una lectura nueva cada pocos
 * segundos. FE-009: los datos demo se cargan bajo demanda (import dinámico)
 * para que no formen parte del build contra el backend.
 */
function simularStream(): () => void {
  const conexion = setTimeout(() => avisarEstado(true), 700)
  const emisor = setInterval(() => {
    void import('../demo/datosDemo').then(({ generarLecturaEnVivo, puedeTransmitirLecturaDemo }) => {
      if (!puedeTransmitirLecturaDemo()) return
      const lectura = generarLecturaEnVivo()
      oyentes.forEach((o) => o.onLectura?.(lectura))
    })
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
        const fuente = source
        const escuchar = (tipo: string, manejar: (datos: Record<string, unknown>) => void) =>
          fuente.addEventListener(tipo, (event: MessageEvent) => {
            const datos = datosDe(event)
            if (datos) manejar(datos)
          })
        const conectividad = (cambio: CambioConectividad) => oyentes.forEach((o) => o.onConectividad?.(cambio))

        for (const tipo of EVENTOS_LECTURA) {
          escuchar(tipo, (datos) => oyentes.forEach((o) => o.onLectura?.(datos as unknown as LecturaTermica)))
        }
        for (const tipo of EVENTOS_ALERTA) {
          escuchar(tipo, (datos) =>
            oyentes.forEach((o) => o.onAlerta?.({ ...(datos as unknown as Omit<EventoAlerta, 'tipo'>), tipo })),
          )
        }
        for (const tipo of EVENTOS_OFFLINE) {
          escuchar(tipo, (datos) => conectividad(normalizarConectividad(datos as { device_id: string }, 'offline')))
        }
        for (const tipo of EVENTOS_ONLINE) {
          escuchar(tipo, (datos) => conectividad(normalizarConectividad(datos as { device_id: string }, 'online')))
        }
        // Forma ya normalizada (HU-13), por si el backend la emite.
        escuchar('conectividad', (datos) => conectividad(datos as unknown as CambioConectividad))
        for (const tipo of EVENTOS_AVISO_DISPOSITIVO) {
          escuchar(tipo, (datos) =>
            oyentes.forEach((o) =>
              o.onAvisoDispositivo?.({
                tipo,
                device_id: String(datos.device_id ?? ''),
                timestamp: String(datos.timestamp ?? new Date().toISOString()),
                detalle: (datos.detalle as Record<string, unknown> | null) ?? null,
              }),
            ),
          )
        }
        // BE-010: la sesión que abrió el stream ya no vale. Se cierra y se pide
        // ticket de inmediato: el 401 activa el cierre de sesión global.
        fuente.addEventListener('sesion_expirada', () => {
          avisarEstado(false)
          fuente.close()
          source = null
          espera = REINTENTO_BASE_MS
          if (!cancelado) conectar()
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
