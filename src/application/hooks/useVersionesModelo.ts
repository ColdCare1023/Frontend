import { useCallback, useEffect, useState } from 'react'
import axios from 'axios'

import { apiClient } from '@/infrastructure/api/apiClient'
import { rutaApi } from '@/lib/rutaApi'

/** HU-46: `VersionModeloResponse` del backend (versionado operativo del modelo IA). */
export interface VersionModeloIA {
  id?: string | null
  version: string
  model_hash: string
  feature_schema_version: string
  dataset_version: string
  scikit_learn_version: string
  python_version: string
  trained_at: string
  aprobado_por: string
  aprobado_en?: string | null
  activa: boolean
  activada_en?: string | null
  desactivada_en?: string | null
  horizonte_min?: number | null
  metricas?: Record<string, unknown> | null
  particiones?: Record<string, unknown> | null
  evaluacion_criterios?: Record<string, unknown> | null
  criterio_principal?: string | null
  /** El backend ya sabe si la activación se bloquearía (409) y por qué. */
  activable?: boolean
  motivos_bloqueo?: string[]
}

export type ValorParticion = string | number | string[]

/** HU-46 esc. 1: lo que el administrador registra (RegistrarVersionModeloRequest). */
export interface NuevaVersionModelo {
  version: string
  model_hash: string
  feature_schema_version: string
  dataset_version: string
  scikit_learn_version: string
  python_version: string
  /** ISO 8601 con zona. */
  trained_at: string
  horizonte_min?: number | null
  metricas?: Record<string, number> | null
  particiones?: Record<string, ValorParticion> | null
}

export type ResultadoVersion =
  | { resultado: 'ok'; version: VersionModeloIA }
  | { resultado: 'conflicto' | 'no_encontrada' | 'invalida' | 'sin_permiso' | 'error'; detalle: string | null }

/** B-12: cuerpo exacto de `POST /api/ia/modelo/versiones` (additionalProperties: false). */
export function cuerpoRegistroVersion(nueva: NuevaVersionModelo) {
  return {
    version: nueva.version,
    model_hash: nueva.model_hash,
    feature_schema_version: nueva.feature_schema_version,
    dataset_version: nueva.dataset_version,
    scikit_learn_version: nueva.scikit_learn_version,
    python_version: nueva.python_version,
    trained_at: nueva.trained_at,
    ...(nueva.horizonte_min != null ? { horizonte_min: nueva.horizonte_min } : {}),
    ...(nueva.metricas ? { metricas: nueva.metricas } : {}),
    ...(nueva.particiones ? { particiones: nueva.particiones } : {}),
  }
}

/** P-12: límites del motivo de `POST /api/ia/modelo/versiones/{version}/desactivar`. */
export const MOTIVO_DESACTIVACION_MIN = 10
export const MOTIVO_DESACTIVACION_MAX = 500

/** P-12: cuerpo exacto de la desactivación (additionalProperties: false). */
export function cuerpoDesactivacion(motivo: string) {
  return { motivo: motivo.trim() }
}

/**
 * Texto del rechazo: FastAPI envía `detail` como cadena (409/404) o como lista
 * (422). Si el backend lo envía como objeto con un código estable
 * (`{codigo}`/`{code}`), se devuelve el código para traducirlo aquí.
 */
export function detalleDelError(error: unknown): string | null {
  if (!axios.isAxiosError(error)) return null
  const detalle = (error.response?.data as { detail?: unknown } | undefined)?.detail
  if (typeof detalle === 'string') return detalle
  if (detalle && typeof detalle === 'object' && !Array.isArray(detalle)) {
    const { codigo, code } = detalle as { codigo?: unknown; code?: unknown }
    if (typeof codigo === 'string') return codigo
    if (typeof code === 'string') return code
    return null
  }
  if (Array.isArray(detalle)) {
    const mensajes = detalle
      .map((item) => (item && typeof item === 'object' && 'msg' in item ? String((item as { msg: unknown }).msg) : null))
      .filter((m): m is string => Boolean(m))
    return mensajes.length > 0 ? mensajes.join('; ') : null
  }
  return null
}

function rechazo(error: unknown): ResultadoVersion {
  const estado = axios.isAxiosError(error) ? error.response?.status : undefined
  const detalle = detalleDelError(error)
  if (estado === 409) return { resultado: 'conflicto', detalle }
  if (estado === 404) return { resultado: 'no_encontrada', detalle }
  if (estado === 422) return { resultado: 'invalida', detalle }
  if (estado === 403) return { resultado: 'sin_permiso', detalle }
  return { resultado: 'error', detalle }
}

/**
 * HU-46: versiones registradas del modelo. Listar: administrador y auditor;
 * registrar, activar y desactivar: solo administrador (ia_router.py). Con
 * `habilitado` en false no se consulta nada (p. ej. el QF, que recibiría un 403).
 */
export function useVersionesModelo(habilitado = true) {
  const [versiones, setVersiones] = useState<VersionModeloIA[]>([])
  const [cargando, setCargando] = useState(habilitado)
  const [error, setError] = useState(false)

  const consultar = useCallback(async () => {
    if (!habilitado) return
    setCargando(true)
    setError(false)
    try {
      const { data } = await apiClient.get<VersionModeloIA[]>('/api/ia/modelo/versiones')
      setVersiones(Array.isArray(data) ? data : [])
    } catch {
      setError(true)
    } finally {
      setCargando(false)
    }
  }, [habilitado])

  useEffect(() => {
    void consultar()
  }, [consultar])

  const registrar = useCallback(
    async (nueva: NuevaVersionModelo): Promise<ResultadoVersion> => {
      try {
        const { data } = await apiClient.post<VersionModeloIA>('/api/ia/modelo/versiones', cuerpoRegistroVersion(nueva))
        await consultar()
        return { resultado: 'ok', version: data }
      } catch (error) {
        return rechazo(error)
      }
    },
    [consultar],
  )

  // HU-46 esc. 2: 404 (no registrada) y 409 (no cumple criterios, o el
  // artefacto desplegado es otro) dejan intacta la versión activa vigente.
  const activar = useCallback(
    async (version: string): Promise<ResultadoVersion> => {
      try {
        const { data } = await apiClient.post<VersionModeloIA>(rutaApi`/api/ia/modelo/versiones/${version}/activar`)
        await consultar()
        return { resultado: 'ok', version: data }
      } catch (error) {
        const resultado = rechazo(error)
        // El rechazo queda en la bitácora; la lista se vuelve a leer igual.
        await consultar()
        return resultado
      }
    },
    [consultar],
  )

  // P-12: desactivar la versión activa deja el registro sin versión activa
  // (el modelo preventivo no se carga y el riesgo vuelve a la línea base).
  // 404 (no registrada) y 409 (ya no es la activa: otra persona se adelantó)
  // dicen que la lista quedó vieja; 422 (motivo no válido) no cambia nada.
  const desactivar = useCallback(
    async (version: string, motivo: string): Promise<ResultadoVersion> => {
      try {
        const { data } = await apiClient.post<VersionModeloIA>(
          rutaApi`/api/ia/modelo/versiones/${version}/desactivar`,
          cuerpoDesactivacion(motivo),
        )
        await consultar()
        return { resultado: 'ok', version: data }
      } catch (error) {
        const resultado = rechazo(error)
        if (resultado.resultado === 'conflicto' || resultado.resultado === 'no_encontrada') await consultar()
        return resultado
      }
    },
    [consultar],
  )

  return { versiones, cargando, error, consultar, registrar, activar, desactivar }
}
