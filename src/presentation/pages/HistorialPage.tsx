import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CircleCheck, DoorClosed, DoorOpen, Droplets, FilterX, Hourglass, Info, OctagonAlert, Search, ThermometerSun, Timer, Wifi, WifiOff, Hash, Inbox, Brain } from 'lucide-react'

import { useHistorial, type FiltrosHistorial } from '@/application/hooks/useHistorial'
import { obtenerEvidenciaInferencia, type EvidenciaInferencia } from '@/application/hooks/useEvidenciaInferencia'
import type { LecturaTermica } from '@/domain/entities/LecturaTermica'
import type { SerieTermica } from '@/domain/entities/SerieTermica'
import { NIVELES_RIESGO } from '@/domain/value-objects/NivelRiesgo'
import { construirOpcionSerieTermica } from '@/infrastructure/charts/serieTermica'
import { useTemaResuelto } from '@/infrastructure/tema/tema'
import { duracionBreve, duracionLegible, duracionPeriodo, fechaCorta, fechaHora, hora } from '@/lib/formato'
import { lecturasNoDibujadas, resumenDeSeries, resumenPorDiaDeSeries } from '@/lib/resumenSerie'
import type { ExcursionEquipo } from '@/lib/resumenTermico'
import { cn } from '@/lib/utils'
import { useCoincideMedia } from '@/presentation/hooks/useCoincideMedia'
import { useResponsivePageSize } from '@/presentation/hooks/useResponsivePageSize'
import { EstadoCarga, EstadoError, EstadoVacio } from '../components/EstadoPagina'
import { GraficaDiferida } from '../components/GraficaDiferida'
import { PageHeader } from '../components/PageHeader'
import { Paginacion } from '../components/Paginacion'
import { RiskBadge } from '../components/RiskBadge'
import { BotonCopiar, BotonMasFiltros, ChipsFiltro, Dato, PlantillaBandeja, type Chip } from '../components/registros/piezas'
import { CeldaRegistro, EncabezadoRegistro, TablaRegistros } from '../components/registros/TablaRegistros'
import { Button } from '../components/ui/button'
import { tonoDesdeRiesgo } from '../components/ui/estado-tonos'
import { formatearCifra } from '../components/ui/formato-cifra'
import { Input, Label, NativeSelect } from '../components/ui/input'
import { Regla } from '../components/ui/regla'
import { SelectorFecha } from '../components/ui/selector-fecha'
import { TiraEstado } from '../components/ui/tira-estado'
import { PanelEvidencia } from './historial/PanelEvidencia'
import { RailHistorial } from './historial/RailHistorial'

const FILTROS_INICIALES: FiltrosHistorial = {}

/** El detalle del equipo enlaza con `?device_id=…`: la primera consulta ya llega filtrada. */
function filtrosDeUrl(): FiltrosHistorial {
  if (typeof window === 'undefined') return FILTROS_INICIALES
  const equipo = new URLSearchParams(window.location.search).get('device_id')?.trim()
  return equipo ? { device_id: equipo } : FILTROS_INICIALES
}

/** Valor del selector de fecha (`yyyy-MM-ddTHH:mm`, hora local) para un instante. */
function entradaLocal(ms: number): string {
  const f = new Date(ms)
  const dos = (n: number) => String(n).padStart(2, '0')
  return `${f.getFullYear()}-${dos(f.getMonth() + 1)}-${dos(f.getDate())}T${dos(f.getHours())}:${dos(f.getMinutes())}`
}
const MINUTO_MS = 60_000
/** Margen alrededor de un episodio al acotar la consulta a él. */
const MARGEN_EPISODIO_MS = 10 * MINUTO_MS

/** La cifra solo toma color cuando la lectura pide atención; la columna de riesgo lo dice en texto. */
const CIFRA_RIESGO: Record<string, string> = {
  riesgo_preventivo: 'text-warning-700',
  excursion_critica: 'text-critical',
}

const cifra = (valor: number | null | undefined, decimales = 1) => (valor == null ? '—' : formatearCifra(valor, decimales))
const fechaDe = (l: LecturaTermica) => l.timestamp
const claveLectura = (l: LecturaTermica) => l.id ?? `${l.device_id}-${l.timestamp}`

export function HistorialPage() {
  const { t } = useTranslation()
  const [inicio] = useState(filtrosDeUrl)
  const tamanoPagina = useResponsivePageSize()
  const {
    lecturas, total, pagina, irAPagina, cargando, errorCarga, consultar,
    series, cargandoSerie, errorSerie, periodo, equiposConocidos,
  } = useHistorial(inicio, tamanoPagina)
  const [filtros, setFiltros] = useState<FiltrosHistorial>(inicio)
  // Lo que se consultó de verdad: los chips describen la lista visible, no el borrador.
  const [aplicados, setAplicados] = useState<FiltrosHistorial>(inicio)
  // HU-36 criterio 3: el rango inválido se bloquea en el FRONTEND antes de consultar.
  const [errorRango, setErrorRango] = useState<string | null>(null)
  const [expandida, setExpandida] = useState<string | null>(null)
  const [masFiltros, setMasFiltros] = useState(false)
  const [lecturaDetalle, setLecturaDetalle] = useState<LecturaTermica | null>(null)
  const [evidencia, setEvidencia] = useState<EvidenciaInferencia | null>(null)
  const [cargandoEvidencia, setCargandoEvidencia] = useState(false)
  const [errorEvidencia, setErrorEvidencia] = useState(false)

  // Al cambiar de página o de consulta se cierra la fila abierta.
  // La firma evita reiniciar la vista cuando llega la misma página otra vez.
  const firma = `${pagina}:${lecturas.length}:${lecturas[0]?.id}:${lecturas.at(-1)?.id}`
  const [firmaPrevia, setFirmaPrevia] = useState(firma)
  if (firmaPrevia !== firma) {
    setFirmaPrevia(firma)
    setExpandida(null)
  }
  // HU-36: curva, tira, rail y cabeceras de día salen de la serie agregada del
  // periodo COMPLETO; la tabla es una página de ese mismo periodo.
  const resumen = useMemo(() => resumenDeSeries(series), [series])
  const porDia = useMemo(() => resumenPorDiaDeSeries(series), [series])
  const noDibujadas = useMemo(() => lecturasNoDibujadas(series), [series])
  const variosEquipos = new Set(lecturas.map((l) => l.device_id)).size > 1 || (!aplicados.device_id && series.length > 1)
  // Ambiente y humedad solo caben como columnas desde 1536 px. Se montan (no
  // se ocultan con CSS): con `hidden` seguían contando en el `colSpan` de la
  // cabecera de día y la tabla abría dos columnas fantasma a la derecha.
  const conAmbiente = useCoincideMedia('(min-width: 96rem)')
  const equiposVistos = useMemo(() => [...new Set([...equiposConocidos, ...lecturas.map((l) => l.device_id)])].sort(), [equiposConocidos, lecturas])

  // La curva se revela una sola vez por visita (un momento por página).
  const [primeraSerie, setPrimeraSerie] = useState<SerieTermica[] | null>(null)
  if (primeraSerie === null && series.length > 0) setPrimeraSerie(series)
  const revelarCurva = primeraSerie === series

  const abrirEvidencia = async (lectura: LecturaTermica) => {
    if (!lectura.id) return
    setLecturaDetalle(lectura)
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

  const consultarCon = (crudos: FiltrosHistorial) => {
    const nuevos = { ...crudos, device_id: crudos.device_id?.trim() || undefined }
    if (nuevos.desde && nuevos.hasta && new Date(nuevos.desde) > new Date(nuevos.hasta)) {
      setErrorRango(t('historial.rangoInvalido'))
      return
    }
    setErrorRango(null)
    setFiltros(nuevos)
    setAplicados(nuevos)
    void consultar(nuevos)
  }

  const limpiar = () => consultarCon(FILTROS_INICIALES)
  const hayFiltros = Object.values(aplicados).some(Boolean)

  const chips: Chip[] = []
  if (aplicados.device_id)
    chips.push({ clave: 'equipo', texto: t('historial.filtro.chipEquipo', { valor: aplicados.device_id }), quitar: () => consultarCon({ ...aplicados, device_id: undefined }) })
  if (aplicados.riesgo_efectivo)
    chips.push({ clave: 'riesgo', texto: t('historial.filtro.chipRiesgo', { valor: t(`riesgo.${aplicados.riesgo_efectivo}`) }), quitar: () => consultarCon({ ...aplicados, riesgo_efectivo: undefined }) })
  if (aplicados.desde || aplicados.hasta) {
    const desde = aplicados.desde ? fechaHora(aplicados.desde) : ''
    const hasta = aplicados.hasta ? fechaHora(aplicados.hasta) : ''
    const valor = desde && hasta ? t('comunes.periodo.rango', { desde, hasta }) : desde ? t('comunes.periodo.desdeSolo', { desde }) : t('comunes.periodo.hastaSolo', { hasta })
    chips.push({ clave: 'periodo', texto: t('historial.filtro.chipPeriodo', { valor }), quitar: () => consultarCon({ ...aplicados, desde: undefined, hasta: undefined }) })
  }

  // «Ver en la tabla»: la consulta se acota al episodio (con un margen) y a su
  // equipo; la tabla paginada muestra entonces sus lecturas desde la primera.
  const verExcursion = (excursion: ExcursionEquipo) =>
    consultarCon({
      ...aplicados,
      device_id: excursion.equipo,
      desde: entradaLocal(Math.floor((excursion.inicio - MARGEN_EPISODIO_MS) / MINUTO_MS) * MINUTO_MS),
      hasta: entradaLocal(Math.ceil((excursion.fin + MARGEN_EPISODIO_MS) / MINUTO_MS) * MINUTO_MS),
    })

  // HU-36 criterio 1: la serie del periodo alimenta la gráfica; el eje
  // muestra el periodo consultado entero, también lo que no tiene datos.
  const tema = useTemaResuelto()
  const ventana = useMemo(() => ({ desde: Date.parse(periodo.desde), hasta: Date.parse(periodo.hasta) }), [periodo])
  const opcionHistorial = useMemo(
    () =>
      construirOpcionSerieTermica(series, {
        interna: t('dashboard.tempInterna'),
        ambiental: t('dashboard.tempAmbiental'),
        rangoEsperado: t('dashboard.rangoEsperadoCorto'),
        ahora: t('dashboard.ejeAhora'),
        excursion: t('dashboard.graficaExcursion'),
        sinDatos: t('dashboard.graficaSinDatos'),
        banda: t('historial.curva.banda'),
        bufferAgotado: t('historial.curva.bufferAgotado'),
        minimo: t('historial.curva.minimo'),
        maximo: t('historial.curva.maximo'),
        lecturas: t('historial.curva.lecturas'),
      }, ventana, tema),
    [series, t, ventana, tema],
  )
  const intervaloSerie = series[0]?.bucket_segundos

  const masLarga = resumen.excursiones[0]
  const guia = masLarga ? (
    <span className="flex items-start gap-2">
      <OctagonAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-critical" />
      {t('historial.guia.excursiones', { count: resumen.excursiones.length, duracion: duracionPeriodo(Math.max(60_000, masLarga.fin - masLarga.inicio), t), equipo: masLarga.equipo })}
    </span>
  ) : resumen.brechas.length > 0 ? (
    <span className="flex items-start gap-2">
      <Hourglass aria-hidden className="mt-0.5 size-4 shrink-0 text-nodata-700" />
      {t('historial.guia.brechas', { count: resumen.brechas.length })}
    </span>
  ) : (
    <span className="flex items-start gap-2">
      <CircleCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-success-700" />
      {t('historial.guia.enRango')}
    </span>
  )

  const sinSegundos = (iso: string) => fechaHora(iso).replace(/:\d{2}(?=\D*$)/, '')
  const textoPeriodo = periodo.porDefecto && !aplicados.hasta
    ? t('historial.periodo.ultimas24h')
    : t('comunes.periodo.rango', { desde: sinSegundos(periodo.desde), hasta: sinSegundos(periodo.hasta) })
  const meta = cargando && total === 0 ? undefined : t('historial.meta', { n: total, periodo: textoPeriodo })

  const barra = (
    <>
      {/* Rejilla de filtros en pares: equipo y riesgo, desde y hasta, y las
          acciones debajo (antes «Hasta» quedaba sola en una segunda fila). Con
          el rail a la derecha (1280–1535 px) la columna no da para 4 campos sin
          cortar «dd/mm/aaaa hh:mm». Bajo 640 px solo se ve el equipo; el resto
          se despliega con «Filtros». */}
      <form
        role="search"
        aria-label={t('historial.filtro.etiqueta')}
        className="grid grid-cols-1 items-end gap-x-3 gap-y-2 border-b border-border px-3 py-2.5 sm:grid-cols-2 sm:px-4 lg:grid-cols-4 xl:grid-cols-2 2xl:grid-cols-4"
        onSubmit={(e) => {
          e.preventDefault()
          consultarCon(filtros)
        }}
      >
        <div className="min-w-0">
          <Label htmlFor="f-device" className="text-meta text-muted">{t('historial.filtro.equipo')}</Label>
          <div className="flex gap-2">
            <div className="relative min-w-0 flex-1">
              <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" />
              <Input id="f-device" list="historial-equipos" className="h-9 pl-9 max-sm:h-11 pointer-coarse:h-11" value={filtros.device_id ?? ''} onChange={(e) => actualizarFiltro('device_id', e.target.value)} placeholder={t('historial.codigoEquipoEjemplo')} />
              <datalist id="historial-equipos">{equiposVistos.map((equipo) => <option key={equipo} value={equipo} />)}</datalist>
            </div>
            <BotonMasFiltros
              abierto={masFiltros}
              onCambiar={setMasFiltros}
              controla="historial-mas-filtros"
              activos={(aplicados.riesgo_efectivo ? 1 : 0) + (aplicados.desde || aplicados.hasta ? 1 : 0)}
              texto={t('historial.filtro.mas')}
              textoActivos={(count) => t('historial.filtro.masActivos', { count })}
            />
          </div>
        </div>
        <div id="historial-mas-filtros" className={cn('grid grid-cols-1 gap-x-3 gap-y-2 min-[480px]:grid-cols-2 sm:contents', !masFiltros && 'max-sm:hidden')}>
          <div className="min-w-0 min-[480px]:max-sm:col-span-2">
            <Label htmlFor="f-riesgo" className="text-meta text-muted">{t('historial.nivelRiesgo')}</Label>
            <NativeSelect id="f-riesgo" className="h-9 max-sm:h-11 pointer-coarse:h-11" value={filtros.riesgo_efectivo ?? ''} onChange={(e) => consultarCon({ ...filtros, riesgo_efectivo: e.target.value || undefined })}>
              <option value="">{t('historial.todosNiveles')}</option>
              {NIVELES_RIESGO.map((nivel) => <option key={nivel} value={nivel}>{t(`riesgo.${nivel}`)}</option>)}
            </NativeSelect>
          </div>
          <div className="min-w-0">
            <Label htmlFor="f-desde" className="text-meta text-muted">{t('historial.desde')}</Label>
            <SelectorFecha id="f-desde" conHora valor={filtros.desde ?? ''} onCambiar={(valor) => actualizarFiltro('desde', valor)} invalido={errorRango !== null} aria-describedby={errorRango ? 'historial-error-rango' : undefined} />
          </div>
          <div className="min-w-0">
            <Label htmlFor="f-hasta" className="text-meta text-muted">{t('historial.hasta')}</Label>
            <SelectorFecha id="f-hasta" conHora valor={filtros.hasta ?? ''} onCambiar={(valor) => actualizarFiltro('hasta', valor)} invalido={errorRango !== null} aria-describedby={errorRango ? 'historial-error-rango' : undefined} />
          </div>
        </div>
        <div className="col-span-full flex flex-wrap items-center gap-2">
          <Button type="submit" size="sm">{t('historial.aplicar')}</Button>
          {hayFiltros && (
            <Button type="button" variant="ghost" size="sm" className="text-muted" onClick={limpiar}>
              <FilterX aria-hidden />
              {t('historial.limpiar')}
            </Button>
          )}
          <span aria-live="polite" className="nums ml-auto text-meta text-faint">
            {cargando ? t('comunes.consultando') : t('historial.filtro.resultadosPeriodo', { count: total })}
          </span>
        </div>
      </form>
      {errorRango && (
        <p id="historial-error-rango" role="alert" className="mx-3 mt-2.5 rounded-(--radius-field) bg-critical-tint px-3 py-2 text-meta text-critical sm:mx-4">
          {errorRango}
        </p>
      )}
      <ChipsFiltro chips={chips} idFocoAlVaciar="f-device" />
    </>
  )

  const cambiarPagina = (n: number) => {
    if (n !== pagina) void irAPagina(n)
  }

  const primeraCarga = cargando && lecturas.length === 0 && !errorCarga
  const sinDatos = !cargando && !errorCarga && total === 0
  // HU-36 esc. 2: el periodo no tiene telemetría (no es que el filtro de riesgo la oculte).
  const periodoSinDatos = !aplicados.riesgo_efectivo || (!cargandoSerie && resumen.n === 0)

  const tabla = errorCarga ? (
    <div className="p-3 sm:p-4">
      <EstadoError mensaje={t('historial.errorCargar')}>
        <Button variant="secondary" size="sm" className="mt-3" onClick={() => void consultar(aplicados)}>
          {t('comunes.reintentar')}
        </Button>
      </EstadoError>
    </div>
  ) : primeraCarga ? (
    <EstadoCarga texto={t('historial.cargando')} />
  ) : sinDatos ? (
    <div className="p-3 sm:p-4">
      {periodoSinDatos ? (
        <EstadoVacio ilustracion="sin-datos" titulo={t('historial.sinDatosRango')} detalle={t('historial.vacio.periodoDetalle', { periodo: textoPeriodo })}>
          {hayFiltros && <Button variant="secondary" size="sm" onClick={limpiar}>{t('comunes.quitarFiltros')}</Button>}
        </EstadoVacio>
      ) : (
        <EstadoVacio ilustracion="sin-resultados" titulo={t('historial.vacio.filtrosTitulo')} detalle={t('historial.vacio.filtrosDetalle')}>
          <Button variant="secondary" size="sm" onClick={limpiar}>{t('comunes.quitarFiltros')}</Button>
        </EstadoVacio>
      )}
    </div>
  ) : (
    <div id="historial-datos-tabla">
      <TablaRegistros
        titulo={t('historial.titulo')}
        columnas={4 + (variosEquipos ? 1 : 0) + (conAmbiente ? 2 : 0)}
        filas={lecturas}
        clave={claveLectura}
        fechaDe={fechaDe}
        cargando={cargando}
        expandida={expandida}
        onExpandir={setExpandida}
        etiquetaBoton={(l, abierta) => t(abierta ? 'historial.fila.ocultarDetalle' : 'historial.fila.verDetalle', { hora: hora(l.timestamp), equipo: l.device_id })}
        resumenDia={(clave) => {
          // Cifras del día completo según la serie; con filtro de riesgo no
          // describirían las filas listadas, así que se omiten.
          const dia = aplicados.riesgo_efectivo ? undefined : porDia.get(clave)
          if (!dia) return null
          return (
            <>
              {t('historial.dia.resumen', { n: dia.n, min: cifra(dia.min), max: cifra(dia.max) })}
              {dia.excursiones > 0 && (
                <span className="ml-2 inline-flex items-center gap-1 text-critical">
                  <OctagonAlert aria-hidden className="size-3.5" />
                  {t('historial.dia.excursiones', { count: dia.excursiones })}
                </span>
              )}
            </>
          )
        }}
        encabezados={
          <>
            <EncabezadoRegistro className="w-[128px] whitespace-nowrap">{t('historial.columnas.hora')}</EncabezadoRegistro>
            {variosEquipos && <EncabezadoRegistro className="w-[136px]">{t('historial.dispositivo')}</EncabezadoRegistro>}
            <EncabezadoRegistro className="w-[144px] text-right">{t('historial.tempInterna')}</EncabezadoRegistro>
            <EncabezadoRegistro className="w-[144px]">{t('historial.riesgo')}</EncabezadoRegistro>
            {/* Sin ancho fijo: toma el sobrante. Con 132 px la suma pasaba de 720 y a 768 px la tabla se desplazaba. */}
            <EncabezadoRegistro>{t('historial.puerta')}</EncabezadoRegistro>
            {conAmbiente && (
              <>
                <EncabezadoRegistro className="w-[112px] text-right">{t('historial.tempAmbiental')}</EncabezadoRegistro>
                <EncabezadoRegistro className="w-[96px] text-right">{t('historial.humedad')}</EncabezadoRegistro>
              </>
            )}
          </>
        }
        renderCeldas={(lectura) => (
          <>
            <CeldaRegistro area="a" className="nums text-body text-subtle sm:whitespace-nowrap">
              {hora(lectura.timestamp)}
              {variosEquipos && <span className="codigo ml-2 whitespace-nowrap text-meta text-muted sm:hidden">{lectura.device_id}</span>}
            </CeldaRegistro>
            {variosEquipos && (
              <CeldaRegistro area="oculta" className="codigo whitespace-nowrap text-body text-subtle">{lectura.device_id}</CeldaRegistro>
            )}
            <CeldaRegistro area="c" className="text-right">
              <span className="inline-flex flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-3">
                <span className="whitespace-nowrap">
                  <span className={cn('nums text-body font-semibold text-foreground max-sm:text-title', lectura.riesgo_efectivo && CIFRA_RIESGO[lectura.riesgo_efectivo])}>{cifra(lectura.temperatura_interna)}</span>
                  <span className="ml-0.5 text-meta font-medium text-muted"> °C</span>
                </span>
                {lectura.temperatura_interna != null && (
                  <Regla tamano="s" decorativa valor={lectura.temperatura_interna} tono={tonoDesdeRiesgo(lectura.riesgo_efectivo)} />
                )}
              </span>
            </CeldaRegistro>
            {/* HU-34: el riesgo EFECTIVO, no la clase cruda de la IA. */}
            <CeldaRegistro area="b">
              <RiskBadge nivel={lectura.riesgo_efectivo} />
              {lectura.apertura_refrigerador && (
                <span className="ml-2 text-meta text-warning-700 sm:hidden">{t('dashboard.puertaAbierta')}</span>
              )}
            </CeldaRegistro>
            <CeldaRegistro area="oculta" className="text-body">
              {/* HU-35 criterio 4: sin sensor de puerta, null no es «cerrada». */}
              {lectura.apertura_refrigerador === null ? (
                <span role="img" className="text-faint" title={t('dashboard.puertaSinSensor')} aria-label={t('dashboard.puertaSinSensor')}>—</span>
              ) : lectura.apertura_refrigerador ? (
                <span className="inline-flex items-center gap-1.5 font-medium text-warning-700">
                  <DoorOpen aria-hidden className="size-4 shrink-0" />
                  {lectura.duracion_apertura_segundos ? t('historial.detalle.puertaAbiertaDuracion', { duracion: duracionBreve(lectura.duracion_apertura_segundos) }) : t('dashboard.puertaAbierta')}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-muted">
                  <DoorClosed aria-hidden className="size-4 shrink-0" />
                  {t('dashboard.puertaCerrada')}
                </span>
              )}
            </CeldaRegistro>
            {conAmbiente && (
              <>
                <CeldaRegistro area="oculta" className="nums text-right text-meta text-muted">{cifra(lectura.temperatura_ambiental)} °C</CeldaRegistro>
                <CeldaRegistro area="oculta" className="nums text-right text-meta text-muted">{cifra(lectura.humedad_ambiental, 0)} %</CeldaRegistro>
              </>
            )}
          </>
        )}
        renderDetalle={(lectura) => <DetalleLectura lectura={lectura} onVerOrigen={() => void abrirEvidencia(lectura)} />}
      />
      <div className="border-t border-border px-3 sm:px-4">
        <Paginacion total={total} pagina={pagina} onCambiar={cambiarPagina} tamano={tamanoPagina} />
      </div>
    </div>
  )

  const conDatos = resumen.n > 0

  return (
    <div className="space-y-4">
      <PageHeader titulo={t('historial.titulo')} descripcion={t('historial.descripcion')} meta={meta} />

      {conDatos && (
        <TiraEstado
          etiqueta={t('historial.resumen.etiqueta')}
          apilarGuia
          guia={guia}
          segmentos={[
            { clave: 'lecturas', etiqueta: t('historial.resumen.lecturas'), valor: resumen.n },
            { clave: 'rango', etiqueta: t('historial.resumen.enRango'), valor: resumen.pctEnRango == null ? '—' : `${formatearCifra(resumen.pctEnRango * 100, 1)} %` },
            { clave: 'excursiones', etiqueta: t('historial.resumen.excursiones'), valor: resumen.excursiones.length, tono: resumen.excursiones.length > 0 ? 'critico' : 'neutro' },
            // Bajo 1024 px mínima y máxima van juntas: con 5 segmentos la tira
            // dejaba «Máxima» sola en otra fila (a 375 y a 768 px).
            { clave: 'min', etiqueta: t('historial.resumen.minima'), valor: `${cifra(resumen.min)} °C`, className: 'max-lg:hidden' },
            { clave: 'max', etiqueta: t('historial.resumen.maxima'), valor: `${cifra(resumen.max)} °C`, className: 'max-lg:hidden' },
            { clave: 'minmax', etiqueta: t('historial.resumen.minMax'), valor: `${cifra(resumen.min)} – ${cifra(resumen.max)} °C`, className: 'lg:hidden' },
          ]}
        />
      )}
      {(noDibujadas.sinHora > 0 || noDibujadas.manuales > 0 || series.some((s) => s.brechas_truncadas)) && (
        <p role="status" className="flex items-start gap-1.5 text-meta text-faint">
          <Info aria-hidden className="mt-0.5 size-3.5 shrink-0" />
          <span>
            {[
              noDibujadas.sinHora > 0 ? t('historial.curva.sinHora', { count: noDibujadas.sinHora }) : null,
              noDibujadas.manuales > 0 ? t('historial.curva.manuales', { count: noDibujadas.manuales }) : null,
              series.some((s) => s.brechas_truncadas) ? t('historial.curva.brechasTruncadas') : null,
            ].filter(Boolean).join(' ')}
          </span>
        </p>
      )}

      <PlantillaBandeja
        etiquetaRail={t('historial.rail.etiqueta')}
        superior={
          conDatos ? (
            <section aria-labelledby="historial-curva-titulo" className="superficie p-4 xl:p-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <h2 id="historial-curva-titulo" className="text-title text-foreground">{t('historial.curva.titulo')}</h2>
                <p className="nums text-meta text-faint">
                  {`${intervaloSerie ? t('historial.curva.agregada', { intervalo: duracionLegible(intervaloSerie) }) : ''} · ${t('dashboard.rangoConservacion')}`}
                </p>
              </div>
              {/* HU-36 criterio 1: el mismo periodo filtrado alimenta la gráfica y la tabla. */}
              <div id="historial-grafica" aria-busy={cargandoSerie || undefined} className={revelarCurva ? 'revelar-grafica' : undefined}>
                <GraficaDiferida option={opcionHistorial} height="clamp(220px, 30vh, 280px)" ariaLabel={t('historial.curva.etiqueta', { n: resumen.n, periodo: textoPeriodo })} ariaDescribedBy="historial-datos-tabla" />
              </div>
            </section>
          ) : errorSerie && !cargandoSerie && (total > 0 || errorSerie === 'no_encontrado') ? (
            <p role="status" className="superficie flex items-start gap-2 p-4 text-body text-muted">
              <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
              {errorSerie === 'no_encontrado' ? t('historial.curva.equipoNoEncontrado', { equipo: aplicados.device_id }) : t('historial.curva.error')}
            </p>
          ) : undefined
        }
        rail={conDatos ? <RailHistorial resumen={resumen} onVerExcursion={verExcursion} /> : undefined}
        inferior={
          <div className="superficie overflow-clip">
            {barra}
            {tabla}
          </div>
        }
      />

      <PanelEvidencia
        lectura={lecturaDetalle}
        evidencia={evidencia}
        cargando={cargandoEvidencia}
        error={errorEvidencia}
        onCerrar={() => setLecturaDetalle(null)}
      />
    </div>
  )
}

/** Detalle de una lectura: los campos técnicos que no caben en la fila. */
function DetalleLectura({ lectura, onVerOrigen }: { lectura: LecturaTermica; onVerOrigen: () => void }) {
  const { t } = useTranslation()
  const retraso =
    lectura.received_at && (lectura.captured_at ?? lectura.timestamp)
      ? Math.round((Date.parse(lectura.received_at) - Date.parse(lectura.captured_at ?? lectura.timestamp)) / 1000)
      : null
  return (
    <>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 xl:grid-cols-4">
        <Dato etiqueta={t('historial.tempAmbiental')} icono={ThermometerSun} className="nums">{cifra(lectura.temperatura_ambiental)} °C</Dato>
        <Dato etiqueta={t('historial.humedad')} icono={Droplets} className="nums">{cifra(lectura.humedad_ambiental, 0)} %</Dato>
        <Dato etiqueta={t('historial.puerta')} icono={lectura.apertura_refrigerador ? DoorOpen : DoorClosed}>
          {lectura.apertura_refrigerador === null
            ? t('dashboard.puertaSinSensor')
            : lectura.apertura_refrigerador
              ? `${t('dashboard.puertaAbierta')}${lectura.duracion_apertura_segundos ? ` · ${duracionBreve(lectura.duracion_apertura_segundos)}` : ''}${lectura.apertura_continua_segundos ? ` (${duracionBreve(lectura.apertura_continua_segundos)})` : ''}`
              : t('dashboard.puertaCerrada')}
        </Dato>
        <Dato etiqueta={t('historial.detalle.conexion')} icono={lectura.estado_conectividad === 'online' ? Wifi : WifiOff}>
          {t(`conectividad.${lectura.estado_conectividad}`, { defaultValue: lectura.estado_conectividad || '—' })}
        </Dato>
        <Dato etiqueta={t('historial.detalle.calidadHora')} icono={Timer}>
          {lectura.time_quality ? t(`historial.detalle.calidad.${lectura.time_quality}`) : '—'}
        </Dato>
        <Dato etiqueta={t('historial.detalle.recibida')} icono={Inbox} className="nums">
          {lectura.received_at ? (
            <>
              {fechaHora(lectura.received_at)}
              {retraso != null && retraso > 0 && <span className="block text-meta text-muted">{t('historial.detalle.retraso', { s: retraso })}</span>}
            </>
          ) : '—'}
        </Dato>
        <Dato etiqueta={t('historial.detalle.secuencia')} icono={Hash} className="codigo">
          {lectura.seq_no != null || lectura.boot_id ? `${lectura.seq_no ?? '—'} · ${lectura.boot_id ?? '—'}` : '—'}
        </Dato>
        <Dato etiqueta={t('historial.detalle.origen')} icono={Brain}>
          {lectura.origen_clasificacion ? t(`historial.detalle.origenes.${lectura.origen_clasificacion}`) : '—'}
        </Dato>
        <Dato etiqueta={t('historial.idLectura')} className="flex min-w-0 items-center gap-1">
          <span className="codigo min-w-0 truncate">{lectura.id ?? '—'}</span>
          {lectura.id && <BotonCopiar valor={lectura.id} campo={t('historial.idLectura')} />}
        </Dato>
        <Dato etiqueta={t('historial.fecha')} className="nums">{fechaCorta(lectura.timestamp)} {hora(lectura.timestamp)}</Dato>
      </dl>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" disabled={!lectura.id} onClick={onVerOrigen}>
          {t('historial.verEvidencia')}
        </Button>
      </div>
    </>
  )
}
