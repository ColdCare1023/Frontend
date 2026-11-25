import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import { CalendarClock, FlaskConical, MapPin, Minus, Settings2, ShieldCheck, TrendingDown, TrendingUp } from 'lucide-react'

import { estadoCalibracion, type Dispositivo } from '@/domain/entities/Dispositivo'
import { MODO_DEMO } from '@/infrastructure/demo/modoDemo'
import type { CintaEquipo } from '@/lib/cinta24h'
import { duracionLegible, fechaCorta, fechaDia, fechaHora, hora, localeActual } from '@/lib/formato'
import { cn } from '@/lib/utils'
import { ActionMenu, ActionMenuLabel } from '../../../components/ActionMenu'
import { BadgeConectividad } from '../../../components/BadgeConectividad'
import { Badge } from '../../../components/ui/badge'
import { Button } from '../../../components/ui/button'
import { Cinta24h } from '../../../components/ui/cinta-24h'
import { Esqueleto } from '../../../components/ui/esqueleto'
import { ESPACIO_FINO, formatearCifra } from '../../../components/ui/formato-cifra'
import { Regla } from '../../../components/ui/regla'
import { IconoEquipo } from '../compartido'
import { accionFila, TEXTO_EQUIPO, tonoDeEstado, type EstadoVisual, type LecturaBreve } from '../estadoEquipo'
import { AccionContextual } from './AccionContextual'
import { Sparkline } from './Sparkline'
import { calcularTendencia, type PuntoTendencia } from './tendencias'

/** Columnas de la lista (subgrid): equipo, lectura, 24 h (≥1024) y acciones. */
export const COLUMNAS_LISTA =
  'grid-cols-1 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_auto] lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)_minmax(0,1fr)_auto]'

const TRAMO_S = 30 * 60

/** «13:24»: la hora de la lectura sin segundos (la completa va en `title`). */
function horaMinuto(iso: string): string {
  const fecha = new Date(iso)
  return Number.isNaN(fecha.getTime()) ? '—' : fecha.toLocaleTimeString(localeActual(), { hour: '2-digit', minute: '2-digit' })
}

/**
 * Una fila por equipo: estado con icono y texto, lectura actual con su regla
 * 2–8 °C y una sola acción contextual. Toda la fila abre el detalle (enlace
 * estirado); los controles internos quedan por encima con `z-10`.
 */
export const FilaDispositivo = memo(function FilaDispositivo({
  dispositivo,
  ampliada,
  estado,
  ultima,
  desde,
  alProbarIoT,
  tendencia,
  cinta,
}: {
  dispositivo: Dispositivo
  ampliada: boolean
  estado: EstadoVisual
  ultima: LecturaBreve | undefined
  /** URL de la lista (con filtros) a la que vuelve el detalle. */
  desde: string
  alProbarIoT: (id: string) => void
  /** Lecturas recientes para la tendencia corta (`useTendencias`). */
  tendencia?: { puntos: readonly PuntoTendencia[]; estado: 'cargando' | 'listo' | 'error' }
  /** Cinta de 24 h con las alertas e incidentes del equipo. */
  cinta?: CintaEquipo
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
        'relative col-span-full grid grid-cols-subgrid gap-y-3 px-4 py-4 transition-colors duration-(--duration-micro) ease-(--ease-hover) hover:bg-surface-hover has-[a[data-fila]:focus-visible]:bg-surface-hover',
        'sm:items-center',
        ampliada && 'lg:min-h-22',
        !dispositivo.activo && 'text-faint',
      )}
    >
      {/* Equipo */}
      <div className={cn('min-w-0', ampliada && 'sm:row-span-2 lg:row-span-1')}>
        <h3 className="flex min-w-0 items-center gap-2">
          <IconoEquipo estado={estado} className="size-4" />
          <Link
            to={ruta}
            state={{ desde }}
            data-fila
            aria-describedby={idEstado}
            className="min-w-0 break-words text-title text-foreground after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:rounded-(--radius-card) focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-ring"
          >
            {dispositivo.nombre || dispositivo.id}
            {dispositivo.nombre && <span className="sr-only"> · {dispositivo.id}</span>}
          </Link>
        </h3>
        {/* Hasta dos líneas: a 1440 «Sala de dispensación» se cortaba con sitio de sobra debajo. */}
        <p className="mt-0.5 line-clamp-2 text-meta text-muted">
          {dispositivo.nombre && <span>{dispositivo.id}</span>}
          {dispositivo.nombre && dispositivo.ubicacion && ' · '}
          {dispositivo.ubicacion}
        </p>
        <div id={idEstado} className="relative z-10 mt-1.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-meta">
          <span className={cn('font-medium', TEXTO_EQUIPO[estado])}>{textoEstado}</span>
          {dispositivo.activo ? (
            <>
              {(ampliada || (dispositivo.estado_conectividad !== 'online' && estado !== 'sin_conexion')) && (
                <BadgeConectividad estado={dispositivo.estado_conectividad} desde={dispositivo.conectividad_cambiada_en} />
              )}
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
              {(ampliada || calibracion === 'vencida' || calibracion === 'proxima_a_vencer') && <Badge
                variant={calibracion === 'vencida' ? 'critical' : calibracion === 'proxima_a_vencer' ? 'warn' : 'outline'}
                title={dispositivo.fecha_proxima_calibracion
                  ? t('dispositivos.calibracionVence', { fecha: fechaDia(dispositivo.fecha_proxima_calibracion) })
                  : undefined}
              >
                {t('dispositivos.calibracion')}: {t(`dispositivos.calibracionEstado.${calibracion}`)}
              </Badge>}
            </>
          ) : (
            <span className="text-faint">
              {dispositivo.dado_de_baja_en ? t('dispositivos.lista.dadoDeBajaEl', { fecha: fechaCorta(dispositivo.dado_de_baja_en) }) : null}
              {dispositivo.motivo_baja && ` · ${t(`dispositivos.motivos.${dispositivo.motivo_baja}`, { defaultValue: dispositivo.motivo_baja })}`}
            </span>
          )}
        </div>
      </div>

      {/* Lectura actual: valor, tendencia corta y Regla M */}
      <div className="min-w-0">
        {!dispositivo.activo ? (
          <p className="text-meta text-faint">{t('dispositivos.lista.fueraDeServicio')}</p>
        ) : ultima && ultima.temperatura !== null ? (
          ampliada ? <LecturaFila ultima={ultima} temperatura={ultima.temperatura} estado={estado} tendencia={tendencia} /> : (
            <>
              <p className="nums text-title text-foreground">{formatearCifra(ultima.temperatura)}<span className="text-meta text-muted">{ESPACIO_FINO}°C</span></p>
              <time dateTime={ultima.timestamp} className="text-meta text-muted" title={fechaHora(ultima.timestamp)}>
                {t('dashboard.ultimaLecturaHora')} · {estado === 'normal' || estado === 'preventivo' || estado === 'critico' ? horaMinuto(ultima.timestamp) : fechaHora(ultima.timestamp)}
              </time>
            </>
          )
        ) : (
          <p className="text-meta text-muted">{t('dispositivos.lista.sinLectura')}</p>
        )}
      </div>

      {/* Últimas 24 h: alertas e incidentes del equipo */}
      {ampliada && <div className="relative z-10 min-w-0 sm:col-start-2 sm:row-start-2 lg:col-start-3 lg:row-start-1">
        {!dispositivo.activo ? (
          <p className="text-meta text-faint max-sm:hidden">—</p>
        ) : cinta ? (
          <>
            <Cinta24h
              segmentos={cinta.segmentos}
              etiqueta={dispositivo.id}
              resumen={t('alertas.rail.resumenCinta', { equipo: dispositivo.id, ...cinta.resumen })}
              textoTono={{ neutro: t('alertas.rail.leyendaSinEventos') }}
              className="h-4 lg:h-5 [&>[data-tono=neutro]]:bg-nodata-100"
            />
            <p className="mt-1 truncate text-meta text-faint">
              <span className="lg:hidden">{t('dispositivos.lista.ultimas24h')} · </span>
              {resumenCinta(cinta, t)}
            </p>
          </>
        ) : (
          <Esqueleto className="h-4 lg:h-5" />
        )}
      </div>}

      {/* Acciones */}
      <div className={cn('relative z-10 flex flex-wrap items-center justify-start gap-2 sm:col-start-3 sm:row-start-1 sm:justify-end sm:gap-1', ampliada && 'sm:row-span-2 lg:col-start-4 lg:row-span-1')}>
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

type T = (clave: string, opciones?: Record<string, unknown>) => string

/** «Crítica 1 h · Sin datos 30 min» o «Sin alertas ni incidentes». */
function resumenCinta(cinta: CintaEquipo, t: T): string {
  const { criticas, preventivos, sinDatos } = cinta.resumen
  const partes = [
    criticas > 0 ? t('dispositivos.lista.cintaCritica', { duracion: duracionLegible(criticas * TRAMO_S) }) : null,
    preventivos > 0 ? t('dispositivos.lista.cintaPreventiva', { duracion: duracionLegible(preventivos * TRAMO_S) }) : null,
    sinDatos > 0 ? t('dispositivos.lista.cintaSinDatos', { duracion: duracionLegible(sinDatos * TRAMO_S) }) : null,
  ].filter(Boolean)
  return partes.length > 0 ? partes.join(' · ') : t('dispositivos.lista.cintaSinEventos')
}

const ICONO_SENTIDO = { sube: TrendingUp, baja: TrendingDown, estable: Minus } as const

/**
 * Valor con la unidad a su escala (DIRECTION §6), la tendencia corta de las
 * últimas lecturas y la Regla M. La Regla de la fila no anima su marca: hay
 * muchas filas y los valores llegan por SSE (MOTION §5).
 */
function LecturaFila({
  ultima,
  temperatura,
  estado,
  tendencia,
}: {
  ultima: LecturaBreve
  temperatura: number
  estado: EstadoVisual
  tendencia?: { puntos: readonly PuntoTendencia[]; estado: 'cargando' | 'listo' | 'error' }
}) {
  const { t } = useTranslation()
  const calculo = tendencia?.estado === 'listo' ? calcularTendencia(tendencia.puntos) : null
  const Icono = calculo ? ICONO_SENTIDO[calculo.sentido] : null
  const valor = calculo ? formatearCifra(Math.abs(calculo.pendiente)) : ''
  const textoTendencia = calculo ? t(`dispositivos.tendencia.${calculo.sentido}`, { valor }) : null
  // Subir junto al límite superior (o bajar junto al inferior) es el aviso que importa.
  const haciaLimite = calculo && ((calculo.sentido === 'sube' && temperatura >= 7) || (calculo.sentido === 'baja' && temperatura <= 2.5))

  return (
    <>
      <div className="flex items-center gap-3">
        <p className="nums text-title text-foreground">
          {formatearCifra(temperatura)}
          <span className="text-meta font-medium text-muted">{ESPACIO_FINO}°C</span>
        </p>
        {tendencia?.estado === 'cargando' ? (
          <Esqueleto className="h-6 w-20" />
        ) : (
          tendencia && <Sparkline puntos={tendencia.puntos} />
        )}
      </div>
      <Regla tamano="m" valor={temperatura} tono={tonoDeEstado(estado)} className="mt-2 w-full max-w-44 [&_.regla__carro]:transition-none" />
      <p className="mt-1.5 flex min-w-0 flex-wrap items-center gap-x-1.5 text-meta text-faint">
        {Icono && textoTendencia && (
          <span className={cn('inline-flex items-center gap-1', haciaLimite ? 'font-medium text-warning-700' : 'text-muted')}>
            <Icono aria-hidden className="size-3.5" />
            {textoTendencia}
            <span aria-hidden>·</span>
          </span>
        )}
        <time className="nums whitespace-nowrap" dateTime={ultima.timestamp} title={fechaHora(ultima.timestamp)}>
          {horaMinuto(ultima.timestamp)}
        </time>
        {calculo && (
          <span className="sr-only">
            {t('dispositivos.tendencia.sr', { tendencia: textoTendencia, desde: hora(new Date(calculo.desde).toISOString()) })}
          </span>
        )}
      </p>
    </>
  )
}
