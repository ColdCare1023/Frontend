import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Download, FileDown, FileText, FileSearch } from 'lucide-react'

import { useReportesBPA, MAX_DIAS_RANGO_REPORTE, diasDeRango } from '@/application/hooks/useReportesBPA'
import { fechaCorta, fechaISOlocal } from '@/lib/formato'
import { EstadoVacio } from '../components/EstadoPagina'
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
    <div className="max-w-3xl">
      <PageHeader eyebrow={t('nav.seccionCumplimiento')} titulo={t('reportes.titulo')} descripcion={t('reportes.descripcion')} />

      {/* ── Configuración del periodo ───────────────────────── */}
      <Card className="mb-5 animate-rise">
        <CardHeader>
          <CardTitle>{t('reportes.rango')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="grid grid-cols-1 items-end gap-3 min-[480px]:grid-cols-2 lg:grid-cols-4"
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
              />
            </div>
            <div>
              <Label htmlFor="r-device">{t('reportes.dispositivo')}</Label>
              <Input
                id="r-device"
                value={deviceId}
                onChange={(e) => setDeviceId(e.target.value)}
                placeholder="FARM-01-CDL"
              />
            </div>
            <Button type="submit" disabled={generando || rangoInvalido}>
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
                : t('reportes.periodoDias', { dias: dias + 1 })}
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
        <EstadoVacio
          icono={FileSearch}
          titulo={t('reportes.sinReporte')}
          detalle={t('reportes.sinReporteDetalle')}
        />
      ) : (
        <Card className="animate-rise">
          <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>{t('reportes.resumen')}</CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              {/* El PDF es el documento que se presenta en una inspección: lleva
                  el veredicto de integridad de la cadena SHA-256 dentro. CSV y
                  JSON son extracciones de datos, no evidencia firmada. */}
              <Button
                size="sm"
                disabled={descargandoPdf || rangoInvalido}
                onClick={() => void descargarPdf(desde, hasta, deviceId || undefined)}
              >
                <FileDown />
                {descargandoPdf ? t('reportes.generandoPdf') : t('reportes.descargarPdf')}
              </Button>
              <Button variant="secondary" size="sm" onClick={descargarCsv}>
                <Download />
                {t('reportes.descargarCsv')}
              </Button>
              <Button variant="secondary" size="sm" onClick={descargarJson}>
                <Download />
                {t('reportes.descargarJson')}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-3 divide-x divide-border text-center">
              {(
                [
                  ['reportes.lecturas', reporte.lecturas.length],
                  ['reportes.alertas', reporte.alertas.length],
                  ['reportes.registrosTrazabilidad', reporte.registros_trazabilidad.length],
                ] as const
              ).map(([clave, cantidad]) => (
                <div key={clave} className="px-3 py-2">
                  <dt className="text-xs text-muted">{t(clave)}</dt>
                  <dd className="nums mt-1 text-2xl font-semibold tracking-tight">{cantidad}</dd>
                </div>
              ))}
            </dl>
            <p className="nums mt-4 text-center text-xs text-faint">
              {fechaCorta(reporte.fecha_desde)} — {fechaCorta(reporte.fecha_hasta)}
              {reporte.device_id && ` · ${reporte.device_id}`}
            </p>
            <p className="mt-3 border-t border-border pt-3 text-center text-xs leading-relaxed text-muted">
              {t('reportes.notaFormatos')}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
