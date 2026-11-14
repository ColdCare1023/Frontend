import type { VersionModeloIA } from '@/application/hooks/useVersionesModelo'

/*
 * HU-46 en la demostración: mismo contrato y mismas reglas que
 * gestionar_modelo_ia.py del backend (criterio principal «por_incidente»).
 * Diferencia declarada: la demo no tiene artefacto desplegado, así que no
 * compara la huella con un archivo real (el backend sí lo hace, HU-16 esc. 4).
 */

const CRITERIO_PRINCIPAL = 'por_incidente'
const UMBRAL_F1_MACRO = 0.85
const UMBRALES_POR_INCIDENTE: Record<string, ['min' | 'max', number]> = {
  incidentes_evaluables: ['min', 10],
  sensibilidad_incidente: ['min', 0.8],
  ic95_inferior_sensibilidad: ['min', 0.5],
  falsas_alarmas_por_dia_sensor: ['max', 2.0],
  mediana_anticipacion_min: ['min', 5.0],
}
const CAMPOS_PARTICIONES = ['entrenamiento', 'prueba', 'separacion_min'] as const

type Criterio = { valor: number | null; umbral: number | null; cumple: boolean | null }

const numero = (valor: unknown): number | null =>
  typeof valor === 'number' && Number.isFinite(valor) ? valor : null

function evaluarCriterios(metricas: Record<string, unknown> | null | undefined) {
  const m = metricas ?? {}
  const f1 = numero(m.f1_macro)
  const detalle: Record<string, Criterio> = {}
  for (const [nombre, [sentido, umbral]] of Object.entries(UMBRALES_POR_INCIDENTE)) {
    const valor = numero(m[nombre])
    detalle[nombre] = { valor, umbral, cumple: valor === null ? null : sentido === 'min' ? valor >= umbral : valor <= umbral }
  }
  const rf = numero(m.ap_random_forest)
  const base = numero(m.ap_mejor_baseline)
  detalle.supera_mejor_baseline_ap = { valor: rf, umbral: base, cumple: rf === null || base === null ? null : rf > base }
  const estados = Object.values(detalle).map((d) => d.cumple)
  return {
    f1: { valor: f1, umbral: UMBRAL_F1_MACRO, cumple: f1 === null ? null : f1 >= UMBRAL_F1_MACRO },
    por_incidente: { detalle, cumple: estados.includes(null) ? null : estados.every(Boolean) },
  }
}

function motivosBloqueo(version: Pick<VersionModeloIA, 'horizonte_min' | 'feature_schema_version' | 'particiones' | 'metricas'>): string[] {
  const motivos: string[] = []
  if (!version.horizonte_min || version.horizonte_min <= 0) motivos.push('falta el horizonte H de la etiqueta')
  if (!version.feature_schema_version) motivos.push('falta la versión del esquema de features')
  const particiones = version.particiones ?? {}
  const faltan = CAMPOS_PARTICIONES.filter((campo) => {
    const valor = particiones[campo]
    return valor == null || valor === '' || (Array.isArray(valor) && valor.length === 0)
  })
  const separacion = numero(particiones.separacion_min)
  if (faltan.length > 0) motivos.push(`faltan las particiones (${faltan.join(', ')})`)
  else if (separacion !== null && version.horizonte_min && separacion < version.horizonte_min) {
    motivos.push('la separación entre particiones es menor que H')
  }
  const principal = evaluarCriterios(version.metricas)[CRITERIO_PRINCIPAL]
  if (principal.cumple === null) motivos.push(`faltan métricas del criterio principal (${CRITERIO_PRINCIPAL})`)
  else if (!principal.cumple) motivos.push(`no cumple el criterio principal (${CRITERIO_PRINCIPAL})`)
  return motivos
}

type Registro = Omit<VersionModeloIA, 'evaluacion_criterios' | 'criterio_principal' | 'activable' | 'motivos_bloqueo'>

function aRespuesta(registro: Registro): VersionModeloIA {
  const motivos = motivosBloqueo(registro)
  return {
    ...registro,
    metricas: registro.metricas ? { ...registro.metricas } : null,
    particiones: registro.particiones ? { ...registro.particiones } : null,
    evaluacion_criterios: evaluarCriterios(registro.metricas),
    criterio_principal: CRITERIO_PRINCIPAL,
    activable: motivos.length === 0,
    motivos_bloqueo: motivos,
  }
}

/** Versión experimental que clasifica en la demo: registrada, nunca aprobada para producción. */
function semilla(): Registro[] {
  return [
    {
      id: '6f1d1c1e-0d3a-4c55-9a51-7d2f6c0b3a01',
      version: 'demo-3.0.0',
      model_hash: '3f7a9c2e5b1d4f6a8c0e2b4d6f8a1c3e5b7d9f1a3c5e7b9d1f3a5c7e9b1d3f5a',
      feature_schema_version: '3',
      dataset_version: 'sintetico-2026-06',
      scikit_learn_version: '1.5.2',
      python_version: '3.12',
      trained_at: '2026-06-18T14:20:00Z',
      aprobado_por: 'u-02',
      aprobado_en: '2026-06-19T15:00:00Z',
      activa: false,
      activada_en: null,
      desactivada_en: null,
      horizonte_min: null,
      metricas: { f1_macro: 0.97 },
      particiones: null,
    },
  ]
}

let registros: Registro[] = semilla()

/** Solo para pruebas: vuelve a la semilla. */
export function reiniciarVersionesDemo(): void {
  registros = semilla()
}

export function listarVersionesDemo(): VersionModeloIA[] {
  return registros.map(aRespuesta)
}

type Resultado = { status: number; data?: VersionModeloIA; detalle?: string; motivos?: string[] }

const CAMPOS_TEXTO: Array<[keyof Registro, number, number]> = [
  ['version', 1, 50],
  ['model_hash', 64, 64],
  ['feature_schema_version', 1, 20],
  ['dataset_version', 1, 50],
  ['scikit_learn_version', 1, 20],
  ['python_version', 1, 20],
]
const PERMITIDOS = new Set<string>([...CAMPOS_TEXTO.map(([campo]) => campo), 'trained_at', 'horizonte_min', 'metricas', 'particiones'])

/** POST /api/ia/modelo/versiones (RegistrarVersionModeloRequest, additionalProperties: false). */
export function registrarVersionDemo(cuerpo: Record<string, unknown>, adminId: string | null): Resultado {
  const extra = Object.keys(cuerpo).find((campo) => !PERMITIDOS.has(campo))
  if (extra) return { status: 422, detalle: `Campo no admitido: ${extra}` }
  for (const [campo, minimo, maximo] of CAMPOS_TEXTO) {
    const valor = cuerpo[campo]
    if (typeof valor !== 'string' || valor.length < minimo || valor.length > maximo) return { status: 422, detalle: `Valor no válido en ${campo}` }
  }
  if (typeof cuerpo.trained_at !== 'string' || Number.isNaN(Date.parse(cuerpo.trained_at))) return { status: 422, detalle: 'Valor no válido en trained_at' }
  const horizonte = cuerpo.horizonte_min
  if (horizonte != null && (!Number.isInteger(horizonte) || (horizonte as number) < 1 || (horizonte as number) > 1440)) {
    return { status: 422, detalle: 'Valor no válido en horizonte_min' }
  }
  const version = cuerpo.version as string
  if (registros.some((r) => r.version === version)) return { status: 409, detalle: `La versión ${version} ya está registrada` }
  const ahora = new Date().toISOString()
  const registro: Registro = {
    id: crypto.randomUUID?.() ?? `v-${Date.now()}`,
    version,
    model_hash: cuerpo.model_hash as string,
    feature_schema_version: cuerpo.feature_schema_version as string,
    dataset_version: cuerpo.dataset_version as string,
    scikit_learn_version: cuerpo.scikit_learn_version as string,
    python_version: cuerpo.python_version as string,
    trained_at: new Date(cuerpo.trained_at as string).toISOString(),
    aprobado_por: adminId ?? 'u-02',
    aprobado_en: ahora,
    activa: false,
    activada_en: null,
    desactivada_en: null,
    horizonte_min: (horizonte as number | null | undefined) ?? null,
    metricas: (cuerpo.metricas as Record<string, unknown> | null | undefined) ?? null,
    particiones: (cuerpo.particiones as Record<string, unknown> | null | undefined) ?? null,
  }
  registros.push(registro)
  return { status: 201, data: aRespuesta(registro) }
}

/** POST /api/ia/modelo/versiones/{version}/activar: 404 si no existe, 409 si no cumple. */
export function activarVersionDemo(version: string): Resultado {
  const objetivo = registros.find((r) => r.version === version)
  if (!objetivo) return { status: 404, detalle: `La versión ${version} no está registrada/aprobada; no puede activarse` }
  const motivos = motivosBloqueo(objetivo)
  if (motivos.length > 0) return { status: 409, detalle: `La versión ${version} no puede activarse: ${motivos.join('; ')}`, motivos }
  const ahora = new Date().toISOString()
  for (const registro of registros) {
    if (registro.activa && registro.version !== version) {
      registro.activa = false
      registro.desactivada_en = ahora
    }
  }
  objetivo.activa = true
  objetivo.activada_en = ahora
  objetivo.desactivada_en = null
  return { status: 200, data: aRespuesta(objetivo) }
}

/** HU-47 esc. 2: versión registrada que estaba activa en `momento` (o null). */
export function versionActivaEnDemo(momento: string): string | null {
  const ms = Date.parse(momento)
  if (!Number.isFinite(ms)) return null
  const vigente = registros.find((r) => {
    if (!r.activada_en || Date.parse(r.activada_en) > ms) return false
    return !r.desactivada_en || Date.parse(r.desactivada_en) > ms
  })
  return vigente?.version ?? null
}
