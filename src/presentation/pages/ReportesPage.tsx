import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CircleAlert, Download, Eye } from 'lucide-react'

import { useReportesBPA, MAX_DIAS_RANGO_REPORTE, diasDeRango, type ReporteBPA } from '@/application/hooks/useReportesBPA'
import { cn } from '@/lib/utils'
import { BarraFiltros, type FiltroActivo } from '../components/ui/barra-filtros'
import { Button } from '../components/ui/button'
import { Detalles } from '../components/ui/detalles'
import { Campo, Input } from '../components/ui/input'
import { SelectorFecha } from '../components/ui/selector-fecha'
import { TituloPagina } from '../components/ui/titulo-pagina'
import { AccionConstancia, type FaseConstancia } from './reportes/AccionConstancia'
import { HojaReporte } from './reportes/HojaReporte'
import { diaLocal, hoyISO, mismoPedido, type PedidoReporte } from './reportes/periodo'
import './reportes/hoja-reporte.css'

type Formato = 'pdf' | 'csv' | 'json'

/** Una descarga que espera a que la hoja esté al día. `base` es la hoja que había al pedirla. */
interface Encargo {
  formato: Formato
  base: ReporteBPA | null
}

export function ReportesPage() {
  const { t } = useTranslation()
  const { reporte, generando, error, descargandoPdf, generar, descargarJson, descargarCsv, descargarPdf } =
    useReportesBPA()

  // El periodo más pedido ya elegido: el último mes, hasta hoy.
  const [desde, setDesde] = useState(hoyISO(-30))
  const [hasta, setHasta] = useState(hoyISO())
  const [deviceId, setDeviceId] = useState('')
  const actual: PedidoReporte = { desde, hasta, equipo: deviceId }
  // Lo último enviado y lo que trajo la hoja que se ve: la hoja no se reescribe sola si luego cambia
  // el periodo, y si una generación falla sigue siendo la del pedido anterior.
  const [enviado, setEnviado] = useState<PedidoReporte | null>(null)
  const [pedido, setPedido] = useState<PedidoReporte | null>(null)
  const [reporteVisto, setReporteVisto] = useState(reporte)
  if (reporte !== reporteVisto) {
    setReporteVisto(reporte)
    setPedido(enviado)
  }

  const [encargo, setEncargo] = useState<Encargo | null>(null)
  // El último PDF que llegó a descargarse: el botón se vuelve su resultado mientras el periodo sea ese.
  const [pdfDescargado, setPdfDescargado] = useState<PedidoReporte | null>(null)
  if (error && pdfDescargado) setPdfDescargado(null)

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

  const hojaDesactualizada = reporte !== null && pedido !== null && !mismoPedido(pedido, actual)
  const hojaAlDia = reporte !== null && !hojaDesactualizada

  const generarReporte = () => {
    if (rangoInvalido) return
    setEnviado(actual)
    void generar(desde, hasta, deviceId || undefined)
  }

  const bajarPdf = async () => {
    const solicitado = actual
    setPdfDescargado(null)
    await descargarPdf(desde, hasta, deviceId || undefined)
    setPdfDescargado(solicitado)
  }

  const entregar = (formato: Formato) => {
    if (formato === 'pdf') void bajarPdf()
    else if (formato === 'csv') descargarCsv()
    else descargarJson()
  }

  // Un solo gesto: si la hoja no está al día, primero se llena y después se descarga lo pedido.
  const pedir = (formato: Formato) => {
    if (rangoInvalido) return
    if (hojaAlDia) {
      entregar(formato)
      return
    }
    setEncargo({ formato, base: reporte })
    generarReporte()
  }

  // La entrega usa las descargas del hook con la hoja recién llegada: se lee siempre la última.
  const entregarConLoUltimo = useRef(entregar)
  useLayoutEffect(() => {
    entregarConLoUltimo.current = entregar
  })
  useEffect(() => {
    if (!encargo || generando) return
    // La hoja no se pudo llenar: no se descarga nada, el aviso de error ya está a la vista.
    if (error) {
      setEncargo(null)
      return
    }
    if (reporte === encargo.base) return
    setEncargo(null)
    entregarConLoUltimo.current(encargo.formato)
  }, [encargo, generando, error, reporte])

  const fase: FaseConstancia = descargandoPdf
    ? 'descargando'
    : generando || encargo
      ? 'preparando'
      : mismoPedido(pdfDescargado, actual) && !error
        ? 'listo'
        : 'reposo'
  const ocupado = fase === 'preparando' || fase === 'descargando'
  const activos: FiltroActivo[] = deviceId
    ? [{ id: 'equipo', etiqueta: deviceId, onQuitar: () => setDeviceId('') }]
    : []

  return (
    <div className="reportes">
      {/* ── La constancia y el gesto que la entrega ──────────────────────── */}
      <div className="reportes__accion">
        <TituloPagina
          antetitulo={t('nav.seccionCumplimiento')}
          descripcion={t('reportes.descripcion')}
          className="mb-4 sm:mb-5"
          titulo={
            <>
              <span className="sr-only">{`${t('reportes.titulo')}:`}</span>{' '}
              <span className="reportes__titulo">{t('reportes.constancia')}</span>
            </>
          }
        />

        <h2 id="reportes-rango-titulo" className="sr-only">{t('reportes.rango')}</h2>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <p
            id="reportes-periodo"
            role={errorPeriodo ? 'alert' : 'status'}
            className={cn('nums text-[15px] leading-6', errorPeriodo ? 'font-medium text-critical' : 'text-foreground')}
          >
            {errorPeriodo ??
              (periodoCompleto
                ? t('reportes.periodoDias', { count: dias + 1, desde: diaLocal(desde), hasta: diaLocal(hasta) })
                : null)}
          </p>
          <BarraFiltros titulo={t('reportes.periodoYEquipo')} activos={activos} onLimpiar={() => setDeviceId('')}>
            <form
              aria-labelledby="reportes-rango-titulo"
              className="contents"
              onSubmit={(e) => {
                e.preventDefault()
                generarReporte()
              }}
            >
              <Campo etiqueta={t('reportes.desde')} htmlFor="r-desde">
                <SelectorFecha
                  id="r-desde"
                  valor={desde}
                  onCambiar={setDesde}
                  invalido={!desde || errorPeriodo !== null}
                  aria-describedby="reportes-periodo"
                />
              </Campo>
              <Campo etiqueta={t('reportes.hasta')} htmlFor="r-hasta">
                <SelectorFecha
                  id="r-hasta"
                  valor={hasta}
                  onCambiar={setHasta}
                  invalido={!hasta || errorPeriodo !== null}
                  aria-describedby="reportes-periodo"
                />
              </Campo>
              {/* En la hoja inferior el aviso de la barra queda tapado: aquí se repite a la vista. */}
              {errorPeriodo && <p aria-hidden className="text-[13px] leading-5 text-critical sm:col-span-2">{errorPeriodo}</p>}
              <Campo etiqueta={t('reportes.dispositivo')} htmlFor="r-device" className="sm:col-span-2">
                <Input
                  id="r-device"
                  value={deviceId}
                  onChange={(e) => setDeviceId(e.target.value)}
                  placeholder={t('reportes.codigoEquipoEjemplo')}
                />
              </Campo>
              {/* Enter en un campo llena la hoja, sin descargar nada. */}
              <button type="submit" aria-hidden tabIndex={-1} className="sr-only" />
            </form>
          </BarraFiltros>
        </div>

        <div className="mt-5 flex flex-col items-stretch gap-3 sm:items-start">
          <AccionConstancia
            fase={fase}
            deshabilitado={rangoInvalido || ocupado}
            archivo={`reporte-bpa-${desde}-${hasta}.pdf`}
            onDescargar={() => pedir('pdf')}
          />
          {hojaDesactualizada && fase !== 'preparando' && (
            <p role="status" className="max-w-[46ch] text-[13.5px] leading-5 font-medium text-honey-700">
              {t('reportes.periodoCambiado')}
            </p>
          )}
          {mensajeError && (
            <p role="alert" className="flex max-w-[52ch] items-start gap-2.5 rounded-(--radius-card) border border-critical/30 bg-surface px-4 py-3 text-[13px] leading-5 font-medium text-critical">
              <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
              {mensajeError}
            </p>
          )}
          <p className="max-w-[46ch] text-[13px] leading-5 text-muted">{t('reportes.vista.pie')}</p>
        </div>

        {/* ── Lo de segundo plano: ver sin descargar, CSV y JSON ─────────────── */}
        <Detalles
          className="reportes__otros"
          titulo={<span className="text-[15px] font-semibold text-foreground">{t('reportes.otrosFormatos')}</span>}
        >
          {/* Los tres formatos que exige RF-13. El reporte es apoyo para
              revisión: no reemplaza registros ni documentos oficiales. */}
          <div className="grid gap-2 pb-1 min-[400px]:grid-cols-2">
            <Button variant="secondary" disabled={rangoInvalido || ocupado} cargando={encargo?.formato === 'csv'} onClick={() => pedir('csv')}>
              {encargo?.formato !== 'csv' && <Download />}
              {t('reportes.descargarCsv')}
            </Button>
            <Button variant="secondary" disabled={rangoInvalido || ocupado} cargando={encargo?.formato === 'json'} onClick={() => pedir('json')}>
              {encargo?.formato !== 'json' && <Download />}
              {t('reportes.descargarJson')}
            </Button>
            <Button
              variant="ghost"
              className="min-[400px]:col-span-2 min-[400px]:justify-start"
              disabled={rangoInvalido || ocupado}
              onClick={generarReporte}
            >
              <Eye />
              {hojaAlDia ? t('reportes.actualizarHoja') : t('reportes.verEnPantalla')}
            </Button>
          </div>
          <div className="space-y-2 pt-2 pb-2 text-xs leading-5 text-muted">
            <p>{t('reportes.notaFormatos')}</p>
            <p>{t('reportes.notaPdf')}</p>
          </div>
        </Detalles>
      </div>

      {/* ── La hoja: la protagonista ───────────────────────────────────────── */}
      <div className="reportes__hoja">
        <HojaReporte reporte={reporte} desde={desde} hasta={hasta} equipo={deviceId} generando={generando} />
      </div>
    </div>
  )
}
