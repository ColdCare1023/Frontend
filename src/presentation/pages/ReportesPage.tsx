import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Bell, CalendarRange, ClipboardList, Download, FileDown, FileSearch, FileText, Link2 } from 'lucide-react'

import { useReportesBPA, MAX_DIAS_RANGO_REPORTE, diasDeRango } from '@/application/hooks/useReportesBPA'
import { fechaCorta, fechaISOlocal } from '@/lib/formato'
import { cn } from '@/lib/utils'
import { CompactWorkspace } from '../components/CompactWorkspace'
import { EstadoVacio } from '../components/EstadoPagina'
import { PageHeader } from '../components/PageHeader'
import { Button } from '../components/ui/button'
import { Card } from '../components/ui/card'
import { Detalles } from '../components/ui/detalles'
import { Input, Label } from '../components/ui/input'
import { Panel } from '../components/ui/panel'
import { SelectorFecha } from '../components/ui/selector-fecha'

function hoyISO(desplazamientoDias = 0): string {
  const fecha = new Date()
  fecha.setDate(fecha.getDate() + desplazamientoDias)
  return fechaISOlocal(fecha)
}

const CONTENIDO_REPORTE = [
  [ClipboardList, 'reportes.incluyeLecturas'],
  [Bell, 'reportes.incluyeAlertas'],
  [Link2, 'reportes.incluyeTrazabilidad'],
] as const

export function ReportesPage() {
  const { t } = useTranslation()
  const { reporte, generando, error, descargandoPdf, generar, descargarJson, descargarCsv, descargarPdf } =
    useReportesBPA()

  const [desde, setDesde] = useState(hoyISO(-30))
  const [hasta, setHasta] = useState(hoyISO())
  const [deviceId, setDeviceId] = useState('')

  // El periodo se mide y se muestra antes de enviar nada: el backend rechaza
  // con 400 los rangos invertidos y los de más de 366 días, y además el
  // endpoint tiene cuota propia (10/min por usuario). Avisar aquí evita gastar
  // un intento en una petición que se sabe inválida. Las dos fechas son
  // obligatorias: sin una de ellas no hay periodo que medir.
  const periodoCompleto = Boolean(desde && hasta)
  const dias = periodoCompleto ? diasDeRango(desde, hasta) : 0
  const errorPeriodo = !periodoCompleto
    ? null
    : dias < 0
      ? t('reportes.errorRangoInvertido')
      : dias > MAX_DIAS_RANGO_REPORTE
        ? t('reportes.errorPeriodoExcesivo', { max: MAX_DIAS_RANGO_REPORTE })
        : null
  const rangoInvalido = !periodoCompleto || errorPeriodo !== null
  const mensajeError =
    error === null
      ? null
      : error === 'rango_invertido'
        ? t('reportes.errorRangoInvertido')
        : error === 'periodo_excesivo'
          ? t('reportes.errorPeriodoExcesivo', { max: MAX_DIAS_RANGO_REPORTE })
          : error === 'cuota'
            ? t('reportes.errorCuota')
            : t('reportes.errorGenerar')

  return (
    <CompactWorkspace>
      <PageHeader eyebrow={t('nav.seccionCumplimiento')} titulo={t('reportes.titulo')} descripcion={t('reportes.descripcion')} />

      {/* ── Periodo, equipo y generación en una sola barra ──── */}
      <Card className="p-4 sm:px-5">
        <h2 id="reportes-rango-titulo" className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <CalendarRange className="size-4 text-primary" aria-hidden />
          {t('reportes.rango')}
        </h2>
        <form
          aria-labelledby="reportes-rango-titulo"
          className="mt-3 grid grid-cols-1 items-end gap-3 min-[420px]:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.3fr)_auto]"
          onSubmit={(e) => {
            e.preventDefault()
            if (rangoInvalido) return
            void generar(desde, hasta, deviceId || undefined)
          }}
        >
          <div>
            <Label htmlFor="r-desde">{t('reportes.desde')}</Label>
            <SelectorFecha
              id="r-desde"
              valor={desde}
              onCambiar={setDesde}
              invalido={!desde || errorPeriodo !== null}
              aria-describedby="reportes-periodo"
            />
          </div>
          <div>
            <Label htmlFor="r-hasta">{t('reportes.hasta')}</Label>
            <SelectorFecha
              id="r-hasta"
              valor={hasta}
              onCambiar={setHasta}
              invalido={!hasta || errorPeriodo !== null}
              aria-describedby="reportes-periodo"
            />
          </div>
          <div className="min-[420px]:col-span-2 lg:col-span-1">
            <Label htmlFor="r-device">{t('reportes.dispositivo')}</Label>
            <Input
              id="r-device"
              value={deviceId}
              onChange={(e) => setDeviceId(e.target.value)}
              placeholder={t('reportes.codigoEquipoEjemplo')}
            />
          </div>
          <Button
            type="submit"
            className="w-full min-[420px]:col-span-2 lg:col-span-1 lg:w-auto lg:min-w-40"
            disabled={generando || rangoInvalido}
          >
            <FileText />
            {generando ? t('reportes.generando') : t('reportes.generar')}
          </Button>
        </form>

        <p
          id="reportes-periodo"
          role={errorPeriodo ? 'alert' : 'status'}
          className={cn('nums mt-2 text-xs', errorPeriodo ? 'text-critical' : 'text-faint')}
        >
          {errorPeriodo ?? (periodoCompleto ? t('reportes.periodoDias', { count: dias + 1 }) : null)}
        </p>

        {mensajeError && (
          <p role="alert" className="mt-3 rounded-(--radius-field) bg-critical-tint px-3 py-2 text-[13px] text-critical">
            {mensajeError}
          </p>
        )}
      </Card>

      {/* ── Resumen y descargas ─────────────────────────────── */}
      {reporte === null ? (
        <EstadoVacio icono={FileSearch} titulo={t('reportes.sinReporte')} detalle={t('reportes.sinReporteDetalle')}>
          <ul className="mt-3 flex flex-wrap justify-center gap-2">
            {CONTENIDO_REPORTE.map(([Icono, clave]) => (
              <li
                key={clave}
                className="inline-flex min-h-8 items-center gap-2 rounded-full border border-border bg-surface px-3 text-xs font-medium text-foreground"
              >
                <Icono className="size-3.5 shrink-0 text-primary" aria-hidden />
                {t(clave)}
              </li>
            ))}
          </ul>
          <p className="mt-2 flex flex-wrap items-center justify-center gap-1.5 text-xs text-muted">
            <span className="mr-1">{t('reportes.formatosDisponibles')}</span>
            {['PDF', 'CSV', 'JSON'].map((formato) => (
              <span key={formato} className="rounded-md bg-primary-tint px-2 py-0.5 text-[11px] font-semibold tracking-wide text-primary">
                {formato}
              </span>
            ))}
          </p>
        </EstadoVacio>
      ) : (
        <Panel
          id="reportes-resumen"
          icono={FileText}
          titulo={t('reportes.resumen')}
          descripcion={
            <span className="nums break-words">
              {fechaCorta(reporte.fecha_desde)} — {fechaCorta(reporte.fecha_hasta)}
              {reporte.device_id && ` · ${reporte.device_id}`}
            </span>
          }
        >
          <dl className="grid grid-cols-1 divide-y divide-border min-[420px]:grid-cols-3 min-[420px]:divide-x min-[420px]:divide-y-0">
            {(
              [
                ['reportes.lecturas', reporte.lecturas.length],
                ['reportes.alertas', reporte.alertas.length],
                ['reportes.registrosTrazabilidad', reporte.registros_trazabilidad.length],
              ] as const
            ).map(([clave, cantidad]) => (
              <div
                key={clave}
                className="flex min-w-0 items-baseline justify-between gap-3 py-2.5 first:pt-0 last:pb-0 min-[420px]:flex-col min-[420px]:justify-start min-[420px]:gap-1 min-[420px]:px-4 min-[420px]:py-0 min-[420px]:first:pl-0 min-[420px]:last:pr-0"
              >
                <dt className="text-xs text-muted">{t(clave)}</dt>
                <dd className="nums text-2xl leading-8 font-semibold tracking-tight text-foreground">{cantidad}</dd>
              </div>
            ))}
          </dl>

          {/* Los tres formatos que exige RF-13. El reporte es apoyo para
              revisión: no reemplaza registros ni documentos oficiales. */}
          <div className="mt-5 flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:flex-wrap sm:items-center">
            <Button
              size="sm"
              className="w-full sm:w-auto"
              disabled={descargandoPdf || rangoInvalido}
              onClick={() => void descargarPdf(desde, hasta, deviceId || undefined)}
            >
              <FileDown />
              {descargandoPdf ? t('reportes.generandoPdf') : t('reportes.descargarPdf')}
            </Button>
            <Button variant="secondary" size="sm" className="w-full sm:w-auto" onClick={descargarCsv}>
              <Download />
              {t('reportes.descargarCsv')}
            </Button>
            <Button variant="secondary" size="sm" className="w-full sm:w-auto" onClick={descargarJson}>
              <Download />
              {t('reportes.descargarJson')}
            </Button>
          </div>
          <Detalles className="mt-2">
            <p className="max-w-[72ch] text-xs leading-5 text-muted">{t('reportes.notaFormatos')}</p>
          </Detalles>
        </Panel>
      )}
    </CompactWorkspace>
  )
}
