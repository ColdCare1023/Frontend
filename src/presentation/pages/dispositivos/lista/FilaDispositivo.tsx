import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import { CalendarClock, FlaskConical, MapPin, Settings2, ShieldCheck } from 'lucide-react'

import { estadoCalibracion, type Dispositivo } from '@/domain/entities/Dispositivo'
import { MODO_DEMO } from '@/infrastructure/demo/modoDemo'
import { fechaCorta, fechaHora } from '@/lib/formato'
import { cn } from '@/lib/utils'
import { ActionMenu, ActionMenuLabel } from '../../../components/ActionMenu'
import { BadgeConectividad } from '../../../components/BadgeConectividad'
import { Badge } from '../../../components/ui/badge'
import { Button } from '../../../components/ui/button'
import { formatearTemperatura } from '../../../components/ui/formato-cifra'
import { Regla } from '../../../components/ui/regla'
import { IconoEquipo } from '../compartido'
import { accionFila, TEXTO_EQUIPO, tonoDeEstado, type EstadoVisual, type LecturaBreve } from '../estadoEquipo'
import { AccionContextual } from './AccionContextual'

/**
 * Una fila por equipo: estado con icono y texto, lectura actual con su regla
 * 2–8 °C y una sola acción contextual. Toda la fila abre el detalle (enlace
 * estirado); los controles internos quedan por encima con `z-10`.
 */
export const FilaDispositivo = memo(function FilaDispositivo({
  dispositivo,
  estado,
  ultima,
  desde,
  alProbarIoT,
}: {
  dispositivo: Dispositivo
  estado: EstadoVisual
  ultima: LecturaBreve | undefined
  /** URL de la lista (con filtros) a la que vuelve el detalle. */
  desde: string
  alProbarIoT: (id: string) => void
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const calibracion = estadoCalibracion(dispositivo)
  const accion = accionFila(dispositivo, calibracion)
  const ruta = `/dispositivos/${encodeURIComponent(dispositivo.id)}`
  const irA = (tab: string) => navigate(`${ruta}?tab=${tab}`, { state: { desde } })
  const idEstado = `eq-${dispositivo.id}-estado`
  const textoEstado =
    estado === 'sin_datos' && dispositivo.ultimo_reporte_en
      ? t('dispositivos.estadoEquipo.sin_datos_desde', { hora: fechaHora(dispositivo.ultimo_reporte_en) })
      : t(`dispositivos.estadoEquipo.${estado}`)

  return (
    <li
      className={cn(
        'relative grid grid-cols-1 gap-x-4 gap-y-3 px-4 py-4 transition-colors duration-(--duration-micro) ease-(--ease-hover) hover:bg-surface-hover has-[a[data-fila]:focus-visible]:bg-surface-hover',
        'sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto] sm:items-center lg:min-h-22',
        !dispositivo.activo && 'text-faint',
      )}
    >
      {/* Equipo */}
      <div className="min-w-0">
        <h3 className="flex min-w-0 items-center gap-2">
          <IconoEquipo estado={estado} className="size-4" />
          <Link
            to={ruta}
            state={{ desde }}
            data-fila
            aria-describedby={idEstado}
            className="codigo truncate text-title text-foreground after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:rounded-(--radius-card) focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-ring"
          >
            {dispositivo.id}
          </Link>
        </h3>
        <p className="mt-0.5 truncate text-meta text-muted">
          {[dispositivo.nombre, dispositivo.ubicacion].filter(Boolean).join(' · ') || '—'}
        </p>
        <div id={idEstado} className="relative z-10 mt-1.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-meta">
          <span className={cn('font-medium', TEXTO_EQUIPO[estado])}>{textoEstado}</span>
          {dispositivo.activo ? (
            <>
              <BadgeConectividad estado={dispositivo.estado_conectividad} desde={dispositivo.conectividad_cambiada_en} />
              {dispositivo.estado_operativo && dispositivo.estado_operativo !== 'OPERATIVO' && estado !== 'sin_datos' && estado !== 'falla_sensor' && (
                <Badge variant="critical">{t(`dispositivos.estadoOperativo.${dispositivo.estado_operativo}`)}</Badge>
              )}
              {dispositivo.broker_pendiente && (
                <Badge
                  variant="warn"
                  title={dispositivo.broker_pendiente_desde
                    ? t('dispositivos.brokerPendienteDesde', { fecha: fechaHora(dispositivo.broker_pendiente_desde) })
                    : undefined}
                >
                  {t(`dispositivos.brokerPendiente.${dispositivo.broker_pendiente}`)}
                </Badge>
              )}
              {dispositivo.rotacion_por_compromiso && estado !== 'retenida' && (
                <Badge variant="critical" title={t('dispositivos.telemetriaRetenidaAyuda')}>{t('dispositivos.telemetriaRetenida')}</Badge>
              )}
              {dispositivo.posesion_pendiente && (
                <Badge variant="warn" title={t('dispositivos.posesionPendienteAyuda')}>{t('dispositivos.posesionPendiente')}</Badge>
              )}
              <Badge
                variant={calibracion === 'vencida' ? 'critical' : calibracion === 'proxima_a_vencer' ? 'warn' : 'outline'}
                title={dispositivo.fecha_proxima_calibracion
                  ? t('dispositivos.calibracionVence', { fecha: fechaCorta(dispositivo.fecha_proxima_calibracion) })
                  : undefined}
              >
                {t('dispositivos.calibracion')}: {t(`dispositivos.calibracionEstado.${calibracion}`)}
              </Badge>
            </>
          ) : (
            <span className="text-faint">
              {dispositivo.dado_de_baja_en ? t('dispositivos.lista.dadoDeBajaEl', { fecha: fechaCorta(dispositivo.dado_de_baja_en) }) : null}
              {dispositivo.motivo_baja && ` · ${t(`dispositivos.motivos.${dispositivo.motivo_baja}`, { defaultValue: dispositivo.motivo_baja })}`}
            </span>
          )}
        </div>
      </div>

      {/* Lectura actual */}
      <div className="min-w-0">
        {!dispositivo.activo ? (
          <p className="text-meta text-faint">{t('dispositivos.lista.fueraDeServicio')}</p>
        ) : ultima && ultima.temperatura !== null ? (
          <>
            <p className="nums text-title text-foreground">{formatearTemperatura(ultima.temperatura)}</p>
            <Regla
              tamano="m"
              valor={ultima.temperatura}
              tono={tonoDeEstado(estado)}
              className="mt-2 w-full max-w-48 [&_.regla__carro]:transition-none"
            />
            <p className="mt-1 nums text-meta text-faint">{t('dispositivos.lista.lecturaDe', { hora: fechaHora(ultima.timestamp) })}</p>
          </>
        ) : (
          <p className="text-meta text-muted">{t('dispositivos.lista.sinLectura')}</p>
        )}
      </div>

      {/* Acciones */}
      <div className="relative z-10 flex flex-wrap items-center justify-start gap-2 sm:justify-end sm:gap-1">
        {accion && <AccionContextual dispositivo={dispositivo} accion={accion} className="max-sm:flex-1" />}
        <ActionMenu label={dispositivo.id}>
          <ActionMenuLabel>{t('dispositivos.menu.grupoIrA')}</ActionMenuLabel>
          <Button variant="ghost" size="sm" onClick={() => irA('calibracion')}>
            <CalendarClock />
            {t('dispositivos.menu.calibracion')}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => irA('ubicacion')}>
            <MapPin />
            {t('dispositivos.menu.ubicacion')}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => irA('configuracion')}>
            <Settings2 />
            {t('dispositivos.menu.configuracion')}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => irA('seguridad')}>
            <ShieldCheck />
            {t('dispositivos.menu.seguridad')}
          </Button>
          {MODO_DEMO && <ActionMenuLabel>{t('dispositivos.grupoDemo')}</ActionMenuLabel>}
          {MODO_DEMO && (
            <Button variant="ghost" size="sm" onClick={() => alProbarIoT(dispositivo.id)}>
              <FlaskConical />
              {t('dispositivos.probarIoT')}
            </Button>
          )}
        </ActionMenu>
      </div>
    </li>
  )
})
