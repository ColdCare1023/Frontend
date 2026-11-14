import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useAlertas, type FiltroEstado } from '@/application/hooks/useAlertas'
import { useAtendidasRecientes } from '@/application/hooks/useAtendidasRecientes'
import { useIncidentesOperativos } from '@/application/hooks/useIncidentesOperativos'
import { useAuthStore } from '@/application/stores/authStore'
import { useEstadoVivoStore } from '@/application/stores/estadoVivoStore'
import type { AccionCorrectiva, AlertaTermica } from '@/domain/entities/AlertaTermica'
import { tienePermiso } from '@/domain/value-objects/Rol'
import { MODO_DEMO } from '@/infrastructure/demo/modoDemo'
import { construirCinta24h } from '@/lib/cinta24h'
import { hora } from '@/lib/formato'
import { ordenEsTriage, ordenarAlertas } from '@/lib/ordenAlertas'
import { rangoPagina } from '@/lib/paginacion'
import { useIdsNuevos } from '@/presentation/hooks/useIdsNuevos'
import { useRefrescoIncidentes } from '@/presentation/hooks/useRefrescoIncidentes'
import { useResponsivePageSize } from '@/presentation/hooks/useResponsivePageSize'
import { EstadoError } from '../components/EstadoPagina'
import { PageHeader } from '../components/PageHeader'
import { Paginacion } from '../components/Paginacion'
import { Button } from '../components/ui/button'
import { Segmentado } from '../components/ui/segmentado'
import { Table, TableBody, TableHead, TableHeader, TableRow } from '../components/ui/table'
import { TooltipProvider } from '../components/ui/tooltip'
import { AtendidasRecientes } from './alertas/AtendidasRecientes'
import { AvisoAlertas, type Aviso } from './alertas/AvisoAlertas'
import { Cinta24hAlertas } from './alertas/Cinta24hAlertas'
import { EquiposAhora } from './alertas/EquiposAhora'
import { FilaAlerta } from './alertas/FilaAlerta'
import { GuiaAtencion } from './alertas/GuiaAtencion'
import { IncidentesOperativos } from './alertas/IncidentesOperativos'
import { PanelAlerta } from './alertas/PanelAlerta'
import { SimularAlertaDemo } from './alertas/SimularAlertaDemo'
import { TiraEstadoAlertas } from './alertas/TiraEstadoAlertas'
import { cuantasAtendidas, FILAS_CON_CONTEXTO, resumirBandeja } from './alertas/logica'
import { FilasCargando } from './alertas/FilasCargando'
import { useAhora } from './alertas/useAhora'
import type { BorradorAccion, PestanaPanel } from './alertas/tipos'
import { VacioAlertas } from './alertas/VacioAlertas'

// HU-23: los filtros siguen la máquina de estados, no un booleano.
const FILTROS: FiltroEstado[] = ['pendiente', 'reconocida', 'atendida', 'todas']

interface EstadoPanel {
  alerta: AlertaTermica
  pestana: PestanaPanel
}

/**
 * Alertas (`/alertas`), plantilla Bandeja (DIRECTION §13.3): tira de estado,
 * la lista con los filtros en su superficie, el rail de contexto (incidentes
 * operativos y cinta 24 h) y «Atendidas recientemente» cuando hay pocas filas.
 * El foco es la primera fila: la pendiente más grave y más antigua.
 */
export function AlertasPage() {
  const { t } = useTranslation()
  const usuario = useAuthStore((s) => s.usuario)
  const {
    alertas,
    cargando,
    errorCarga,
    errorRefresco = false,
    actualizadoEn = null,
    limiteAlcanzado = false,
    reintentar,
    filtro,
    setFiltro,
    reconocerAlerta,
    registrarAccionCorrectiva,
    obtenerCicloAtencion,
    rectificarAccion,
  } = useAlertas()
  const incidentesConsulta = useIncidentesOperativos()
  useRefrescoIncidentes(incidentesConsulta.consultar)
  const atendidas = useAtendidasRecientes()
  const recargarAtendidas = atendidas.recargar
  const resumenVivo = useEstadoVivoStore((s) => s.alertas)
  const cargaViva = useEstadoVivoStore((s) => s.carga)
  const conectado = useEstadoVivoStore((s) => s.conectado)
  const ahora = useAhora()
  // La cinta se recalcula con los datos o cada 5 min, no con cada minuto.
  const ahoraCinta = Math.floor(ahora / 300_000) * 300_000

  // ── RBAC (sin cambios): HU-23/HU-41 ─────────────────────────────────────
  // Reconocer es exclusivo del farmacéutico (como `require_roles` en el
  // backend); registrar la acción, farmacéutico y técnico; el administrador
  // entra por `tienePermiso`. El auditor es de solo lectura: solo Cronología.
  const puedeReconocer = usuario !== null && tienePermiso(usuario.rol, ['farmaceutico'])
  const puedeRegistrarAccion = usuario !== null && tienePermiso(usuario.rol, ['farmaceutico', 'tecnico'])
  // HU-28: rectifica su autor técnico o un farmacéutico; nunca el auditor; solo la vigente.
  const puedeRectificar = useCallback(
    (accion: AccionCorrectiva) =>
      usuario !== null &&
      accion.vigente !== false &&
      (tienePermiso(usuario.rol, ['farmaceutico']) || (accion.usuario_id === usuario.id && tienePermiso(usuario.rol, ['tecnico']))),
    [usuario],
  )

  // ── Lista ordenada y paginada ───────────────────────────────────────────
  const [aviso, setAviso] = useState<Aviso | null>(null)
  const [pagina, setPagina] = useState(1)
  const tamanoPagina = useResponsivePageSize()
  const ordenadas = useMemo(() => ordenarAlertas(alertas, filtro), [alertas, filtro])
  const visibles = useMemo(() => ordenadas.slice(...rangoPagina(pagina, tamanoPagina)), [ordenadas, pagina, tamanoPagina])
  const nuevos = useIdsNuevos(ordenadas.map((a) => a.id), !cargando, filtro)
  // Un solo «Registrar acción» primario por pantalla: el de la crítica abierta
  // más antigua (el foco, DIRECTION §6). Sin críticas, el de la primera fila
  // de la bandeja de triaje.
  const idPrimaria = useMemo(() => {
    const abiertas = visibles.filter((a) => a.estado !== 'atendida')
    const critica = abiertas.find((a) => a.nivel_riesgo === 'excursion_critica')
    return critica?.id ?? (ordenEsTriage(filtro) ? abiertas[0]?.id : undefined)
  }, [visibles, filtro])

  const cambiarFiltro = useCallback(
    (siguiente: FiltroEstado) => {
      setPagina(1)
      setAviso(null)
      setFiltro(siguiente)
    },
    [setFiltro],
  )

  // ── Contexto: tira, incidentes, cinta y atendidas ──────────────────────
  const pendientesVivo = resumenVivo?.pendientes
  const revisadasVivo = resumenVivo?.revisadas
  const estadoResumen: 'cargando' | 'listo' | 'error' =
    resumenVivo && pendientesVivo && revisadasVivo ? 'listo' : cargaViva === 'cargando' ? 'cargando' : 'error'
  const resumen = useMemo(
    () =>
      pendientesVivo && revisadasVivo
        ? resumirBandeja(pendientesVivo, revisadasVivo, atendidas.alertas, atendidas.limite, ahora)
        : null,
    [pendientesVivo, revisadasVivo, atendidas.alertas, atendidas.limite, ahora],
  )
  const incidentes = incidentesConsulta.incidentes
  const incidentesActivos =
    incidentesConsulta.errorCarga || incidentesConsulta.cargando ? null : incidentes.filter((i) => i.estado === 'activo').length
  const cintas = useMemo(
    () =>
      construirCinta24h(
        [...(pendientesVivo ?? []), ...(revisadasVivo ?? []), ...atendidas.alertas],
        incidentes,
        ahoraCinta,
      ),
    [pendientesVivo, revisadasVivo, atendidas.alertas, incidentes, ahoraCinta],
  )
  const ultimaAtendida = resumen?.ultimaAtendida ?? atendidas.alertas[0] ?? null

  // ── Región viva única ──────────────────────────────────────────────────
  const [anuncio, setAnuncio] = useState('')
  const [revisando, setRevisando] = useState<ReadonlySet<string>>(new Set())

  const revisar = useCallback(
    async (alerta: AlertaTermica) => {
      setAviso(null)
      setRevisando((previo) => new Set(previo).add(alerta.id))
      try {
        const resultado = await reconocerAlerta(alerta.id)
        if (resultado === 'ok') setAnuncio(t('alertas.anuncio.revisada', { equipo: alerta.device_id }))
        else if (resultado === 'conflicto') setAviso({ tipo: 'conflicto' })
        else setAviso({ tipo: 'errorRevisar', equipo: alerta.device_id })
      } finally {
        setRevisando((previo) => {
          const siguiente = new Set(previo)
          siguiente.delete(alerta.id)
          return siguiente
        })
      }
    },
    [reconocerAlerta, t],
  )

  // Anuncio agrupado de alertas que llegan por SSE (máximo uno cada 10 s).
  const ultimoAnuncioSse = useRef(0)
  useEffect(() => {
    if (nuevos.size === 0) return
    const marca = Date.now()
    if (marca - ultimoAnuncioSse.current < 10_000) return
    ultimoAnuncioSse.current = marca
    const llegadas = ordenadas.filter((a) => nuevos.has(a.id))
    if (llegadas.length === 1) {
      const [una] = llegadas
      setAnuncio(
        t('alertas.anuncio.nueva', { count: 1, riesgo: t(`riesgo.${una.nivel_riesgo}`), equipo: una.device_id }),
      )
    } else if (llegadas.length > 1) {
      setAnuncio(t('alertas.anuncio.nueva', { count: llegadas.length }))
    }
  }, [nuevos, ordenadas, t])

  // ── Panel lateral ──────────────────────────────────────────────────────
  const [panel, setPanel] = useState<EstadoPanel | null>(null)
  const disparador = useRef<HTMLElement | null>(null)
  const borradores = useRef(new Map<string, BorradorAccion>())
  const listaRef = useRef<HTMLDivElement>(null)

  const abrirPanel = useCallback((alerta: AlertaTermica, pestana: PestanaPanel, origen: HTMLElement) => {
    disparador.current = origen
    setPanel({ alerta, pestana })
  }, [])
  const abrirCronologia = useCallback(
    (alerta: AlertaTermica, origen: HTMLElement) => abrirPanel(alerta, 'cronologia', origen),
    [abrirPanel],
  )
  const cerrarPanel = useCallback(() => setPanel(null), [])

  // La alerta del panel se lee de la lista (para ver su estado al día) y, si
  // sale del filtro, se conserva la última instantánea.
  const enLista = panel ? alertas.find((a) => a.id === panel.alerta.id) : undefined
  const alertaPanel = enLista ?? panel?.alerta ?? null
  useEffect(() => {
    if (enLista && panel && enLista !== panel.alerta) setPanel({ ...panel, alerta: enLista })
  }, [enLista, panel])

  const devolverFoco = useCallback(() => {
    const origen = disparador.current
    if (origen?.isConnected) {
      origen.focus()
      return
    }
    // La fila salió de la lista: primera acción de la primera fila, o el filtro activo.
    const destino =
      listaRef.current?.querySelector<HTMLElement>('tbody button') ??
      listaRef.current?.querySelector<HTMLElement>('[data-accion-vacio]') ??
      listaRef.current?.querySelector<HTMLElement>('[aria-pressed="true"]')
    destino?.focus()
  }, [])

  const registrar = useCallback(
    async (alertaId: string, datos: BorradorAccion) => {
      const resultado = await registrarAccionCorrectiva(alertaId, datos)
      if (resultado === 'ok') {
        setAnuncio(t('alertas.accionRegistrada'))
        void recargarAtendidas()
      }
      return resultado
    },
    [registrarAccionCorrectiva, recargarAtendidas, t],
  )

  // ── Conteos de los filtros (solo visibles a ≥640, anunciados aparte) ───
  const conteos: Partial<Record<FiltroEstado, number>> =
    estadoResumen === 'listo' && resumen ? { pendiente: resumen.pendientes, reconocida: resumen.revisadas } : {}

  const horaDatos = actualizadoEn ? hora(new Date(actualizadoEn).toISOString()) : null
  const meta = horaDatos
    ? conectado === false
      ? t('alertas.sinConexionVivo', { hora: horaDatos })
      : t('alertas.actualizado', { hora: horaDatos })
    : undefined
  const mostrarAtendidas = !cargando && !errorCarga && ordenEsTriage(filtro) ? cuantasAtendidas(visibles.length) : 0
  // Con pocas filas, el hueco bajo la bandeja se llena con contexto real: la
  // lectura actual de cada equipo y, sin atendidas que mostrar, el
  // procedimiento de atención (nunca tarjetas de relleno, DIRECTION §13).
  const pocasFilas = !cargando && !errorCarga && ordenEsTriage(filtro) && visibles.length <= FILAS_CON_CONTEXTO
  const sinAtendidas = atendidas.estado !== 'cargando' && atendidas.alertas.length === 0

  return (
    <TooltipProvider delayDuration={250} skipDelayDuration={300}>
      <div className="mx-auto w-full max-w-(--ancho-contenido-max)">
        <PageHeader titulo={t('alertas.titulo')} descripcion={t('alertas.descripcion')} meta={meta}>
          {MODO_DEMO && <SimularAlertaDemo onError={() => setAnuncio(t('alertas.demo.error'))} />}
        </PageHeader>

        <TiraEstadoAlertas
          resumen={resumen}
          incidentesActivos={incidentesActivos}
          estado={estadoResumen}
          atendidasDisponibles={atendidas.estado !== 'error'}
          ahora={ahora}
        />

        <div className="flex flex-col gap-3 xl:gap-4">
          {/* Bandeja y rail en su propia grilla: el rail fijo (sticky) no puede
              salirse de ella y montarse sobre lo que va debajo. */}
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-12 xl:gap-4">
            <div className="min-w-0 space-y-3 xl:col-span-8 2xl:col-span-9">
              <AvisoAlertas
                aviso={aviso}
                onCerrar={() => setAviso(null)}
                errorRefresco={errorRefresco}
                horaDatos={horaDatos}
                onReintentar={reintentar}
              />

              <div ref={listaRef} className="superficie overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-border p-2 sm:min-h-12 sm:px-3 sm:py-1.5">
                  <Segmentado
                    etiqueta={t('alertas.filtroEstado')}
                    valor={filtro}
                    onCambiar={cambiarFiltro}
                    opciones={FILTROS.map((opcion) => ({
                      valor: opcion,
                      etiqueta: t(`alertas.filtro.${opcion}`),
                      conteo: conteos[opcion] ?? null,
                      descripcionConteo:
                        conteos[opcion] != null ? t('alertas.filtroConteo', { count: conteos[opcion] }) : undefined,
                    }))}
                    className="grid w-full grid-cols-4 sm:inline-flex sm:w-auto"
                    botonClassName="px-1.5 text-meta sm:px-3 sm:text-body"
                  />
                  <p className="hidden pr-1 text-meta text-faint sm:block">
                    {ordenEsTriage(filtro) ? t('alertas.ordenUrgencia') : t('alertas.ordenReciente')}
                  </p>
                </div>

                {errorCarga ? (
                  <div className="p-3">
                    <EstadoError mensaje={t('alertas.errorCargar')}>
                      <Button variant="secondary" size="sm" className="mt-3" onClick={reintentar}>
                        {t('comunes.reintentar')}
                      </Button>
                    </EstadoError>
                  </div>
                ) : !cargando && ordenadas.length === 0 ? (
                  <VacioAlertas
                    filtro={filtro}
                    revisadas={resumen?.revisadas ?? 0}
                    ultimaAtendida={ultimaAtendida}
                    incidentesActivos={incidentesActivos ?? 0}
                    onFiltro={cambiarFiltro}
                  />
                ) : (
                  <>
                    <div key={filtro} className="animate-(--animate-fade)">
                      <Table
                        variante="embebida"
                        mobileLayout="stack"
                        className="min-w-0"
                        titulo={t('alertas.titulo')}
                        cargando={cargando}
                      >
                        <TableHeader className="bg-surface-sunken">
                          <TableRow className="hover:bg-transparent">
                            <TableHead className="h-9 pr-3 pl-4 font-medium text-muted sm:pr-3 sm:pl-4">{t('alertas.columnaAlerta')}</TableHead>
                            <TableHead className="hidden h-9 w-36 px-3 font-medium text-muted sm:px-3 md:table-cell">
                              {t('alertas.columnaExcursion')}
                            </TableHead>
                            <TableHead className="h-9 w-px pr-4 pl-3 text-right font-medium text-muted sm:pr-4 sm:pl-3">{t('alertas.acciones')}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {cargando ? (
                            <FilasCargando puedeReconocer={puedeReconocer} puedeRegistrar={puedeRegistrarAccion} />
                          ) : (
                            visibles.map((alerta, indice) => (
                              <FilaAlerta
                                key={alerta.id}
                                alerta={alerta}
                                filtro={filtro}
                                puedeReconocer={puedeReconocer}
                                puedeRegistrar={puedeRegistrarAccion}
                                seleccionada={panel?.alerta.id === alerta.id}
                                revisando={revisando.has(alerta.id)}
                                nueva={nuevos.has(alerta.id)}
                                indice={indice}
                                primaria={alerta.id === idPrimaria}
                                onRevisar={revisar}
                                onAbrir={abrirPanel}
                              />
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                    {!cargando && (
                      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-2 [&>*]:mt-0">
                        <Paginacion total={ordenadas.length} pagina={pagina} onCambiar={setPagina} tamano={tamanoPagina} />
                        {limiteAlcanzado && (
                          <p className="text-meta text-faint">{t('alertas.limiteResultados', { limite: 200 })}</p>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>

              {pocasFilas && <EquiposAhora ahora={ahora} />}
            </div>

            <aside
              aria-label={t('alertas.rail.region')}
              className="grid grid-cols-1 content-start gap-3 md:grid-cols-2 xl:sticky xl:top-[calc(var(--alto-cabecera)+24px)] xl:col-span-4 xl:grid-cols-1 xl:gap-4 xl:self-start 2xl:col-span-3"
            >
              <IncidentesOperativos
                incidentes={incidentes}
                cargando={incidentesConsulta.cargando}
                errorCarga={incidentesConsulta.errorCarga}
                onReintentar={() => void incidentesConsulta.consultar()}
                ahora={ahora}
              />
              <Cinta24hAlertas cintas={cintas} cargando={estadoResumen === 'cargando' && atendidas.estado === 'cargando'} />
            </aside>
          </div>

          {/* Lo recién atendido y la guía van a todo lo ancho, después del rail:
              la bandeja y el rail terminan casi a la par (sin hueco junto al
              rail) y en móvil los incidentes quedan antes que el historial. */}
          <div className="min-w-0 space-y-3 empty:hidden xl:space-y-4">
            <AtendidasRecientes
              alertas={atendidas.alertas}
              cantidad={mostrarAtendidas}
              ahora={ahora}
              onVerAtendidas={() => cambiarFiltro('atendida')}
              onCronologia={abrirCronologia}
              conAccion={ordenadas.length > 0}
            />

            {pocasFilas && sinAtendidas && <GuiaAtencion />}
          </div>
        </div>

        <p role="status" aria-live="polite" className="sr-only">
          {anuncio}
        </p>

        <PanelAlerta
          alerta={alertaPanel}
          pestanaInicial={panel?.pestana ?? 'cronologia'}
          puedeRegistrar={puedeRegistrarAccion}
          puedeRectificar={puedeRectificar}
          borradores={borradores.current}
          onCerrar={cerrarPanel}
          onDevolverFoco={devolverFoco}
          registrarAccion={registrar}
          obtenerCiclo={obtenerCicloAtencion}
          rectificarAccion={rectificarAccion}
        />
      </div>
    </TooltipProvider>
  )
}
