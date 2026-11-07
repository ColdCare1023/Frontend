import { useTranslation } from 'react-i18next'
import { RadioTower } from 'lucide-react'

import { useIncidentesOperativos } from '@/application/hooks/useIncidentesOperativos'
import { fechaHora } from '@/lib/formato'
import { Badge } from '../../components/ui/badge'
import { Detalles } from '../../components/ui/detalles'
import { HaceCuanto } from './FilaAviso'

/**
 * HU-54 / A-3: incidentes SIN_DATOS como alerta OPERATIVA, distinta de las térmicas: el nodo dejó de
 * reportar y no hay temperatura que clasificar. A la vista, solo los activos y en corto (qué equipo,
 * qué pasa, desde cuándo); el registro completo, con su aviso y su recuperación, tras «Ver más».
 */
export function IncidentesOperativos({ nombreDe }: { nombreDe: (deviceId: string) => string }) {
  const { t } = useTranslation()
  const { incidentes, cargando, errorCarga } = useIncidentesOperativos()
  // Sin incidentes (o si el historial no responde) no se muestra; el estado
  // operativo en vivo sigue en Inicio.
  if (cargando || errorCarga || incidentes.length === 0) return null
  const activos = incidentes.filter((incidente) => incidente.estado === 'activo')

  return (
    <section aria-labelledby="incidentes-operativos-titulo" className="incidentes-op">
      <h2 id="incidentes-operativos-titulo" className="incidentes-op__titulo">
        {t('alertas.incidentesOperativos')}
      </h2>
      {activos.length > 0 && (
        <ul className="mt-2 grid gap-2">
          {activos.map((incidente) => (
            <li key={incidente.id} className="incidentes-op__activo">
              <span aria-hidden className="incidentes-op__icono">
                <RadioTower className="size-5" />
              </span>
              <span className="min-w-0">
                <span className="block text-[15px] leading-5 font-semibold tracking-[-0.01em] text-foreground">{nombreDe(incidente.device_id)}</span>
                <span className="block text-[13.5px] leading-5 text-muted">
                  {t(`alertas.incidenteTipo.${incidente.tipo ?? 'sin_datos'}`)} · <HaceCuanto marca={incidente.detectado_en} />
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
      <Detalles className="mt-1" titulo={t('comunes.verMas')}>
        <ul className="grid gap-3 pb-2">
          {incidentes.map((incidente) => {
            const temperatura = incidente.tipo === 'excursion_no_verificada' ? incidente.detalle?.temperatura_interna : null
            return (
              <li key={incidente.id} className="min-w-0 text-[13px] leading-5 text-muted">
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-[14px] font-semibold tracking-[-0.01em] text-foreground">{nombreDe(incidente.device_id)}</span>
                  <span className="nums">{incidente.device_id}</span>
                  <Badge variant={incidente.estado === 'activo' ? 'critical' : 'ok'}>{t(`alertas.incidenteEstado.${incidente.estado}`)}</Badge>
                  <span>{t(`alertas.incidenteTipo.${incidente.tipo ?? 'sin_datos'}`)}</span>
                </p>
                <p className="nums mt-1">
                  {(incidente.tipo ?? 'sin_datos') === 'sin_datos'
                    ? t('alertas.incidenteDetectado', {
                        fecha: fechaHora(incidente.detectado_en),
                        segundos: incidente.umbral_silencio_segundos,
                      })
                    : t('alertas.incidenteAbierto', { fecha: fechaHora(incidente.detectado_en) })}
                  {temperatura != null && <> · {t('alertas.incidenteTemperatura', { temperatura: temperatura.toFixed(2) })}</>}
                  {incidente.ultimo_reporte_en && <> · {t('alertas.incidenteUltimoReporte', { fecha: fechaHora(incidente.ultimo_reporte_en) })}</>}
                </p>
                {incidente.recuperado_en && <p className="nums">{t('alertas.incidenteRecuperado', { fecha: fechaHora(incidente.recuperado_en) })}</p>}
                <p className="nums">
                  {incidente.notificado_en
                    ? t('alertas.incidenteNotificado', { fecha: fechaHora(incidente.notificado_en) })
                    : t('alertas.incidenteSinAviso')}
                </p>
              </li>
            )
          })}
        </ul>
        <p className="max-w-[72ch] pb-2 text-[13px] leading-5 text-muted">{t('alertas.incidentesOperativosDetalle')}</p>
      </Detalles>
    </section>
  )
}
