import { useId, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Fingerprint, FlaskConical, Link2, Search, ShieldAlert, ShieldCheck, ShieldQuestion } from 'lucide-react'

import { useTrazabilidad } from '@/application/hooks/useTrazabilidad'
import { useAuthStore } from '@/application/stores/authStore'
import type { RegistroTrazabilidad, VerificacionSegmento } from '@/domain/entities/RegistroTrazabilidad'
import { apiClient } from '@/infrastructure/api/apiClient'
import { MODO_DEMO } from '@/infrastructure/demo/modoDemo'
import { contarPorDia } from '@/lib/agruparPorDia'
import { instanteDelPeriodo } from '@/lib/limitesPeriodo'
import { fechaISOlocal, fechaHora, hora } from '@/lib/formato'
import { rangoPagina } from '@/lib/paginacion'
import { cn } from '@/lib/utils'
import { useResponsivePageSize } from '@/presentation/hooks/useResponsivePageSize'
import { EstadoCarga, EstadoError, EstadoVacio } from '../components/EstadoPagina'
import { Paginacion } from '../components/Paginacion'
import { PageHeader } from '../components/PageHeader'
import { BotonCopiar, ChipsFiltro, Dato, PlantillaBandeja, TarjetaRail, type Chip } from '../components/registros/piezas'
import { CeldaRegistro, EncabezadoRegistro, TablaRegistros } from '../components/registros/TablaRegistros'
import { idBotonFila } from '../components/registros/ids'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Detalles } from '../components/ui/detalles'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../components/ui/dialog'
import { Input, Label, NativeSelect } from '../components/ui/input'
import { SelectorFecha } from '../components/ui/selector-fecha'
import { etiquetaEvento, iconoEvento, resumenPayload } from './trazabilidad/iconosEvento'
import { AlcanceVerificacion, ComparacionSellos, VeredictoCadena } from './trazabilidad/VeredictoCadena'

const TIPOS_EVENTO = ['LECTURA_TERMICA', 'ALERTA_TERMICA', 'ACCION_CORRECTIVA', 'REPORTE_BPA', 'AUDITORIA', 'CONECTIVIDAD']
const fechaDe = (r: RegistroTrazabilidad) => r.timestamp
const claveRegistro = (r: RegistroTrazabilidad) => r.id
const humanizar = (clave: string) => clave.replaceAll('_', ' ').replace(/^\p{L}/u, (l) => l.toLocaleUpperCase())

export function TrazabilidadPage() {
  const { t } = useTranslation()
  const {
    registros, cargando, errorCarga, consultar,
    verificacion, verificando, verificarIntegridad, errorVerificacion, cadenas = [], estadoCadena, aislarCorrupcion,
    verificacionSegmento, verificandoSegmento, errorSegmento, verificarPorDispositivo,
  } = useTrazabilidad()
  // HU-26: cadena a verificar ('' = todas a la vez).
  const [cadenaElegida, setCadenaElegida] = useState('')
  const [pagina, setPagina] = useState(1)
  const tamanoPagina = useResponsivePageSize()
  // HU-37: verificación acotada a un dispositivo y periodo.
  const [segmentoDeviceId, setSegmentoDeviceId] = useState('')
  const [segmentoDesde, setSegmentoDesde] = useState('')
  const [segmentoHasta, setSegmentoHasta] = useState('')
  // HU-37 esc. 1: el periodo se acota por hora, no solo por días completos.
  const [segmentoHoraDesde, setSegmentoHoraDesde] = useState('')
  const [segmentoHoraHasta, setSegmentoHoraHasta] = useState('')
  const [faltaDesde, setFaltaDesde] = useState(false)
  const [tipoEvento, setTipoEvento] = useState('')
  const [equipo, setEquipo] = useState('')
  const [equipoAplicado, setEquipoAplicado] = useState('')
  const [mostrarSellos, setMostrarSellos] = useState(false)
  const [expandida, setExpandida] = useState<string | null>(null)
  const [aislando, setAislando] = useState(false)
  const [confirmarAislar, setConfirmarAislar] = useState(false)
  const [errorAislar, setErrorAislar] = useState<'error' | 'conflicto' | null>(null)
  const [fueraDeLista, setFueraDeLista] = useState(false)
  const usuario = useAuthStore((s) => s.usuario)
  const idEquipos = useId()

  // La firma evita reiniciar la vista cuando llega la misma lista otra vez.
  const firma = `${registros.length}:${registros[0]?.id}:${registros.at(-1)?.id}`
  const [firmaPrevia, setFirmaPrevia] = useState(firma)
  if (firmaPrevia !== firma) {
    setFirmaPrevia(firma)
    setPagina(1)
    setExpandida(null)
  }
  const visibles = useMemo(() => registros.slice(...rangoPagina(pagina, tamanoPagina)), [registros, pagina, tamanoPagina])
  const porDia = useMemo(() => contarPorDia(registros, fechaDe), [registros])
  const equiposVistos = useMemo(
    () => [...new Set([...cadenas.filter((c) => !c.es_sistema).map((c) => c.chain_id), ...registros.flatMap((r) => (r.device_id ? [r.device_id] : []))])].sort(),
    [cadenas, registros],
  )
  const composicion = useMemo(() => {
    const mapa = new Map<string, number>()
    for (const r of registros) mapa.set(r.tipo_evento, (mapa.get(r.tipo_evento) ?? 0) + 1)
    return [...mapa.entries()].sort((a, b) => b[1] - a[1])
  }, [registros])
  const maxComposicion = Math.max(1, ...composicion.map(([, n]) => n))

  const detalle = verificacion?.detalle_inconsistencia ?? null
  const estadoVerificacion = verificacion?.estado ?? (verificacion?.integra ? 'integra' : 'ruptura_detectada')
  const puedeAislar = usuario?.rol === 'administrador' && Boolean(detalle) && estadoVerificacion === 'ruptura_detectada'

  // El rango invertido se marca en los dos campos y se explica antes de enviar.
  const inicioSegmento = segmentoDesde ? instanteDelPeriodo(segmentoDesde, segmentoHoraDesde, 'inicio') : null
  const finSegmento = segmentoHasta ? instanteDelPeriodo(segmentoHasta, segmentoHoraHasta, 'fin') : null
  const segmentoInvertido = Boolean(inicioSegmento && finSegmento && inicioSegmento.getTime() > finSegmento.getTime())
  const mensajeSegmento =
    segmentoInvertido || errorSegmento === 'rango_invalido' ? t('trazabilidad.rangoInvalido') : errorSegmento ? t('comunes.error') : null

  const consultarCon = (tipo: string, deviceId: string) => {
    setTipoEvento(tipo)
    setEquipo(deviceId)
    setEquipoAplicado(deviceId)
    setFueraDeLista(false)
    void consultar(tipo || undefined, deviceId || undefined)
  }

  const aislar = async () => {
    if (!detalle) return
    setAislando(true)
    setErrorAislar(null)
    const resultado = await aislarCorrupcion(detalle.id)
    setAislando(false)
    if (resultado === 'ok') setConfirmarAislar(false)
    else setErrorAislar(resultado === 'conflicto' ? 'conflicto' : 'error')
  }

  const verificarCadena = () => void verificarIntegridad(cadenaElegida || undefined)
  const mensajeVerificacion = errorVerificacion
    ? {
        sin_registros: t('trazabilidad.cadena.sinRegistros', { cadena: cadenaElegida }),
        limite: t('trazabilidad.limiteVerificaciones'),
        error: t('trazabilidad.errorVerificar'),
      }[errorVerificacion]
    : null
  const selectorCadena = (
    <div className="w-full sm:w-56">
      <Label htmlFor="cadena-verificar" className="text-meta text-muted">{t('trazabilidad.cadena.etiqueta')}</Label>
      <NativeSelect
        id="cadena-verificar"
        className="h-9 pointer-coarse:h-11"
        value={cadenaElegida}
        disabled={verificando}
        aria-describedby="cadena-verificar-ayuda"
        onChange={(e) => setCadenaElegida(e.target.value)}
      >
        <option value="">{t('trazabilidad.cadena.todas')}</option>
        {[...cadenas]
          .sort((a, b) => Number(a.es_sistema) - Number(b.es_sistema) || a.chain_id.localeCompare(b.chain_id))
          .map((c) => (
            <option key={c.chain_id} value={c.chain_id}>
              {t('trazabilidad.cadena.opcion', { cadena: c.es_sistema ? t('trazabilidad.cadena.sistemaCorto') : c.chain_id, count: c.total_registros })}
            </option>
          ))}
      </NativeSelect>
      <p id="cadena-verificar-ayuda" className="sr-only">{t('trazabilidad.cadena.ayuda')}</p>
    </div>
  )

  const verificarSegmento = () => {
    // «Desde» es obligatorio: el campo se marca y recibe el foco.
    if (!segmentoDesde) {
      setFaltaDesde(true)
      document.getElementById('seg-desde')?.focus()
      return
    }
    if (!segmentoDeviceId || segmentoInvertido || !inicioSegmento) return
    // Sin «Hasta», hasta ahora; con fecha y sin hora, hasta el final de ese día.
    const hastaISO = finSegmento ? finSegmento.toISOString() : new Date().toISOString()
    void verificarPorDispositivo(segmentoDeviceId, inicioSegmento.toISOString(), hastaISO)
  }

  const irAFila = (id: string) => {
    const indice = registros.findIndex((r) => r.id === id)
    if (indice < 0) {
      setFueraDeLista(true)
      return
    }
    setFueraDeLista(false)
    setPagina(Math.floor(indice / tamanoPagina) + 1)
    setExpandida(id)
    requestAnimationFrame(() => {
      const boton = document.getElementById(idBotonFila(id))
      const reducido = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
      boton?.scrollIntoView?.({ block: 'center', behavior: reducido ? 'auto' : 'smooth' })
      boton?.focus({ preventScroll: true })
    })
  }

  const chips: Chip[] = []
  if (tipoEvento) chips.push({ clave: 'tipo', texto: t('trazabilidad.filtro.chipTipo', { valor: etiquetaEvento(tipoEvento, t) }), quitar: () => consultarCon('', equipoAplicado) })
  if (equipoAplicado) chips.push({ clave: 'equipo', texto: t('trazabilidad.filtro.chipEquipo', { valor: equipoAplicado }), quitar: () => consultarCon(tipoEvento, '') })
  const hayFiltros = chips.length > 0

  const meta =
    registros.length > 0
      ? t('trazabilidad.meta', { n: registros.length, desde: fechaHora(registros.at(-1)?.timestamp).split(',')[0], hasta: fechaHora(registros[0].timestamp).split(',')[0] })
      : undefined

  const barra = (
    <>
      <form
        role="search"
        aria-label={t('trazabilidad.filtro.etiqueta')}
        className="flex flex-wrap items-end gap-x-3 gap-y-2 border-b border-border px-3 py-2.5 sm:px-4"
        onSubmit={(e) => {
          e.preventDefault()
          consultarCon(tipoEvento, equipo.trim())
        }}
      >
        {/* 208 px: «Ej.: FARM-01-CDL» y el chevron de sugerencias caben sin cortarse. */}
        <div className="w-full sm:w-52">
          <Label htmlFor="f-equipo-traza" className="text-meta text-muted">{t('trazabilidad.filtro.equipo')}</Label>
          <div className="relative">
            <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" />
            <Input id="f-equipo-traza" list={idEquipos} className="h-9 pl-9 pointer-coarse:h-11" value={equipo} onChange={(e) => setEquipo(e.target.value)} placeholder={t('historial.codigoEquipoEjemplo')} />
            <datalist id={idEquipos}>{equiposVistos.map((d) => <option key={d} value={d} />)}</datalist>
          </div>
        </div>
        <div className="w-full sm:w-48">
          <Label htmlFor="f-evento" className="text-meta text-muted">{t('trazabilidad.tipoEvento')}</Label>
          <NativeSelect id="f-evento" className="h-9 pointer-coarse:h-11" value={tipoEvento} onChange={(e) => consultarCon(e.target.value, equipoAplicado)}>
            <option value="">{t('trazabilidad.todosEventos')}</option>
            {TIPOS_EVENTO.map((tipo) => <option key={tipo} value={tipo}>{etiquetaEvento(tipo, t)}</option>)}
          </NativeSelect>
        </div>
        <div className="flex flex-1 flex-wrap items-center gap-1">
          <Button type="button" variant="ghost" size="sm" className="h-9 pointer-coarse:h-11" aria-expanded={mostrarSellos} onClick={() => setMostrarSellos((actual) => !actual)}>
            <Fingerprint aria-hidden />
            {mostrarSellos ? t('trazabilidad.ocultarSellos') : t('trazabilidad.mostrarSellos')}
          </Button>
          {MODO_DEMO && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-9 pointer-coarse:h-11"
              onClick={async () => {
                await apiClient.post('/api/demo/trazabilidad/simular-inconsistencia')
                await verificarIntegridad(cadenaElegida || undefined)
              }}
            >
              <FlaskConical aria-hidden />
              {t('trazabilidad.simularDemo')}
            </Button>
          )}
          <span aria-live="polite" className="nums ml-auto text-meta text-faint">
            {cargando ? t('comunes.consultando') : t('trazabilidad.filtro.resultados', { count: registros.length })}
          </span>
        </div>
      </form>
      <ChipsFiltro chips={chips} idFocoAlVaciar="f-equipo-traza" />
    </>
  )

  const tabla =
    cargando && registros.length === 0 ? (
      <EstadoCarga />
    ) : errorCarga ? (
      <div className="p-3 sm:p-4">
        <EstadoError mensaje={t('comunes.errorCargar')}>
          <Button variant="secondary" size="sm" className="mt-3" onClick={() => void consultar(tipoEvento || undefined, equipoAplicado || undefined)}>
            {t('comunes.reintentar')}
          </Button>
        </EstadoError>
      </div>
    ) : registros.length === 0 ? (
      <div className="p-3 sm:p-4">
        {hayFiltros ? (
          <EstadoVacio ilustracion="sin-resultados" titulo={t('trazabilidad.vacio.filtrosTitulo')} detalle={t('trazabilidad.vacio.filtrosDetalle')}>
            <Button variant="secondary" size="sm" onClick={() => consultarCon('', '')}>{t('comunes.quitarFiltros')}</Button>
          </EstadoVacio>
        ) : (
          <EstadoVacio ilustracion="sin-datos" titulo={t('trazabilidad.sinRegistros')}>
            <Button variant="secondary" size="sm" onClick={() => void consultar()}>{t('auditoria.vacio.actualizar')}</Button>
          </EstadoVacio>
        )}
      </div>
    ) : (
      <>
        <TablaRegistros
          titulo={t('trazabilidad.titulo')}
          columnas={mostrarSellos ? 5 : 4}
          filas={visibles}
          clave={claveRegistro}
          fechaDe={fechaDe}
          cargando={cargando}
          expandida={expandida}
          onExpandir={setExpandida}
          marca={(r) => (detalle?.id === r.id ? 'corrupta' : undefined)}
          propsFila={(r) => ({ 'data-testid': detalle?.id === r.id ? 'fila-corrupta' : undefined })}
          etiquetaBoton={(r, abierta) => t(abierta ? 'trazabilidad.fila.ocultarDetalle' : 'trazabilidad.fila.verDetalle', { evento: etiquetaEvento(r.tipo_evento, t), hora: hora(r.timestamp) })}
          resumenDia={(clave) => t('trazabilidad.dia.resumen', { count: porDia.get(clave)?.length ?? 0 })}
          encabezados={
            <>
              <EncabezadoRegistro className="w-12 px-0 first:pl-0"><span className="sr-only">{t('trazabilidad.columnas.cadena')}</span></EncabezadoRegistro>
              <EncabezadoRegistro className="w-[124px] whitespace-nowrap">{t('trazabilidad.columnas.hora')}</EncabezadoRegistro>
              <EncabezadoRegistro>{t('trazabilidad.evento')}</EncabezadoRegistro>
              <EncabezadoRegistro className="w-[136px]">{t('historial.dispositivo')}</EncabezadoRegistro>
              {mostrarSellos && <EncabezadoRegistro className="w-[220px]">{t('trazabilidad.sellos')}</EncabezadoRegistro>}
            </>
          }
          renderCeldas={(r) => {
            const Icono = iconoEvento(r.tipo_evento)
            const corrupto = detalle?.id === r.id
            const resumen = resumenPayload(r, t)
            return (
              <>
                {/* La cadena de custodia como carril: un nodo neutro por registro. */}
                <CeldaRegistro area="oculta" className="relative px-0 py-0 first:pl-0 before:absolute before:inset-y-0 before:left-1/2 before:w-px before:-translate-x-1/2 before:bg-border">
                  <span data-corrupta={corrupto || undefined} className="relative z-[1] mx-auto flex size-6 items-center justify-center rounded-full bg-surface text-muted ring-1 ring-border data-[corrupta]:text-critical data-[corrupta]:ring-critical">
                    {corrupto ? <ShieldAlert aria-hidden className="size-3.5" /> : <Icono aria-hidden className="size-3.5" />}
                  </span>
                </CeldaRegistro>
                <CeldaRegistro area="oculta" className="nums whitespace-nowrap text-body text-subtle">{hora(r.timestamp)}</CeldaRegistro>
                <CeldaRegistro area="a">
                  <div className="flex min-w-0 items-start gap-2">
                    <Icono aria-hidden className="mt-0.5 size-4 shrink-0 text-muted sm:hidden" />
                    <div className="min-w-0">
                      <p className="truncate text-body text-foreground">
                        {corrupto && <span className="sr-only">{t('trazabilidad.registroAfectado')}: </span>}
                        {etiquetaEvento(r.tipo_evento, t)}
                      </p>
                      {resumen && <p className="hidden truncate text-meta text-faint sm:block">{resumen}</p>}
                    </div>
                  </div>
                </CeldaRegistro>
                {/* Bajo 640 px hora, equipo y resumen comparten esta línea: hasta 2 líneas en vez de cortarse. */}
                <CeldaRegistro area="b" className="codigo truncate text-body text-subtle max-sm:text-meta max-sm:text-muted">
                  <span className="max-sm:line-clamp-2 max-sm:whitespace-normal max-sm:[overflow-wrap:anywhere]">
                    <span className="nums sm:hidden">{hora(r.timestamp)} · </span>
                    {r.device_id ?? '—'}
                    {resumen && <span className="sm:hidden"> · {resumen}</span>}
                  </span>
                </CeldaRegistro>
                {mostrarSellos && (
                  <CeldaRegistro area="oculta" className="codigo text-meta text-faint">
                    <span className="flex items-center gap-1.5">
                      {r.previous_hash.slice(0, 8)}…<Link2 aria-hidden className="size-3 shrink-0" />{r.hash_actual.slice(0, 8)}…
                    </span>
                  </CeldaRegistro>
                )}
                {corrupto && (
                  <CeldaRegistro area="c" className="sm:hidden">
                    <Badge variant="critical">{t('trazabilidad.corrupto')}</Badge>
                  </CeldaRegistro>
                )}
              </>
            )
          }}
          renderDetalle={(r) => (
            <DetalleRegistro
              registro={r}
              corrupto={detalle?.id === r.id ? detalle : null}
              onVerificarDia={
                r.device_id
                  ? () => {
                      setSegmentoDeviceId(r.device_id ?? '')
                      const dia = fechaISOlocal(new Date(r.timestamp))
                      setSegmentoDesde(dia)
                      setSegmentoHasta(dia)
                      setFaltaDesde(false)
                      requestAnimationFrame(() => document.getElementById('seg-enviar')?.focus())
                    }
                  : undefined
              }
            />
          )}
        />
        <div className="border-t border-border px-3 sm:px-4">
          <Paginacion total={registros.length} pagina={pagina} onCambiar={setPagina} tamano={tamanoPagina} />
        </div>
      </>
    )

  return (
    <div className="space-y-4">
      <PageHeader titulo={t('trazabilidad.titulo')} descripcion={t('trazabilidad.descripcion')} meta={meta} />

      <PlantillaBandeja
        etiquetaRail={t('trazabilidad.rail')}
        superior={
          <>
            <VeredictoCadena
              verificacion={verificacion}
              estadoCadena={estadoCadena}
              verificando={verificando}
              registros={registros}
              onVerificar={verificarCadena}
              onAislar={puedeAislar ? () => setConfirmarAislar(true) : undefined}
              onVerEnTabla={detalle ? () => irAFila(detalle.id) : undefined}
              selectorCadena={selectorCadena}
              error={mensajeVerificacion}
            />
            {fueraDeLista && (
              <p role="status" className="flex flex-wrap items-center gap-2 text-meta text-muted">
                {t('trazabilidad.veredicto.fueraDeLista', { n: registros.length })}
                {hayFiltros && (
                  <Button variant="ghost" size="sm" onClick={() => consultarCon('', '')}>
                    {t('trazabilidad.veredicto.verTodosLosTipos')}
                  </Button>
                )}
              </p>
            )}
          </>
        }
        rail={
          <>
            {/* ── HU-37: verificación acotada a un dispositivo y periodo ── */}
            <TarjetaRail titulo={t('trazabilidad.verificarSegmento')}>
              <form aria-label={t('trazabilidad.verificarSegmento')} className="grid gap-3" onSubmit={(e) => { e.preventDefault(); verificarSegmento() }}>
                <div>
                  <Label htmlFor="seg-device">{t('historial.dispositivo')}</Label>
                  <Input id="seg-device" list={`${idEquipos}-seg`} value={segmentoDeviceId} onChange={(e) => setSegmentoDeviceId(e.target.value)} placeholder={t('historial.codigoEquipoEjemplo')} required />
                  <datalist id={`${idEquipos}-seg`}>{equiposVistos.map((d) => <option key={d} value={d} />)}</datalist>
                </div>
                <div>
                  <Label htmlFor="seg-desde">{t('historial.desde')}</Label>
                  <div className="grid grid-cols-[minmax(0,1fr)_8rem] gap-2">
                    <SelectorFecha id="seg-desde" valor={segmentoDesde} onCambiar={setSegmentoDesde} invalido={(faltaDesde && !segmentoDesde) || segmentoInvertido} aria-describedby="segmento-desde-ayuda" />
                    <Input
                      id="seg-desde-hora"
                      type="time"
                      step={60}
                      className="nums"
                      value={segmentoHoraDesde}
                      onChange={(e) => setSegmentoHoraDesde(e.target.value)}
                      aria-label={t('trazabilidad.horaDesde')}
                      aria-invalid={segmentoInvertido || undefined}
                      aria-describedby="segmento-desde-ayuda"
                    />
                  </div>
                  <p id="segmento-desde-ayuda" className="mt-1 text-meta text-faint">{t('trazabilidad.desdeAyuda')}</p>
                </div>
                <div>
                  <Label htmlFor="seg-hasta">{t('historial.hasta')}</Label>
                  <div className="grid grid-cols-[minmax(0,1fr)_8rem] gap-2">
                    <SelectorFecha id="seg-hasta" valor={segmentoHasta} onCambiar={setSegmentoHasta} invalido={segmentoInvertido} aria-describedby="segmento-hasta-ayuda" />
                    <Input
                      id="seg-hasta-hora"
                      type="time"
                      step={60}
                      className="nums"
                      value={segmentoHoraHasta}
                      onChange={(e) => setSegmentoHoraHasta(e.target.value)}
                      disabled={!segmentoHasta}
                      aria-label={t('trazabilidad.horaHasta')}
                      aria-invalid={segmentoInvertido || undefined}
                      aria-describedby="segmento-hasta-ayuda"
                    />
                  </div>
                  <p id="segmento-hasta-ayuda" className="mt-1 text-meta text-faint">{t('trazabilidad.hastaOpcional')}</p>
                </div>
                <Button id="seg-enviar" type="submit" variant="secondary" disabled={verificandoSegmento || segmentoInvertido} className="w-full">
                  {verificandoSegmento ? t('trazabilidad.verificando') : t('trazabilidad.verificarSegmentoBoton')}
                </Button>
              </form>
              {mensajeSegmento && (
                <p role="alert" className="mt-3 rounded-(--radius-field) bg-critical-tint px-3 py-2 text-meta text-critical">{mensajeSegmento}</p>
              )}
              {verificacionSegmento && <ResultadoSegmento resultado={verificacionSegmento} />}
              <Detalles className="mt-2" titulo={t('trazabilidad.segmento.queRevisa')}>
                <div className="space-y-2 text-meta text-muted">
                  <p>{t('trazabilidad.cadenaExplicacion')}</p>
                  {verificacionSegmento && <AlcanceVerificacion texto={verificacionSegmento.alcance} />}
                </div>
              </Detalles>
            </TarjetaRail>
            {composicion.length > 0 && (
              <TarjetaRail titulo={t('trazabilidad.composicion.titulo')}>
                <ul className="-mx-2 space-y-0.5">
                  {composicion.map(([tipo, n]) => {
                    const Icono = iconoEvento(tipo)
                    const activo = tipoEvento === tipo
                    return (
                      <li key={tipo}>
                        <button
                          type="button"
                          aria-pressed={activo}
                          aria-label={`${t('trazabilidad.composicion.filtrar', { tipo: etiquetaEvento(tipo, t) })}: ${n}`}
                          onClick={() => consultarCon(activo ? '' : tipo, equipoAplicado)}
                          className={cn(
                            'flex min-h-10 w-full cursor-pointer flex-col justify-center gap-1 rounded-(--radius-field) px-2 py-1.5 text-left transition-colors duration-(--duration-micro) hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-ring',
                            activo && 'bg-primary-tint hover:bg-primary-tint',
                          )}
                        >
                          <span className="flex w-full items-center gap-2 text-body">
                            <Icono aria-hidden className="size-4 shrink-0 text-muted" />
                            <span className="min-w-0 flex-1 truncate text-foreground">{etiquetaEvento(tipo, t)}</span>
                            <span className="nums text-meta text-muted">{n}</span>
                          </span>
                          <span aria-hidden className="block h-1 w-full overflow-hidden rounded-full bg-surface-sunken">
                            <span className="block h-full w-full origin-left rounded-full bg-border-strong" style={{ transform: `scaleX(${n / maxComposicion})` }} />
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </TarjetaRail>
            )}
          </>
        }
        inferior={
          <div className="superficie overflow-clip">
            {barra}
            {tabla}
          </div>
        }
      />

      {/* Aislar un registro inconsistente es irreversible: siempre con confirmación. */}
      <Dialog open={confirmarAislar} onOpenChange={(abierto) => { setConfirmarAislar(abierto); if (!abierto) setErrorAislar(null) }}>
        <DialogContent destructivo>
          <DialogTitle>{t('trazabilidad.aislar')}</DialogTitle>
          <DialogDescription>{t('trazabilidad.confirmarAislar')}</DialogDescription>
          {detalle && <p className="codigo mt-3 break-all rounded-(--radius-field) bg-surface-sunken px-3 py-2 text-meta">{detalle.id}</p>}
          {errorAislar && <p role="alert" className="mt-3 rounded-(--radius-field) bg-critical-tint px-3 py-2 text-meta text-critical">{errorAislar === 'conflicto' ? t('trazabilidad.aislarNoConcluida') : t('comunes.error')}</p>}
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirmarAislar(false)} disabled={aislando}>{t('comunes.cancelar')}</Button>
            <Button variant="danger" onClick={() => void aislar()} disabled={aislando}>
              <span key={aislando ? 'si' : 'no'} className="cambio-texto">{aislando ? t('trazabilidad.aislando') : t('trazabilidad.aislar')}</span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/** Detalle de un registro de la cadena: contenido, sellos completos y atajo de verificación. */
function DetalleRegistro({
  registro,
  corrupto,
  onVerificarDia,
}: {
  registro: RegistroTrazabilidad
  corrupto: Parameters<typeof ComparacionSellos>[0]['detalle'] | null
  onVerificarDia?: () => void
}) {
  const { t } = useTranslation()
  const contenido = Object.entries(registro.payload ?? {})
  const valor = (clave: string, v: unknown) => {
    if (v == null) return '—'
    if (typeof v === 'number' && /temperatura/.test(clave)) return `${v.toFixed(1)} °C`
    if (typeof v === 'string' && /riesgo/.test(clave)) return t(`riesgo.${v}`, { defaultValue: v })
    if (typeof v === 'boolean') return v ? t('comunes.si') : t('comunes.no')
    return typeof v === 'object' ? JSON.stringify(v) : String(v)
  }
  return (
    <>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 xl:grid-cols-4">
        <Dato etiqueta={t('trazabilidad.fecha')} className="nums">{fechaHora(registro.timestamp)}</Dato>
        <Dato etiqueta={t('auditoria.detalle.fechaUtc')} className="codigo text-meta">{registro.timestamp}</Dato>
        <Dato etiqueta={t('trazabilidad.detalle.codigoEvento')} className="codigo">{registro.tipo_evento}</Dato>
        <Dato etiqueta={t('historial.dispositivo')} className="codigo">{registro.device_id ?? '—'}</Dato>
        <Dato etiqueta={t('trazabilidad.detalle.usuario')} className="codigo break-all">{registro.usuario_id ?? '—'}</Dato>
      </dl>
      <div className="mt-3 border-t border-border pt-3">
        <p className="text-meta font-medium text-muted">{t('trazabilidad.detalle.contenido')}</p>
        {contenido.length > 0 ? (
          <dl className="mt-1.5 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
            {contenido.map(([clave, v]) => (
              <Dato key={clave} etiqueta={humanizar(clave)} className="break-all text-meta">{valor(clave, v)}</Dato>
            ))}
          </dl>
        ) : (
          <p className="mt-1 text-body text-faint">{t('trazabilidad.detalle.sinContenido')}</p>
        )}
      </div>
      <dl className="mt-3 grid gap-3 border-t border-border pt-3 lg:grid-cols-2">
        <Dato etiqueta={t('trazabilidad.hashAnterior')} className="flex min-w-0 items-start gap-1">
          <span className="codigo min-w-0 break-all text-meta text-muted">{registro.previous_hash}</span>
          <BotonCopiar valor={registro.previous_hash} campo={t('trazabilidad.hashAnterior')} />
        </Dato>
        <Dato etiqueta={t('trazabilidad.hash')} className="flex min-w-0 items-start gap-1">
          <span className="codigo min-w-0 break-all text-meta text-muted">{registro.hash_actual}</span>
          <BotonCopiar valor={registro.hash_actual} campo={t('trazabilidad.hash')} />
        </Dato>
      </dl>
      <p className="mt-1 text-meta text-faint">{t('trazabilidad.detalle.enlace')}</p>
      {corrupto && (
        <div className="mt-3 border-t border-border pt-3">
          <ComparacionSellos detalle={corrupto} />
        </div>
      )}
      {onVerificarDia && (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="ghost" size="sm" onClick={onVerificarDia}>
            <ShieldCheck aria-hidden />
            {t('trazabilidad.detalle.verificarEquipoDia')}
          </Button>
        </div>
      )}
    </>
  )
}

/** Primeros 8 caracteres de un UUID: lo bastante para ubicarlo, el completo se copia. */
const idCorto = (id: string) => (id.length > 10 ? id.slice(0, 8) : id)

/**
 * HU-37: resultado de la verificación por dispositivo y periodo. Esc. 2: una
 * lectura alterada se rotula «Corrupta» con su ID (copiable) y su fecha, y la
 * lista sigue con el resto del segmento. Un eslabón v3 sin clave es «No
 * verificable», no corrupto.
 */
function ResultadoSegmento({ resultado }: { resultado: VerificacionSegmento }) {
  const { t } = useTranslation()
  const idResumen = useId()
  const estadoDe = (r: VerificacionSegmento['registros_del_dispositivo'][number]) => r.estado ?? (r.integro ? 'integro' : 'corrupto')
  const corruptos = resultado.total_corruptos ?? resultado.registros_del_dispositivo.filter((r) => estadoDe(r) === 'corrupto').length
  const estado = resultado.estado ?? (resultado.integra ? 'integra' : 'corrupta')
  const Icono = estado === 'integra' ? ShieldCheck : estado === 'no_concluida' ? ShieldQuestion : ShieldAlert
  const color = estado === 'integra' ? 'text-success-700' : estado === 'no_concluida' ? 'text-warning-700' : 'text-critical'
  const titulo = {
    integra: t('trazabilidad.segmentoIntegro'),
    corrupta: t('trazabilidad.segmentoRoto'),
    no_concluida: t('trazabilidad.segmento.noConcluido'),
  }[estado]
  return (
    <div role="status" data-testid="resultado-segmento" className="mt-4 border-t border-border pt-3">
      <p key={estado} className={cn('cambio-texto flex items-center gap-2 text-body font-semibold', color)}>
        <Icono className="size-4 shrink-0" aria-hidden />
        {titulo}
      </p>
      <p id={idResumen} className="mt-0.5 text-meta text-muted">
        {t('trazabilidad.segmentoResumen', { n: resultado.total_bloques_verificados, device: resultado.device_id })}
        {corruptos > 0 && <span className="text-critical"> {t('trazabilidad.segmento.corruptas', { count: corruptos })}</span>}
        {(resultado.total_no_verificables ?? 0) > 0 && (
          <span className="text-warning-700"> {t('trazabilidad.segmento.noVerificables', { count: resultado.total_no_verificables })}</span>
        )}
      </p>
      {resultado.registros_del_dispositivo.length > 0 && (
        // Lista con desplazamiento propio: alcanzable con el teclado.
        <ul tabIndex={0} aria-labelledby={idResumen} className="mt-2 max-h-56 divide-y divide-border overflow-y-auto rounded-md text-meta focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
          {resultado.registros_del_dispositivo.map((r) => {
            const estadoRegistro = estadoDe(r)
            return (
              <li key={r.id} data-estado={estadoRegistro} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2">
                <span className="nums shrink-0 text-muted">{fechaHora(r.timestamp)}</span>
                <span className="min-w-0 flex-1 font-medium">{etiquetaEvento(r.tipo_evento, t)}</span>
                {estadoRegistro !== 'integro' && (
                  <span className="flex w-full items-center gap-1 sm:w-auto">
                    <span className="sr-only">{t('trazabilidad.segmento.idRegistro')}: </span>
                    <span className="codigo text-faint" title={r.id}>{idCorto(r.id)}</span>
                    <BotonCopiar valor={r.id} campo={t('trazabilidad.segmento.idRegistro')} />
                  </span>
                )}
                <Badge dot variant={estadoRegistro === 'integro' ? 'ok' : estadoRegistro === 'corrupto' ? 'critical' : 'warn'}>
                  {{
                    integro: t('trazabilidad.segmento.integra'),
                    corrupto: t('trazabilidad.segmento.corrupta'),
                    no_verificable: t('trazabilidad.segmento.noVerificable'),
                  }[estadoRegistro]}
                </Badge>
                {estadoRegistro === 'corrupto' && r.tipo_discrepancia && (
                  <span className="w-full text-faint">{t(`trazabilidad.discrepancia_${r.tipo_discrepancia}`)}</span>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
