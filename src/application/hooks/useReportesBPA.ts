import { useCallback, useState } from 'react'
import axios from 'axios'

import type { AlertaTermica } from '@/domain/entities/AlertaTermica'
import type { LecturaTermica } from '@/domain/entities/LecturaTermica'
import type { RegistroTrazabilidad } from '@/domain/entities/RegistroTrazabilidad'
import { apiClient } from '@/infrastructure/api/apiClient'
import i18n from '@/infrastructure/i18n'
import { fechaHora } from '@/lib/formato'

function descargarBlob(contenido: BlobPart, tipo: string, nombre: string): void {
  const blob = new Blob([contenido], { type: tipo })
  const url = URL.createObjectURL(blob)
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = nombre
  enlace.click()
  URL.revokeObjectURL(url)
}

function campoCsv(valor: string): string {
  // Excel y LibreOffice evalúan celdas que empiezan por fórmula incluso si
  // proceden de campos de datos. La comilla simple conserva el valor visible
  // como texto y se aplica antes del escape CSV convencional.
  const seguro = /^[=+\-@]/.test(valor.trimStart()) ? `'${valor}` : valor
  return /[";\n]/.test(seguro) ? `"${seguro.replaceAll('"', '""')}"` : seguro
}

/**
 * Tope de amplitud del periodo. Debe coincidir con `MAX_DIAS_RANGO_REPORTE`
 * del backend (`reportes_router.py`), que responde 400 por encima de este
 * valor. Se replica aquí para poder avisar antes de gastar la petición —y la
 * cuota— en algo que se sabe que va a ser rechazado.
 */
export const MAX_DIAS_RANGO_REPORTE = 366

export type ErrorReporte = 'rango_invertido' | 'periodo_excesivo' | 'cuota' | 'generico'

/**
 * Instantes locales de inicio y fin del día.
 *
 * `new Date('2026-01-15')` se interpreta como medianoche **UTC**, mientras que
 * `new Date('2026-01-15T23:59:59')` se interpreta como hora **local**. El hook
 * mezclaba ambas formas, así que en Lima (UTC−5) el inicio del periodo caía a
 * las 19:00 del día anterior y el fin era correcto. Mientras el backend
 * ignoraba las fechas (hallazgo S-03 del backend) el desfase no se notaba;
 * ahora que las respeta, un reporte «del 15 de enero» arrastraría cinco horas
 * del día 14 y las atribuiría al periodo declarado.
 */
function inicioDelDiaLocal(fecha: string): string {
  const [anio, mes, dia] = fecha.split('-').map(Number)
  return new Date(anio, mes - 1, dia, 0, 0, 0, 0).toISOString()
}

function finDelDiaLocal(fecha: string): string {
  const [anio, mes, dia] = fecha.split('-').map(Number)
  return new Date(anio, mes - 1, dia, 23, 59, 59, 999).toISOString()
}

/** Días completos entre dos fechas `YYYY-MM-DD`, en el calendario local. */
export function diasDeRango(desde: string, hasta: string): number {
  const [a1, m1, d1] = desde.split('-').map(Number)
  const [a2, m2, d2] = hasta.split('-').map(Number)
  const ms = Date.UTC(a2, m2 - 1, d2) - Date.UTC(a1, m1 - 1, d1)
  return Math.round(ms / 86_400_000)
}

/**
 * Motivo por el que el backend rechazaría el periodo, o `null` si es válido.
 * Refleja las dos validaciones de `_validar_rango()`.
 */
export function validarRango(desde: string, hasta: string): ErrorReporte | null {
  const dias = diasDeRango(desde, hasta)
  if (dias < 0) return 'rango_invertido'
  if (dias > MAX_DIAS_RANGO_REPORTE) return 'periodo_excesivo'
  return null
}

/** 429: el endpoint tiene cuota propia por usuario (10/min). */
function clasificarFallo(err: unknown): ErrorReporte {
  if (axios.isAxiosError(err) && err.response?.status === 429) return 'cuota'
  return 'generico'
}

export interface ReporteBPA {
  device_id: string | null
  fecha_desde: string
  fecha_hasta: string
  lecturas: LecturaTermica[]
  alertas: AlertaTermica[]
  registros_trazabilidad: RegistroTrazabilidad[]
}

export function useReportesBPA() {
  const [reporte, setReporte] = useState<ReporteBPA | null>(null)
  const [generando, setGenerando] = useState(false)
  const [error, setError] = useState<ErrorReporte | null>(null)
  const [descargandoPdf, setDescargandoPdf] = useState(false)

  const generar = useCallback(async (desde: string, hasta: string, deviceId?: string) => {
    // Se comprueba antes de salir a la red: el endpoint tiene cuota propia
    // (10 peticiones por minuto y usuario), así que gastar un intento en algo
    // que el backend va a rechazar con 400 penaliza al usuario dos veces.
    const invalido = validarRango(desde, hasta)
    if (invalido) {
      setError(invalido)
      return
    }
    setGenerando(true)
    setError(null)
    try {
      const params: Record<string, string> = {
        fecha_desde: inicioDelDiaLocal(desde),
        fecha_hasta: finDelDiaLocal(hasta),
      }
      if (deviceId) params.device_id = deviceId
      const { data } = await apiClient.get<ReporteBPA>('/api/reportes/bpa', { params })
      setReporte(data)
    } catch (err) {
      setError(clasificarFallo(err))
    } finally {
      setGenerando(false)
    }
  }, [])

  const descargarJson = useCallback(() => {
    if (!reporte) return
    descargarBlob(
      JSON.stringify(reporte, null, 2),
      'application/json',
      `reporte-bpa-${reporte.fecha_desde.slice(0, 10)}-${reporte.fecha_hasta.slice(0, 10)}.json`,
    )
  }, [reporte])

  const descargarCsv = useCallback(() => {
    if (!reporte) return
    const t = i18n.t.bind(i18n)
    const cabecera = [
      t('historial.fecha'),
      t('historial.dispositivo'),
      `${t('historial.tempInterna')} (°C)`,
      `${t('historial.tempAmbiental')} (°C)`,
      `${t('historial.humedad')} (%)`,
      t('historial.puerta'),
      t('historial.riesgo'),
    ]
    const filas = reporte.lecturas.map((l) =>
      [
        fechaHora(l.timestamp),
        l.device_id,
        l.temperatura_interna?.toFixed(1) ?? '',
        l.temperatura_ambiental?.toFixed(1) ?? '',
        l.humedad_ambiental?.toFixed(0) ?? '',
        l.apertura_refrigerador === null
          ? t('dashboard.puertaSinSensor')
          : l.apertura_refrigerador
            ? t('dashboard.puertaAbierta')
            : t('dashboard.puertaCerrada'),
        // HU-34: un reporte de cumplimiento no puede presentar la clase
        // cruda de la IA como si fuera el veredicto — es `riesgo_efectivo`.
        l.riesgo_efectivo ? t(`riesgo.${l.riesgo_efectivo}`) : '',
      ]
        .map(campoCsv)
        .join(';'),
    )
    // BOM UTF-8 + separador ';' para que Excel en español lo abra directo.
    const csv = '\uFEFF' + [cabecera.map(campoCsv).join(';'), ...filas].join('\r\n')
    descargarBlob(
      csv,
      'text/csv;charset=utf-8',
      `reporte-bpa-${reporte.fecha_desde.slice(0, 10)}-${reporte.fecha_hasta.slice(0, 10)}.csv`,
    )
  }, [reporte])

  // RF-13 / HU-38: el PDF lo compone el backend, no el navegador. Es la única
  // forma de que el documento incluya el veredicto de integridad de la cadena
  // SHA-256 calculado sobre los registros reales — un PDF armado en el cliente
  // solo podría copiar lo que ya se le entregó, y no probaría nada.
  const descargarPdf = useCallback(
    async (desde: string, hasta: string, deviceId?: string) => {
      const invalido = validarRango(desde, hasta)
      if (invalido) {
        setError(invalido)
        return
      }
      setDescargandoPdf(true)
      setError(null)
      try {
        const params: Record<string, string> = {
          fecha_desde: inicioDelDiaLocal(desde),
          fecha_hasta: finDelDiaLocal(hasta),
        }
        if (deviceId) params.device_id = deviceId
        const { data } = await apiClient.get<Blob>('/api/reportes/bpa/pdf', {
          params,
          responseType: 'blob',
        })
        descargarBlob(data, 'application/pdf', `reporte-bpa-${desde}-${hasta}.pdf`)
      } catch (err) {
        setError(clasificarFallo(err))
      } finally {
        setDescargandoPdf(false)
      }
    },
    [],
  )

  return {
    reporte,
    generando,
    error,
    descargandoPdf,
    generar,
    descargarJson,
    descargarCsv,
    descargarPdf,
  }
}
