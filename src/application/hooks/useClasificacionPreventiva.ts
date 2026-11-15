import { useCallback, useEffect, useState } from 'react'

import { useAuthStore } from '@/application/stores/authStore'
import { tienePermiso } from '@/domain/value-objects/Rol'
import { apiClient } from '@/infrastructure/api/apiClient'

/**
 * Códigos estables de `motivo_codigo` en `GET /api/ia/preventivo`
 * (prediccion_preventiva/servicio.py, CODIGO_*): por qué el modelo
 * preventivo no está disponible.
 */
export const MOTIVOS_PREVENTIVO = [
  'modo_desactivado',
  'version_no_configurada',
  'sha256_no_configurado',
  'sin_version_activa_registrada',
  'version_distinta_de_la_activa',
  'hash_distinto_del_registrado',
  'artefacto_no_verificado',
  'estado_no_admitido',
  'incompatible',
  'error_de_carga',
] as const
export type MotivoPreventivo = (typeof MOTIVOS_PREVENTIVO)[number]

const MODOS = ['desactivado', 'sombra', 'activo'] as const
export type ModoPreventivo = (typeof MODOS)[number]

/** `GET /api/ia/preventivo`: solo los campos que usa la interfaz. */
export interface EstadoPreventivoApi {
  modo: string
  disponible: boolean
  version?: string | null
  motivo?: string | null
  /** Aditivo (backend con el registro de versiones): ausente en backends anteriores. */
  motivo_codigo?: string | null
  version_activa_registrada?: string | null
  es_version_activa_registrada?: boolean
  /** Solo la demostración lo declara. */
  datos_simulados?: boolean
}

export interface ClasificacionPreventiva {
  modo: ModoPreventivo | null
  disponible: boolean
  /** Versión configurada (IA_PREVENTIVO_VERSION) o la cargada. */
  version: string | null
  /** Versión activa del registro de la base (HU-46). */
  versionActivaRegistrada: string | null
  esVersionActivaRegistrada: boolean | null
  motivo: MotivoPreventivo | null
  /**
   * HU-20 / HU-34: el backend informa que el modelo preventivo decide el
   * riesgo efectivo y puede abrir alertas preventivas (modo activo, cargado y
   * — con el registro de versiones — la versión activa y aprobada).
   */
  operativa: boolean
  /**
   * HU-46: qué artefacto comprueba la activación de una versión
   * (infrastructure/ai/gobierno.py): el preventivo con IA_PREVENTIVO_MODO=activo;
   * si no, el Random Forest legado.
   */
  artefactoGobernado: 'preventivo' | 'legado'
  datosSimulados: boolean
}

export function aClasificacionPreventiva(api: EstadoPreventivoApi): ClasificacionPreventiva {
  const modo = MODOS.find((m) => m === api.modo) ?? null
  const disponible = api.disponible === true
  const declarado = (MOTIVOS_PREVENTIVO as readonly string[]).includes(api.motivo_codigo ?? '')
    ? (api.motivo_codigo as MotivoPreventivo)
    : null
  const esActiva = typeof api.es_version_activa_registrada === 'boolean' ? api.es_version_activa_registrada : null
  return {
    modo,
    disponible,
    version: api.version ?? null,
    versionActivaRegistrada: api.version_activa_registrada ?? null,
    esVersionActivaRegistrada: esActiva,
    // Un backend anterior no envía `motivo_codigo`: del modo desactivado sí se sabe el motivo.
    motivo: disponible ? null : (declarado ?? (modo === 'desactivado' ? 'modo_desactivado' : null)),
    // Un backend anterior no informa el registro (null): basta el modo activo y cargado.
    operativa: modo === 'activo' && disponible && esActiva !== false,
    artefactoGobernado: modo === 'activo' ? 'preventivo' : 'legado',
    datosSimulados: api.datos_simulados === true,
  }
}

// El estado es una configuración del servidor, igual para todas las cuentas que
// pueden leerlo: varias piezas de una misma pantalla comparten una consulta.
const VIGENCIA_MS = 60_000
let memoria: { valor: ClasificacionPreventiva; en: number } | null = null
let enCurso: Promise<ClasificacionPreventiva | null> | null = null

/** Descarta lo consultado (p. ej. tras activar una versión del modelo). */
export function olvidarClasificacionPreventiva(): void {
  memoria = null
  enCurso = null
}

function vigente(): ClasificacionPreventiva | null {
  return memoria && Date.now() - memoria.en < VIGENCIA_MS ? memoria.valor : null
}

export function consultarClasificacionPreventiva(): Promise<ClasificacionPreventiva | null> {
  const guardado = vigente()
  if (guardado) return Promise.resolve(guardado)
  enCurso ??= apiClient
    .get<EstadoPreventivoApi>('/api/ia/preventivo')
    .then(({ data }) => {
      if (!data || typeof data !== 'object' || typeof data.modo !== 'string') return null
      const valor = aClasificacionPreventiva(data)
      memoria = { valor, en: Date.now() }
      return valor
    })
    // Sin respuesta (red, 403, backend anterior): no se sabe, y lo que no se
    // sabe no se presenta como «en operación».
    .catch(() => null)
    .finally(() => {
      enCurso = null
    })
  return enCurso
}

/**
 * HU-20 / HU-34 / HU-46: estado de la clasificación preventiva según el
 * backend. `GET /api/ia/preventivo` admite al QF, al auditor y al
 * administrador (ia_router.py); al técnico no se le pregunta, porque el 403
 * quedaría en la bitácora (HU-42) y para él la respuesta es «no se sabe».
 */
export function useClasificacionPreventiva() {
  const rol = useAuthStore((s) => s.usuario?.rol)
  const habilitado = rol !== undefined && tienePermiso(rol, ['farmaceutico', 'auditor'])
  const [clasificacion, setClasificacion] = useState<ClasificacionPreventiva | null>(() => (habilitado ? vigente() : null))
  const [cargando, setCargando] = useState(() => habilitado && vigente() === null)

  const consultar = useCallback(async () => {
    if (!habilitado) {
      setClasificacion(null)
      setCargando(false)
      return
    }
    setCargando(true)
    const valor = await consultarClasificacionPreventiva()
    setClasificacion(valor)
    setCargando(false)
  }, [habilitado])

  useEffect(() => {
    let vivo = true
    if (!habilitado) return
    void consultarClasificacionPreventiva().then((valor) => {
      if (!vivo) return
      setClasificacion(valor)
      setCargando(false)
    })
    return () => {
      vivo = false
    }
  }, [habilitado])

  const recargar = useCallback(async () => {
    olvidarClasificacionPreventiva()
    await consultar()
  }, [consultar])

  return { clasificacion, cargando, operativa: clasificacion?.operativa === true, recargar }
}
