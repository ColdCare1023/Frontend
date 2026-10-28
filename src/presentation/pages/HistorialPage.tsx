import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChartSpline, DoorClosed, DoorOpen, FilterX, SearchX, ShieldQuestion } from 'lucide-react'

import { useHistorial, type FiltrosHistorial } from '@/application/hooks/useHistorial'
import { obtenerEvidenciaInferencia, type EvidenciaInferencia } from '@/application/hooks/useEvidenciaInferencia'
import type { LecturaTermica } from '@/domain/entities/LecturaTermica'
import { NIVELES_RIESGO } from '@/domain/value-objects/NivelRiesgo'
import { construirOpcionCurvaTermica } from '@/infrastructure/charts/curvaTermica'
import { EChartWrapper } from '@/infrastructure/charts/EChartWrapper'
import { useTemaResuelto } from '@/infrastructure/tema/tema'
import { fechaCorta, fechaHora, hora } from '@/lib/formato'
import { rangoPagina } from '@/lib/paginacion'
import { cn } from '@/lib/utils'
import { useResponsivePageSize } from '@/presentation/hooks/useResponsivePageSize'
import { EstadoCarga, EstadoError, EstadoVacio } from '../components/EstadoPagina'
import { PageHeader } from '../components/PageHeader'
import { Paginacion } from '../components/Paginacion'
import { RiskBadge } from '../components/RiskBadge'
import { Button } from '../components/ui/button'
import { Card } from '../components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../components/ui/dialog'
import { Input, Label, NativeSelect } from '../components/ui/input'
import { Panel } from '../components/ui/panel'
import { SelectorFecha } from '../components/ui/selector-fecha'
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

// Ocho columnas: bajo 1280 px el relleno lateral se ciñe para que quepan.
const RELLENO = 'sm:px-2 xl:px-4'
// Lectura principal (fecha, equipo, temperatura interna y riesgo) en primer
// plano; ambiente, humedad, puerta y origen quedan en segundo plano.
const SECUNDARIA = 'nums text-[13px] text-muted'

/** Fecha arriba y hora debajo: ninguna de las dos se parte al estrechar la columna. */
function FechaYHora({ iso }: { iso: string | null }) {
  if (!iso || Number.isNaN(new Date(iso).getTime())) return <>{fechaHora(iso)}</>
  return (
    <>
      <span className="block whitespace-nowrap">{fechaCorta(iso)}</span>
      <span className="block whitespace-nowrap text-muted">{hora(iso)}</span>
    </>
  )
}

export function HistorialPage() {
  const { t } = useTranslation()
  const { lecturas, cargando, errorCarga, consultar } = useHistorial()
  const [pagina, setPagina] = useState(1)
  const tamanoPagina = useResponsivePageSize()
  // La lista completa puede tener miles de filas; solo se pinta la página
  // visible. Al cambiar la lista (filtro nuevo) se vuelve a la primera.
  const visibles = useMemo(
    () => lecturas.slice(...rangoPagina(pagina, tamanoPagina)),
    [lecturas, pagina, tamanoPagina],
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
  const tema = useTemaResuelto()
  const serieGrafica = useMemo(() => [...lecturas].reverse(), [lecturas])
  const opcionHistorial = useMemo(
    () =>
      // HU-36 criterio 1: la misma consulta filtrada alimenta la gráfica y la tabla.
      construirOpcionCurvaTermica(serieGrafica, {
        interna: t('dashboard.tempInterna'),
        ambiental: t('dashboard.tempAmbiental'),
        rangoEsperado: t('dashboard.rangoEsperadoCorto'),
        ahora: t('dashboard.ejeAhora'),
        excursion: t('dashboard.graficaExcursion'),
        sinDatos: t('dashboard.graficaSinDatos'),
      }, undefined, tema),
    // Con el tema cambian los colores del canvas (tokens CSS): se reconstruye.
    [serieGrafica, t, tema],
  )

  return (
    <div className="space-y-4">
      <PageHeader eyebrow={t('nav.seccionOperacion')} titulo={t('historial.titulo')} descripcion={t('historial.descripcion')} />

      {/* ── Filtros: una sola barra (apilada en móvil) ─────────── */}
      <Card className="p-3 sm:p-4">
        <p id="titulo-filtros-historial" className="sr-only">
          {t('historial.filtros')}
        </p>
        <form
          aria-labelledby="titulo-filtros-historial"
          className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,1.15fr)_minmax(0,1.15fr)_auto]"
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
              value={filtros.riesgo_efectivo ?? ''}
              onChange={(e) => actualizarFiltro('riesgo_efectivo', e.target.value)}
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
            <SelectorFecha
              id="f-desde"
              conHora
              valor={filtros.desde ?? ''}
              onCambiar={(valor) => actualizarFiltro('desde', valor)}
              invalido={errorRango !== null}
              aria-describedby={errorRango ? 'historial-error-rango' : undefined}
            />
          </div>
          <div>
            <Label htmlFor="f-hasta">{t('historial.hasta')}</Label>
            <SelectorFecha
              id="f-hasta"
              conHora
              valor={filtros.hasta ?? ''}
              onCambiar={(valor) => actualizarFiltro('hasta', valor)}
              invalido={errorRango !== null}
              aria-describedby={errorRango ? 'historial-error-rango' : undefined}
            />
          </div>
          <div className="flex gap-2 sm:col-span-2 sm:justify-end xl:col-span-1">
            <Button type="submit" className="flex-1 sm:flex-none">
              {t('historial.aplicar')}
            </Button>
            <Button variant="ghost" onClick={limpiar}>
              <FilterX aria-hidden />
              {t('historial.limpiar')}
            </Button>
          </div>
        </form>
        {errorRango && (
          <p
            id="historial-error-rango"
            role="alert"
            className="mt-3 rounded-(--radius-field) bg-critical-tint px-3 py-2 text-[13px] text-critical"
          >
            {errorRango}
          </p>
        )}
      </Card>

      {/* ── HU-36 criterio 1: la misma consulta alimenta la gráfica ──── */}
      {lecturas.length > 0 && !errorCarga && (
        <Panel id="historial-grafica" icono={ChartSpline} titulo={t('dashboard.curvaTermica')} cuerpoClassName="p-3 sm:p-4">
          <div aria-busy={cargando || undefined}>
            <EChartWrapper
              option={opcionHistorial}
              height="200px"
              ariaLabel={t('dashboard.graficaEtiqueta', { n: serieGrafica.length })}
              ariaDescribedBy="historial-datos-tabla"
            />
          </div>
        </Panel>
      )}

      {/* ── Lecturas ────────────────────────────────────────── */}
      <div id="historial-datos-tabla">
        {errorCarga ? (
          <EstadoError mensaje={t('historial.errorCargar')}>
            <Button variant="secondary" size="sm" className="mt-3" onClick={() => void consultar(filtros)}>
              {t('comunes.reintentar')}
            </Button>
          </EstadoError>
        ) : !cargando && lecturas.length === 0 ? (
          <EstadoVacio icono={SearchX} titulo={t('historial.sinResultados')} />
        ) : (
          <>
            <Table mobileLayout="stack" className="min-w-0" titulo={t('historial.titulo')} cargando={cargando}>
              <TableHeader>
                <TableRow>
                  <TableHead className={cn('w-36', RELLENO)}>{t('historial.fecha')}</TableHead>
                  <TableHead className={cn('w-32', RELLENO)}>{t('historial.codigoEquipo')}</TableHead>
                  <TableHead className={cn('w-28 text-right', RELLENO)}>{t('historial.tempInterna')}</TableHead>
                  <TableHead className={cn('w-44', RELLENO)}>{t('historial.riesgo')}</TableHead>
                  <TableHead className={cn('w-28 text-right', RELLENO)}>{t('historial.tempAmbiental')}</TableHead>
                  <TableHead className={cn('w-24 text-right', RELLENO)}>{t('historial.humedad')}</TableHead>
                  <TableHead className={cn('w-20 text-center', RELLENO)}>{t('historial.puerta')}</TableHead>
                  <TableHead className={cn('w-32 text-right', RELLENO)}>{t('historial.evidenciaModelo')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cargando ? (
                  <TableEmpty colSpan={8}>
                    <EstadoCarga texto={t('historial.cargando')} className="py-0" />
                  </TableEmpty>
                ) : (
                  visibles.map((lectura) => (
                    <TableRow key={lectura.id}>
                      <TableCell data-label={t('historial.fecha')} className={cn('nums text-[13px] leading-5', RELLENO)}>
                        <FechaYHora iso={lectura.timestamp} />
                      </TableCell>
                      <TableCell data-label={t('historial.codigoEquipo')} className={cn('whitespace-nowrap text-[13px] font-medium', RELLENO)}>
                        {lectura.device_id}
                      </TableCell>
                      <TableCell data-label={t('historial.tempInterna')} className={cn('nums whitespace-nowrap text-right text-[15px] font-semibold', RELLENO)}>
                        {lectura.temperatura_interna?.toFixed(1) ?? '—'} °C
                      </TableCell>
                      {/* En móvil el riesgo encabeza la ficha de cada lectura, a lo ancho. */}
                      <TableCell data-label={t('historial.riesgo')} className={cn('mobile-full max-sm:order-first', RELLENO)}>
                        {/* HU-34: el historial también debe mostrar el riesgo
                            EFECTIVO, no la clase cruda de la IA. */}
                        <RiskBadge nivel={lectura.riesgo_efectivo} />
                      </TableCell>
                      <TableCell data-label={t('historial.tempAmbiental')} className={cn(SECUNDARIA, 'whitespace-nowrap text-right', RELLENO)}>
                        {lectura.temperatura_ambiental?.toFixed(1) ?? '—'} °C
                      </TableCell>
                      <TableCell data-label={t('historial.humedad')} className={cn(SECUNDARIA, 'whitespace-nowrap text-right', RELLENO)}>
                        {lectura.humedad_ambiental?.toFixed(0) ?? '—'} %
                      </TableCell>
                      <TableCell data-label={t('historial.puerta')} className={cn('text-center', RELLENO)}>
                        {/* HU-35 criterio 4: si el dato de puerta no está disponible, null no es
                            "cerrada" — se marca aparte para no fingir un dato. */}
                        <span className="inline-flex w-full justify-start sm:justify-center">
                          {lectura.apertura_refrigerador === null ? (
                            <ShieldQuestion role="img" className="size-4 text-faint" aria-label={t('dashboard.puertaSinSensor')} />
                          ) : lectura.apertura_refrigerador ? (
                            <DoorOpen role="img" className="size-4 text-honey-700" aria-label={t('dashboard.puertaAbierta')} />
                          ) : (
                            <DoorClosed role="img" className="size-4 text-faint" aria-label={t('dashboard.puertaCerrada')} />
                          )}
                        </span>
                      </TableCell>
                      <TableCell data-label={t('historial.evidenciaModelo')} className={cn('text-right', RELLENO)}>
                        {/* Discreto en la tabla; en la ficha táctil conserva el borde de botón. */}
                        <Button variant="ghost" size="sm" className="max-sm:border max-sm:border-border-strong" disabled={!lectura.id} onClick={() => void abrirEvidencia(lectura)}>
                          {t('historial.verEvidencia')}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            <Paginacion total={lecturas.length} pagina={pagina} onCambiar={setPagina} tamano={tamanoPagina} />
          </>
        )}
      </div>

      <Dialog open={lecturaDetalle !== null} onOpenChange={(abierto) => !abierto && setLecturaDetalle(null)}>
        <DialogContent>
          <DialogTitle>{t('historial.evidenciaTitulo')}</DialogTitle>
          <DialogDescription className="break-all">{t('historial.idLectura')}: {lecturaDetalle}</DialogDescription>
          {cargandoEvidencia ? (
            <p role="status" className="mt-4 text-sm text-muted">{t('app.cargando')}</p>
          ) : errorEvidencia ? (
            <p role="alert" className="mt-4 rounded-lg bg-critical-tint px-3 py-2 text-sm text-critical">{t('historial.evidenciaNoDisponible')}</p>
          ) : evidencia && (
            <div className="mt-4 space-y-4">
              {evidencia.datos_simulados && <p className="rounded-lg border border-critical/20 bg-critical-tint px-3 py-2 text-xs leading-relaxed text-critical">{t('historial.evidenciaDemo')}</p>}
              <dl className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-border bg-surface-sunken p-3"><dt className="text-xs text-muted">{t('historial.claseModelo')}</dt><dd className="mt-1 text-sm font-semibold">{evidencia.model_class ? t(`riesgo.${evidencia.model_class}`) : t('historial.sinInferencia')}</dd></div>
                <div className="rounded-lg border border-border bg-surface-sunken p-3"><dt className="text-xs text-muted">{t('historial.riesgoEfectivo')}</dt><dd className="mt-1 text-sm font-semibold">{evidencia.effective_risk ? t(`riesgo.${evidencia.effective_risk}`) : '—'}</dd></div>
                <div className="rounded-lg border border-border bg-surface-sunken p-3"><dt className="text-xs text-muted">{t('historial.versionModelo')}</dt><dd className="nums mt-1 text-sm font-semibold">{evidencia.model_version ?? '—'}</dd></div>
                <div className="rounded-lg border border-border bg-surface-sunken p-3"><dt className="text-xs text-muted">{t('historial.estadoInferencia')}</dt><dd className="mt-1 text-sm font-semibold">{evidencia.inference_status ? t(`historial.inferencia.${evidencia.inference_status}`) : '—'}</dd></div>
                <div className="rounded-lg border border-border bg-surface-sunken p-3"><dt className="text-xs text-muted">{t('historial.fechaInferencia')}</dt><dd className="nums mt-1 text-sm font-semibold">{evidencia.inference_at ? fechaHora(evidencia.inference_at) : '—'}</dd></div>
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
                    {Object.entries(evidencia.probabilities).map(([clase, probabilidad]) => <div key={clase} className="grid grid-cols-[1fr_auto] gap-3 text-xs"><span>{t(`riesgo.${clase}`)}</span><span className="nums font-semibold">{(probabilidad * 100).toFixed(1)}%</span><div className="col-span-2 h-1.5 rounded-full bg-border"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, Math.max(0, probabilidad * 100))}%` }} /></div></div>)}
                  </div>
                </div>
              )}
              <p className="border-t border-border pt-3 text-xs leading-relaxed text-muted">{t('historial.reglaDeterminista')}: {evidencia.excursion_confirmada ? t('dashboard.excursionConfirmada') : t('historial.sinExcursion')}</p>
            </div>
          )}
          <div className="mt-4 flex justify-end"><Button variant="ghost" onClick={() => setLecturaDetalle(null)}>{t('comunes.cerrar')}</Button></div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
