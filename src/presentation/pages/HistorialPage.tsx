import { CompactWorkspace } from '../components/CompactWorkspace'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { EChartsCoreOption } from 'echarts/core'
import { DoorClosed, DoorOpen, FilterX, ShieldQuestion, SlidersHorizontal } from 'lucide-react'

import { useHistorial, type FiltrosHistorial } from '@/application/hooks/useHistorial'
import type { LecturaTermica } from '@/domain/entities/LecturaTermica'
import { obtenerEvidenciaInferencia, type EvidenciaInferencia } from '@/application/hooks/useEvidenciaInferencia'
import { NIVELES_RIESGO, RANGO_TERMICO } from '@/domain/value-objects/NivelRiesgo'
import { EChartWrapper } from '@/infrastructure/charts/EChartWrapper'
import { temaGrafica } from '@/infrastructure/charts/temaColdCare'
import { fechaHora, hora as formatearHora } from '@/lib/formato'
import { rangoPagina } from '@/lib/paginacion'
import { Paginacion } from '../components/Paginacion'
import { EstadoError } from '../components/EstadoPagina'
import { PageHeader } from '../components/PageHeader'
import { RiskBadge } from '../components/RiskBadge'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Input, Label, NativeSelect } from '../components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table'

const FILTROS_INICIALES: FiltrosHistorial = {}

// HU-36 criterio 1: la misma consulta filtrada alimenta tanto la gráfica de
// ECharts como la tabla, no solo la tabla.
function construirOpcionHistorial(serie: LecturaTermica[], etiquetas: {
  interna: string
  ambiental: string
  rangoEsperado: string
}): EChartsCoreOption {
  const horas = serie.map((l) => l.timestamp)
  const colores = temaGrafica()
  return {
    textStyle: { fontFamily: 'Inter Variable, sans-serif', color: colores.muted },
    grid: { left: 44, right: 40, top: 32, bottom: 28 },
    tooltip: {
      confine: true,
      trigger: 'axis',
      axisPointer: { label: { formatter: ({ value }: { value: string | number }) => fechaHora(String(value)) } },
      backgroundColor: colores.surface,
      borderColor: colores.border,
      textStyle: { color: colores.foreground, fontSize: 12, fontFamily: 'Inter Variable, sans-serif' },
      valueFormatter: (v: unknown) => (typeof v === 'number' ? `${v.toFixed(1)} °C` : '—'),
    },
    legend: {
      selected: { [etiquetas.ambiental]: false },
      top: 0,
      right: 0,
      icon: 'roundRect',
      itemWidth: 14,
      itemHeight: 3,
      formatter: etiquetaCortaTemperatura,
      textStyle: { color: colores.muted, fontSize: 12, fontFamily: 'Inter Variable, sans-serif' },
    },
    xAxis: {
      type: 'category',
      data: horas,
      boundaryGap: false,
      axisLine: { lineStyle: { color: colores.border } },
      axisTick: { show: false },
      axisLabel: { formatter: (value: string) => formatearHora(value), fontSize: 11, color: colores.muted },
    },
    yAxis: {
      type: 'value',
      min: (value: { min: number }) => Math.floor(Math.min(value.min, 0)),
      max: (value: { max: number }) => Math.ceil(Math.max(value.max, 10)),
      splitLine: { lineStyle: { color: colores.grid } },
      axisLabel: { fontSize: 11, color: colores.muted, formatter: '{value} °C' },
    },
    series: [
      {
        name: etiquetas.interna,
        type: 'line',
        smooth: false,
        symbol: 'none',
        sampling: 'lttb',
        large: true,
        data: serie.map((l) => l.temperatura_interna),
        lineStyle: { width: 2.5, color: colores.primary },
        itemStyle: { color: colores.primary },
        areaStyle: { color: colores.primary, opacity: 0.08 },
        markArea: {
          silent: true,
          itemStyle: { color: colores.primary, opacity: 0.06 },
          label: { show: true, position: 'insideTop', color: colores.primary, fontSize: 10, formatter: etiquetas.rangoEsperado },
          data: [[{ yAxis: RANGO_TERMICO.minimo }, { yAxis: RANGO_TERMICO.maximo }]],
        },
        markLine: {
          silent: true,
          symbol: 'none',
          lineStyle: { color: colores.critical, type: 'dashed', width: 1 },
          label: { color: colores.critical, fontSize: 10, formatter: '{c} °C' },
          data: [{ yAxis: RANGO_TERMICO.minimo }, { yAxis: RANGO_TERMICO.maximo }],
        },
        markPoint: {
          symbol: 'circle',
          symbolSize: 14,
          itemStyle: { color: colores.critical, borderColor: colores.surface, borderWidth: 2 },
          label: { show: true, formatter: '!', color: colores.surface, fontWeight: 700, fontSize: 10 },
          data: serie.flatMap((lectura, indice) => lectura.excursion_confirmada && lectura.temperatura_interna != null
            ? [{ coord: [horas[indice], lectura.temperatura_interna], name: 'Excursión confirmada' }]
            : []),
        },
      },
      {
        name: etiquetas.ambiental,
        type: 'line',
        smooth: false,
        symbol: 'none',
        sampling: 'lttb',
        large: true,
        data: serie.map((l) => l.temperatura_ambiental),
        lineStyle: { width: 1.5, color: colores.secondary, type: 'dashed' },
        itemStyle: { color: colores.secondary },
      },
    ],
  }
}

function etiquetaCortaTemperatura(nombre: string): string {
  return nombre
    .replace(/^temperatura\s+/i, '')
    .replace(/\s+temperature$/i, '')
}

export function HistorialPage() {
  const { t } = useTranslation()
  const { lecturas, cargando, errorCarga, consultar } = useHistorial()
  const [pagina, setPagina] = useState(1)
  // La lista completa puede tener miles de filas; solo se pinta la página
  // visible. Al cambiar la lista (filtro nuevo) se vuelve a la primera.
  const visibles = useMemo(
    () => lecturas.slice(...rangoPagina(pagina)),
    [lecturas, pagina],
  )
  const [filtros, setFiltros] = useState<FiltrosHistorial>(FILTROS_INICIALES)
  // HU-36 criterio 3: el rango inválido se bloquea en el FRONTEND antes de
  // consultar — la validación del backend (422) sigue existiendo para una
  // llamada directa a la API, pero no es la única barrera.
  const [errorRango, setErrorRango] = useState<string | null>(null)
  const [lecturaDetalle, setLecturaDetalle] = useState<string | null>(null)
  const [evidencia, setEvidencia] = useState<EvidenciaInferencia | null>(null)
  const [cargandoEvidencia, setCargandoEvidencia] = useState(false)
  const [errorEvidencia, setErrorEvidencia] = useState(false)

  const abrirEvidencia = async (lectura: LecturaTermica) => {
    if (!lectura.id) return
    setLecturaDetalle(lectura.id)
    setEvidencia(null)
    setErrorEvidencia(false)
    setCargandoEvidencia(true)
    try {
      setEvidencia(await obtenerEvidenciaInferencia(lectura.id))
    } catch {
      setErrorEvidencia(true)
    } finally {
      setCargandoEvidencia(false)
    }
  }

  const actualizarFiltro = (campo: keyof FiltrosHistorial, valor: string) => {
    setFiltros((previos) => ({ ...previos, [campo]: valor || undefined }))
  }

  const limpiar = () => {
    setFiltros(FILTROS_INICIALES)
    setErrorRango(null)
    void consultar(FILTROS_INICIALES)
  }

  const aplicarFiltros = () => {
    if (filtros.desde && filtros.hasta && new Date(filtros.desde) > new Date(filtros.hasta)) {
      setErrorRango(t('historial.rangoInvalido'))
      return
    }
    setErrorRango(null)
    void consultar(filtros)
  }

  // HU-36 criterio 1: la gráfica necesita orden cronológico ascendente; el
  // backend devuelve el historial en orden descendente (más reciente primero).
  const serieGrafica = useMemo(() => [...lecturas].reverse(), [lecturas])
  const opcionHistorial = useMemo(
    () =>
      construirOpcionHistorial(serieGrafica, {
        interna: t('dashboard.tempInterna'),
        ambiental: t('dashboard.tempAmbiental'),
        rangoEsperado: t('dashboard.rangoEsperadoCorto'),
      }),
    [serieGrafica, t],
  )

  return (
    <CompactWorkspace>
      <PageHeader eyebrow={t('nav.seccionOperacion')} titulo={t('historial.titulo')} descripcion={t('historial.descripcion')} />

      {errorCarga && (
        <div className="mb-4">
          <EstadoError mensaje={t('historial.errorCargar')}>
            <Button variant="secondary" size="sm" className="mt-3" onClick={() => void consultar(filtros)}>
              {t('comunes.reintentar')}
            </Button>
          </EstadoError>
        </div>
      )}

      {/* ── Filtros ─────────────────────────────────────────── */}
      <Card className="mb-4 rounded-lg border border-border bg-surface shadow-none">
        <CardContent className="p-4">
          <p
            id="titulo-filtros-historial"
            className="mb-3 flex items-center gap-2 text-xs font-medium text-muted"
          >
            <SlidersHorizontal className="size-3.5" aria-hidden />
            {t('historial.filtros')}
          </p>
          <form
            aria-labelledby="titulo-filtros-historial"
            className="grid grid-cols-2 items-end gap-3 xl:grid-cols-[1fr_1fr_1.2fr_1.2fr_auto]"
            onSubmit={(e) => {
              e.preventDefault()
              aplicarFiltros()
            }}
          >
            <div>
              <Label htmlFor="f-device">{t('historial.codigoEquipo')}</Label>
              <Input
                id="f-device"
                value={filtros.device_id ?? ''}
                onChange={(e) => actualizarFiltro('device_id', e.target.value)}
                placeholder={t('historial.codigoEquipoEjemplo')}
              />
            </div>
            <div>
              <Label htmlFor="f-riesgo">{t('historial.nivelRiesgo')}</Label>
              <NativeSelect
                id="f-riesgo"
                value={filtros.nivel_riesgo ?? ''}
                onChange={(e) => actualizarFiltro('nivel_riesgo', e.target.value)}
              >
                <option value="">{t('historial.todosNiveles')}</option>
                {NIVELES_RIESGO.map((nivel) => (
                  <option key={nivel} value={nivel}>
                    {t(`riesgo.${nivel}`)}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div>
              <Label htmlFor="f-desde">{t('historial.desde')}</Label>
              <Input
                id="f-desde"
                type="datetime-local"
                value={filtros.desde ?? ''}
                onChange={(e) => actualizarFiltro('desde', e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="f-hasta">{t('historial.hasta')}</Label>
              <Input
                id="f-hasta"
                type="datetime-local"
                value={filtros.hasta ?? ''}
                onChange={(e) => actualizarFiltro('hasta', e.target.value)}
              />
            </div>
            <div className="flex gap-2 col-span-2 xl:col-span-1">
              <Button type="submit" className="flex-1">
                {t('historial.aplicar')}
              </Button>
              <Button variant="ghost" onClick={limpiar} aria-label={t('historial.limpiar')}>
                <FilterX />
              </Button>
            </div>
          </form>
          {errorRango && (
            <p role="alert" className="mt-3 rounded-(--radius-field) bg-clay-100 px-3 py-2 text-[13px] text-clay-700">
              {errorRango}
            </p>
          )}
        </CardContent>
      </Card>

      {/* ── HU-36 criterio 1: la misma consulta alimenta la gráfica ──── */}
      {lecturas.length > 0 && (
        <Card className="mb-4 rounded-lg border border-border bg-surface shadow-none" style={{ animationDelay: '30ms' }}>
          <CardHeader className="px-4 py-3">
            <CardTitle>{t('dashboard.curvaTermica')}</CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3" aria-busy={cargando || undefined}>
            <EChartWrapper
              option={opcionHistorial}
              height="200px"
              ariaLabel={t('dashboard.graficaEtiqueta', { n: serieGrafica.length })}
              ariaDescribedBy="historial-datos-tabla"
            />
          </CardContent>
        </Card>
      )}

      {/* ── Tabla ───────────────────────────────────────────── */}
      <div id="historial-datos-tabla" className="animate-rise [&_thead]:bg-cream-100 " style={{ animationDelay: '60ms' }}>
        <Table className="table-fixed min-w-[1040px]" titulo={t('historial.titulo')} cargando={cargando}>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[17%] text-center">{t('historial.fecha')}</TableHead>
              <TableHead className="w-[15%] text-center">{t('historial.codigoEquipo')}</TableHead>
              <TableHead className="w-[13%] text-center">{t('historial.tempInterna')}</TableHead>
              <TableHead className="w-[14%] text-center">{t('historial.tempAmbiental')}</TableHead>
              <TableHead className="w-[10%] text-center">{t('historial.humedad')}</TableHead>
              <TableHead className="w-[8%] text-center">{t('historial.puerta')}</TableHead>
              <TableHead className="w-[11%] text-center">{t('historial.riesgo')}</TableHead>
              <TableHead className="w-[12%] text-center">{t('historial.evidenciaModelo')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {errorCarga ? (
              <TableEmpty colSpan={8}>{t('historial.errorTabla')}</TableEmpty>
            ) : cargando ? (
              <TableEmpty colSpan={8}>{t('historial.cargando')}</TableEmpty>
            ) : lecturas.length === 0 ? (
              <TableEmpty colSpan={8}>{t('historial.sinResultados')}</TableEmpty>
            ) : (
              visibles.map((lectura) => (
                <TableRow key={lectura.id}>
                  <TableCell className="nums whitespace-nowrap text-center text-[13px]">
                    {fechaHora(lectura.timestamp)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-center text-[13px]">{lectura.device_id}</TableCell>
                  <TableCell className="nums text-center font-medium">
                    {lectura.temperatura_interna?.toFixed(1) ?? '—'} °C
                  </TableCell>
                  <TableCell className="nums text-center text-muted">
                    {lectura.temperatura_ambiental?.toFixed(1) ?? '—'} °C
                  </TableCell>
                  <TableCell className="nums text-center text-muted">
                    {lectura.humedad_ambiental?.toFixed(0) ?? '—'} %
                  </TableCell>
                  <TableCell className="text-center">
                    {/* HU-35 criterio 4: si el dato de puerta no está disponible, null no es
                        "cerrada" — se marca aparte para no fingir un dato. */}
                    <span className="inline-flex w-full justify-center">
                    {lectura.apertura_refrigerador === null ? (
                      <ShieldQuestion role="img" className="size-4 text-faint" aria-label={t('dashboard.puertaSinSensor')} />
                    ) : lectura.apertura_refrigerador ? (
                      <DoorOpen role="img" className="size-4 text-honey-600" aria-label={t('dashboard.puertaAbierta')} />
                    ) : (
                      <DoorClosed role="img" className="size-4 text-faint" aria-label={t('dashboard.puertaCerrada')} />
                    )}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    {/* HU-34: el historial también debe mostrar el riesgo
                        EFECTIVO, no la clase cruda de la IA. */}
                    <RiskBadge nivel={lectura.riesgo_efectivo} />
                  </TableCell>
                  <TableCell className="text-center">
                    <Button variant="secondary" size="sm" disabled={!lectura.id} onClick={() => void abrirEvidencia(lectura)}>
                      {t('historial.verEvidencia')}
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        {!errorCarga && <Paginacion total={lecturas.length} pagina={pagina} onCambiar={setPagina} />}
      </div>

      <Dialog open={lecturaDetalle !== null} onOpenChange={(abierto) => !abierto && setLecturaDetalle(null)}>
        <DialogContent>
          <DialogTitle>{t('historial.evidenciaTitulo')}</DialogTitle>
          <DialogDescription className="break-all">{t('historial.idLectura')}: {lecturaDetalle}</DialogDescription>
          {cargandoEvidencia ? (
            <p role="status" className="mt-4 text-sm text-muted">{t('app.cargando')}</p>
          ) : errorEvidencia ? (
            <p role="alert" className="mt-4 rounded-lg bg-[#FFF2F6] px-3 py-2 text-sm text-[#7B2342]">{t('historial.evidenciaNoDisponible')}</p>
          ) : evidencia && (
            <div className="mt-4 space-y-4">
              {evidencia.datos_simulados && <p className="rounded-lg border border-[#F3BED0] bg-[#FFF2F6] px-3 py-2 text-xs leading-relaxed text-[#70213D]">{t('historial.evidenciaDemo')}</p>}
              <dl className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg bg-[#F4F7FB] p-3"><dt className="text-xs text-muted">{t('historial.claseModelo')}</dt><dd className="mt-1 text-sm font-semibold">{evidencia.model_class ? t(`riesgo.${evidencia.model_class}`) : t('historial.sinInferencia')}</dd></div>
                <div className="rounded-lg bg-[#F4F7FB] p-3"><dt className="text-xs text-muted">{t('historial.riesgoEfectivo')}</dt><dd className="mt-1 text-sm font-semibold">{evidencia.effective_risk ? t(`riesgo.${evidencia.effective_risk}`) : '—'}</dd></div>
                <div className="rounded-lg bg-[#F4F7FB] p-3"><dt className="text-xs text-muted">{t('historial.versionModelo')}</dt><dd className="nums mt-1 text-sm font-semibold">{evidencia.model_version ?? '—'}</dd></div>
                <div className="rounded-lg bg-[#F4F7FB] p-3"><dt className="text-xs text-muted">{t('historial.estadoInferencia')}</dt><dd className="mt-1 text-sm font-semibold">{evidencia.inference_status ? t(`historial.inferencia.${evidencia.inference_status}`) : '—'}</dd></div>
                <div className="rounded-lg bg-[#F4F7FB] p-3"><dt className="text-xs text-muted">{t('historial.fechaInferencia')}</dt><dd className="nums mt-1 text-sm font-semibold">{evidencia.inference_at ? fechaHora(evidencia.inference_at) : '—'}</dd></div>
              </dl>
              <div>
                <h3 className="mb-2 text-sm font-semibold">{t('historial.variablesEntrada')}</h3>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-3">
                  {Object.entries(evidencia.feature_vector).map(([nombre, valor]) => <div key={nombre}><dt className="text-muted">{t(`metricasIA.variables.${nombre}`, { defaultValue: nombre.replaceAll('_', ' ') })}</dt><dd className="nums font-medium">{valor == null ? '—' : typeof valor === 'boolean' ? (valor ? t('comunes.si') : t('comunes.no')) : valor}</dd></div>)}
                </dl>
              </div>
              {evidencia.probabilities && (
                <div>
                  <h3 className="mb-2 text-sm font-semibold">{t('historial.probabilidadesEjemplo')}</h3>
                  <div className="space-y-2">
                    {Object.entries(evidencia.probabilities).map(([clase, probabilidad]) => <div key={clase} className="grid grid-cols-[1fr_auto] gap-3 text-xs"><span>{t(`riesgo.${clase}`)}</span><span className="nums font-semibold">{(probabilidad * 100).toFixed(1)}%</span><div className="col-span-2 h-1.5 rounded-full bg-[#E6EDF6]"><div className="h-full rounded-full bg-gradient-to-r from-[#00D1FF] to-[#0B5CFF]" style={{ width: `${Math.min(100, Math.max(0, probabilidad * 100))}%` }} /></div></div>)}
                  </div>
                </div>
              )}
              <p className="border-t border-border pt-3 text-xs leading-relaxed text-muted">{t('historial.reglaDeterminista')}: {evidencia.excursion_confirmada ? t('dashboard.excursionConfirmada') : t('historial.sinExcursion')}</p>
            </div>
          )}
          <div className="mt-4 flex justify-end"><Button variant="ghost" onClick={() => setLecturaDetalle(null)}>{t('comunes.cerrar')}</Button></div>
        </DialogContent>
      </Dialog>
    </CompactWorkspace>
  )
}
