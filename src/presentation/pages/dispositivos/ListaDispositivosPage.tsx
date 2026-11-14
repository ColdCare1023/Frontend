import { useCallback, useDeferredValue, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { useLocation, useSearchParams } from 'react-router'
import { Plus, Search } from 'lucide-react'

import { useEstadoVivoStore } from '@/application/stores/estadoVivoStore'
import { MODO_DEMO } from '@/infrastructure/demo/modoDemo'
import { hora } from '@/lib/formato'
import { rangoPagina } from '@/lib/paginacion'
import { useResponsivePageSize } from '@/presentation/hooks/useResponsivePageSize'
import { EstadoCarga, EstadoError, EstadoVacio } from '../../components/EstadoPagina'
import { PageHeader } from '../../components/PageHeader'
import { Paginacion } from '../../components/Paginacion'
import { BarraFiltros } from '../../components/ui/barra-filtros'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Segmentado } from '../../components/ui/segmentado'
import { TiraEstado, type SegmentoTira } from '../../components/ui/tira-estado'
import { useFlota } from './contextoFlota'
import {
  coincide,
  estadoVisualEquipo,
  fraseGuia,
  rangoAtencion,
  RANGO_ATENCION_MAXIMO,
  resumenFlota,
  type FraseGuia,
} from './estadoEquipo'
import { FilaDispositivo } from './lista/FilaDispositivo'
import { RailContexto } from './lista/RailContexto'
import { PanelRegistrarEquipo } from './paneles/PanelRegistrarEquipo'
import { PanelSimuladorIoT } from './paneles/PanelSimuladorIoT'

type Filtro = 'todos' | 'atencion' | 'baja'

/** `/dispositivos`: tira de estado, lista de equipos y rail de contexto. */
export function ListaDispositivosPage() {
  const { t } = useTranslation()
  const location = useLocation()
  const { dispositivos, cargando, errorCarga, consultar } = useFlota()
  const ultimas = useEstadoVivoStore((s) => s.ultimas)
  const [parametros, setParametros] = useSearchParams()
  const filtro: Filtro = parametros.get('filtro') === 'atencion' ? 'atencion' : parametros.get('filtro') === 'baja' ? 'baja' : 'todos'
  const consulta = parametros.get('q') ?? ''
  const consultaDiferida = useDeferredValue(consulta)
  const pagina = Math.max(1, Number(parametros.get('pagina')) || 1)
  const tamanoPagina = useResponsivePageSize()
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
  const resumen = useMemo(() => resumenFlota(dispositivos), [dispositivos])
  const desde = `${location.pathname}${location.search}`
  const hayFiltros = filtro !== 'todos' || consulta !== ''

  return (
    <div>
      <PageHeader
        eyebrow={t('nav.seccionAdministracion')}
        titulo={t('dispositivos.titulo')}
        descripcion={t('dispositivos.descripcion')}
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
          <TiraEstado
            className="col-span-12"
            etiqueta={t('dispositivos.resumenIoT')}
            guia={<TextoGuia frase={fraseGuia(resumen, dispositivos)} />}
            segmentos={segmentosTira(resumen, t)}
          />

          <section aria-labelledby="titulo-lista" className="superficie col-span-12 min-w-0 self-start overflow-hidden xl:col-span-8">
            <h2 id="titulo-lista" className="sr-only">{t('dispositivos.lista.etiqueta')}</h2>
            <BarraFiltros
              etiqueta={t('dispositivos.lista.filtrar')}
              resultado={t(filtradas.length === 1 ? 'dispositivos.lista.conteoUno' : 'dispositivos.lista.conteoVarios', { n: filtradas.length })}
              hayFiltros={hayFiltros}
              alLimpiar={() => cambiar({ filtro: null, q: null, pagina: null })}
            >
              <Segmentado<Filtro>
                etiqueta={t('dispositivos.lista.filtrar')}
                valor={filtro}
                onCambiar={(valor) => cambiar({ filtro: valor === 'todos' ? null : valor, pagina: null })}
                opciones={[
                  { valor: 'todos', etiqueta: t('dispositivos.lista.filtroTodos', { n: conteos.todos }) },
                  { valor: 'atencion', etiqueta: t('dispositivos.lista.filtroAtencion', { n: conteos.atencion }) },
                  { valor: 'baja', etiqueta: t('dispositivos.lista.filtroBaja', { n: conteos.baja }) },
                ]}
              />
              <label className="relative w-full sm:w-60">
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

            <div aria-hidden className="hidden h-9 grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto] items-center gap-x-4 border-b border-border bg-surface-sunken px-4 text-meta font-medium text-muted sm:grid">
              <span>{t('dispositivos.lista.columnaEquipo')}</span>
              <span>{t('dispositivos.lista.columnaLectura')}</span>
              <span className="text-right">{t('comunes.acciones')}</span>
            </div>

            {filtradas.length === 0 ? (
              <EstadoVacio
                ilustracion="sin-resultados"
                titulo={t('dispositivos.lista.sinResultados')}
                className="m-4"
              >
                <Button variant="secondary" size="sm" className="mt-3" onClick={() => cambiar({ filtro: null, q: null, pagina: null })}>
                  {t('dispositivos.lista.limpiarFiltros')}
                </Button>
              </EstadoVacio>
            ) : (
              <ul aria-labelledby="titulo-lista" className="divide-y divide-border">
                {visibles.map(({ d, ultima, estado }) => (
                  <FilaDispositivo
                    key={d.id}
                    dispositivo={d}
                    estado={estado}
                    ultima={ultima}
                    desde={desde}
                    alProbarIoT={setSimulando}
                  />
                ))}
              </ul>
            )}
            <div className="border-t border-border px-4 py-2 empty:hidden">
              <Paginacion
                total={filtradas.length}
                pagina={pagina}
                onCambiar={(p) => cambiar({ pagina: p > 1 ? String(p) : null })}
                tamano={tamanoPagina}
              />
            </div>
          </section>

          <RailContexto dispositivos={dispositivos} />
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
    { clave: 'sinDatos', etiqueta: t('dispositivos.sinDatos'), valor: resumen.sinDatos, tono: resumen.sinDatos > 0 ? 'aviso' : 'neutro' },
    { clave: 'fallas', etiqueta: t('dispositivos.fallasSensor'), valor: resumen.fallas, tono: resumen.fallas > 0 ? 'aviso' : 'neutro' },
    { clave: 'buffer', etiqueta: t('dispositivos.bufferPendiente'), valor: resumen.buffer },
    {
      clave: 'calibracion',
      etiqueta: t('dispositivos.tira.calibracion'),
      valor: calibracion,
      tono: resumen.calibracionVencidas > 0 ? 'critico' : calibracion > 0 ? 'aviso' : 'neutro',
      detalle: calibracion > 0 ? t('dispositivos.tira.porAtender') : undefined,
    },
    {
      clave: 'consola',
      etiqueta: t('dispositivos.tira.consola'),
      valor: resumen.consola,
      tono: resumen.consola > 0 ? 'aviso' : 'neutro',
      detalle: resumen.consola > 0 ? t('dispositivos.tira.pendientes') : undefined,
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
