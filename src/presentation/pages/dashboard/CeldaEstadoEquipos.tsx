import { memo, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { CircleCheck, Hourglass, Info, ShieldAlert, TriangleAlert, WifiOff } from 'lucide-react'

import { brechasRecientes, umbralSilencioSegundos, type Dispositivo } from '@/domain/entities/Dispositivo'
import { porcentajeConDatos, tramosDisponibilidad, type EstadoTramo } from '@/domain/value-objects/Disponibilidad'
import { fechaHora, hora } from '@/lib/formato'
import { clsx } from 'clsx'
import { Badge } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'
import { tonoDesdeRiesgo } from '../../components/ui/estado-tonos'
import { textoRangoBuffer, textosBrecha } from './bufferNodo'
import { CintaDisponibilidad } from './CintaDisponibilidad'
import { FONDO_TRAMO } from './utilidades'
import { ordenarEquipos, rangoEquipo, tieneIncidencia } from './equipos'
import { useMinuto, useVencido } from '../../hooks/useReloj'

const ORDEN_LEYENDA: readonly EstadoTramo[] = ['operativo', 'sin_datos', 'perdida', 'falla_sensor', 'suspendido', 'sin_registro']

export interface TemperaturaEquipo {
  valor: number | null
  timestamp?: string
  riesgo: Parameters<typeof tonoDesdeRiesgo>[0]
}

/** Badge del estado operativo con el texto de siempre. */
export function BadgeEstadoOperativo({ equipo }: { equipo: Dispositivo }) {
  const { t } = useTranslation()
  const incidenteActivo = equipo.incidencias_operativas?.find((i) => i.estado === 'activo' && i.tipo === 'sin_datos')
  if (equipo.estado_operativo === 'SIN_DATOS')
    return (
      <Badge variant="nodata">
        {t('dashboard.estadoSinDatos', { segundos: incidenteActivo?.umbral_silencio_segundos ?? umbralSilencioSegundos(equipo) })}
      </Badge>
    )
  if (equipo.estado_operativo === 'FALLA_SENSOR') return <Badge variant="critical">{t('dispositivos.estadoOperativo.FALLA_SENSOR')}</Badge>
  if (equipo.estado_operativo === 'MONITOREO_SUSPENDIDO')
    return (
      <Badge variant="critical" title={t('dispositivos.telemetriaRetenidaAyuda')}>
        {t('dispositivos.estadoOperativo.MONITOREO_SUSPENDIDO')}
      </Badge>
    )
  return (
    <Badge variant="ok" dot>
      {t('dispositivos.estadoOperativo.OPERATIVO')}
    </Badge>
  )
}

/** Un único aviso por fila, por prioridad (TA). El panel muestra todos. */
function AvisoFila({ equipo, porcentaje }: { equipo: Dispositivo; porcentaje: number | null }) {
  const { t } = useTranslation()
  const incidentes = equipo.incidencias_operativas ?? []
  const excursion = incidentes.find((i) => i.estado === 'activo' && i.tipo === 'excursion_no_verificada')
  if (excursion)
    return (
      <span role="alert" className="font-semibold text-danger-700">
        {t('dashboard.excursionNoVerificada', {
          temperatura: excursion.detalle?.temperatura_interna?.toFixed(2) ?? '—',
          fecha: fechaHora(excursion.detalle?.captured_at ?? excursion.detectado_en),
        })}
      </span>
    )
  const silencio = incidentes.find((i) => i.estado === 'activo' && i.tipo === 'sin_datos')
  if (silencio)
    return (
      <span role="status" className="font-medium text-nodata-700">
        {t('dashboard.alertaSilencio', { fecha: fechaHora(silencio.detectado_en), segundos: silencio.umbral_silencio_segundos })}
      </span>
    )
  const buffer = equipo.buffer_littlefs
  // HU-48: la brecha más reciente (el backend las entrega de la más nueva a la más antigua).
  const brecha = brechasRecientes(buffer, 1)[0]
  if (brecha) {
    const { resumen, periodo } = textosBrecha(brecha, t)
    return (
      <span className="text-danger-700">
        {resumen} · {periodo}
      </span>
    )
  }
  if (buffer && (buffer.perdidas ?? 0) > 0)
    return <span className="font-medium text-warning-700">{t('dispositivos.perdidas', { n: buffer.perdidas })}</span>
  if (buffer && buffer.pendientes > 0) {
    const rango = textoRangoBuffer(buffer, t)
    return (
      <span className="text-muted">
        {t('dispositivos.bufferLittlefs', { n: buffer.pendientes, max: buffer.limite })}
        {rango && ` · ${rango}`}
      </span>
    )
  }
  if (equipo.estado_operativo === 'SIN_DATOS')
    return (
      <span className="text-muted">
        {equipo.ultimo_reporte_en ? t('dashboard.ultimoDatoOperativo', { fecha: fechaHora(equipo.ultimo_reporte_en) }) : t('dashboard.nuncaReporto')}
      </span>
    )
  return (
    <span className="nums text-faint">
      {[
        porcentaje !== null ? t('dashboard.disponibilidad', { porcentaje }) : null,
        equipo.ultimo_reporte_en ? t('dashboard.ultimoReporteCorto', { hora: hora(equipo.ultimo_reporte_en) }) : null,
      ]
        .filter(Boolean)
        .join(' · ')}
    </span>
  )
}

function IconoEquipo({ equipo }: { equipo: Dispositivo }) {
  const rango = rangoEquipo(equipo)
  if (rango === 0) return <ShieldAlert aria-hidden className="size-4 shrink-0 text-danger-700" />
  if (rango === 1) return <Hourglass aria-hidden className="size-4 shrink-0 text-nodata-700" />
  if (rango === 2 || rango === 3) return <TriangleAlert aria-hidden className="size-4 shrink-0 text-warning-700" />
  if (rango === 4) return <WifiOff aria-hidden className="size-4 shrink-0 text-subtle" />
  return <CircleCheck aria-hidden className="size-4 shrink-0 text-success-700" />
}

const FilaEquipo = memo(function FilaEquipo({
  equipo,
  seleccionado,
  temperatura,
  ahora,
  onElegir,
  onVerDetalles,
}: {
  equipo: Dispositivo
  seleccionado: boolean
  temperatura: TemperaturaEquipo | undefined
  ahora: number
  onElegir: (id: string) => void
  onVerDetalles: (id: string) => void
}) {
  const { t } = useTranslation()
  const nombre = equipo.nombre?.trim() || equipo.id
  const tramos = useMemo(() => tramosDisponibilidad(equipo, ahora), [equipo, ahora])
  const porcentaje = porcentajeConDatos(tramos)
  const valor = temperatura?.valor ?? null
  const vencida = useVencido(temperatura?.timestamp, umbralSilencioSegundos(equipo))
  const historica = vencida || equipo.estado_operativo === 'SIN_DATOS' || equipo.estado_operativo === 'MONITOREO_SUSPENDIDO' || equipo.estado_conectividad !== 'online'
  return (
    <li
      aria-current={seleccionado ? 'true' : undefined}
      className={clsx(
        'relative px-2 py-2',
        seleccionado && 'bg-primary-tint before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full before:bg-primary',
      )}
    >
      {/* Nombre a todo lo ancho y en hasta dos líneas (sin «Cámara fría de
          va…»): la cifra y la Regla S van apiladas a la derecha. */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <IconoEquipo equipo={equipo} />
        <button
          type="button"
          onClick={() => onElegir(equipo.id)}
          aria-label={t('dashboard.mostrarEnMonitoreo', { equipo: nombre })}
          className="flex min-w-0 flex-1 cursor-pointer flex-col items-start rounded-(--radius-field) text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <span className="w-full [overflow-wrap:anywhere] text-body font-medium text-foreground" title={nombre}>
            {nombre}
          </span>
          {nombre !== equipo.id && <span className="codigo w-full [overflow-wrap:anywhere] text-meta text-muted">{equipo.id}</span>}
        </button>
        {!historica && valor !== null && (
          <span className="nums whitespace-nowrap text-body font-semibold text-foreground">{valor.toFixed(1)} °C</span>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="size-9 shrink-0 px-0 max-sm:size-11"
          aria-label={t('dashboard.verDetallesEquipo', { equipo: nombre })}
          onClick={() => onVerDetalles(equipo.id)}
        >
          <Info aria-hidden className="size-4" />
        </Button>
      </div>
      {historica && valor !== null && (
        <p className="mt-1 flex flex-wrap items-baseline gap-x-2 text-meta text-muted">
          {t('dashboard.ultimaLecturaHora')} <span className="nums whitespace-nowrap">{valor.toFixed(1)} °C</span>
          {temperatura?.timestamp && <time dateTime={temperatura.timestamp}>{fechaHora(temperatura.timestamp)}</time>}
        </p>
      )}
      <CintaDisponibilidad tramos={tramos} equipo={nombre} className="mt-2" />
      {/* Un aviso, dos líneas como máximo (tres a 1024–1279, donde la columna es
          estrecha): la frase completa está en el panel de detalle. */}
      <p className="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-meta">
        <BadgeEstadoOperativo equipo={equipo} /> <AvisoFila equipo={equipo} porcentaje={porcentaje} />
      </p>
    </li>
  )
})

/**
 * Estado operativo de TODOS los equipos (21st System Status): problemas
 * primero, cinta de 24 h y un aviso por fila. No se mezcla con el riesgo
 * térmico (HU-13/44/48/54).
 */
export const CeldaEstadoEquipos = memo(function CeldaEstadoEquipos({
  equipos,
  deviceId,
  temperaturas,
  onElegir,
  onVerDetalles,
}: {
  equipos: readonly Dispositivo[]
  deviceId: string | null
  temperaturas: Record<string, TemperaturaEquipo>
  onElegir: (id: string) => void
  onVerDetalles: (id: string) => void
}) {
  const { t } = useTranslation()
  // Minuto en curso (ms): la cinta avanza por minuto, no por segundo.
  const ahora = useMinuto()
  const ordenados = useMemo(() => ordenarEquipos(equipos), [equipos])
  const problemas = ordenados.filter(tieneIncidencia).length
  // La leyenda nombra solo los estados que aparecen en las cintas: con dos
  // equipos sanos son dos muestras en una línea, no cuatro en tres.
  const presentes = useMemo(() => {
    const estados = new Set<EstadoTramo>()
    for (const equipo of ordenados) for (const tramo of tramosDisponibilidad(equipo, ahora)) estados.add(tramo.estado)
    return ORDEN_LEYENDA.filter((estado) => estados.has(estado))
  }, [ordenados, ahora])
  const leyenda = presentes.map((estado) => (
    <span key={estado} className="inline-flex items-center gap-1">
      <span aria-hidden className={clsx('size-2 rounded-[2px]', FONDO_TRAMO[estado])} />
      {t(`dashboard.cinta.${estado}`)}
    </span>
  ))

  return (
    <section
      aria-labelledby="estado-equipos-titulo"
      className="superficie col-span-4 flex min-h-0 min-w-0 flex-col p-4 sm:col-span-8 lg:col-span-4 lg:h-[360px] xl:p-5"
    >
      <div>
        <h2 id="estado-equipos-titulo" className="text-title text-foreground">
          {t('dashboard.estadoIoTTitulo')}
        </h2>
        <p className="nums text-meta text-faint">
          {ordenados.length > 0 ? t('dashboard.equiposResumen', { count: ordenados.length, problemas }) : t('dashboard.esperandoDatos')}
        </p>
        <p className="sr-only">{t('dashboard.estadoIoTDetalle')}</p>
      </div>
      {ordenados.length > 0 && (
        <>
          <ul className="mt-1 min-h-0 flex-1 divide-y divide-border lg:overflow-y-auto lg:overscroll-contain">
            {ordenados.map((equipo) => (
              <FilaEquipo
                key={equipo.id}
                equipo={equipo}
                seleccionado={equipo.id === deviceId}
                temperatura={temperaturas[equipo.id]}
                ahora={ahora}
                onElegir={onElegir}
                onVerDetalles={onVerDetalles}
              />
            ))}
          </ul>
          {/* Eje de la cinta (de −24 h a ahora) con la leyenda en medio: una línea. */}
          <div className="nums mt-2 flex items-center justify-between gap-x-3 px-2 text-micro text-faint">
            <span aria-hidden className="shrink-0">{t('dashboard.cintaInicio')}</span>
            <span className="flex min-w-0 flex-wrap justify-center gap-x-3 gap-y-0.5">{leyenda}</span>
            <span aria-hidden className="shrink-0">{t('dashboard.ejeAhora')}</span>
          </div>
        </>
      )}
    </section>
  )
})
