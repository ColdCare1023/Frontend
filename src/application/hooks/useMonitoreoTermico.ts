import { useCallback, useEffect, useRef, useState } from 'react'

import type { LecturaTermica } from '@/domain/entities/LecturaTermica'
import { apiClient } from '@/infrastructure/api/apiClient'
import { suscribirseLecturas, type MotivoDesconexionSse } from '@/infrastructure/sse/sseClient'

// HU-31 criterio 4: ventana por defecto de 24 horas para la curva térmica del
// dashboard (antes era un conteo fijo de las últimas 60 lecturas, sin
// relación con el tiempo real transcurrido).
export const VENTANA_HORAS_POR_DEFECTO = 24

// Techo defensivo de memoria: a 30 s/lectura, 24 h son ~2880 puntos por
// dispositivo — lejos de este límite. Sin él, un rango ampliado a semanas
// podría acumular sin fin en el navegador.
export const MAX_LECTURAS_EN_MEMORIA = 5000

/**
 * HU-31: cuántas lecturas trajo el historial y cuántas hay en la ventana
 * (`X-Total-Count`). Si `total` supera a `recibidas`, lo crudo no cubre el
 * periodo: la interfaz lo avisa. `total` es null con backends que no envían
 * la cabecera.
 */
export interface CoberturaHistorial {
  recibidas: number
  total: number | null
}

interface MonitoreoTermico {
  ultima: LecturaTermica | null
  serie: LecturaTermica[]
  sseConectado: boolean
  /** HU-32 esc. 3: causa conocida del corte (p. ej. demasiadas pestañas abiertas). */
  motivoDesconexion: MotivoDesconexionSse | null
  estadoHistorial: 'cargando' | 'completo' | 'error'
  reintentar: () => void
  cobertura: CoberturaHistorial | null
}

/** Valor entero no negativo de `X-Total-Count`, o null si no llegó. */
export function totalDeCabecera(cabeceras: unknown): number | null {
  const crudo =
    cabeceras && typeof (cabeceras as { get?: unknown }).get === 'function'
      ? (cabeceras as { get: (nombre: string) => unknown }).get('x-total-count')
      : (cabeceras as Record<string, unknown> | undefined)?.['x-total-count']
  const valor = typeof crudo === 'number' ? crudo : typeof crudo === 'string' && crudo.trim() !== '' ? Number(crudo) : Number.NaN
  return Number.isInteger(valor) && valor >= 0 ? valor : null
}

/** Identidad de una lectura para no repetirla (sin `id`, equipo e instante). */
function claveLectura(lectura: LecturaTermica): string {
  return lectura.id ?? `${lectura.device_id}|${lectura.timestamp}`
}

/**
 * Carga historial para la ventana activa y conserva última lectura en vivo al
 * cambiarla. La serie se mantiene en orden cronológico ascendente.
 *
 * Con `deviceId`, historial y flujo SSE se limitan a ese nodo: sin filtro, con
 * dos o más refrigeradores la curva intercalaba lecturas de equipos distintos
 * y "temperatura actual" mostraba la del último que reportó, fuera cual fuera.
 */
export function useMonitoreoTermico(
  horasVentana: number = VENTANA_HORAS_POR_DEFECTO,
  deviceId: string | null = null,
): MonitoreoTermico {
  const [serie, setSerie] = useState<LecturaTermica[]>([])
  const [ultima, setUltima] = useState<LecturaTermica | null>(null)
  const [sseConectado, setSseConectado] = useState(false)
  const [motivoDesconexion, setMotivoDesconexion] = useState<MotivoDesconexionSse | null>(null)
  const [estadoHistorial, setEstadoHistorial] = useState<MonitoreoTermico['estadoHistorial']>('cargando')
  const [intento, setIntento] = useState(0)
  const [cobertura, setCobertura] = useState<CoberturaHistorial | null>(null)
  const reintentar = useCallback(() => setIntento((actual) => actual + 1), [])
  const deviceAnterior = useRef<string | null>(deviceId)

  useEffect(() => {
    let activo = true
    // Mantiene visible la ventana anterior mientras llega la nueva respuesta.
    // Vaciarla aquí desmontaba el panel de monitoreo y producía un destello.
    setEstadoHistorial('cargando')
    // Al cambiar de equipo, lo mostrado pertenece a otro refrigerador.
    if (deviceAnterior.current !== deviceId) {
      deviceAnterior.current = deviceId
      setSerie([])
      setUltima(null)
      setCobertura(null)
    }

    const desde = new Date(Date.now() - horasVentana * 60 * 60 * 1000).toISOString()
    const desdeMs = new Date(desde).getTime()

    apiClient
      .get<LecturaTermica[]>('/api/lecturas', {
        params: { desde, limite: MAX_LECTURAS_EN_MEMORIA, ...(deviceId ? { device_id: deviceId } : {}) },
      })
      .then(({ data, headers }) => {
        if (!activo) return
        setCobertura({ recibidas: data.length, total: totalDeCabecera(headers) })
        // El historial no puede sobrescribir la serie: la suscripción SSE se
        // abre en el mismo efecto y no hay garantía de qué responde antes. Si
        // una lectura en vivo llegaba mientras el GET seguía en vuelo, este
        // `set` la borraba —y con una excursión térmica en marcha, esa es
        // justo la lectura que no puede perderse—. Se combina el historial con
        // lo ya recibido, sin repetir por `id`.
        setSerie((previa) => {
          const porLectura = new Map<string, LecturaTermica>()
          for (const lectura of previa) {
            if (new Date(lectura.timestamp).getTime() >= desdeMs) porLectura.set(claveLectura(lectura), lectura)
          }
          // Repetida, manda la versión del servidor: puede haber cambiado
          // desde que llegó por SSE (HU-07: lectura sin hora ya reanclada).
          for (const lectura of data) {
            if (new Date(lectura.timestamp).getTime() >= desdeMs) porLectura.set(claveLectura(lectura), lectura)
          }
          // Lo ya mostrado no es siempre posterior al historial: al ampliar la
          // ventana (24 h → 7 d) o al reintentar, el historial trae lecturas
          // más antiguas y también más nuevas que lo previo. Sin ordenar, las
          // nuevas quedaban antes y «Lecturas recientes» mostraba lo viejo.
          return [...porLectura.values()]
            .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp))
            .slice(-MAX_LECTURAS_EN_MEMORIA)
        })
        const lecturaMasReciente = data.reduce<LecturaTermica | null>((reciente, lectura) =>
          !reciente || lectura.timestamp > reciente.timestamp ? lectura : reciente, null)
        if (lecturaMasReciente) {
          setUltima((previa) =>
            !previa ||
            lecturaMasReciente.timestamp > previa.timestamp ||
            (lecturaMasReciente.timestamp === previa.timestamp && claveLectura(lecturaMasReciente) === claveLectura(previa))
              ? lecturaMasReciente
              : previa,
          )
        }
        setEstadoHistorial('completo')
      })
      .catch(() => {
        if (activo) setEstadoHistorial('error')
      })

    const cerrar = suscribirseLecturas(
      (lectura) => {
        if (deviceId && lectura.device_id !== deviceId) return
        setUltima((previa) => !previa || lectura.timestamp > previa.timestamp ? lectura : previa)
        if (new Date(lectura.timestamp).getTime() < desdeMs) return
        setSerie((previa) => {
          if (previa.some((actual) => actual.id === lectura.id)) return previa
          return [...previa, lectura].slice(-MAX_LECTURAS_EN_MEMORIA)
        })
      },
      (conectado, motivo) => {
        setSseConectado(conectado)
        setMotivoDesconexion(conectado ? null : (motivo ?? null))
      },
    )

    return () => {
      activo = false
      cerrar()
    }
  }, [horasVentana, deviceId, intento])

  return { ultima, serie, sseConectado, motivoDesconexion, estadoHistorial, reintentar, cobertura }
}
