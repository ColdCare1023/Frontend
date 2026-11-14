import type { TFunction } from 'i18next'

import type { NuevaVersionModelo, ValorParticion } from '@/application/hooks/useVersionesModelo'

/** HU-46: el backend exige 64 caracteres (SHA-256 en hexadecimal). */
const PATRON_HUELLA = /^[0-9a-f]{64}$/i

export const FORM_VERSION_VACIO = {
  version: '',
  model_hash: '',
  feature_schema_version: '',
  dataset_version: '',
  scikit_learn_version: '',
  python_version: '',
  trained_at: '',
  horizonte_min: '',
  metricas: '',
  particiones: '',
}

export type FormularioVersion = typeof FORM_VERSION_VACIO

/** Objeto JSON opcional; `undefined` si está vacío, `null` si no es un objeto válido. */
function leerObjetoJson(texto: string): Record<string, unknown> | undefined | null {
  if (!texto.trim()) return undefined
  try {
    const valor: unknown = JSON.parse(texto)
    return valor && typeof valor === 'object' && !Array.isArray(valor) ? (valor as Record<string, unknown>) : null
  } catch {
    return null
  }
}

const esNumero = (valor: unknown): valor is number => typeof valor === 'number' && Number.isFinite(valor)
const esValorParticion = (valor: unknown): valor is ValorParticion =>
  typeof valor === 'string' || esNumero(valor) || (Array.isArray(valor) && valor.every((item) => typeof item === 'string'))

/** Valida el formulario y arma la versión, o devuelve el primer error legible. */
export function validarNuevaVersion(
  form: FormularioVersion,
  t: TFunction,
): { nueva: NuevaVersionModelo } | { error: string } {
  if (!PATRON_HUELLA.test(form.model_hash.trim())) return { error: t('metricasIA.versiones.form.huellaInvalida') }
  const entrenada = Date.parse(form.trained_at)
  if (!form.trained_at || Number.isNaN(entrenada)) return { error: t('metricasIA.versiones.form.fechaRequerida') }
  let horizonte: number | null = null
  if (form.horizonte_min.trim()) {
    horizonte = Number(form.horizonte_min)
    if (!Number.isInteger(horizonte) || horizonte < 1 || horizonte > 1440) return { error: t('metricasIA.versiones.form.horizonteInvalido') }
  }
  const metricas = leerObjetoJson(form.metricas)
  if (metricas === null) return { error: t('metricasIA.versiones.form.jsonInvalido', { campo: t('metricasIA.versiones.form.metricas') }) }
  if (metricas && !Object.values(metricas).every(esNumero)) return { error: t('metricasIA.versiones.form.metricasNoNumericas') }
  const particiones = leerObjetoJson(form.particiones)
  if (particiones === null) return { error: t('metricasIA.versiones.form.jsonInvalido', { campo: t('metricasIA.versiones.form.particiones') }) }
  if (particiones && !Object.values(particiones).every(esValorParticion)) return { error: t('metricasIA.versiones.form.particionesInvalidas') }
  return {
    nueva: {
      version: form.version.trim(),
      model_hash: form.model_hash.trim().toLowerCase(),
      feature_schema_version: form.feature_schema_version.trim(),
      dataset_version: form.dataset_version.trim(),
      scikit_learn_version: form.scikit_learn_version.trim(),
      python_version: form.python_version.trim(),
      trained_at: new Date(entrenada).toISOString(),
      horizonte_min: horizonte,
      metricas: (metricas as Record<string, number> | undefined) ?? null,
      particiones: (particiones as Record<string, ValorParticion> | undefined) ?? null,
    },
  }
}

