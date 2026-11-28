import { useCallback, useEffect, useRef, useState } from 'react'

import type { AlertaTermica } from '@/domain/entities/AlertaTermica'
import type { EstadoAlerta } from '@/domain/value-objects/EstadoAlerta'
import { apiClient } from '@/infrastructure/api/apiClient'
import { suscribirseTiempoReal } from '@/infrastructure/sse/sseClient'
import { useAccionesAlerta, type CambioAlerta } from './useAccionesAlerta'

export type { CambiosRectificacion, ResultadoAccionAlerta, ResultadoRectificacion } from './useAccionesAlerta'

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

export function useAlertas(filtroInicial: FiltroEstado = 'pendiente') {
  const [filtro, setFiltroEstado] = useState<FiltroEstado>(filtroInicial)
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
  const aplicarLocal = useCallback(
    (alertaId: string, cambio: CambioAlerta) => {
      setPorFiltro((previo) => {
        const siguiente: typeof previo = {}
        for (const [clave, lista] of Object.entries(previo) as [FiltroEstado, AlertaTermica[]][]) {
          siguiente[clave] = lista.map((a) =>
            a.id === alertaId ? { ...a, ...(typeof cambio === 'function' ? cambio(a) : cambio) } : a,
          )
        }
        return siguiente
      })
    },
    [],
  )

  const recargarTrasPausa = useCallback(() => {
    const id = window.setTimeout(() => {
      temporizadores.current.delete(id)
      void consultar(filtroActual.current, { fondo: true })
    }, PAUSA_SALIDA_MS)
    temporizadores.current.add(id)
  }, [consultar])

  const refrescarTrasError = useCallback(() => consultar(filtroActual.current, { fondo: true }), [consultar])
  const acciones = useAccionesAlerta(aplicarLocal, recargarTrasPausa, refrescarTrasError)

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
    ...acciones,
  }
}
