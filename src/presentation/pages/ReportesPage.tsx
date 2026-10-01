import { CompactWorkspace } from '../components/CompactWorkspace'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Download, FileDown, FileText, FileSearch } from 'lucide-react'

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
        <Card className="rounded-none border-0 border-b border-border bg-transparent shadow-none">
          <CardContent className="flex items-start gap-3 px-0 py-4 text-left">
            <span className="flex size-8 shrink-0 items-center justify-center text-muted"><FileSearch className="size-4" aria-hidden /></span>
            <div>
              <p className="text-sm font-semibold text-foreground">{t('reportes.sinReporte')}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-muted">{t('reportes.sinReporteDetalle')}</p>
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
            <dl className="grid grid-cols-3 gap-4 text-left">
              {(
                [
                  ['reportes.lecturas', reporte.lecturas.length],
                  ['reportes.alertas', reporte.alertas.length],
                  ['reportes.registrosTrazabilidad', reporte.registros_trazabilidad.length],
                ] as const
              ).map(([clave, cantidad]) => (
                <div key={clave} className="flex flex-col gap-2 py-2">
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
