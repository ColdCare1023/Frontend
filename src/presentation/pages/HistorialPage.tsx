import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { EChartsCoreOption } from 'echarts/core'
import { DoorClosed, DoorOpen, FilterX, ShieldQuestion, SlidersHorizontal } from 'lucide-react'

import { useHistorial, type FiltrosHistorial } from '@/application/hooks/useHistorial'
import type { LecturaTermica } from '@/domain/entities/LecturaTermica'
import { NIVELES_RIESGO, RANGO_TERMICO } from '@/domain/value-objects/NivelRiesgo'
import { EChartWrapper } from '@/infrastructure/charts/EChartWrapper'
import { fechaHora, hora as formatearHora } from '@/lib/formato'
import { rangoPagina } from '@/lib/paginacion'
import { Paginacion } from '../components/Paginacion'
import { PageHeader } from '../components/PageHeader'
import { RiskBadge } from '../components/RiskBadge'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Input, Label, NativeSelect } from '../components/ui/input'
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
}): EChartsCoreOption {
  const horas = serie.map((l) => formatearHora(l.timestamp))
  return {
    textStyle: { fontFamily: 'Inter, sans-serif', color: '#59677C' },
    grid: { left: 44, right: 16, top: 32, bottom: 28 },
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#ffffff',
      borderColor: '#DCE5F0',
      textStyle: { color: '#0F172A', fontSize: 12 },
      valueFormatter: (v: unknown) => (typeof v === 'number' ? `${v.toFixed(1)} °C` : '—'),
    },
    legend: {
      top: 0,
      right: 0,
      icon: 'roundRect',
      itemWidth: 14,
      itemHeight: 3,
      formatter: etiquetaCortaTemperatura,
      textStyle: { color: '#59677C', fontSize: 12 },
    },
    xAxis: {
      type: 'category',
      data: horas,
      boundaryGap: false,
      axisLine: { lineStyle: { color: '#DCE5F0' } },
      axisTick: { show: false },
      axisLabel: { fontSize: 11, color: '#59677C' },
    },
    yAxis: {
      type: 'value',
      min: (value: { min: number }) => Math.floor(Math.min(value.min, 0)),
      max: (value: { max: number }) => Math.ceil(Math.max(value.max, 10)),
      splitLine: { lineStyle: { color: '#E9EFF7' } },
      axisLabel: { fontSize: 11, color: '#59677C', formatter: '{value} °C' },
    },
    series: [
      {
        name: etiquetas.interna,
        type: 'line',
        smooth: true,
        symbol: 'none',
        sampling: 'lttb',
        large: true,
        data: serie.map((l) => l.temperatura_interna),
        lineStyle: { width: 2.5, color: '#0B5CFF' },
        itemStyle: { color: '#0B5CFF' },
        markArea: {
          silent: true,
          itemStyle: { color: 'rgba(11, 92, 255, 0.06)' },
          data: [[{ yAxis: RANGO_TERMICO.minimo }, { yAxis: RANGO_TERMICO.maximo }]],
        },
        markLine: {
          silent: true,
          symbol: 'none',
          lineStyle: { color: '#8F3320', type: 'dashed', width: 1 },
          label: { color: '#8F3320', fontSize: 10, formatter: '{c} °C' },
          data: [{ yAxis: RANGO_TERMICO.minimo }, { yAxis: RANGO_TERMICO.maximo }],
        },
      },
      {
        name: etiquetas.ambiental,
        type: 'line',
        smooth: true,
        symbol: 'none',
        sampling: 'lttb',
        large: true,
        data: serie.map((l) => l.temperatura_ambiental),
        lineStyle: { width: 1.5, color: '#08738F', type: 'dashed' },
        itemStyle: { color: '#08738F' },
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
  const { lecturas, cargando, consultar } = useHistorial()
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
      }),
    [serieGrafica, t],
  )

  return (
    <div>
      <PageHeader eyebrow={t('nav.seccionOperacion')} titulo={t('historial.titulo')} descripcion={t('historial.descripcion')} />

      {/* ── Filtros ─────────────────────────────────────────── */}
      <Card className="mb-5 animate-rise">
        <CardContent className="p-5">
          <p
            id="titulo-filtros-historial"
            className="mb-3 flex items-center gap-2 text-[13px] font-medium text-muted"
          >
            <SlidersHorizontal className="size-3.5" aria-hidden />
            {t('historial.filtros')}
          </p>
          <form
            aria-labelledby="titulo-filtros-historial"
            className="grid grid-cols-1 items-end gap-3 min-[480px]:grid-cols-2 lg:grid-cols-5"
            onSubmit={(e) => {
              e.preventDefault()
              aplicarFiltros()
            }}
          >
            <div>
              <Label htmlFor="f-device">{t('historial.dispositivo')}</Label>
              <Input
                id="f-device"
                value={filtros.device_id ?? ''}
                onChange={(e) => actualizarFiltro('device_id', e.target.value)}
                placeholder="FARM-01-CDL"
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
            <div className="flex gap-2 min-[480px]:col-span-2 lg:col-span-1">
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
      {!cargando && lecturas.length > 0 && (
        <Card className="mb-5 animate-rise" style={{ animationDelay: '30ms' }}>
          <CardHeader>
            <CardTitle>{t('dashboard.curvaTermica')}</CardTitle>
          </CardHeader>
          <CardContent>
            <EChartWrapper
              option={opcionHistorial}
              height="280px"
              ariaLabel={t('dashboard.graficaEtiqueta', { n: serieGrafica.length })}
              ariaDescribedBy="historial-datos-tabla"
            />
          </CardContent>
        </Card>
      )}

      {/* ── Tabla ───────────────────────────────────────────── */}
      <div id="historial-datos-tabla" className="animate-rise" style={{ animationDelay: '60ms' }}>
        <Table titulo={t('historial.titulo')} cargando={cargando}>
          <TableHeader>
            <TableRow>
              <TableHead>{t('historial.fecha')}</TableHead>
              <TableHead>{t('historial.dispositivo')}</TableHead>
              <TableHead className="text-right">{t('historial.tempInterna')}</TableHead>
              <TableHead className="text-right">{t('historial.tempAmbiental')}</TableHead>
              <TableHead className="text-right">{t('historial.humedad')}</TableHead>
              <TableHead>{t('historial.puerta')}</TableHead>
              <TableHead>{t('historial.riesgo')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cargando ? (
              <TableEmpty colSpan={7}>{t('historial.cargando')}</TableEmpty>
            ) : lecturas.length === 0 ? (
              <TableEmpty colSpan={7}>{t('historial.sinResultados')}</TableEmpty>
            ) : (
              visibles.map((lectura) => (
                <TableRow key={lectura.id}>
                  <TableCell className="nums text-[13px]">
                    {fechaHora(lectura.timestamp)}
                  </TableCell>
                  <TableCell className="text-[13px]">{lectura.device_id}</TableCell>
                  <TableCell className="nums text-right font-medium">
                    {lectura.temperatura_interna?.toFixed(1) ?? '—'} °C
                  </TableCell>
                  <TableCell className="nums text-right text-muted">
                    {lectura.temperatura_ambiental?.toFixed(1) ?? '—'} °C
                  </TableCell>
                  <TableCell className="nums text-right text-muted">
                    {lectura.humedad_ambiental?.toFixed(0) ?? '—'} %
                  </TableCell>
                  <TableCell>
                    {/* HU-35 criterio 4: sin MC-38 instalado, null no es
                        "cerrada" — se marca aparte para no fingir un dato. */}
                    {lectura.apertura_refrigerador === null ? (
                      <ShieldQuestion role="img" className="size-4 text-faint" aria-label={t('dashboard.puertaSinSensor')} />
                    ) : lectura.apertura_refrigerador ? (
                      <DoorOpen role="img" className="size-4 text-honey-600" aria-label={t('dashboard.puertaAbierta')} />
                    ) : (
                      <DoorClosed role="img" className="size-4 text-faint" aria-label={t('dashboard.puertaCerrada')} />
                    )}
                  </TableCell>
                  <TableCell>
                    {/* HU-34: el historial también debe mostrar el riesgo
                        EFECTIVO, no la clase cruda de la IA. */}
                    <RiskBadge nivel={lectura.riesgo_efectivo} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <Paginacion total={lecturas.length} pagina={pagina} onCambiar={setPagina} />
      </div>
    </div>
  )
}
