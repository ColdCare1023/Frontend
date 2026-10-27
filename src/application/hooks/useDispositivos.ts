import { useCallback, useEffect, useState } from 'react'
import axios from 'axios'

import {
  aplicarCambioConectividad,
  type CredencialRotada,
  type Dispositivo,
  type DispositivoAlta,
  type HistorialConfiguracion,
} from '@/domain/entities/Dispositivo'
import { apiClient } from '@/infrastructure/api/apiClient'
import { suscribirseTiempoReal } from '@/infrastructure/sse/sseClient'
import { rutaApi } from '@/lib/rutaApi'

export function useDispositivos() {
  const [dispositivos, setDispositivos] = useState<Dispositivo[]>([])
  const [cargando, setCargando] = useState(true)

  const consultar = useCallback(async () => {
    setCargando(true)
    try {
      const { data } = await apiClient.get<Dispositivo[]>('/api/dispositivos')
      setDispositivos(data)
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    void consultar()
  }, [consultar])

  // HU-13: conectividad en vivo también en la gestión de dispositivos.
  useEffect(
    () =>
      suscribirseTiempoReal({
        onConectividad: (cambio) => setDispositivos((previos) => aplicarCambioConectividad(previos, cambio)),
      }),
    [],
  )

  const darDeBaja = useCallback(
    async (
      deviceId: string,
      motivo: string,
      descripcion: string | undefined,
      deviceIdReemplazo: string | undefined,
    ): Promise<'ok' | 'no_encontrado' | 'error'> => {
      try {
        await apiClient.post(rutaApi`/api/dispositivos/${deviceId}/baja`, {
          motivo,
          descripcion: descripcion || undefined,
          device_id_reemplazo: deviceIdReemplazo || undefined,
        })
        await consultar()
        return 'ok'
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 404) return 'no_encontrado'
        return 'error'
      }
    },
    [consultar],
  )

  // HU-30: certificado de calibración del sensor. B-12: contrato de
  // CalibracionRequest — el backend calcula la próxima fecha a partir de la
  // vigencia en meses; no acepta una fecha de vencimiento ni un margen.
  const registrarCalibracion = useCallback(
    async (
      deviceId: string,
      fechaCalibracion: string,
      numeroCertificado: string,
      observaciones: string | undefined,
      mesesVigencia: number,
    ): Promise<'ok' | 'error'> => {
      try {
        await apiClient.patch(rutaApi`/api/dispositivos/${deviceId}/calibracion`, cuerpoCalibracion(
          fechaCalibracion, numeroCertificado, observaciones, mesesVigencia,
        ))
        await consultar()
        return 'ok'
      } catch {
        return 'error'
      }
    },
    [consultar],
  )

  // HU-51: ubicación y metadatos de instalación del sensor.
  const actualizarInstalacion = useCallback(
    async (
      deviceId: string,
      ubicacion: string | undefined,
      fechaInstalacion: string | undefined,
      observaciones: string | undefined,
    ): Promise<'ok' | 'error'> => {
      try {
        await apiClient.patch(rutaApi`/api/dispositivos/${deviceId}/instalacion`, {
          ubicacion: ubicacion || undefined,
          fecha_instalacion: fechaInstalacion || undefined,
          observaciones: observaciones || undefined,
        })
        await consultar()
        return 'ok'
      } catch {
        return 'error'
      }
    },
    [consultar],
  )

  // HU-53/HU-54: responsable registrado (destinatario de avisos).
  const actualizarResponsable = useCallback(
    async (
      deviceId: string,
      nombre: string | undefined,
      email: string | undefined,
      telefono: string | undefined,
    ): Promise<'ok' | 'error'> => {
      try {
        await apiClient.patch(rutaApi`/api/dispositivos/${deviceId}/responsable`, {
          nombre: nombre || undefined,
          email: email || undefined,
          telefono: telefono || undefined,
        })
        await consultar()
        return 'ok'
      } catch {
        return 'error'
      }
    },
    [consultar],
  )

  // HU-49: historial auditable de cambios (instalación, calibración,
  // responsable) de un dispositivo — de solo lectura.
  const obtenerHistorialConfiguracion = useCallback(
    async (deviceId: string): Promise<HistorialConfiguracion[]> => {
      const { data } = await apiClient.get<HistorialConfiguracion[]>(
        rutaApi`/api/dispositivos/${deviceId}/historial-configuracion`,
      )
      return data
    },
    [],
  )

  // HU-43: el alta emite la credencial MQTT; el token llega una sola vez.
  // B-12: contrato de DispositivoAltaRequest (`sensores_habilitados`).
  const registrarDispositivo = useCallback(async (payload: {
    device_id: string
    nombre: string
    ubicacion: string
    sensores: SensorHabilitado[]
  }): Promise<{ resultado: 'ok'; credencial: CredencialRotada } | { resultado: 'duplicado' | 'error' }> => {
    try {
      const { data } = await apiClient.post<DispositivoAlta>('/api/dispositivos', cuerpoAlta(payload))
      await consultar()
      return { resultado: 'ok', credencial: data.credencial }
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 409) return { resultado: 'duplicado' }
      return { resultado: 'error' }
    }
  }, [consultar])

  // HU-43/HU-44: el administrador declara hecha en la consola de EMQX la
  // operación que quedó pendiente (crear/actualizar o retirar el usuario).
  const confirmarBroker = useCallback(
    async (deviceId: string, nota: string | undefined): Promise<'ok' | 'error'> => {
      try {
        await apiClient.post(rutaApi`/api/dispositivos/${deviceId}/broker/confirmar`, { nota: nota || undefined })
        await consultar()
        return 'ok'
      } catch {
        return 'error'
      }
    },
    [consultar],
  )

  // FE-003: contrato del backend (HU-44): rutas `/credenciales/...` y motivo
  // obligatorio, que queda en la auditoría. La rotación devuelve el token en
  // claro UNA sola vez; el llamador lo muestra y no lo guarda.
  const rotarCredencial = useCallback(
    async (deviceId: string, motivo: string): Promise<CredencialRotada | null> => {
      try {
        const { data } = await apiClient.post<CredencialRotada>(
          rutaApi`/api/dispositivos/${deviceId}/credenciales/rotar`,
          { motivo },
        )
        await consultar()
        return data
      } catch {
        return null
      }
    },
    [consultar],
  )

  const revocarCredencial = useCallback(
    async (deviceId: string, motivo: string): Promise<'revocada' | 'error'> => {
      try {
        await apiClient.post(rutaApi`/api/dispositivos/${deviceId}/credenciales/revocar`, { motivo })
        await consultar()
        return 'revocada'
      } catch {
        return 'error'
      }
    },
    [consultar],
  )

  const simularEscenario = useCallback(async (
    deviceId: string,
    escenario: 'sin_datos' | 'buffer_pendiente' | 'buffer_lleno' | 'falla_sensor' | 'puerta_abierta' | 'puerta_cerrada' | 'recuperar',
  ): Promise<boolean> => {
    try {
      await apiClient.post(rutaApi`/api/demo/dispositivos/${deviceId}/simulacion`, { escenario })
      await consultar()
      return true
    } catch {
      return false
    }
  }, [consultar])

  return {
    dispositivos,
    cargando,
    consultar,
    darDeBaja,
    registrarCalibracion,
    actualizarInstalacion,
    actualizarResponsable,
    obtenerHistorialConfiguracion,
    registrarDispositivo,
    rotarCredencial,
    revocarCredencial,
    confirmarBroker,
    simularEscenario,
  }
}

export type SensorHabilitado = 'DS18B20' | 'SHT31' | 'MC-38'

/** B-12: cuerpo exacto de `POST /api/dispositivos` (probado contra el OpenAPI). */
export function cuerpoAlta(payload: { device_id: string; nombre: string; ubicacion: string; sensores: SensorHabilitado[] }) {
  return {
    device_id: payload.device_id,
    nombre: payload.nombre,
    ubicacion: payload.ubicacion,
    sensores_habilitados: payload.sensores,
  }
}

/** B-12: cuerpo exacto de `PATCH /api/dispositivos/{id}/calibracion`. */
export function cuerpoCalibracion(
  fechaCalibracion: string, numeroCertificado: string, observaciones: string | undefined, mesesVigencia: number,
) {
  return {
    fecha_calibracion: fechaCalibracion,
    numero_certificado: numeroCertificado,
    observaciones: observaciones || undefined,
    meses_vigencia: mesesVigencia,
  }
}
