import { useMemo, useState } from 'react'
import { LayoutGroup, motion, useReducedMotion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { SearchX } from 'lucide-react'

import { useHistorial, type FiltrosHistorial } from '@/application/hooks/useHistorial'
import { obtenerEvidenciaInferencia, type EvidenciaInferencia } from '@/application/hooks/useEvidenciaInferencia'
import type { LecturaTermica } from '@/domain/entities/LecturaTermica'
import { NIVELES_RIESGO } from '@/domain/value-objects/NivelRiesgo'
import { construirOpcionCurvaTermica } from '@/infrastructure/charts/curvaTermica'
import { EChartWrapper } from '@/infrastructure/charts/EChartWrapper'
import { useTemaResuelto } from '@/infrastructure/tema/tema'
import { fechaHora } from '@/lib/formato'
import { rangoPagina } from '@/lib/paginacion'
import { cn } from '@/lib/utils'
import { useResponsivePageSize } from '@/presentation/hooks/useResponsivePageSize'
import { EstadoCarga, EstadoError, EstadoVacio } from '../components/EstadoPagina'
import { Paginacion } from '../components/Paginacion'
import { BarraFiltros, type FiltroActivo } from '../components/ui/barra-filtros'
import { Button } from '../components/ui/button'
import { Detalles } from '../components/ui/detalles'
import { Indicador, Indicadores } from '../components/ui/indicadores'
import { Campo, Input, NativeSelect } from '../components/ui/input'
import { Segmentado } from '../components/ui/segmentado'
import { SelectorFecha } from '../components/ui/selector-fecha'
import { TituloPagina } from '../components/ui/titulo-pagina'
import {
  agruparPorDia,
  claveDeDia,
  dentroDeVentana,
  filtrosDeAtajo,
  notaDelResumen,
  resumir,
  resumirPeriodo,
  ventanaDe,
  type Atajo,
  type Periodo,
} from './historial/agrupar'
import { EvidenciaLectura } from './historial/EvidenciaLectura'
import { FraseHistorial } from './historial/FraseHistorial'
import { LecturasDelDia } from './historial/LecturasDelDia'
import { transicionPieza } from './historial/movimiento'
import { ResumenDias } from './historial/ResumenDias'
import './historial/historial.css'

const FILTROS_INICIALES: FiltrosHistorial = {}
const ATAJOS: Atajo[] = ['24h', 'hoy', 'ayer', '7d']

const ALTO_CURVA = 'clamp(220px, 50dvh, 620px)'

const iguales = (a: FiltrosHistorial, b: FiltrosHistorial) =>
  a.device_id === b.device_id && a.riesgo_efectivo === b.riesgo_efectivo && a.desde === b.desde && a.hasta === b.hasta

function porClaveDeDia(lecturas: LecturaTermica[]) {
  const mapa = new Map<string, LecturaTermica[]>()
  for (const lectura of lecturas) {
    const clave = claveDeDia(lectura.timestamp)
    const lista = mapa.get(clave)
    if (lista) lista.push(lectura)
    else mapa.set(clave, [lectura])
  }
  return mapa
}

export function HistorialPage() {
  const { t } = useTranslation()
  const reducir = useReducedMotion()
  const { lecturas, cargando, errorCarga, consultar } = useHistorial()
  const [pagina, setPagina] = useState(1)
  const tamanoPagina = useResponsivePageSize()

  // Lo escrito en el panel y lo que está consultado: los chips muestran solo lo segundo.
  const [filtros, setFiltros] = useState<FiltrosHistorial>(FILTROS_INICIALES)
  const [aplicados, setAplicados] = useState<FiltrosHistorial>(FILTROS_INICIALES)
  // «24 horas» no filtra en el backend: recorta lo que llega. Los demás atajos piden su periodo.
  const [periodo, setPeriodo] = useState<Periodo>('24h')
  const [ahora, setAhora] = useState(() => Date.now())
  // HU-36 criterio 3: el rango inválido se bloquea en el FRONTEND antes de
  // consultar: la validación del backend (422) sigue existiendo para una
  // llamada directa a la API, pero no es la única barrera.
  const [errorRango, setErrorRango] = useState<string | null>(null)

  const [lecturaDetalle, setLecturaDetalle] = useState<string | null>(null)
  const [evidencia, setEvidencia] = useState<EvidenciaInferencia | null>(null)
  const [cargandoEvidencia, setCargandoEvidencia] = useState(false)
  const [errorEvidencia, setErrorEvidencia] = useState(false)

  // ── Lo que responde la pregunta: la ventana del periodo ─────────────────
  const ventana = useMemo(() => ventanaDe(periodo, aplicados, ahora), [periodo, aplicados, ahora])
  const enVentana = useMemo(() => dentroDeVentana(lecturas, ventana), [lecturas, ventana])
  const resumenPeriodo = useMemo(() => resumirPeriodo(lecturas, enVentana, ventana, ahora), [lecturas, enVentana, ventana, ahora])
  // Si en la ventana no hay nada, la curva y los días muestran lo último que llegó; la frase ya lo dice.
  const delPeriodo = enVentana.length > 0 ? enVentana : lecturas
  const diasDelPeriodo = useMemo(
    () => [...porClaveDeDia(delPeriodo)].map(([clave, delDia]) => ({ clave, lecturas: delDia })),
    [delPeriodo],
  )

  // ── Todas las lecturas cargadas, plegadas ───────────────────────────────
  // La lista completa puede tener miles de filas; solo se pinta la página
  // visible. Al cambiar la lista (filtro nuevo) se vuelve a la primera.
  const visibles = useMemo(() => lecturas.slice(...rangoPagina(pagina, tamanoPagina)), [lecturas, pagina, tamanoPagina])
  const dias = useMemo(() => agruparPorDia(visibles), [visibles])
  // Lo del día completo, no solo de esta página: la cifra no cambia al paginar.
  const porDia = useMemo(() => porClaveDeDia(lecturas), [lecturas])
  const resumen = useMemo(() => resumir(lecturas), [lecturas])

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

  const aplicar = (siguientes: FiltrosHistorial) => {
    if (siguientes.desde && siguientes.hasta && new Date(siguientes.desde) > new Date(siguientes.hasta)) {
      setErrorRango(t('historial.rangoInvalido'))
      return
    }
    setErrorRango(null)
    if (iguales(siguientes, aplicados)) return
    setAplicados(siguientes)
    setAhora(Date.now())
    setPagina(1)
    void consultar(siguientes)
  }

  // Una lista y un calendario ya son una decisión: se aplican al elegir, con la curva detrás del panel.
  const elegir = (campo: keyof FiltrosHistorial, valor: string) => {
    const siguientes = { ...filtros, [campo]: valor || undefined }
    if (campo === 'desde' || campo === 'hasta') setPeriodo(siguientes.desde || siguientes.hasta ? 'personalizado' : '24h')
    setFiltros(siguientes)
    aplicar(siguientes)
  }

  const elegirAtajo = (atajo: Periodo) => {
    if (atajo === 'personalizado') return
    const siguientes = { ...filtros, ...filtrosDeAtajo(atajo) }
    if (atajo === '24h') {
      delete siguientes.desde
      delete siguientes.hasta
    }
    setPeriodo(atajo)
    setFiltros(siguientes)
    setAhora(Date.now())
    aplicar(siguientes)
  }

  const quitar = (campo: keyof FiltrosHistorial) => elegir(campo, '')

  const limpiar = () => {
    setFiltros(FILTROS_INICIALES)
    setErrorRango(null)
    setAplicados(FILTROS_INICIALES)
    setPeriodo('24h')
    setAhora(Date.now())
    setPagina(1)
    void consultar(FILTROS_INICIALES)
  }

  const fechaChip = (valor: string) => fechaHora(new Date(valor).toISOString())
  const activos: FiltroActivo[] = [
    aplicados.device_id && { id: 'equipo', etiqueta: aplicados.device_id, onQuitar: () => quitar('device_id') },
    aplicados.riesgo_efectivo && { id: 'riesgo', etiqueta: t(`riesgo.${aplicados.riesgo_efectivo}`), onQuitar: () => quitar('riesgo_efectivo') },
    // Con un atajo elegido, sus fechas ya se ven en el control de periodo.
    periodo === 'personalizado' && aplicados.desde && { id: 'desde', etiqueta: `${t('historial.desde')} ${fechaChip(aplicados.desde)}`, onQuitar: () => quitar('desde') },
    periodo === 'personalizado' && aplicados.hasta && { id: 'hasta', etiqueta: `${t('historial.hasta')} ${fechaChip(aplicados.hasta)}`, onQuitar: () => quitar('hasta') },
  ].filter((filtro): filtro is FiltroActivo => Boolean(filtro))

  // HU-36 criterio 1: la gráfica necesita orden cronológico ascendente; el
  // backend devuelve el historial en orden descendente (más reciente primero).
  const tema = useTemaResuelto()
  const serieGrafica = useMemo(() => [...delPeriodo].reverse(), [delPeriodo])
  const opcionHistorial = useMemo(
    () =>
      // HU-36 criterio 1: la misma consulta filtrada alimenta la gráfica y la lista.
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

  const cargaInicial = cargando && lecturas.length === 0
  const conDatos = !errorCarga && lecturas.length > 0
  // Filtrado por nivel, la cobertura y los huecos no se pueden leer de lo que llega: no se anotan.
  const nota = conDatos && !aplicados.riesgo_efectivo ? notaDelResumen(resumenPeriodo, t) : null
  const transicion = transicionPieza(reducir)

  return (
    <div className="flex flex-1 flex-col">
      <TituloPagina
        antetitulo={t('nav.seccionOperacion')}
        descripcion={t('historial.descripcion')}
        className="mb-3 sm:mb-4"
        titulo={
          conDatos ? (
            <>
              {/* El nombre de la pantalla, para quien no ve la navegación; el espacio va fuera para que cuente. */}
              <span className="sr-only">{`${t('historial.titulo')}:`}</span>{' '}
              <span className={cn('block transition-opacity duration-(--duration-ui)', cargando && 'opacity-60')}>
                <FraseHistorial
                  resumen={resumenPeriodo}
                  periodo={periodo}
                  riesgo={aplicados.riesgo_efectivo}
                  cantidad={enVentana.length}
                />
              </span>
            </>
          ) : (
            t('historial.titulo')
          )
        }
      />
      {nota && <p className="historial-nota">{nota}</p>}

      {/* ── Periodo a un toque; lo demás, en la barra compacta ──────────────── */}
      <div className="historial-controles">
        <Segmentado<Periodo>
          etiqueta={t('historial.periodo')}
          valor={periodo}
          onCambiar={elegirAtajo}
          opciones={ATAJOS.map((atajo) => ({ valor: atajo, etiqueta: t(`historial.atajos.${atajo}`) }))}
          className="max-sm:w-full max-sm:[&>button]:flex-1"
          botonClassName="max-[359px]:px-2"
        />
        <BarraFiltros titulo={t('historial.filtros')} activos={activos} onLimpiar={limpiar}>
          <form
            className="contents"
            onSubmit={(evento) => {
              evento.preventDefault()
              aplicar(filtros)
            }}
          >
            <Campo etiqueta={t('historial.codigoEquipo')} htmlFor="f-device">
              <Input
                id="f-device"
                value={filtros.device_id ?? ''}
                onChange={(e) => setFiltros((previos) => ({ ...previos, device_id: e.target.value || undefined }))}
                onBlur={() => aplicar(filtros)}
                placeholder={t('historial.codigoEquipoEjemplo')}
              />
            </Campo>
            <Campo etiqueta={t('historial.nivelRiesgo')} htmlFor="f-riesgo">
              <NativeSelect id="f-riesgo" value={filtros.riesgo_efectivo ?? ''} onChange={(e) => elegir('riesgo_efectivo', e.target.value)}>
                <option value="">{t('historial.todosNiveles')}</option>
                {NIVELES_RIESGO.map((nivel) => (
                  <option key={nivel} value={nivel}>
                    {t(`riesgo.${nivel}`)}
                  </option>
                ))}
              </NativeSelect>
            </Campo>
            <Campo etiqueta={t('historial.desde')} htmlFor="f-desde">
              <SelectorFecha
                id="f-desde"
                conHora
                valor={filtros.desde ?? ''}
                onCambiar={(valor) => elegir('desde', valor)}
                invalido={errorRango !== null}
                aria-describedby={errorRango ? 'f-hasta-error' : undefined}
              />
            </Campo>
            <Campo etiqueta={t('historial.hasta')} htmlFor="f-hasta">
              <SelectorFecha
                id="f-hasta"
                conHora
                valor={filtros.hasta ?? ''}
                onCambiar={(valor) => elegir('hasta', valor)}
                invalido={errorRango !== null}
                aria-describedby={errorRango ? 'f-hasta-error' : undefined}
              />
            </Campo>
            {errorRango && (
              <p id="f-hasta-error" role="alert" className="rounded-(--radius-field) bg-critical-tint px-3 py-2 text-[13px] leading-5 text-critical sm:col-span-2">
                {errorRango}
              </p>
            )}
            <Button type="submit" variant="secondary" className="sm:col-span-2">
              {t('historial.aplicar')}
            </Button>
          </form>
        </BarraFiltros>
      </div>

      {errorCarga ? (
        <EstadoError mensaje={t('historial.errorCargar')} onReintentar={() => void consultar(aplicados)} />
      ) : !cargando && lecturas.length === 0 ? (
        <EstadoVacio icono={SearchX} titulo={t('historial.sinResultados')} llenar>
          {activos.length > 0 && (
            <Button variant="secondary" size="sm" onClick={limpiar}>
              {t('historial.limpiar')}
            </Button>
          )}
        </EstadoVacio>
      ) : (
        <>
          {/* ── HU-36 criterio 1: la misma consulta alimenta la curva y las lecturas ──── */}
          <section
            id="historial-grafica"
            aria-labelledby="historial-grafica-titulo"
            aria-busy={cargando || undefined}
            className={cn('curva-historial', cargando && !cargaInicial && 'opacity-60')}
          >
            <h2 id="historial-grafica-titulo" className="mb-3 px-1 text-[15px] leading-6 font-semibold text-foreground sm:mb-4">
              {t('dashboard.curvaTermica')}
            </h2>
            {cargaInicial ? (
              <div aria-hidden className="esqueleto rounded-(--radius-field)" style={{ height: ALTO_CURVA }} />
            ) : (
              <EChartWrapper
                option={opcionHistorial}
                height={ALTO_CURVA}
                ariaLabel={t('dashboard.graficaEtiqueta', { n: serieGrafica.length })}
                ariaDescribedBy="historial-datos-tabla"
              />
            )}
          </section>

          {cargaInicial ? (
            <div
              id="historial-datos-tabla"
              role="region"
              aria-label={t('historial.titulo')}
              aria-busy
              className="mt-[clamp(28px,4vw,44px)] min-w-0"
            >
              <EstadoCarga texto={t('historial.cargando')} variant="tabla" />
            </div>
          ) : (
            <LayoutGroup>
              {/* ── Día por día: solo lo que salió del rango, a la vista ──────── */}
              <ResumenDias dias={diasDelPeriodo} onVerEvidencia={(lectura) => void abrirEvidencia(lectura)} />

              {/* ── Todas las lecturas, plegadas: nadie tiene que leer 200 filas ── */}
              <motion.div layout="position" transition={transicion}>
                <Detalles
                  className="historial-todas"
                  titulo={
                    <span className="historial-todas__titulo">
                      {t('historial.verTodas')}
                      <span className="nums ml-2 font-medium text-muted">{lecturas.length}</span>
                    </span>
                  }
                >
                  <div className="pb-2">
                    <Indicadores className="mb-6 max-sm:grid max-sm:grid-cols-2">
                      {resumen.maxima !== null && <Indicador etiqueta={t('historial.maxima')} valor={resumen.maxima.toFixed(1)} unidad="°C" />}
                      {resumen.minima !== null && <Indicador etiqueta={t('historial.minima')} valor={resumen.minima.toFixed(1)} unidad="°C" />}
                      <Indicador etiqueta={t('historial.fueraDeRango')} valor={resumen.fueraDeRango} tono={resumen.fueraDeRango > 0 ? 'critico' : 'neutro'} />
                      <Indicador etiqueta={t('historial.lecturas')} valor={resumen.total} />
                    </Indicadores>
                    <div
                      id="historial-datos-tabla"
                      role="region"
                      aria-label={t('historial.titulo')}
                      aria-busy={cargando || undefined}
                      className="min-w-0"
                    >
                      {dias.map((dia, indice) => (
                        <LecturasDelDia
                          key={dia.clave}
                          dia={dia}
                          todas={porDia.get(dia.clave) ?? dia.lecturas}
                          mostrarCabecera={indice === 0}
                          onVerEvidencia={(lectura) => void abrirEvidencia(lectura)}
                        />
                      ))}
                      <Paginacion total={lecturas.length} pagina={pagina} onCambiar={setPagina} tamano={tamanoPagina} />
                    </div>
                  </div>
                </Detalles>
              </motion.div>
            </LayoutGroup>
          )}
        </>
      )}

      <EvidenciaLectura
        lecturaId={lecturaDetalle}
        evidencia={evidencia}
        cargando={cargandoEvidencia}
        error={errorEvidencia}
        onCerrar={() => setLecturaDetalle(null)}
      />
    </div>
  )
}
