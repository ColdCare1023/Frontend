import type { LecturaTermica } from '@/domain/entities/LecturaTermica'

// HU-35: el nodo entrega su umbral configurado; 120 s cubre respuestas de
// backends anteriores que todavía no publican este campo.
export const UMBRAL_PUERTA_ABIERTA_POR_DEFECTO = 120

export interface EstadoPuerta {
  /** Sin MC-38: `apertura_refrigerador === null`. */
  sinSensor: boolean
  abiertaAhora: boolean
  /** Con `apertura_continua_segundos` (backend actual). */
  conAperturaContinua: boolean
  /** Lo que lleva abierta sin cerrarse, con el reloj si el dato es fresco. */
  aperturaEnCurso: number | null
  huboAperturaCerrada: boolean
  aperturaProlongada: boolean
  umbral: number
}

/**
 * HU-35: `apertura_refrigerador` dice si HUBO apertura en la ventana de
 * muestreo y `duracion_apertura_segundos` cuánto duró dentro de ella (nunca
 * más que el intervalo). Lo que lleva abierta la puerta sin cerrarse viene en
 * `apertura_continua_segundos`; con backends anteriores se conserva el
 * criterio previo.
 */
export function estadoPuerta(
  ultima: LecturaTermica,
  segundosDesdeUltima: number | null,
  desactualizado: boolean,
): EstadoPuerta {
  const configurado = ultima.umbral_puerta_abierta_segundos
  const umbral =
    typeof configurado === 'number' && Number.isFinite(configurado) && configurado > 0
      ? configurado
      : UMBRAL_PUERTA_ABIERTA_POR_DEFECTO
  const conAperturaContinua = ultima.apertura_continua_segundos !== undefined
  const abiertaAhora = conAperturaContinua
    ? (ultima.apertura_continua_segundos ?? 0) > 0
    : ultima.apertura_refrigerador === true
  // Mientras el dato es fresco, el contador sigue avanzando entre lecturas.
  const aperturaEnCurso =
    abiertaAhora && ultima.apertura_continua_segundos != null
      ? ultima.apertura_continua_segundos + (desactualizado ? 0 : (segundosDesdeUltima ?? 0))
      : null
  const huboAperturaCerrada = conAperturaContinua && !abiertaAhora && ultima.apertura_refrigerador === true
  const aperturaProlongada = conAperturaContinua
    ? aperturaEnCurso != null && aperturaEnCurso >= umbral
    : ultima.apertura_refrigerador === true &&
      ultima.duracion_apertura_segundos != null &&
      ultima.duracion_apertura_segundos >= umbral
  return {
    sinSensor: ultima.apertura_refrigerador === null,
    abiertaAhora,
    conAperturaContinua,
    aperturaEnCurso,
    huboAperturaCerrada,
    aperturaProlongada,
    umbral,
  }
}

export interface MarcaApertura {
  ms: number
  prolongada: boolean
}

/**
 * Aperturas de la ventana (HU-35 esc. 3, «conservando el evento histórico»):
 * cada paso de cerrada a abierta cuenta una vez. Una lectura sin MC-38
 * (`null`) no cuenta ni corta la apertura.
 */
export function aperturasEnSerie(serie: readonly LecturaTermica[], umbral = UMBRAL_PUERTA_ABIERTA_POR_DEFECTO): MarcaApertura[] {
  const marcas: MarcaApertura[] = []
  let abierta = false
  for (const lectura of serie) {
    if (lectura.apertura_refrigerador === null || lectura.apertura_refrigerador === undefined) continue
    if (lectura.apertura_refrigerador && !abierta) {
      const instante = Date.parse(lectura.timestamp)
      if (!Number.isNaN(instante)) {
        const duracion = lectura.apertura_continua_segundos ?? lectura.duracion_apertura_segundos ?? 0
        marcas.push({ ms: instante, prolongada: duracion >= umbral })
      }
    }
    if (abierta && lectura.apertura_refrigerador) {
      const ultima = marcas[marcas.length - 1]
      const duracion = lectura.apertura_continua_segundos ?? 0
      if (ultima && duracion >= umbral) ultima.prolongada = true
    }
    abierta = lectura.apertura_refrigerador
  }
  return marcas
}

/** HU-33 criterio 3: el sensor de este campo falló (no es «aún no llegó»). */
export function fallaSensor(lectura: LecturaTermica, campo: string): boolean {
  const estado = lectura.estado_sensores?.[campo]
  return estado !== undefined && estado !== null && estado !== 'valido'
}
