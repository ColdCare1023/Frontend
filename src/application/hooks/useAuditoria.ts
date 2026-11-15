import { useCallback, useEffect, useRef, useState } from 'react'
import axios from 'axios'

import type { RegistroAuditoria, ResultadoAuditoria } from '@/domain/entities/Usuario'
import { apiClient } from '@/infrastructure/api/apiClient'

// HU-50 criterio 1: el panel de seguridad debe poder filtrar por periodo,
// usuario, tipo y resultado — el backend expone estos filtros en
// `GET /api/auditoria` (`desde`, `hasta`, `usuario_id`, `accion`, `resultado`).
export interface FiltrosAuditoria {
  desde?: string
  hasta?: string
  usuario_id?: string
  accion?: string
  /** HU-42 esc. 1 / HU-50: resultado real del evento (filtro del servidor). */
  resultado?: ResultadoAuditoria
}

/** Tope de la lista en pantalla; la exportación del servidor llega a 10 000 filas. */
export const LIMITE_AUDITORIA = 200

/** `validacion`: el backend rechazó un filtro (422), p. ej. un usuario que no es un UUID. */
export type ErrorAuditoria = 'validacion' | 'error'
export type ResultadoExportacion = 'ok' | 'cuota' | 'error'

const NOMBRE_EXPORTACION_POR_DEFECTO = 'coldcare-auditoria.csv'

function parametros(filtros: FiltrosAuditoria): Record<string, string> {
  const params: Record<string, string> = {}
  if (filtros.desde) params.desde = new Date(filtros.desde).toISOString()
  if (filtros.hasta) params.hasta = new Date(filtros.hasta).toISOString()
  if (filtros.usuario_id) params.usuario_id = filtros.usuario_id
  if (filtros.accion) params.accion = filtros.accion
  if (filtros.resultado) params.resultado = filtros.resultado
  return params
}

/** Nombre del archivo según `Content-Disposition` (expuesta por CORS). */
export function nombreDeContentDisposition(cabecera: unknown, porDefecto = NOMBRE_EXPORTACION_POR_DEFECTO): string {
  if (typeof cabecera !== 'string') return porDefecto
  const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(cabecera)
  if (utf8) {
    try {
      return decodeURIComponent(utf8[1].trim())
    } catch {
      // cae al nombre simple
    }
  }
  const simple = /filename="?([^";]+)"?/i.exec(cabecera)
  const nombre = simple?.[1].trim()
  // Solo el nombre: nada de rutas.
  return nombre ? nombre.replace(/[\\/]/g, '_') : porDefecto
}

function cabecera(headers: unknown, nombre: string): unknown {
  const h = headers as { get?: (n: string) => unknown; [clave: string]: unknown } | undefined
  return (typeof h?.get === 'function' ? h.get(nombre) : undefined) ?? h?.[nombre.toLowerCase()] ?? h?.[nombre]
}

function descargar(contenido: Blob, nombre: string): void {
  const url = URL.createObjectURL(contenido)
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = nombre
  enlace.click()
  // Revocar en el mismo tick puede cancelar la descarga en algunos navegadores.
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

export function useAuditoria() {
  const [registros, setRegistros] = useState<RegistroAuditoria[]>([])
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState(false)
  const [motivoError, setMotivoError] = useState<ErrorAuditoria | null>(null)
  const [exportando, setExportando] = useState(false)
  // Solo cuenta la respuesta de la última consulta: si los filtros cambian
  // antes de que llegue la anterior (p. ej. la carga inicial), la vieja
  // pisaría la lista filtrada y cerraría la fila que se hubiera abierto.
  const ultimaConsulta = useRef(0)

  const consultar = useCallback(async (filtros: FiltrosAuditoria = {}) => {
    const consulta = ++ultimaConsulta.current
    setCargando(true)
    setErrorCarga(false)
    setMotivoError(null)
    try {
      const { data } = await apiClient.get<RegistroAuditoria[]>('/api/auditoria', {
        params: { limite: String(LIMITE_AUDITORIA), ...parametros(filtros) },
      })
      if (consulta === ultimaConsulta.current) setRegistros(data)
    } catch (error) {
      // No se relanza: quien refresca tras una operación ya hecha no debe
      // perder su resultado por un fallo de la recarga.
      if (consulta !== ultimaConsulta.current) return
      setErrorCarga(true)
      setMotivoError(axios.isAxiosError(error) && error.response?.status === 422 ? 'validacion' : 'error')
    } finally {
      if (consulta === ultimaConsulta.current) setCargando(false)
    }
  }, [])

  /**
   * HU-42 esc. 1 / HU-50 esc. 4: exportación del SERVIDOR con los mismos
   * filtros (hasta 10 000 filas). La propia exportación queda auditada como
   * EXPORTAR_BITACORA y el archivo declara su alcance en la primera línea.
   */
  const exportar = useCallback(async (filtros: FiltrosAuditoria = {}): Promise<ResultadoExportacion> => {
    setExportando(true)
    try {
      const respuesta = await apiClient.get<Blob>('/api/auditoria/exportar', { params: parametros(filtros), responseType: 'blob' })
      const contenido = respuesta.data instanceof Blob ? respuesta.data : new Blob([String(respuesta.data ?? '')], { type: 'text/csv;charset=utf-8' })
      descargar(contenido, nombreDeContentDisposition(cabecera(respuesta.headers, 'Content-Disposition')))
      return 'ok'
    } catch (error) {
      return axios.isAxiosError(error) && error.response?.status === 429 ? 'cuota' : 'error'
    } finally {
      setExportando(false)
    }
  }, [])

  useEffect(() => {
    void consultar()
  }, [consultar])

  return { registros, cargando, errorCarga, motivoError, consultar, exportar, exportando, limite: LIMITE_AUDITORIA }
}
