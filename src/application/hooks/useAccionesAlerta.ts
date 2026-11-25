import { useCallback } from 'react'
import axios from 'axios'

import { useAuthStore } from '@/application/stores/authStore'
import { useEstadoVivoStore } from '@/application/stores/estadoVivoStore'
import type { AccionCorrectiva, AlertaTermica } from '@/domain/entities/AlertaTermica'
import { apiClient } from '@/infrastructure/api/apiClient'
import { rutaApi } from '@/lib/rutaApi'

/**
 * `prohibido`: 403 del backend (RBAC). Desde H16, registrar la acción
 * correctiva es del farmacéutico (y del administrador); reconocer, también.
 */
export type ResultadoAccionAlerta = 'ok' | 'conflicto' | 'prohibido' | 'error'
export type ResultadoRectificacion = ResultadoAccionAlerta

/**
 * HU-28 esc. 2: qué se corrige de la versión vigente. Lo que no se envía se
 * hereda de ella (el backend exige al menos un cambio real).
 */
export interface CambiosRectificacion {
  decision?: string
  descripcion?: string
  justificacion?: string
}

/** 409: otra persona cambió la alerta antes; 403: el rol no puede (RBAC). */
function resultadoDeError(error: unknown): Exclude<ResultadoAccionAlerta, 'ok'> {
  if (axios.isAxiosError(error) && error.response?.status === 409) return 'conflicto'
  if (axios.isAxiosError(error) && error.response?.status === 403) return 'prohibido'
  return 'error'
}

export type CambioAlerta = Partial<AlertaTermica> | ((alerta: AlertaTermica) => Partial<AlertaTermica>)

/** Las dos vistas de atención comparten las transiciones y los mismos contratos de API. */
export function useAccionesAlerta(
  aplicarLocal: (id: string, cambio: CambioAlerta) => void,
  refrescarTrasExito: () => void,
  refrescarTrasError: () => Promise<void>,
) {
  // HU-23 Escenario 1: PENDIENTE -> RECONOCIDA. El nombre del endpoint
  // (/revisar) es histórico — se conserva por compatibilidad con el backend.
  //
  // HU-27 Escenario 2: si otro usuario ya reconoció (o atendió) esta alerta
  // entre que se cargó la lista y este click, el backend responde 409 — se
  // refresca la lista para que la fila desaparezca/actualice sola, en vez de
  // dejar un botón «Revisar» fantasma sobre una alerta que ya cambió.
  const reconocerAlerta = useCallback(
    async (alertaId: string): Promise<ResultadoAccionAlerta> => {
      try {
        const { data } = await apiClient.patch<AlertaTermica>(rutaApi`/api/alertas/${alertaId}/revisar`)
        aplicarLocal(alertaId, data?.id === alertaId ? data : { estado: 'reconocida', revisada: true, reconocida_en: new Date().toISOString() })
        refrescarTrasExito()
        // El contador del riel y la píldora se actualizan sin esperar al SSE.
        useEstadoVivoStore.getState().refrescarAlertas()
        return 'ok'
      } catch (error) {
        await refrescarTrasError()
        return resultadoDeError(error)
      }
    },
    [aplicarLocal, refrescarTrasExito, refrescarTrasError],
  )

  // HU-23 Escenario 2 / HU-27 Escenario 2: registrar la acción correctiva
  // marca la alerta como ATENDIDA. HU-23 esc. 1 y 3: el flujo es PENDIENTE ->
  // RECONOCIDA -> ATENDIDA; sobre una PENDIENTE, el backend primero la
  // reconoce a nombre de quien registra (REVISAR_ALERTA con origen
  // `accion_correctiva`, mismo instante) y después la atiende. Si otro usuario
  // ya la atendió, responde 409 — se informa en vez de fingir éxito o de
  // sobrescribir en silencio. 403: el rol no puede registrar (H16).
  const registrarAccionCorrectiva = useCallback(
    async (
      alertaId: string,
      { decision, descripcion, justificacion }: { decision: string; descripcion: string; justificacion: string },
    ): Promise<ResultadoAccionAlerta> => {
      try {
        const { data } = await apiClient.post<AccionCorrectiva>(rutaApi`/api/alertas/${alertaId}/acciones-correctivas`, { decision, justificacion, descripcion })
        const ahora = data?.created_at ?? new Date().toISOString()
        const autor = data?.usuario_id ?? useAuthStore.getState().usuario?.id ?? null
        aplicarLocal(alertaId, (alerta) =>
          alerta.estado === 'pendiente'
            ? // El reconocimiento implícito y la atención comparten instante y autor.
              { estado: 'atendida', atendida_en: ahora, reconocida_en: ahora, revisada: true, revisada_por: autor }
            : { estado: 'atendida', atendida_en: ahora },
        )
        refrescarTrasExito()
        useEstadoVivoStore.getState().refrescarAlertas()
        return 'ok'
      } catch (error) {
        await refrescarTrasError()
        return resultadoDeError(error)
      }
    },
    [aplicarLocal, refrescarTrasExito, refrescarTrasError],
  )

  // HU-23 criterio 4: cronología de atención de una alerta (reconocimiento +
  // acciones correctivas + rectificaciones, HU-28), de solo lectura.
  const obtenerCicloAtencion = useCallback(async (alertaId: string): Promise<AccionCorrectiva[]> => {
    const { data } = await apiClient.get<AccionCorrectiva[]>(
      rutaApi`/api/alertas/${alertaId}/acciones-correctivas`,
    )
    return data
  }, [])

  // HU-28: rectificar crea una acción nueva que referencia a la anterior; la
  // original no se toca. Esc. 2: se puede corregir la decisión, la acción y/o
  // la justificación; solo se envía lo que cambia. 409: ya no es la versión
  // vigente (alguien la rectificó antes). 403: ni autor ni farmacéutico.
  const rectificarAccion = useCallback(
    async (accionId: string, cambios: CambiosRectificacion, motivo: string): Promise<ResultadoRectificacion> => {
      try {
        const cuerpo: Record<string, string> = { motivo_rectificacion: motivo }
        for (const campo of ['decision', 'descripcion', 'justificacion'] as const) {
          if (cambios[campo] !== undefined) cuerpo[campo] = cambios[campo]
        }
        await apiClient.post(rutaApi`/api/alertas/acciones-correctivas/${accionId}/rectificar`, cuerpo)
        return 'ok'
      } catch (error) {
        return resultadoDeError(error)
      }
    },
    [],
  )

  return { reconocerAlerta, registrarAccionCorrectiva, obtenerCicloAtencion, rectificarAccion }
}
