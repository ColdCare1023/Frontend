import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown } from 'lucide-react'

import { CAPACIDAD_BUFFER_LITTLEFS, umbralSilencioSegundos, type Dispositivo } from '@/domain/entities/Dispositivo'
import { fechaHora } from '@/lib/formato'
import { Badge } from '@/presentation/components/ui/badge'
import { Detalles } from '@/presentation/components/ui/detalles'

/**
 * Estado de los nodos cuando todavía no hay lectura térmica que mostrar: una cámara sin telemetría
 * también debe aparecer aquí. Incluye cola local, pérdidas y brechas del buffer.
 */
export function EstadoEquiposIoT({ equipos }: { equipos: Dispositivo[] }) {
  const { t } = useTranslation()
  if (equipos.length === 0) return null

  return (
    <section aria-labelledby="estado-iot-titulo" className="monitoreo__bloque">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="estado-iot-titulo" className="monitoreo__subtitulo">{t('dashboard.estadoIoTTitulo')}</h2>
        <p className="text-[13px] leading-5 text-muted">{t('dashboard.estadoIoTDetalle')}</p>
      </div>
      <ul className="renglones grid gap-x-8 md:grid-cols-2">
        {equipos.map((dispositivo) => {
          const buffer = dispositivo.buffer_littlefs
          const pendientes = buffer?.pendientes ?? 0
          const perdidas = buffer?.perdidas ?? 0
          const incidentes = dispositivo.incidencias_operativas ?? []
          const incidenteActivo = incidentes.find((incidente) => incidente.estado === 'activo' && incidente.tipo === 'sin_datos')
          const excursionNoVerificada = incidentes.find((incidente) => incidente.estado === 'activo' && incidente.tipo === 'excursion_no_verificada')
          const incidentesResueltos = incidentes.filter((incidente) => incidente.estado === 'resuelto')

          return (
            <li key={dispositivo.id} className="incidente text-sm">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <span className="text-base font-semibold tracking-tight">{dispositivo.nombre || dispositivo.id}</span>
                <span className="nums text-xs text-muted">{dispositivo.id}</span>
                {dispositivo.estado_operativo === 'SIN_DATOS' && (
                  <Badge variant="critical">
                    {t('dashboard.estadoSinDatos', {
                      segundos: incidenteActivo?.umbral_silencio_segundos ?? umbralSilencioSegundos(dispositivo),
                    })}
                  </Badge>
                )}
                {dispositivo.estado_operativo === 'FALLA_SENSOR' && <Badge variant="critical">{t('dispositivos.estadoOperativo.FALLA_SENSOR')}</Badge>}
                {dispositivo.estado_operativo === 'MONITOREO_SUSPENDIDO' && (
                  <Badge variant="critical" title={t('dispositivos.telemetriaRetenidaAyuda')}>
                    {t('dispositivos.estadoOperativo.MONITOREO_SUSPENDIDO')}
                  </Badge>
                )}
                {dispositivo.estado_operativo === 'OPERATIVO' && incidentesResueltos.length > 0 && <Badge variant="ok">{t('dispositivos.estadoOperativo.OPERATIVO')}</Badge>}
              </div>
              {excursionNoVerificada && (
                <p role="alert" className="mt-1.5 text-[13px] font-semibold text-clay-700">
                  {t('dashboard.excursionNoVerificada', {
                    temperatura: excursionNoVerificada.detalle?.temperatura_interna?.toFixed(2) ?? '—',
                    fecha: fechaHora(excursionNoVerificada.detalle?.captured_at ?? excursionNoVerificada.detectado_en),
                  })}
                </p>
              )}
              {incidenteActivo && (
                <p role="status" className="mt-1.5 text-[13px] font-medium text-clay-700">
                  {t('dashboard.alertaSilencio', {
                    fecha: fechaHora(incidenteActivo.detectado_en),
                    segundos: incidenteActivo.umbral_silencio_segundos,
                  })}
                </p>
              )}
              {dispositivo.estado_operativo === 'SIN_DATOS' && (
                <p className="mt-1 text-[13px] text-muted">
                  {dispositivo.ultimo_reporte_en
                    ? t('dashboard.ultimoDatoOperativo', { fecha: fechaHora(dispositivo.ultimo_reporte_en) })
                    : t('dashboard.nuncaReporto')}
                </p>
              )}
              {buffer && (
                <div className="mt-2 flex flex-col gap-1 text-[13px] text-muted">
                  {pendientes > 0 ? (
                    <span>{t('dispositivos.bufferLittlefs', { n: pendientes, max: buffer.limite })}</span>
                  ) : buffer.ultima_sincronizacion_en ? (
                    <span className="text-success-700">
                      {t('dashboard.sinPendientes', { fecha: fechaHora(buffer.ultima_sincronizacion_en) })}
                    </span>
                  ) : null}
                  {buffer.desde && (
                    <span>
                      {t('dispositivos.rangoBuffer', {
                        desde: fechaHora(buffer.desde),
                        hasta: buffer.hasta ? fechaHora(buffer.hasta) : '—',
                      })}
                    </span>
                  )}
                  {perdidas > 0 && (
                    <span className="font-semibold text-honey-700">
                      {t('dispositivos.perdidas', { n: perdidas })}
                    </span>
                  )}
                  {buffer.brechas?.slice(-2).map((brecha) => (
                    <span key={`${brecha.desde}-${brecha.hasta}`} className="text-clay-700">
                      {t('dashboard.brechaBuffer', { n: brecha.muestras_perdidas })} · {t('dashboard.causaBufferAgotado')}
                      <span className="mt-0.5 block font-normal">
                        {t('dashboard.periodoBrecha', {
                          desde: fechaHora(brecha.desde),
                          hasta: fechaHora(brecha.hasta),
                        })}
                      </span>
                    </span>
                  ))}
                </div>
              )}
              {incidentesResueltos.length > 0 && (
                <details className="group mt-2 text-[13px] text-muted">
                  <summary className="inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded font-medium hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary">
                    {t('dashboard.incidentesRecientes', { n: incidentesResueltos.length })}
                    <ChevronDown className="size-3.5 transition-transform group-open:rotate-180" aria-hidden />
                  </summary>
                  <ul className="mt-1 space-y-1">
                    {incidentesResueltos.slice(-3).map((incidente) => (
                      <li key={incidente.id}>
                        {t('dashboard.incidenteRecuperado', { fecha: fechaHora(incidente.recuperado_en) })}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/** Incidentes de los equipos mientras sí hay lecturas: lo que importa a la vista, la ficha técnica plegada. */
export const IncidentesEquipos = memo(function IncidentesEquipos({ equipos }: { equipos: Dispositivo[] }) {
  const { t } = useTranslation()
  if (equipos.length === 0) return null
  return (
    <section aria-labelledby="incidentes-titulo" className="min-w-0">
      <h2 id="incidentes-titulo" className="monitoreo__subtitulo">{t('dashboard.estadoIoTTitulo')}</h2>
      <p className="sr-only">{t('dashboard.estadoIoTDetalle')}</p>
      <div className="renglones">
        {equipos.map((equipo) => {
          const ultimaLectura = equipo.ultimo_reporte_en ? fechaHora(equipo.ultimo_reporte_en) : '—'
          const segundosSilencio = umbralSilencioSegundos(equipo)
          const lecturasPendientes = equipo.buffer_littlefs?.pendientes ?? 0
          const incidenteActivo = equipo.incidencias_operativas?.find((incidente) => incidente.estado === 'activo' && incidente.tipo === 'sin_datos')
          return (
            <article key={equipo.id} className="incidente">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-base font-semibold tracking-tight">{equipo.nombre || equipo.id}</p>
                  <p className="nums mt-0.5 text-xs text-muted">{equipo.id}</p>
                </div>
                <Badge variant={equipo.estado_operativo === 'OPERATIVO' ? 'ok' : 'critical'}>
                  {equipo.estado_operativo === 'SIN_DATOS'
                    ? t('dashboard.estadoSinDatos', { segundos: segundosSilencio })
                    : equipo.estado_operativo === 'FALLA_SENSOR'
                      ? t('dispositivos.estadoOperativo.FALLA_SENSOR')
                      : equipo.estado_operativo === 'MONITOREO_SUSPENDIDO'
                        ? t('dispositivos.estadoOperativo.MONITOREO_SUSPENDIDO')
                        : t('dispositivos.estadoOperativo.OPERATIVO')}
                </Badge>
              </div>
              {incidenteActivo && (
                <p role="status" className="mt-2 text-[13px] leading-5 font-medium text-clay-700">
                  {t('dashboard.alertaSilencio', { fecha: fechaHora(incidenteActivo.detectado_en), segundos: incidenteActivo.umbral_silencio_segundos })}
                </p>
              )}
              {/* Lo que el farmacéutico necesita ver; la ficha técnica queda plegada. */}
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                <div><dt className="text-muted">{t('dispositivos.ultimoReporte')}</dt><dd className="mt-0.5 text-[13px] font-medium">{ultimaLectura}</dd></div>
                <div><dt className="text-muted">{t('dispositivos.conectividad')}</dt><dd className="mt-0.5 text-[13px] font-medium">{equipo.estado_conectividad === 'online' ? t('dashboard.dispositivoOnline') : t('dashboard.dispositivoOffline')}</dd></div>
              </dl>
              <Detalles className="mt-1">
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                  <div><dt className="text-muted">{t('dispositivos.fallasSensor')}</dt><dd className="mt-0.5 font-medium">{(equipo.sensores ?? []).filter((sensor) => sensor.estado === 'error').length}</dd></div>
                  <div><dt className="text-muted">{t('dispositivos.bufferLittlefs', { n: lecturasPendientes, max: equipo.buffer_littlefs?.limite ?? CAPACIDAD_BUFFER_LITTLEFS })}</dt><dd className="mt-0.5 font-medium">{t('dispositivos.perdidas', { n: equipo.buffer_littlefs?.perdidas ?? 0 })}</dd></div>
                  <div><dt className="text-muted">{t('dispositivos.intervaloReporte')}</dt><dd className="mt-0.5 font-medium">{equipo.intervalo_reporte_segundos ?? 30} s</dd></div>
                  <div><dt className="text-muted">{t('dispositivos.umbralSinDatos')}</dt><dd className="mt-0.5 font-medium">{segundosSilencio} s</dd></div>
                  <div><dt className="text-muted">{t('dispositivos.firmware')}</dt><dd className="mt-0.5 font-medium">{equipo.firmware_version || '—'}</dd></div>
                  <div><dt className="text-muted">{t('dispositivos.credencialEstado')}</dt><dd className="mt-0.5 font-medium">{t(`dispositivos.credencial.${equipo.estado_credencial_broker ?? 'sin_reportar'}`)}</dd></div>
                  {equipo.buffer_littlefs?.desde && <div><dt className="text-muted">{t('dispositivos.ventanaCola')}</dt><dd className="mt-0.5 font-medium">{t('dispositivos.rangoBuffer', { desde: fechaHora(equipo.buffer_littlefs.desde), hasta: equipo.buffer_littlefs.hasta ? fechaHora(equipo.buffer_littlefs.hasta) : '—' })}</dd></div>}
                </dl>
              </Detalles>
            </article>
          )
        })}
      </div>
    </section>
  )
})
