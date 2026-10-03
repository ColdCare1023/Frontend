import { CompactWorkspace } from '../components/CompactWorkspace'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Bell, ClipboardList, Download, FileDown, FileSearch, FileText, Link2 } from 'lucide-react'

import { useReportesBPA, MAX_DIAS_RANGO_REPORTE, diasDeRango } from '@/application/hooks/useReportesBPA'
import { fechaCorta, fechaISOlocal } from '@/lib/formato'
import { PageHeader } from '../components/PageHeader'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Input, Label } from '../components/ui/input'

function hoyISO(desplazamientoDias = 0): string {
  const fecha = new Date()
  fecha.setDate(fecha.getDate() + desplazamientoDias)
  return fechaISOlocal(fecha)
}

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
  // un intento en una petición que se sabe inválida.
  const dias = diasDeRango(desde, hasta)
  const rangoInvalido = dias < 0 || dias > MAX_DIAS_RANGO_REPORTE
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

      <div className="space-y-4">
      {/* ── Configuración del periodo ───────────────────────── */}
      <Card className="rounded-lg border-border bg-surface shadow-none">
        <CardHeader className="px-4 pt-4 pb-0">
          <CardTitle>{t('reportes.rango')}</CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <form
            className="grid grid-cols-2 items-end gap-3 xl:grid-cols-[1fr_1fr_1.2fr_auto]"
            onSubmit={(e) => {
              e.preventDefault()
              void generar(desde, hasta, deviceId || undefined)
            }}
          >
            <div>
              <Label htmlFor="r-desde">{t('reportes.desde')}</Label>
              <Input
                id="r-desde"
                type="date"
                required
                value={desde}
                onChange={(e) => setDesde(e.target.value)}
                aria-describedby="reportes-periodo"
                aria-invalid={rangoInvalido}
                max={hasta || undefined}
              />
            </div>
            <div>
              <Label htmlFor="r-hasta">{t('reportes.hasta')}</Label>
              <Input
                id="r-hasta"
                type="date"
                required
                min={desde}
                value={hasta}
                onChange={(e) => setHasta(e.target.value)}
                aria-describedby="reportes-periodo"
                aria-invalid={rangoInvalido}
              />
            </div>
            <div>
              <Label htmlFor="r-device">{t('reportes.dispositivo')}</Label>
              <Input
                id="r-device"
                value={deviceId}
                onChange={(e) => setDeviceId(e.target.value)}
                placeholder={t('reportes.codigoEquipoEjemplo')}
              />
            </div>
            <Button type="submit" className="w-full xl:min-w-40" disabled={generando || rangoInvalido}>
              <FileText />
              {generando ? t('reportes.generando') : t('reportes.generar')}
            </Button>
          </form>

          <p
            id="reportes-periodo"
            role={rangoInvalido ? 'alert' : 'status'}
            className={`mt-3 text-xs ${rangoInvalido ? 'text-clay-700' : 'text-faint'}`}
          >
            {dias < 0
              ? t('reportes.errorRangoInvertido')
              : dias > MAX_DIAS_RANGO_REPORTE
                ? t('reportes.errorPeriodoExcesivo', { max: MAX_DIAS_RANGO_REPORTE })
                : t('reportes.periodoDias', { count: dias + 1 })}
          </p>

          {mensajeError && (
            <p
              role="alert"
              className="mt-3 rounded-(--radius-field) bg-clay-100 px-3 py-2 text-[13px] text-clay-700"
            >
              {mensajeError}
            </p>
          )}
        </CardContent>
      </Card>

      {/* ── Resumen ─────────────────────────────────────────── */}
      {reporte === null ? (
        <Card className="rounded-xl border-border bg-surface shadow-none">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-tint text-primary">
                <FileSearch className="size-5" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">{t('reportes.sinReporte')}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted">{t('reportes.sinReporteDetalle')}</p>
              </div>
            </div>

            <div className="mt-4 grid divide-y divide-border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
              {([
                [ClipboardList, 'reportes.incluyeLecturas'],
                [Bell, 'reportes.incluyeAlertas'],
                [Link2, 'reportes.incluyeTrazabilidad'],
              ] as const).map(([Icono, clave]) => (
                <div key={clave} className="flex min-h-12 items-center gap-2.5 py-2.5 sm:px-3 sm:py-2 first:sm:pl-0 last:sm:pr-0">
                  <Icono className="size-4 shrink-0 text-primary" aria-hidden />
                  <span className="text-xs font-medium text-foreground">{t(clave)}</span>
                </div>
              ))}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
              <span className="mr-1 text-xs text-muted">{t('reportes.formatosDisponibles')}</span>
              {['PDF', 'CSV', 'JSON'].map((formato) => (
                <span key={formato} className="rounded-full bg-background px-2.5 py-1 text-[11px] font-semibold tracking-wide text-ink-700">{formato}</span>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden rounded-lg border-border shadow-none">
          <CardHeader className="gap-5 border-b border-border bg-background/60 pb-5">
            <CardTitle>{t('reportes.resumen')}</CardTitle>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
              {/* El reporte es apoyo para revisión; el copy aclara que no reemplaza
                  registros ni documentos oficiales. */}
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
          </CardHeader>
          <CardContent className="pt-6">
            <dl className="grid grid-cols-2 gap-2 text-left sm:grid-cols-3 sm:gap-4">
              {(
                [
                  ['reportes.lecturas', reporte.lecturas.length],
                  ['reportes.alertas', reporte.alertas.length],
                  ['reportes.registrosTrazabilidad', reporte.registros_trazabilidad.length],
                ] as const
              ).map(([clave, cantidad]) => (
                <div key={clave} className="flex min-w-0 flex-col gap-2 rounded-lg bg-background p-3 sm:rounded-none sm:bg-transparent sm:p-0 sm:py-2 [&:last-child]:col-span-2 sm:[&:last-child]:col-span-1">
                  <dt className="text-xs text-muted">{t(clave)}</dt>
                  <dd className="nums text-2xl font-semibold tracking-tight">{cantidad}</dd>
                </div>
              ))}
            </dl>
            <p className="nums mt-5 break-words border-t border-border pt-5 text-xs text-faint">
              {fechaCorta(reporte.fecha_desde)} — {fechaCorta(reporte.fecha_hasta)}
              {reporte.device_id && ` · ${reporte.device_id}`}
            </p>
            <p className="mt-3 text-xs leading-relaxed text-muted">
              {t('reportes.notaFormatos')}
            </p>
          </CardContent>
        </Card>
      )}
      </div>
    </CompactWorkspace>
  )
}
