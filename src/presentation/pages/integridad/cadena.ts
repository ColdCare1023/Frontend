import type { RegistroTrazabilidad, VerificacionIntegridad } from '@/domain/entities/RegistroTrazabilidad'

type Traductor = (clave: string, opciones?: Record<string, unknown>) => string

export function etiquetaEvento(tipo: string, t: Traductor) {
  return t(`trazabilidad.eventos.${tipo}`, {
    defaultValue: tipo.replaceAll('_', ' ').toLocaleLowerCase(),
  })
}

export type EstadoSello = 'pendiente' | 'coincide' | 'no_coincide' | 'afectado'

/** Cómo se une un sello con el anterior: `hueco` son registros no consecutivos (un filtro, una página). */
export type EnlaceSello = 'inicio' | 'unido' | 'hueco' | 'roto'

export interface Eslabon {
  id: string
  tipo_evento: string
  timestamp: string
  device_id: string | null
  payload: Record<string, unknown>
  hash: string
  /** Solo en el registro alterado: lo que debería decir el sello. */
  hashEsperado?: string
  estado: EstadoSello
  enlace: EnlaceSello
  /** Registros que hay entre este sello y el anterior y no se muestran. */
  saltados: number
}

export type Veredicto = 'sin_revisar' | 'integra' | 'rota' | 'aislada'

export const TAMANO_CADENA = 5

/** HU-26: los backends previos (y el modo demo) solo envían `integra`. */
export function veredictoDe(verificacion: VerificacionIntegridad | null): Veredicto {
  if (!verificacion) return 'sin_revisar'
  const estado = verificacion.estado ?? (verificacion.integra ? 'integra' : 'ruptura_detectada')
  return estado === 'integra' ? 'integra' : estado === 'ruptura_aislada' ? 'aislada' : 'rota'
}

function aEslabon(registro: RegistroTrazabilidad, estado: EstadoSello): Omit<Eslabon, 'enlace' | 'saltados'> & { previo: string } {
  return {
    id: registro.id,
    tipo_evento: registro.tipo_evento,
    timestamp: registro.timestamp,
    device_id: registro.device_id,
    payload: registro.payload,
    hash: registro.hash_actual,
    previo: registro.previous_hash,
    estado,
  }
}

/**
 * Qué sellos se dibujan y con qué timbre: los últimos si no hay ruptura y, si la hay, los que rodean
 * al registro alterado. El registro puede no estar entre los cargados (la lista trae los más recientes
 * y puede estar filtrada), pero el detalle de la verificación basta para dibujarlo donde corresponde.
 * Los enlaces salen de los propios sellos: dos registros se unen solo si el sello coincide de verdad.
 */
export function armarCadena(
  registros: RegistroTrazabilidad[],
  verificacion: VerificacionIntegridad | null,
  tamano = TAMANO_CADENA,
): Eslabon[] {
  // El backend entrega primero lo más reciente; la cadena se lee en orden, de lo antiguo a lo nuevo.
  const orden = [...registros].reverse()
  const veredicto = veredictoDe(verificacion)
  const detalle = veredicto === 'rota' ? (verificacion?.detalle_inconsistencia ?? null) : null

  type Provisional = ReturnType<typeof aEslabon> & { hashEsperado?: string }
  let ventana: Provisional[]
  let saltadosTrasRoto = 0

  if (detalle) {
    const roto: Provisional = {
      id: detalle.id,
      tipo_evento: detalle.tipo_evento,
      timestamp: detalle.timestamp,
      device_id: null,
      payload: {},
      hash: detalle.hash_almacenado,
      hashEsperado: detalle.hash_esperado,
      previo: '',
      estado: 'no_coincide',
    }
    const indice = orden.findIndex((r) => r.id === detalle.id)
    if (indice >= 0) {
      const inicio = Math.max(0, Math.min(indice - 2, orden.length - tamano))
      ventana = orden.slice(inicio, inicio + tamano).map((r, i) => {
        const posicion = inicio + i
        if (posicion === indice) {
          return { ...aEslabon(r, 'no_coincide'), hash: detalle.hash_almacenado, hashEsperado: detalle.hash_esperado }
        }
        return aEslabon(r, posicion < indice ? 'coincide' : 'afectado')
      })
    } else {
      const marca = Date.parse(detalle.timestamp)
      const anteriores = orden.filter((r) => Date.parse(r.timestamp) <= marca)
      const posteriores = orden.filter((r) => Date.parse(r.timestamp) > marca)
      const previos = anteriores.slice(-2).map((r) => aEslabon(r, 'coincide'))
      const siguientes = posteriores.slice(0, Math.max(0, tamano - previos.length - 1)).map((r) => aEslabon(r, 'afectado'))
      ventana = [...previos, roto, ...siguientes]
      saltadosTrasRoto = Math.max(0, (verificacion?.registros_posteriores_afectados ?? 0) - posteriores.length)
    }
  } else {
    const desde = veredicto === 'aislada' && verificacion?.integra_desde ? Date.parse(verificacion.integra_desde) : null
    ventana = orden.slice(-tamano).map((r) => {
      if (veredicto === 'integra') return aEslabon(r, 'coincide')
      if (desde !== null && Date.parse(r.timestamp) >= desde) return aEslabon(r, 'coincide')
      return aEslabon(r, 'pendiente')
    })
  }

  return ventana.map(({ previo, ...eslabon }, i) => {
    const anterior = ventana[i - 1]
    let enlace: EnlaceSello = 'inicio'
    if (anterior) {
      if (anterior.estado === 'no_coincide') enlace = 'roto'
      else enlace = anterior.hash === previo ? 'unido' : 'hueco'
    }
    return { ...eslabon, enlace, saltados: anterior?.estado === 'no_coincide' ? saltadosTrasRoto : 0 }
  })
}

/** La temperatura de una lectura, si el registro la lleva. Lo demás se nombra por su tipo de evento. */
export function temperaturaDelRegistro(payload: Record<string, unknown>): number | null {
  const valor = payload.temperatura_interna
  return typeof valor === 'number' && Number.isFinite(valor) ? valor : null
}
