import { useCallback, useEffect, useRef, useState } from 'react'
import axios from 'axios'

import type { Dispositivo } from '@/domain/entities/Dispositivo'
import type { LecturaTermica } from '@/domain/entities/LecturaTermica'
import { SERIE_VENTANA_POR_DEFECTO_MS, type SerieTermica } from '@/domain/entities/SerieTermica'
import { apiClient } from '@/infrastructure/api/apiClient'
import { TAMANO_PAGINA } from '@/lib/paginacion'

export interface FiltrosHistorial {
  device_id?: string
  /** HU-36 / B-14: riesgo efectivo, el mismo que muestra la tabla (no la clase cruda). */
  riesgo_efectivo?: string
  desde?: string
  hasta?: string
}

/**
 * Periodo que se consultó de verdad. Sin «desde» ni «hasta» son las últimas
 * 24 h (HU-31 esc. 4): la tabla y la curva describen el MISMO periodo
 * (HU-36 esc. 1), no «las últimas N lecturas» de una y «24 h» de la otra.
 */
export interface PeriodoHistorial {
  desde: string
  hasta: string
  /** El usuario no fijó «desde»: se tomaron 24 h antes de «hasta». */
  porDefecto: boolean
}

/** La curva compara a lo sumo estos equipos a la vez (una serie por equipo). */
export const MAX_EQUIPOS_CURVA = 6

export type ErrorSerie = 'no_encontrado' | 'error'

export function periodoEfectivo(filtros: FiltrosHistorial, ahora = Date.now()): PeriodoHistorial {
  const hastaMs = filtros.hasta ? new Date(filtros.hasta).getTime() : ahora
  const desdeMs = filtros.desde ? new Date(filtros.desde).getTime() : hastaMs - SERIE_VENTANA_POR_DEFECTO_MS
  return { desde: new Date(desdeMs).toISOString(), hasta: new Date(hastaMs).toISOString(), porDefecto: !filtros.desde }
}

/** `X-Total-Count` (HU-31/HU-36): total sin paginar; `null` si el backend no lo envía. */
function totalDeCabecera(headers: unknown): number | null {
  const h = headers as { get?: (nombre: string) => unknown; [clave: string]: unknown } | undefined
  const crudo = (typeof h?.get === 'function' ? h.get('x-total-count') : undefined) ?? h?.['x-total-count'] ?? h?.['X-Total-Count']
  const total = Number(crudo)
  return crudo != null && crudo !== '' && Number.isFinite(total) && total >= 0 ? total : null
}

/**
 * HU-36: Historial sobre el periodo completo.
 * - La TABLA se pagina contra `GET /api/lecturas` (`limite` + `offset`) y el
 *   total sale de `X-Total-Count`: ninguna lectura del periodo queda fuera.
 * - La CURVA y el RESUMEN salen de `GET /api/lecturas/serie` (agregados del
 *   backend por intervalo), uno por equipo, sobre el mismo periodo.
 *
 * `inicial`: filtros de la primera consulta (p. ej. el equipo de la URL).
 */
export function useHistorial(inicial: FiltrosHistorial = {}, tamanoPagina = TAMANO_PAGINA) {
  const [primeraConsulta] = useState(inicial)
  const [lecturas, setLecturas] = useState<LecturaTermica[]>([])
  const [total, setTotal] = useState(0)
  const [pagina, setPagina] = useState(1)
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState(false)
  const [series, setSeries] = useState<SerieTermica[]>([])
  const [cargandoSerie, setCargandoSerie] = useState(true)
  const [errorSerie, setErrorSerie] = useState<ErrorSerie | null>(null)
  const [periodo, setPeriodo] = useState<PeriodoHistorial>(() => periodoEfectivo(inicial))
  const [equiposConocidos, setEquiposConocidos] = useState<string[]>([])

  // Lo consultado de verdad: la paginación repite estos mismos filtros y periodo.
  const consulta = useRef<{ filtros: FiltrosHistorial; periodo: PeriodoHistorial }>({ filtros: inicial, periodo: periodoEfectivo(inicial) })
  // Dos turnos: uno por consulta (tabla + curva) y otro por página de la
  // tabla. Cambiar de página no debe descartar la curva que aún llega.
  const turnoConsulta = useRef(0)
  const turnoPagina = useRef(0)
  const tamano = useRef(tamanoPagina)
  const equipos = useRef<Promise<string[]> | null>(null)

  /** Equipos activos (para la curva sin filtro de equipo). Una vez por visita. */
  const obtenerEquipos = useCallback(() => {
    equipos.current ??= apiClient
      .get<Dispositivo[]>('/api/dispositivos/estado-operativo', { params: { todos: true } })
      .then(({ data }) => (Array.isArray(data) ? data.map((d) => d.id).filter(Boolean) : []))
      .catch(() => [])
    return equipos.current
  }, [])

  const pedirPagina = useCallback(async (n: number, propio: number) => {
    const { filtros, periodo: p } = consulta.current
    const params: Record<string, string> = {
      limite: String(tamano.current),
      offset: String((n - 1) * tamano.current),
      desde: p.desde,
      hasta: p.hasta,
    }
    if (filtros.device_id) params.device_id = filtros.device_id
    if (filtros.riesgo_efectivo) params.riesgo_efectivo = filtros.riesgo_efectivo
    const respuesta = await apiClient.get<LecturaTermica[]>('/api/lecturas', { params })
    if (propio !== turnoPagina.current) return null
    const filas = Array.isArray(respuesta.data) ? respuesta.data : []
    // Sin cabecera (backend anterior): se ofrece una página más si esta vino llena.
    const conocido = totalDeCabecera(respuesta.headers)
    const estimado = (n - 1) * tamano.current + filas.length + (filas.length === tamano.current ? 1 : 0)
    setLecturas(filas)
    setTotal(conocido ?? estimado)
    setPagina(n)
    return filas
  }, [])

  const pedirSeries = useCallback(
    async (filas: LecturaTermica[], propio: number) => {
      const { filtros, periodo: p } = consulta.current
      setCargandoSerie(true)
      setErrorSerie(null)
      const candidatos = filtros.device_id
        ? [filtros.device_id]
        : [...new Set([...(await obtenerEquipos()), ...filas.map((l) => l.device_id)])].sort().slice(0, MAX_EQUIPOS_CURVA)
      if (propio !== turnoConsulta.current) return
      setEquiposConocidos((previos) => [...new Set([...previos, ...candidatos])].sort())
      const resultados = await Promise.allSettled(
        candidatos.map((device_id) =>
          apiClient.get<SerieTermica>('/api/lecturas/serie', { params: { device_id, desde: p.desde, hasta: p.hasta } }),
        ),
      )
      if (propio !== turnoConsulta.current) return
      const ok = resultados.flatMap((r) => (r.status === 'fulfilled' && r.value.data ? [r.value.data] : []))
      // Con un equipo elegido su serie se muestra aunque esté vacía (el vacío
      // también es un dato); sin filtro, solo los equipos con lecturas.
      setSeries(filtros.device_id ? ok : ok.filter((s) => s.total_lecturas > 0))
      const fallos = resultados.filter((r): r is PromiseRejectedResult => r.status === 'rejected')
      if (fallos.length > 0 && ok.length === 0) {
        const noEncontrado = fallos.every((f) => axios.isAxiosError(f.reason) && f.reason.response?.status === 404)
        setErrorSerie(filtros.device_id && noEncontrado ? 'no_encontrado' : 'error')
      }
      setCargandoSerie(false)
    },
    [obtenerEquipos],
  )

  const consultar = useCallback(
    async (filtros: FiltrosHistorial = {}) => {
      const propio = ++turnoConsulta.current
      const propioPagina = ++turnoPagina.current
      const p = periodoEfectivo(filtros)
      consulta.current = { filtros, periodo: p }
      setPeriodo(p)
      setCargando(true)
      setErrorCarga(false)
      let filas: LecturaTermica[] = []
      try {
        filas = (await pedirPagina(1, propioPagina)) ?? []
      } catch {
        if (propioPagina === turnoPagina.current) {
          setErrorCarga(true)
          setLecturas([])
          setTotal(0)
        }
      } finally {
        if (propioPagina === turnoPagina.current) setCargando(false)
      }
      if (propio === turnoConsulta.current) await pedirSeries(filas, propio)
    },
    [pedirPagina, pedirSeries],
  )

  /** Otra página de la MISMA consulta (la curva y el resumen no cambian). */
  const irAPagina = useCallback(
    async (n: number) => {
      const propio = ++turnoPagina.current
      setCargando(true)
      setErrorCarga(false)
      try {
        await pedirPagina(Math.max(1, n), propio)
      } catch {
        if (propio === turnoPagina.current) setErrorCarga(true)
      } finally {
        if (propio === turnoPagina.current) setCargando(false)
      }
    },
    [pedirPagina],
  )

  useEffect(() => {
    void consultar(primeraConsulta)
  }, [consultar, primeraConsulta])

  // Al cambiar el tamaño de página, se vuelve a la primera con los mismos filtros.
  useEffect(() => {
    if (tamano.current === tamanoPagina) return
    tamano.current = tamanoPagina
    void irAPagina(1)
  }, [tamanoPagina, irAPagina])

  return {
    lecturas,
    total,
    pagina,
    irAPagina,
    cargando,
    errorCarga,
    consultar,
    series,
    cargandoSerie,
    errorSerie,
    periodo,
    equiposConocidos,
  }
}
