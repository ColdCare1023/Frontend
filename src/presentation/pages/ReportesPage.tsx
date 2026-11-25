import { SeccionDetalle } from '@/presentation/components/ui/seccion-detalle'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useReportesBPA, MAX_DIAS_RANGO_REPORTE, diasDeRango } from '@/application/hooks/useReportesBPA'
import { MODO_DEMO } from '@/infrastructure/demo/modoDemo'
import { fechaCorta } from '@/lib/formato'
import { PageHeader } from '../components/PageHeader'
import { FormularioPeriodo } from './reportes/FormularioPeriodo'
import { QueIncluye } from './reportes/QueIncluye'
import { ResumenReporte } from './reportes/ResumenReporte'
import { atajoDe, periodoDeAtajo } from './reportes/formatoReporte'

/**
 * Reportes BPA (RF-13, HU-38), Plantilla Documento: periodo a la izquierda
 * (5/12) y resultado a la derecha (7/12). Solo en modo demo se genera al
 * entrar una vista previa de los últimos 7 días. Con backend real no: cada
 * llamada a /api/reportes/bpa registra una exportación EXPORTAR_REPORTE_BPA en
 * la auditoría y en la cadena de hashes y consume la cuota de 10/min, así que
 * generar sigue siendo una acción explícita del usuario.
 */
export function ReportesPage() {
  const { t } = useTranslation()
  const {
    reporte,
    generando,
    error,
    descargandoPdf,
    periodo,
    origen = null,
    generacion = 0,
    generar,
    reintentar,
    descargarJson,
    descargarCsv,
    descargarPdf,
  } = useReportesBPA()

  const inicial = periodoDeAtajo('dias7')
  const [desde, setDesde] = useState(inicial.desde)
  const [hasta, setHasta] = useState(inicial.hasta)
  const [deviceId, setDeviceId] = useState('')
  const [autoPendiente, setAutoPendiente] = useState(MODO_DEMO)
  const autoLanzada = useRef(false)
  const formulario = useRef<HTMLFormElement>(null)

  // Vista previa automática solo en demo, una sola vez (el ref protege del
  // doble efecto de StrictMode). Fuera de demo dejaría una exportación BPA
  // en la auditoría que el usuario nunca pidió.
  useEffect(() => {
    if (!MODO_DEMO || autoLanzada.current) return
    autoLanzada.current = true
    void Promise.resolve(generar(inicial.desde, inicial.hasta, undefined, { origen: 'auto' })).finally(() =>
      setAutoPendiente(false),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // El periodo se mide antes de enviar nada: el backend rechaza con 400 los
  // rangos invertidos y los de más de 366 días, y el endpoint tiene cuota
  // propia (10/min por usuario). Las dos fechas son obligatorias.
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
  // Rango inválido devuelto por el hook: va en la línea del periodo, no en la columna.
  const errorRangoApi =
    error === 'rango_invertido'
      ? t('reportes.errorRangoInvertido')
      : error === 'periodo_excesivo'
        ? t('reportes.errorPeriodoExcesivo', { max: MAX_DIAS_RANGO_REPORTE })
        : null
  const mensajeError =
    error === null || errorRangoApi ? null : error === 'cuota' ? t('reportes.errorCuota') : t('reportes.errorGenerar')
  const lineaPeriodo = errorPeriodo ?? errorRangoApi ?? (periodoCompleto ? t('reportes.periodoDias', { count: dias + 1 }) : null)

  const enviar = () => void generar(desde, hasta, deviceId.trim() || undefined)
  const editado =
    reporte && periodo && (periodo.desde !== desde || periodo.hasta !== hasta || (periodo.deviceId ?? '') !== deviceId.trim())
  const textoPeriodo = periodo
    ? `${fechaCorta(`${periodo.desde}T12:00:00`)} – ${fechaCorta(`${periodo.hasta}T12:00:00`)}`
    : ''
  const usar30 = () => {
    const p = periodoDeAtajo('dias30')
    setDesde(p.desde)
    setHasta(p.hasta)
    void generar(p.desde, p.hasta, deviceId.trim() || undefined)
  }

  return (
    <div>
      <PageHeader titulo={t('reportes.titulo')} descripcion={t('reportes.descripcion')} />
      <div className="grid items-start gap-3 lg:grid-cols-12 xl:gap-4">
        <div className="min-w-0 space-y-3 lg:col-span-5 xl:space-y-4">
          <FormularioPeriodo
            ref={formulario}
            desde={desde}
            hasta={hasta}
            deviceId={deviceId}
            onDesde={setDesde}
            onHasta={setHasta}
            onDeviceId={setDeviceId}
            generando={generando}
            rangoInvalido={rangoInvalido}
            lineaPeriodo={lineaPeriodo}
            errorPeriodo={errorPeriodo !== null || errorRangoApi !== null}
            plegable={reporte !== null}
            onGenerar={enviar}
          />
          <SeccionDetalle titulo={t('reportes.queIncluye')}>
            <QueIncluye />
          </SeccionDetalle>
        </div>
        <ResumenReporte
          className="min-w-0 lg:col-span-7"
          reporte={reporte}
          cargando={generando || (autoPendiente && reporte === null && error === null)}
          mensajeError={mensajeError}
          origen={origen}
          generacion={generacion}
          desactualizada={editado ? t('reportes.vistaDesactualizada', { periodo: textoPeriodo }) : null}
          descargandoPdf={descargandoPdf}
          onPdf={() => void (periodo ? descargarPdf() : descargarPdf(desde, hasta, deviceId.trim() || undefined))}
          onCsv={descargarCsv}
          onJson={descargarJson}
          onReintentar={() => (reintentar ? reintentar() : enviar())}
          onGenerar={() => formulario.current?.requestSubmit()}
          onUsar30={atajoDe(desde, hasta) === 'dias30' ? undefined : usar30}
        />
      </div>
      {reporte && (
        <p role="status" className="sr-only">
          {t('reportes.generadoAnuncio', {
            lecturas: reporte.lecturas.length,
            alertas: reporte.alertas.length,
            registros: reporte.registros_trazabilidad.length,
          })}
        </p>
      )}
    </div>
  )
}
