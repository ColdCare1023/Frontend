import { SeccionDetalle } from '@/presentation/components/ui/seccion-detalle'
import { useCallback, useDeferredValue, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { Link, useLocation, useSearchParams } from 'react-router'
import { Plus, Search } from 'lucide-react'

import { useEstadoVivoStore } from '@/application/stores/estadoVivoStore'
import { MODO_DEMO } from '@/infrastructure/demo/modoDemo'
import { construirCinta24h } from '@/lib/cinta24h'
import { hora } from '@/lib/formato'
import { rangoPagina } from '@/lib/paginacion'
import { useMinuto } from '@/presentation/hooks/useReloj'
import { useResponsivePageSize } from '@/presentation/hooks/useResponsivePageSize'
import { EstadoCarga, EstadoError, EstadoVacio } from '../../components/EstadoPagina'
import { PageHeader } from '../../components/PageHeader'
import { Paginacion } from '../../components/Paginacion'
import { BarraFiltros } from '../../components/ui/barra-filtros'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Segmentado } from '../../components/ui/segmentado'
import { TiraEstado, type SegmentoTira } from '../../components/ui/tira-estado'
import { ActividadReciente } from './ActividadReciente'
import { eventosRecientes } from './actividad'
import { useActividad, useFlota } from './contextoFlota'
import {
  coincide,
  estadoVisualEquipo,
  fraseGuia,
  rangoAtencion,
  RANGO_ATENCION_MAXIMO,
  resumenFlota,
  type FraseGuia,
} from './estadoEquipo'
import { COLUMNAS_LISTA, FilaDispositivo } from './lista/FilaDispositivo'
import { RailContexto } from './lista/RailContexto'
import { useTendencias } from './lista/tendencias'
import { PanelRegistrarEquipo } from './paneles/PanelRegistrarEquipo'
import { PanelSimuladorIoT } from './paneles/PanelSimuladorIoT'

type Filtro = 'todos' | 'atencion' | 'baja'

/** `/dispositivos`: tira de estado, lista de equipos y rail de contexto. */
export function ListaDispositivosPage() {
  const { t } = useTranslation()
  const location = useLocation()
  const { dispositivos, cargando, errorCarga, consultar } = useFlota()
  const actividad = useActividad()
  const ultimas = useEstadoVivoStore((s) => s.ultimas)
  const ahora = useMinuto()
  const [parametros, setParametros] = useSearchParams()
  const filtro: Filtro = parametros.get('filtro') === 'atencion' ? 'atencion' : parametros.get('filtro') === 'baja' ? 'baja' : 'todos'
  const consulta = parametros.get('q') ?? ''
  const consultaDiferida = useDeferredValue(consulta)
  const pagina = Math.max(1, Number(parametros.get('pagina')) || 1)
  const tamanoPagina = useResponsivePageSize()
  const [ampliada, setAmpliada] = useState(false)
  const [registrando, setRegistrando] = useState(false)
  const [simulando, setSimulando] = useState<string | null>(null)

  const cambiar = useCallback(
    (cambios: Record<string, string | null>) => {
      setParametros(
        (previos) => {
          const siguientes = new URLSearchParams(previos)
          for (const [clave, valor] of Object.entries(cambios)) {
            if (valor) siguientes.set(clave, valor)
            else siguientes.delete(clave)
          }
          return siguientes
        },
        { replace: true },
      )
    },
    [setParametros],
  )

  // Orden por atención: se calcula con la flota cargada; una actualización por
  // SSE solo cambia el contenido de la fila, no la reordena bajo el cursor.
  const filas = useMemo(() => {
    const conEstado = dispositivos.map((d) => {
      const ultima = ultimas[d.id]
      const estado = estadoVisualEquipo(d, ultima)
      return { d, ultima, estado, rango: rangoAtencion(d, estado) }
    })
    return conEstado.sort((a, b) => a.rango - b.rango)
  }, [dispositivos, ultimas])

  const conteos = useMemo(
    () => ({
      todos: filas.length,
      atencion: filas.filter((f) => f.rango <= RANGO_ATENCION_MAXIMO).length,
      baja: filas.filter((f) => !f.d.activo).length,
    }),
    [filas],
  )

  const filtradas = useMemo(
    () =>
      filas.filter(
        (f) =>
          (filtro === 'todos' || (filtro === 'atencion' ? f.rango <= RANGO_ATENCION_MAXIMO : !f.d.activo)) &&
          coincide(f.d, consultaDiferida),
      ),
    [filas, filtro, consultaDiferida],
  )
  const visibles = useMemo(() => filtradas.slice(...rangoPagina(pagina, tamanoPagina)), [filtradas, pagina, tamanoPagina])
  // Tendencia corta y cinta 24 h solo para las filas de la página visible.
  const activosVisibles = useMemo(() => ampliada ? visibles.filter((f) => f.d.activo).map((f) => f.d.id) : [], [visibles, ampliada])
  const tendencias = useTendencias(activosVisibles)
  const ahoraCinta = Math.floor(ahora / 300_000) * 300_000
  const cintas = useMemo(
    () =>
      actividad.cargando
        ? new Map()
        : new Map(construirCinta24h(actividad.alertas, actividad.incidentes, ahoraCinta, activosVisibles).map((c) => [c.deviceId, c])),
    [actividad.cargando, actividad.alertas, actividad.incidentes, ahoraCinta, activosVisibles],
  )
  const eventos = useMemo(
    () => eventosRecientes(actividad.alertas, actividad.incidentes, ahora, { limite: 5 }),
    [actividad.alertas, actividad.incidentes, ahora],
  )
  const resumen = useMemo(() => resumenFlota(dispositivos), [dispositivos])
  const desde = `${location.pathname}${location.search}`
  const hayFiltros = filtro !== 'todos' || consulta !== ''

  return (
    <div>
      <PageHeader
        titulo={t('dispositivos.titulo')}
      >
        <Button onClick={() => setRegistrando(true)}>
          <Plus />
          {t('dispositivos.nuevoEquipo')}
        </Button>
      </PageHeader>

      {cargando && dispositivos.length === 0 ? (
        <EstadoCarga />
      ) : errorCarga ? (
        <EstadoError mensaje={t('comunes.errorCargar')}>
          <Button variant="secondary" size="sm" className="mt-3" onClick={() => void consultar()}>
            {t('comunes.reintentar')}
          </Button>
        </EstadoError>
      ) : dispositivos.length === 0 ? (
        <EstadoVacio
          ilustracion="sin-equipos"
          titulo={t('dispositivos.sinDispositivos')}
          detalle={t('dispositivos.lista.vacioDetalle')}
          contexto={
            <ol aria-label={t('dispositivos.lista.pasosTitulo')} className="mt-3 space-y-1.5 text-meta text-muted">
              {(['paso1', 'paso2', 'paso3'] as const).map((paso, i) => (
                <li key={paso} className="flex gap-2">
                  <span className="nums text-faint">{i + 1}.</span>
                  {t(`dispositivos.lista.${paso}`)}
                </li>
              ))}
            </ol>
          }
        >
          <Button className="mt-4" onClick={() => setRegistrando(true)}>
            <Plus />
            {t('dispositivos.nuevoEquipo')}
          </Button>
        </EstadoVacio>
      ) : (
        <div className="grid grid-cols-12 gap-3 xl:gap-4">
          <div className="col-span-12 grid grid-cols-12 gap-3 xl:gap-4">
            <section aria-labelledby="titulo-lista" className="superficie col-span-12 min-w-0 self-start overflow-hidden xl:col-span-12">
              <h2 id="titulo-lista" className="sr-only">{t('dispositivos.lista.etiqueta')}</h2>
              <BarraFiltros
                className="items-center"
                etiqueta={t('dispositivos.lista.filtrar')}
                resultado={
                  // En móvil el segmentado ocupa la fila: el conteo solo se anuncia.
                  <span className="max-sm:sr-only">
                    {t(filtradas.length === 1 ? 'dispositivos.lista.conteoUno' : 'dispositivos.lista.conteoVarios', { n: filtradas.length })}
                  </span>
                }
                hayFiltros={hayFiltros}
                alLimpiar={() => cambiar({ filtro: null, q: null, pagina: null })}
              >
                <Segmentado<Filtro>
                  etiqueta={t('dispositivos.lista.filtrar')}
                  valor={filtro}
                  onCambiar={(valor) => cambiar({ filtro: valor === 'todos' ? null : valor, pagina: null })}
                  opciones={(['todos', 'atencion', 'baja'] as const).map((valor) => ({
                    valor,
                    etiqueta: t(`dispositivos.lista.filtro.${valor}`),
                    conteo: conteos[valor],
                    descripcionConteo: t(conteos[valor] === 1 ? 'dispositivos.lista.conteoUno' : 'dispositivos.lista.conteoVarios', { n: conteos[valor] }),
                  }))}
                  className="grid w-full grid-cols-3 sm:inline-flex sm:w-auto"
                  botonClassName="px-1.5 text-meta sm:px-3 sm:text-body"
                />
                {/* 176 px entre 1280 y 1439: con 224 la búsqueda bajaba a otra fila. */}
                <label className="relative w-full sm:w-56 xl:max-[1439px]:w-44">
                  <span className="sr-only">{t('dispositivos.lista.buscar')}</span>
                  <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" />
                  <Input
                    type="search"
                    className="pl-9"
                    placeholder={t('dispositivos.lista.buscarMarcador')}
                    value={consulta}
                    onChange={(e) => cambiar({ q: e.target.value || null, pagina: null })}
                  />
                </label>
              </BarraFiltros>

              <div className={`grid gap-x-4 ${ampliada ? COLUMNAS_LISTA : 'grid-cols-1 sm:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_auto]'}`}>
                <div aria-hidden className="col-span-full hidden h-9 grid-cols-subgrid items-center border-b border-border bg-surface-sunken px-4 text-meta font-medium text-muted sm:grid">
                  <span>{t('dispositivos.lista.columnaEquipo')}</span>
                  <span>{t('dispositivos.lista.columnaLectura')}</span>
                  {ampliada && <span className="hidden lg:block">{t('dispositivos.lista.ultimas24h')}</span>}
                  <span className="text-right">{t('comunes.acciones')}</span>
                </div>

                {filtradas.length === 0 ? (
                  <EstadoVacio
                    ilustracion="sin-resultados"
                    titulo={t('dispositivos.lista.sinResultados')}
                    className="col-span-full m-4"
                  >
                    <Button variant="secondary" size="sm" className="mt-3" onClick={() => cambiar({ filtro: null, q: null, pagina: null })}>
                      {t('dispositivos.lista.limpiarFiltros')}
                    </Button>
                  </EstadoVacio>
                ) : (
                  <ul aria-labelledby="titulo-lista" className="col-span-full grid grid-cols-subgrid divide-y divide-border">
                    {visibles.map(({ d, ultima, estado }) => (
                      <FilaDispositivo
                        key={d.id}
                        ampliada={ampliada}
                        dispositivo={d}
                        estado={estado}
                        ultima={ultima}
                        desde={desde}
                        alProbarIoT={setSimulando}
                        tendencia={tendencias.get(d.id)}
                        cinta={cintas.get(d.id)}
                      />
                    ))}
                  </ul>
                )}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-2">
                <Button variant="ghost" size="sm" className="aria-pressed:bg-primary-tint aria-pressed:text-primary-text" aria-pressed={ampliada} onClick={() => setAmpliada(!ampliada)}>
                  {t('lectura.tendenciasEquipo')}
                </Button>
                <Paginacion
                  total={filtradas.length}
                  pagina={pagina}
                  onCambiar={(p) => cambiar({ pagina: p > 1 ? String(p) : null })}
                  tamano={tamanoPagina}
                />
              </div>
            </section>

            <SeccionDetalle titulo={t('lectura.flotaActividad')} className="col-span-12">
              <TiraEstado
                apilarGuia
                etiqueta={t('dispositivos.resumenIoT')}
                guia={<TextoGuia frase={fraseGuia(resumen, dispositivos)} />}
                segmentos={segmentosTira(resumen, t)}
              />
              <RailContexto dispositivos={dispositivos} />
              <ActividadReciente
                id="actividad-flota"
                titulo={t('dispositivos.actividad.titulo')}
                eventos={eventos}
                cargando={actividad.cargando}
                error={actividad.error}
                ahora={ahora}
                className="col-span-12"
                accion={
                  <Link
                    to="/alertas"
                    className="inline-flex h-11 items-center rounded-(--radius-field) px-3 text-body font-medium text-primary-text transition-colors duration-(--duration-micro) hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:h-9 sm:pointer-coarse:h-11"
                  >
                    {t('dispositivos.actividad.verAlertas')}
                  </Link>
                }
              />
            </SeccionDetalle>
          </div>
        </div>
      )}

      <PanelRegistrarEquipo abierto={registrando} alCambiar={setRegistrando} />
      {MODO_DEMO && <PanelSimuladorIoT deviceId={simulando} alCerrar={() => setSimulando(null)} />}
    </div>
  )
}

function segmentosTira(resumen: ReturnType<typeof resumenFlota>, t: TFunction): SegmentoTira[] {
  const calibracion = resumen.calibracionVencidas + resumen.calibracionPorVencer
  return [
    {
      clave: 'equipos',
      etiqueta: t('dispositivos.equiposRegistrados'),
      valor: resumen.total,
      detalle: [t('dispositivos.tira.enLinea', { n: resumen.enLinea }), resumen.deBaja > 0 ? t('dispositivos.tira.deBaja', { n: resumen.deBaja }) : null]
        .filter(Boolean)
        .join(' · '),
    },
    { clave: 'sinDatos', etiqueta: t('dispositivos.sinDatos'), valor: resumen.sinDatos, tono: resumen.sinDatos > 0 ? 'sinDatos' : 'neutro' },
    { clave: 'fallas', etiqueta: t('dispositivos.fallasSensor'), valor: resumen.fallas, tono: resumen.fallas > 0 ? 'aviso' : 'neutro' },
    { clave: 'buffer', etiqueta: t('dispositivos.bufferPendiente'), valor: resumen.buffer, tono: resumen.buffer > 0 ? 'aviso' : 'neutro' },
    {
      clave: 'calibracion',
      etiqueta: t('dispositivos.tira.calibracion'),
      valor: calibracion,
      tono: resumen.calibracionVencidas > 0 ? 'critico' : calibracion > 0 ? 'aviso' : 'neutro',
      detalle: resumen.calibracionVencidas > 0 ? t('dispositivos.tira.vencidas', { count: resumen.calibracionVencidas }) : undefined,
    },
    {
      clave: 'consola',
      etiqueta: t('dispositivos.tira.consola'),
      valor: resumen.consola,
      tono: resumen.consola > 0 ? 'aviso' : 'neutro',
    },
  ]
}

function TextoGuia({ frase }: { frase: FraseGuia }) {
  const { t } = useTranslation()
  switch (frase.clave) {
    case 'retenida':
      return <>{t('dispositivos.tira.fraseRetenida', { id: frase.id })}</>
    case 'sinDatos':
      return (
        <>
          {frase.desde
            ? t('dispositivos.tira.fraseSinDatos', { n: frase.n, total: frase.total, hora: hora(frase.desde) })
            : t('dispositivos.tira.fraseSinDatosSinHora', { n: frase.n, total: frase.total })}
        </>
      )
    case 'falla':
      return <>{frase.n === 1 ? t('dispositivos.tira.fraseFallaUno', { id: frase.id }) : t('dispositivos.tira.fraseFallaVarios', { n: frase.n })}</>
    case 'calibracion':
      return <>{t('dispositivos.tira.fraseCalibracion', { id: frase.id })}</>
    case 'consola':
      return <>{frase.n === 1 ? t('dispositivos.tira.fraseConsolaUno') : t('dispositivos.tira.fraseConsolaVarios', { n: frase.n })}</>
    default:
      return <>{t('dispositivos.tira.fraseNormal', { n: frase.n })}</>
  }
}
