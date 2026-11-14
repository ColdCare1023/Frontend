import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Download, FileDown, FileText } from 'lucide-react'

import type { ReporteBPA } from '@/application/hooks/useReportesBPA'
import { fechaCorta } from '@/lib/formato'
import { conteoAlertas, equiposDe, tiempoEnRango } from '@/lib/resumenReporte'
import { cn } from '@/lib/utils'
import { EstadoError, EstadoVacio } from '../../components/EstadoPagina'
import { Badge } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'
import { ContadorAnimado } from '../../components/ui/cifra-animada'
import { Detalles } from '../../components/ui/detalles'
import { Esqueleto } from '../../components/ui/esqueleto'
import { BarraTiempoEnRango } from './BarraTiempoEnRango'
import { CurvaMiniReporte } from './CurvaMiniReporte'
import { textoPorcentaje } from './formatoReporte'

const MAX_EQUIPOS = 5

function EsqueletoResumen({ className }: { className?: string }) {
  const { t } = useTranslation()
  return (
    <section aria-busy className={cn('superficie esqueleto-diferido flex flex-col', className)}>
      <span className="sr-only" role="status">{t('app.cargando')}</span>
      <div aria-hidden className="border-b border-border px-4 py-3 xl:px-5"><Esqueleto className="h-5 w-44" /></div>
      <div aria-hidden className="space-y-4 p-4 xl:p-5">
        <div className="grid grid-cols-3 gap-3">{[0, 1, 2].map((i) => <Esqueleto key={i} className="h-14" />)}</div>
        <Esqueleto className="h-3 w-full rounded-full" />
        <Esqueleto className="h-24 w-full" />
      </div>
      <div aria-hidden className="mt-auto flex gap-2 border-t border-border px-4 py-3 xl:px-5">
        {[0, 1, 2].map((i) => <Esqueleto key={i} className="h-8 w-28" />)}
      </div>
    </section>
  )
}

export interface PropsResumenReporte {
  reporte: ReporteBPA | null
  cargando: boolean
  mensajeError: string | null
  origen: 'auto' | 'usuario' | null
  generacion: number
  desactualizada: string | null
  descargandoPdf: boolean
  onPdf: () => void
  onCsv: () => void
  onJson: () => void
  onReintentar: () => void
  onGenerar: () => void
  onUsar30?: () => void
  className?: string
}

/** Columna de resultado (7/12): resumen del periodo, tiempo en rango y descargas. */
export function ResumenReporte(props: PropsResumenReporte) {
  const { reporte, cargando, mensajeError, className } = props
  const { t } = useTranslation()

  if (cargando) return <EsqueletoResumen className={className} />
  if (mensajeError) {
    return (
      <div className={className}>
        <EstadoError mensaje={mensajeError}>
          <Button variant="secondary" size="sm" className="mt-3" onClick={props.onReintentar}>
            {t('comunes.reintentar')}
          </Button>
        </EstadoError>
      </div>
    )
  }
  if (!reporte) {
    return (
      <EstadoVacio ilustracion="sin-reporte" titulo={t('reportes.sinReporte')} detalle={t('reportes.sinReporteDetalle')} className={className}>
        <Button size="sm" onClick={props.onGenerar}>
          <FileText />
          {t('reportes.generar')}
        </Button>
      </EstadoVacio>
    )
  }
  return <ContenidoResumen {...props} reporte={reporte} />
}

function ContenidoResumen({
  reporte,
  origen,
  generacion,
  desactualizada,
  descargandoPdf,
  onPdf,
  onCsv,
  onJson,
  onUsar30,
  className,
}: PropsResumenReporte & { reporte: ReporteBPA }) {
  const { t, i18n } = useTranslation()
  const parcial = Boolean(reporte.truncado)
  const tiempo = useMemo(
    () => tiempoEnRango(reporte.lecturas, reporte.fecha_desde, reporte.fecha_hasta, { parcial }),
    [reporte, parcial],
  )
  const alertas = useMemo(() => conteoAlertas(reporte.alertas), [reporte])
  const equipos = useMemo(() => (reporte.device_id ? [] : equiposDe(reporte.lecturas)), [reporte])
  const vacio = reporte.lecturas.length === 0 && reporte.alertas.length === 0 && reporte.registros_trazabilidad.length === 0
  const cifras = [
    ['reportes.lecturas', reporte.lecturas.length],
    ['reportes.alertas', reporte.alertas.length],
    ['reportes.registrosTrazabilidad', reporte.registros_trazabilidad.length],
  ] as const

  return (
    <section
      id="reportes-resumen"
      aria-labelledby="reportes-resumen-titulo"
      className={cn('superficie flex min-w-0 flex-col animate-(--animate-swap)', className)}
    >
      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-border px-4 py-3 xl:px-5">
        <h2 id="reportes-resumen-titulo" className="text-title text-foreground">{t('reportes.resumen')}</h2>
        <p className="nums text-meta text-faint">
          {fechaCorta(reporte.fecha_desde)} — {fechaCorta(reporte.fecha_hasta)} ·{' '}
          {reporte.device_id ? <span className="codigo">{reporte.device_id}</span> : t('reportes.todosLosEquipos')}
        </p>
        {desactualizada && <p className="basis-full text-meta text-warning-700">{desactualizada}</p>}
      </header>

      {parcial && (
        <div
          role={origen === 'auto' ? 'status' : 'alert'}
          className="mx-4 mt-4 rounded-(--radius-field) bg-critical-tint px-3 py-2 text-meta text-critical xl:mx-5"
        >
          <p className="font-semibold">
            {t('reportes.truncadoTitulo', { limite: (reporte.limite_por_coleccion ?? 0).toLocaleString('es-PE') })}
          </p>
          <p className="mt-1">
            {t('reportes.truncadoDetalle', {
              colecciones: [
                reporte.lecturas_truncadas && t('reportes.lecturas'),
                reporte.alertas_truncadas && t('reportes.alertas'),
                reporte.trazabilidad_truncada && t('reportes.registrosTrazabilidad'),
              ]
                .filter(Boolean)
                .join(', '),
            })}
          </p>
        </div>
      )}

      <div className="space-y-4 p-4 xl:space-y-5 xl:p-5">
        <dl className="grid grid-cols-3 divide-x divide-border rounded-(--radius-field) border border-border">
          {cifras.map(([clave, cantidad]) => (
            <div key={clave} className="flex min-w-0 flex-col justify-between gap-1 px-3 py-2.5 sm:px-4">
              <dt className="text-meta text-muted">{t(clave)}</dt>
              <dd className="text-metric text-foreground">
                <ContadorAnimado valor={cantidad} clave={generacion} formato={(n) => Math.round(n).toLocaleString('es-PE')} />
              </dd>
            </div>
          ))}
        </dl>

        {vacio ? (
          <EstadoVacio ilustracion="sin-datos" titulo={t('reportes.sinLecturas')} detalle={t('reportes.sinLecturasDetalle')} className="shadow-none">
            {onUsar30 && (
              <Button variant="secondary" size="sm" onClick={onUsar30}>
                {t('reportes.usar30')}
              </Button>
            )}
          </EstadoVacio>
        ) : (
          <>
            {reporte.lecturas.length > 0 && <BarraTiempoEnRango tiempo={tiempo} parcial={parcial} clave={generacion} />}
            <CurvaMiniReporte lecturas={reporte.lecturas} clave={generacion} />
            {alertas.criticas + alertas.preventivas + alertas.pendientes > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-meta text-muted">{t('reportes.alertas')}</span>
                {alertas.criticas > 0 && <Badge variant="critical">{t('reportes.alertasDesglose.criticas', { count: alertas.criticas })}</Badge>}
                {alertas.preventivas > 0 && <Badge variant="warn">{t('reportes.alertasDesglose.preventivas', { count: alertas.preventivas })}</Badge>}
                {alertas.pendientes > 0 && <Badge variant="outline">{t('reportes.alertasDesglose.pendientes', { count: alertas.pendientes })}</Badge>}
              </div>
            )}
            {equipos.length >= 2 && (
              <PorEquipo reporte={reporte} equipos={equipos} parcial={parcial} idioma={i18n.resolvedLanguage} />
            )}
          </>
        )}
      </div>

      <footer className="mt-auto flex flex-col gap-2 border-t border-border px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center xl:px-5">
        <h3 className="sr-only">{t('reportes.descargas')}</h3>
        <Button size="sm" className="w-full max-sm:h-11 sm:w-auto" aria-busy={descargandoPdf} disabled={descargandoPdf} onClick={onPdf}>
          <FileDown />
          <span key={descargandoPdf ? 'pdf-on' : 'pdf-off'} className="animate-(--animate-swap)">
            {descargandoPdf ? t('reportes.generandoPdf') : t('reportes.descargarPdf')}
          </span>
        </Button>
        <Button variant="secondary" size="sm" className="w-full max-sm:h-11 sm:w-auto" onClick={onCsv}>
          <Download />
          {t('reportes.descargarCsv')}
        </Button>
        <Button variant="secondary" size="sm" className="w-full max-sm:h-11 sm:w-auto" onClick={onJson}>
          <Download />
          {t('reportes.descargarJson')}
        </Button>
        <Detalles className="basis-full" titulo={t('reportes.formatosDisponibles')}>
          <p className="max-w-[72ch] text-meta text-muted">{t('reportes.notaFormatos')}</p>
          <p className="mt-2 max-w-[72ch] text-meta text-muted lg:hidden">{t('reportes.notaPdf')}</p>
        </Detalles>
      </footer>
    </section>
  )
}

function PorEquipo({
  reporte,
  equipos,
  parcial,
  idioma,
}: {
  reporte: ReporteBPA
  equipos: string[]
  parcial: boolean
  idioma: string | undefined
}) {
  const { t } = useTranslation()
  const filas = useMemo(
    () =>
      equipos.slice(0, MAX_EQUIPOS).map((equipo) => ({
        equipo,
        tiempo: tiempoEnRango(
          reporte.lecturas.filter((l) => l.device_id === equipo),
          reporte.fecha_desde,
          reporte.fecha_hasta,
          { parcial },
        ),
      })),
    [equipos, reporte, parcial],
  )
  return (
    <div>
      <h3 className="text-body font-medium text-foreground">{t('reportes.porEquipo')}</h3>
      <ul className="mt-1 divide-y divide-border">
        {filas.map(({ equipo, tiempo }) => (
          <li key={equipo} className="grid h-11 grid-cols-[minmax(0,1fr)_6rem_auto] items-center gap-3">
            <span className="codigo truncate text-body">{equipo}</span>
            <BarraTiempoEnRango tiempo={tiempo} compacta />
            <span className="nums text-meta text-muted">{textoPorcentaje(tiempo.porcentajes.enRango, idioma)}</span>
          </li>
        ))}
      </ul>
      {equipos.length > MAX_EQUIPOS && (
        <p className="mt-1 text-meta text-faint">{t('reportes.masEquipos', { count: equipos.length - MAX_EQUIPOS })}</p>
      )}
    </div>
  )
}
