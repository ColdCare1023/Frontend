import type { TFunction } from 'i18next'

/**
 * HU-46 / HU-16 esc. 4: motivos con los que el backend rechaza activar una
 * versión del modelo. El 409 de `/activar` trae
 * `{"detail": "La versión X no puede activarse: m1; m2", "codigos": [c1, c2]}`:
 * `codigos` (IA-B05) es un código estable por motivo y en el mismo orden;
 * `detail` conserva los textos en español de gestionar_modelo_ia.py
 * (`motivos_bloqueo_activacion`) y de prediccion_preventiva/servicio.py
 * (`motivos_activacion`), de donde se leen los valores (H, versiones…).
 *
 * Único lugar donde se traducen los rechazos del versionado del modelo: el
 * 409 de `/activar` (por código y, si no llegan códigos, por texto) y el 409
 * de `/desactivar`.
 */
export type ModeloArtefacto = 'preventivo' | 'legado'
export type GrupoMotivo = 'criterios' | 'artefacto' | 'otros'

export interface MotivoActivacion {
  grupo: GrupoMotivo
  /** Texto para la persona (traducido si el motivo es conocido). */
  texto: string
}

interface DefinicionMotivo {
  grupo: Exclude<GrupoMotivo, 'otros'>
  /** Solo existe cuando el artefacto que se valida es el preventivo (IA_PREVENTIVO_MODO=activo). */
  preventivo: boolean
  /** Clave en `metricasIA.versiones.motivos`. */
  clave: string
  /** Texto del backend: de él salen los valores, y la clasificación si no llegan códigos. */
  patron: RegExp
  /** Nombre de cada grupo de captura de `patron`, en orden (los parámetros de la clave). */
  valores?: string[]
}

/**
 * Códigos estables del 409 de `/activar` (campo `codigos`). Criterios:
 * BLOQUEO_* de gestionar_modelo_ia.py; artefacto: ACTIVACION_* de
 * prediccion_preventiva/servicio.py (los cinco últimos son IA-B05 v6 y v7).
 */
export const MOTIVOS_POR_CODIGO = {
  falta_horizonte: { grupo: 'criterios', preventivo: false, clave: 'sinHorizonte', patron: /^falta el horizonte H de la etiqueta$/ },
  falta_esquema_features: { grupo: 'criterios', preventivo: false, clave: 'sinEsquema', patron: /^falta la versión del esquema de features$/ },
  faltan_particiones: {
    grupo: 'criterios', preventivo: false, clave: 'faltanParticiones',
    patron: /^faltan las particiones \((.+)\)$/, valores: ['campos'],
  },
  separacion_menor_que_horizonte: {
    grupo: 'criterios', preventivo: false, clave: 'separacionMenor', patron: /^la separación entre particiones es menor que H$/,
  },
  criterio_principal_desconocido: {
    grupo: 'criterios', preventivo: false, clave: 'criterioDesconocido', patron: /^criterio principal desconocido: (.+)$/, valores: ['criterio'],
  },
  faltan_metricas_criterio_principal: {
    grupo: 'criterios', preventivo: false, clave: 'faltanMetricas',
    patron: /^faltan métricas del criterio principal \((.+)\)$/, valores: ['criterio'],
  },
  no_cumple_criterio_principal: {
    grupo: 'criterios', preventivo: false, clave: 'noCumpleCriterio', patron: /^no cumple el criterio principal \((.+)\)$/, valores: ['criterio'],
  },
  version_preventiva_no_configurada: {
    grupo: 'artefacto', preventivo: true, clave: 'versionNoConfigurada', patron: /^IA_PREVENTIVO_VERSION no está configurada$/,
  },
  version_distinta_de_la_desplegada: {
    grupo: 'artefacto', preventivo: true, clave: 'versionNoDesplegada',
    patron: /^la versión no es la desplegada en IA_PREVENTIVO_VERSION \((.+)\)$/, valores: ['desplegada'],
  },
  sha256_no_configurado: { grupo: 'artefacto', preventivo: true, clave: 'sha256NoConfigurado', patron: /^IA_PREVENTIVO_SHA256 no está configurada$/ },
  sha256_distinto_del_registrado: {
    grupo: 'artefacto', preventivo: true, clave: 'sha256Distinto', patron: /^IA_PREVENTIVO_SHA256 no coincide con el hash registrado$/,
  },
  // Común a ambos artefactos: el archivo desplegado no es el de la huella registrada.
  artefacto_distinto_del_registrado: {
    grupo: 'artefacto', preventivo: false, clave: 'artefactoDistinto', patron: /^el artefacto desplegado no coincide con el hash registrado$/,
  },
  manifiesto_ilegible: {
    grupo: 'artefacto', preventivo: true, clave: 'manifiestoIlegible', patron: /^el manifiesto del modelo preventivo no se pudo leer$/,
  },
  manifiesto_no_aprobado: {
    grupo: 'artefacto', preventivo: true, clave: 'manifiestoNoAprobado',
    patron: /^el manifiesto está en estado (.+); activar exige (.+)$/, valores: ['estado', 'exigido'],
  },
  // IA-B05 v7: el manifiesto se editó fuera de la CLI (su SHA-256 no es el anotado en historial.json).
  manifiesto_distinto_del_historial: {
    grupo: 'artefacto', preventivo: true, clave: 'manifiestoNoCoincide',
    patron: /^el SHA-256 del manifiesto no coincide con el último anotado en historial\.json\b/,
  },
  // IA-B05 v6: H y scikit-learn registrados deben ser los del manifiesto desplegado, y este cargar con el instalado.
  horizonte_distinto_del_manifiesto: {
    grupo: 'artefacto', preventivo: true, clave: 'horizonteNoCoincide',
    patron: /^el horizonte registrado \((.+?) min\) no es el del manifiesto desplegado \((.+?) min\)$/,
    valores: ['registrado', 'manifiesto'],
  },
  // IA-B05 v6: el esquema de features registrado es el que muestra la evidencia (HU-47); debe ser el del modelo.
  esquema_features_distinto_del_manifiesto: {
    grupo: 'artefacto', preventivo: true, clave: 'esquemaNoCoincide',
    patron: /^el esquema de features registrado \((.+?)\) no es el del manifiesto \((.+?)\)$/,
    valores: ['registrado', 'manifiesto'],
  },
  sklearn_distinto_del_manifiesto: {
    grupo: 'artefacto', preventivo: true, clave: 'sklearnNoCoincide',
    patron: /^la versión de scikit-learn registrada \((.+?)\) no es la del manifiesto \((.+?)\)$/,
    valores: ['registrada', 'manifiesto'],
  },
  sklearn_incompatible_con_el_instalado: {
    grupo: 'artefacto', preventivo: true, clave: 'sklearnIncompatible',
    patron: /^el modelo se entrenó con scikit-learn (.+?) y el instalado es (.+?); no cargaría$/,
    valores: ['entrenado', 'instalado'],
  },
} satisfies Record<string, DefinicionMotivo>
export type CodigoMotivo = keyof typeof MOTIVOS_POR_CODIGO

const DEFINICIONES: DefinicionMotivo[] = Object.values(MOTIVOS_POR_CODIGO)

function definicionDe(codigo: string): DefinicionMotivo | null {
  return Object.hasOwn(MOTIVOS_POR_CODIGO, codigo) ? MOTIVOS_POR_CODIGO[codigo as CodigoMotivo] : null
}

/** P-12: el 409 de `/desactivar` cuando la versión no es la activa. */
export const CODIGO_VERSION_NO_ACTIVA = 'version_no_activa'

export function esVersionNoActiva(detalle: string | null | undefined): boolean {
  return detalle?.trim() === CODIGO_VERSION_NO_ACTIVA
}

const PREFIJO = 'no puede activarse: '
// Motivos que llevan su propio «; »: «el manifiesto está en estado X; activar
// exige Y» y «…scikit-learn A y el instalado es B; no cargaría».
const CONTINUACION = /^(?:activar exige |no cargaría$)/

/** Separa los motivos del `detail` de un 409; [] si no tiene esa forma. */
export function separarMotivos(detalle: string | null | undefined): string[] {
  if (!detalle) return []
  const inicio = detalle.indexOf(PREFIJO)
  if (inicio < 0) return []
  const motivos: string[] = []
  for (const parte of detalle.slice(inicio + PREFIJO.length).split('; ')) {
    const limpia = parte.trim()
    if (!limpia) continue
    if (CONTINUACION.test(limpia) && motivos.length > 0) motivos[motivos.length - 1] += `; ${limpia}`
    else motivos.push(limpia)
  }
  return motivos
}

/** Definición que corresponde al texto de un motivo (cuando no llega su código). */
function definicionDelTexto(motivo: string): DefinicionMotivo | null {
  return DEFINICIONES.find((d) => d.patron.test(motivo)) ?? null
}

/** Motivos que solo existen si el artefacto que se valida es el preventivo. */
export function esMotivoPreventivo(motivo: string): boolean {
  return definicionDelTexto(motivo)?.preventivo ?? false
}

function traducir(definicion: DefinicionMotivo, parametros: Record<string, string>, t: TFunction): string {
  const params = { ...parametros }
  if (params.criterio) params.criterio = t(`metricasIA.versiones.criterios.${params.criterio}`, { defaultValue: params.criterio })
  return t(`metricasIA.versiones.motivos.${definicion.clave}`, params)
}

/**
 * Texto de un motivo cuya definición se conoce (por su código). Los valores
 * salen del texto del backend; si el texto cambió de forma, un motivo sin
 * valores se traduce igual y uno con valores muestra el texto original (que
 * los trae) o, si no hay texto, la traducción con «…».
 */
function textoDefinido(definicion: DefinicionMotivo, motivo: string, t: TFunction): string {
  const nombres = definicion.valores ?? []
  const m = definicion.patron.exec(motivo)
  if (m) return traducir(definicion, Object.fromEntries(nombres.map((nombre, i) => [nombre, m[i + 1]])), t)
  if (nombres.length > 0 && motivo) return motivo
  return traducir(definicion, Object.fromEntries(nombres.map((nombre) => [nombre, '…'])), t)
}

/** Texto traducido de un motivo de bloqueo (por su texto); el original si no se conoce. */
export function textoMotivo(motivo: string, t: TFunction): string {
  const definicion = definicionDelTexto(motivo)
  return definicion ? textoDefinido(definicion, motivo, t) : motivo
}

export interface RechazoActivacion {
  motivos: MotivoActivacion[]
  /** Artefacto al que se refieren los motivos de artefacto (null si no se sabe). */
  artefacto: ModeloArtefacto | null
  soloArtefacto: boolean
}

/** Un `detail` que solo trae códigos conocidos (p. ej. `{codigo}` como objeto) se lee como `codigos`. */
function codigosDelDetalle(detalle: string | null | undefined): string[] | null {
  const partes = detalle?.split('; ').map((parte) => parte.trim()).filter(Boolean) ?? []
  return partes.length > 0 && partes.every((parte) => definicionDe(parte) !== null) ? partes : null
}

/**
 * Clasifica los motivos de un 409 en criterios de la versión y artefacto
 * desplegado. Con `codigos` (el backend los envía junto al `detail`) el grupo
 * y la traducción salen del código; sin ellos, del texto. El artefacto es el
 * preventivo si algún motivo es propio de él; si no, el que el backend
 * gobierna (`GET /api/ia/preventivo`).
 */
export function clasificarRechazo(
  detalle: string | null,
  gobernado: ModeloArtefacto | null,
  t: TFunction,
  codigos?: readonly string[] | null,
): RechazoActivacion {
  const crudos = separarMotivos(detalle)
  const lista = codigos && codigos.length > 0 ? codigos : codigosDelDetalle(detalle)
  let clasificados: Array<MotivoActivacion & { preventivo: boolean }>
  if (lista) {
    // Un código por motivo y en el mismo orden; si la cuenta no cuadra, cada
    // código busca su texto (para los valores) entre los motivos.
    const emparejados = lista.length === crudos.length
    clasificados = lista.map((codigo, i) => {
      const definicion = definicionDe(codigo)
      const texto = emparejados ? crudos[i] : (crudos.find((c) => definicion?.patron.test(c)) ?? '')
      if (definicion) return { grupo: definicion.grupo, texto: textoDefinido(definicion, texto, t), preventivo: definicion.preventivo }
      // Código sin definición (`otro` o uno nuevo): se clasifica por su texto.
      return porTexto(texto || codigo, t)
    })
  } else {
    clasificados = crudos.map((motivo) => porTexto(motivo, t))
  }
  const motivos = clasificados.map(({ grupo, texto }) => ({ grupo, texto }))
  const artefacto = clasificados.some((m) => m.preventivo) ? 'preventivo' : gobernado
  return {
    motivos,
    artefacto: motivos.some((m) => m.grupo === 'artefacto') ? artefacto : null,
    soloArtefacto: motivos.length > 0 && motivos.every((m) => m.grupo === 'artefacto'),
  }
}

function porTexto(motivo: string, t: TFunction): MotivoActivacion & { preventivo: boolean } {
  const definicion = definicionDelTexto(motivo)
  return definicion
    ? { grupo: definicion.grupo, texto: textoDefinido(definicion, motivo, t), preventivo: definicion.preventivo }
    : { grupo: 'otros', texto: motivo, preventivo: false }
}
