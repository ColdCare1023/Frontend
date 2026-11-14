import { useCallback, useEffect, useState } from 'react'
import axios from 'axios'

import type { Dispositivo } from '@/domain/entities/Dispositivo'
import { apiClient } from '@/infrastructure/api/apiClient'
import { rutaApi } from '@/lib/rutaApi'

/** HU-30: lo que el responsable registra del certificado de calibración. */
export interface DatosCalibracion {
  fecha: string
  certificado: string
  observaciones?: string
  vencimiento: string
  margen: number
}

export type ResultadoCalibracion = 'ok' | 'sin_permiso' | 'no_encontrado' | 'error'

/** B-12: cuerpo exacto de `PATCH /api/dispositivos/{id}/calibracion` (CalibracionRequest). */
export function cuerpoCalibracion(
  fechaCalibracion: string, numeroCertificado: string, observaciones: string | undefined,
  fechaVencimiento: string, margenAvisoDias: number,
) {
  return {
    fecha_calibracion: fechaCalibracion,
    numero_certificado: numeroCertificado,
    observaciones: observaciones || undefined,
    fecha_vencimiento: fechaVencimiento,
    margen_aviso_dias: margenAvisoDias,
  }
}

/**
 * HU-30: el backend autoriza al Químico Farmacéutico (y al administrador) a
 * registrar la calibración y su margen de aviso (`_roles_calibracion` en
 * dispositivos_router.py). Esta llamada no depende de `GET /api/dispositivos`,
 * que es solo del administrador.
 */
export async function registrarCalibracionDispositivo(deviceId: string, datos: DatosCalibracion): Promise<ResultadoCalibracion> {
  try {
    await apiClient.patch(
      rutaApi`/api/dispositivos/${deviceId}/calibracion`,
      cuerpoCalibracion(datos.fecha, datos.certificado, datos.observaciones, datos.vencimiento, datos.margen),
    )
    return 'ok'
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 403) return 'sin_permiso'
    if (axios.isAxiosError(error) && error.response?.status === 404) return 'no_encontrado'
    return 'error'
  }
}

/**
 * HU-30 esc. 3: vigencia de calibración de cada equipo activo para marcar las
 * lecturas capturadas con el certificado vencido (Historial y curva). Usa
 * `estado-operativo?todos=true`, que también leen técnico, QF y auditor; una
 * sola consulta, sin sondeo: la vigencia cambia por días, no por segundos.
 */
export function useCalibracionEquipos() {
  const [equipos, setEquipos] = useState<Dispositivo[]>([])

  const consultar = useCallback(async () => {
    try {
      const { data } = await apiClient.get<Dispositivo[]>('/api/dispositivos/estado-operativo', { params: { todos: true } })
      setEquipos(Array.isArray(data) ? data : [])
    } catch {
      // Sin datos de calibración no se marca nada (no se inventa un aviso).
      setEquipos([])
    }
  }, [])

  useEffect(() => {
    void consultar()
  }, [consultar])

  return { equipos, consultar }
}
