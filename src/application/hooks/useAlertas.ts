import { useCallback, useEffect, useRef, useState } from 'react'
import axios from 'axios'

import type { AccionCorrectiva, AlertaTermica } from '@/domain/entities/AlertaTermica'
import type { EstadoAlerta } from '@/domain/value-objects/EstadoAlerta'
import { useEstadoVivoStore } from '@/application/stores/estadoVivoStore'
import { apiClient } from '@/infrastructure/api/apiClient'
import { suscribirseTiempoReal } from '@/infrastructure/sse/sseClient'
import { rutaApi } from '@/lib/rutaApi'

export type ResultadoAccionAlerta = 'ok' | 'conflicto' | 'error'
export type ResultadoRectificacion = ResultadoAccionAlerta | 'prohibido'

// HU-23: filtro por la máquina de estados, no por el booleano `revisada`
// (que el backend conserva solo por compatibilidad hacia atrás).
export type FiltroEstado = 'todas' | EstadoAlerta

/** Tope de la consulta: con 200 filas se avisa que hay más (usar Reportes). */
export const LIMITE_ALERTAS = 200
/** Ráfagas de eventos SSE se agrupan en una sola recarga (PERFORMANCE C3). */
const AGRUPAR_SSE_MS = 750
/** La fila muestra «Revisada»/«Registrada» antes de salir de su pestaña. */
const PAUSA_SALIDA_MS = 700

interface Consulta {
  /** Recarga de fondo (SSE, tras una acción): nunca vuelve a «cargando». */
  fondo?: boolean
}

export function useAlertas() {
  const [filtro, setFiltroEstado] = useState<FiltroEstado>('pendiente')
  // Caché por filtro: volver a una pestaña ya vista no parpadea a esqueleto.
  const [porFiltro, setPorFiltro] = useState<Partial<Record<FiltroEstado, AlertaTermica[]>>>({})
  const [refrescando, setRefrescando] = useState(false)
  const [errorCarga, setErrorCarga] = useState(false)
  const [errorRefresco, setErrorRefresco] = useState(false)
  const [actualizadoEn, setActualizadoEn] = useState<number | null>(null)
  const filtroActual = useRef(filtro)
  filtroActual.current = filtro
  const cacheRef = useRef(porFiltro)
  cacheRef.current = porFiltro
  const temporizadores = useRef(new Set<number>())

  const consultar = useCallback(async (destino: FiltroEstado, { fondo = false }: Consulta = {}) => {
    if (fondo || cacheRef.current[destino] !== undefined) setRefrescando(true)
    try {
      const params: Record<string, string> = { limite: String(LIMITE_ALERTAS) }
      if (destino !== 'todas') params.estado = destino
      const { data } = await apiClient.get<AlertaTermica[]>('/api/alertas', { params })
      setPorFiltro((previo) => ({ ...previo, [destino]: data }))
      if (destino === filtroActual.current) {
        setErrorCarga(false)
        setErrorRefresco(false)
        setActualizadoEn(Date.now())
      }
    } catch {
      if (destino === filtroActual.current) {
        // Con datos en pantalla, el fallo es de refresco: las filas se quedan.
        if (cacheRef.current[destino] !== undefined) setErrorRefresco(true)
        else setErrorCarga(true)
      }
    } finally {
      setRefrescando(false)
    }
  }, [])

  useEffect(() => {
    void consultar(filtro)
  }, [consultar, filtro])

  // FE-008: una alerta nueva, su actualización o la recuperación llegan por
  // SSE; la lista se refresca sin esperar a que el usuario recargue, sin
  // esqueleto y agrupando ráfagas.
  useEffect(() => {
    let pendiente: number | null = null
    const cancelar = suscribirseTiempoReal({
      onAlerta: () => {
        if (pendiente !== null) return
        pendiente = window.setTimeout(() => {
          pendiente = null
          void consultar(filtroActual.current, { fondo: true })
        }, AGRUPAR_SSE_MS)
      },
    })
    return () => {
      if (pendiente !== null) window.clearTimeout(pendiente)
      cancelar()
    }
  }, [consultar])

  useEffect(() => {
    const ids = temporizadores.current
    return () => ids.forEach((id) => window.clearTimeout(id))
  }, [])

  const setFiltro = useCallback((siguiente: FiltroEstado) => {
    setErrorCarga(false)
    setErrorRefresco(false)
    setFiltroEstado(siguiente)
  }, [])

  const reintentar = useCallback(() => void consultar(filtroActual.current), [consultar])

  /** Actualización optimista: la fila cambia antes de la recarga. */
  const aplicarLocal = useCallback((alertaId: string, cambio: Partial<AlertaTermica>) => {
    setPorFiltro((previo) => {
      const siguiente: typeof previo = {}
      for (const [clave, lista] of Object.entries(previo) as [FiltroEstado, AlertaTermica[]][]) {
        siguiente[clave] = lista.map((a) => (a.id === alertaId ? { ...a, ...cambio } : a))
      }
      return siguiente
    })
  }, [])

  const recargarTrasPausa = useCallback(() => {
    const id = window.setTimeout(() => {
      temporizadores.current.delete(id)
      void consultar(filtroActual.current, { fondo: true })
    }, PAUSA_SALIDA_MS)
    temporizadores.current.add(id)
  }, [consultar])

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
        await apiClient.patch(rutaApi`/api/alertas/${alertaId}/revisar`)
        aplicarLocal(alertaId, { estado: 'reconocida', revisada: true, reconocida_en: new Date().toISOString() })
        recargarTrasPausa()
        // El contador del riel y la píldora se actualizan sin esperar al SSE.
        useEstadoVivoStore.getState().refrescarAlertas()
        return 'ok'
      } catch (error) {
        await consultar(filtroActual.current, { fondo: true })
        if (axios.isAxiosError(error) && error.response?.status === 409) return 'conflicto'
        return 'error'
      }
    },
    [aplicarLocal, consultar, recargarTrasPausa],
  )

  // HU-23 Escenario 2 / HU-27 Escenario 2: registrar la acción correctiva
  // marca la alerta como ATENDIDA (RECONOCIDA -> ATENDIDA, o directamente
  // PENDIENTE -> ATENDIDA si nadie la reconoció antes). Si otro usuario ya la
  // atendió primero, el backend responde 409 — se informa en vez de fingir
  // éxito o de sobrescribir en silencio.
  const registrarAccionCorrectiva = useCallback(
    async (
      alertaId: string,
      { decision, descripcion, justificacion }: { decision: string; descripcion: string; justificacion: string },
    ): Promise<ResultadoAccionAlerta> => {
      try {
        await apiClient.post(rutaApi`/api/alertas/${alertaId}/acciones-correctivas`, { decision, justificacion, descripcion })
        aplicarLocal(alertaId, { estado: 'atendida', atendida_en: new Date().toISOString() })
        recargarTrasPausa()
        useEstadoVivoStore.getState().refrescarAlertas()
        return 'ok'
      } catch (error) {
        await consultar(filtroActual.current, { fondo: true })
        if (axios.isAxiosError(error) && error.response?.status === 409) return 'conflicto'
        return 'error'
      }
    },
    [aplicarLocal, consultar, recargarTrasPausa],
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
  // original no se toca. 409: ya no es la versión vigente (alguien la
  // rectificó antes). 403: ni autor ni farmacéutico.
  const rectificarAccion = useCallback(
    async (accionId: string, descripcion: string, motivo: string): Promise<ResultadoRectificacion> => {
      try {
        await apiClient.post(rutaApi`/api/alertas/acciones-correctivas/${accionId}/rectificar`, {
          descripcion,
          motivo_rectificacion: motivo,
        })
        return 'ok'
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 409) return 'conflicto'
        if (axios.isAxiosError(error) && error.response?.status === 403) return 'prohibido'
        return 'error'
      }
    },
    [],
  )

  const alertas = porFiltro[filtro] ?? []

  return {
    alertas,
    // Solo la primera carga de un filtro sin datos: los refrescos no parpadean.
    cargando: porFiltro[filtro] === undefined && !errorCarga,
    refrescando,
    errorCarga,
    errorRefresco,
    actualizadoEn,
    limiteAlcanzado: alertas.length >= LIMITE_ALERTAS,
    reintentar,
    filtro,
    setFiltro,
    reconocerAlerta,
    registrarAccionCorrectiva,
    obtenerCicloAtencion,
    rectificarAccion,
  }
}
