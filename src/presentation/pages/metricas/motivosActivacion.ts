import type { TFunction } from 'i18next'

/**
 * HU-46 / HU-16 esc. 4: motivos con los que el backend rechaza activar una
 * versión del modelo. Los textos son los de gestionar_modelo_ia.py
 * (`motivos_bloqueo_activacion`) y de prediccion_preventiva/servicio.py
 * (`motivos_activacion`); el 409 los une en
 * «La versión X no puede activarse: m1; m2».
 */
export type ModeloArtefacto = 'preventivo' | 'legado'
export type GrupoMotivo = 'criterios' | 'artefacto' | 'otros'

export interface MotivoActivacion {
  grupo: GrupoMotivo
  /** Texto para la persona (traducido si el motivo es conocido). */
  texto: string
}

type Regla = [RegExp, string, (m: RegExpExecArray) => Record<string, string>]

const sinParametros = () => ({})

const CRITERIOS: Regla[] = [
  [/^falta el horizonte H de la etiqueta$/, 'sinHorizonte', sinParametros],
  [/^falta la versión del esquema de features$/, 'sinEsquema', sinParametros],
  [/^faltan las particiones \((.+)\)$/, 'faltanParticiones', (m) => ({ campos: m[1] })],
  [/^la separación entre particiones es menor que H$/, 'separacionMenor', sinParametros],
  [/^faltan métricas del criterio principal \((.+)\)$/, 'faltanMetricas', (m) => ({ criterio: m[1] })],
  [/^no cumple el criterio principal \((.+)\)$/, 'noCumpleCriterio', (m) => ({ criterio: m[1] })],
  [/^criterio principal desconocido: (.+)$/, 'criterioDesconocido', (m) => ({ criterio: m[1] })],
]

/** Solo existen cuando el artefacto que se valida es el preventivo (IA_PREVENTIVO_MODO=activo). */
const PREVENTIVO: Regla[] = [
  [/^IA_PREVENTIVO_VERSION no está configurada$/, 'versionNoConfigurada', sinParametros],
  [/^la versión no es la desplegada en IA_PREVENTIVO_VERSION \((.+)\)$/, 'versionNoDesplegada', (m) => ({ desplegada: m[1] })],
  [/^IA_PREVENTIVO_SHA256 no está configurada$/, 'sha256NoConfigurado', sinParametros],
  [/^IA_PREVENTIVO_SHA256 no coincide con el hash registrado$/, 'sha256Distinto', sinParametros],
  [/^el manifiesto del modelo preventivo no se pudo leer$/, 'manifiestoIlegible', sinParametros],
  [/^el manifiesto está en estado (.+); activar exige (.+)$/, 'manifiestoNoAprobado', (m) => ({ estado: m[1], exigido: m[2] })],
]

/** Común a ambos artefactos: el archivo desplegado no es el de la huella registrada. */
const ARTEFACTO_DISTINTO = /^el artefacto desplegado no coincide con el hash registrado$/

const PREFIJO = 'no puede activarse: '

/** Separa los motivos del `detail` de un 409; [] si no tiene esa forma. */
export function separarMotivos(detalle: string | null | undefined): string[] {
  if (!detalle) return []
  const inicio = detalle.indexOf(PREFIJO)
  if (inicio < 0) return []
  const motivos: string[] = []
  for (const parte of detalle.slice(inicio + PREFIJO.length).split('; ')) {
    const limpia = parte.trim()
    if (!limpia) continue
    // «el manifiesto está en estado X; activar exige Y» lleva su propio «; ».
    if (/^activar exige /.test(limpia) && motivos.length > 0) motivos[motivos.length - 1] += `; ${limpia}`
    else motivos.push(limpia)
  }
  return motivos
}

function buscar(reglas: Regla[], motivo: string): { clave: string; params: Record<string, string> } | null {
  for (const [patron, clave, params] of reglas) {
    const m = patron.exec(motivo)
    if (m) return { clave, params: params(m) }
  }
  return null
}

export function esMotivoPreventivo(motivo: string): boolean {
  return buscar(PREVENTIVO, motivo) !== null
}

/** Texto traducido de un motivo de bloqueo; el original si no se conoce. */
export function textoMotivo(motivo: string, t: TFunction): string {
  const criterio = buscar(CRITERIOS, motivo)
  if (criterio) {
    const params = { ...criterio.params }
    if (params.criterio) params.criterio = t(`metricasIA.versiones.criterios.${params.criterio}`, { defaultValue: params.criterio })
    return t(`metricasIA.versiones.motivos.${criterio.clave}`, params)
  }
  const preventivo = buscar(PREVENTIVO, motivo)
  if (preventivo) return t(`metricasIA.versiones.motivos.${preventivo.clave}`, preventivo.params)
  if (ARTEFACTO_DISTINTO.test(motivo)) return t('metricasIA.versiones.motivos.artefactoDistinto')
  return motivo
}

export interface RechazoActivacion {
  motivos: MotivoActivacion[]
  /** Artefacto al que se refieren los motivos de artefacto (null si no se sabe). */
  artefacto: ModeloArtefacto | null
  soloArtefacto: boolean
}

/**
 * Clasifica los motivos de un 409 en criterios de la versión y artefacto
 * desplegado. El artefacto es el preventivo si algún motivo es propio de él;
 * si no, el que el backend gobierna (`GET /api/ia/preventivo`).
 */
export function clasificarRechazo(detalle: string | null, gobernado: ModeloArtefacto | null, t: TFunction): RechazoActivacion {
  const crudos = separarMotivos(detalle)
  const motivos = crudos.map<MotivoActivacion>((motivo) => ({
    grupo: buscar(CRITERIOS, motivo)
      ? 'criterios'
      : esMotivoPreventivo(motivo) || ARTEFACTO_DISTINTO.test(motivo)
        ? 'artefacto'
        : 'otros',
    texto: textoMotivo(motivo, t),
  }))
  const artefacto = crudos.some(esMotivoPreventivo) ? 'preventivo' : gobernado
  return {
    motivos,
    artefacto: motivos.some((m) => m.grupo === 'artefacto') ? artefacto : null,
    soloArtefacto: motivos.length > 0 && motivos.every((m) => m.grupo === 'artefacto'),
  }
}
