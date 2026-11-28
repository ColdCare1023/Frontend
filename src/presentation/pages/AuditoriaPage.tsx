import { SeccionDetalle } from '@/presentation/components/ui/seccion-detalle'
import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CircleCheck, Download, FilterX, Info, Search, ShieldAlert, TriangleAlert } from 'lucide-react'

import { useAuditoria, type FiltrosAuditoria, type ResultadoExportacion } from '@/application/hooks/useAuditoria'
import { useAuthStore } from '@/application/stores/authStore'
import { RESULTADOS_AUDITORIA, type RegistroAuditoria, type ResultadoAuditoria, type Usuario } from '@/domain/entities/Usuario'
import { apiClient } from '@/infrastructure/api/apiClient'
import { claveDia, contarPorDia } from '@/lib/agruparPorDia'
import { fechaHora, hora } from '@/lib/formato'
import { rangoPagina } from '@/lib/paginacion'
import { cn } from '@/lib/utils'
import { useResponsivePageSize } from '@/presentation/hooks/useResponsivePageSize'
import { EstadoCarga, EstadoError, EstadoVacio } from '../components/EstadoPagina'
import { Paginacion } from '../components/Paginacion'
import { PageHeader } from '../components/PageHeader'
import { BotonCopiar, BotonMasFiltros, ChipsFiltro, Dato, TarjetaRail, type Chip } from '../components/registros/piezas'
import { CeldaRegistro, EncabezadoRegistro, TablaRegistros } from '../components/registros/TablaRegistros'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Input, Label, NativeSelect } from '../components/ui/input'
import { SelectorFecha } from '../components/ui/selector-fecha'
import { TiraEstado } from '../components/ui/tira-estado'
import { CATEGORIAS_AUDITORIA, clasificarAccion, CODIGOS_SEGURIDAD, ICONO_CATEGORIA, nombreAccion, type CategoriaAuditoria } from './auditoria/categoriasAuditoria'
import { HistogramaActividad } from './auditoria/HistogramaActividad'
import { esFallida } from './auditoria/categoriasAuditoria'

const FILTROS_INICIALES: FiltrosAuditoria = {}
const esResultado = (valor: string): valor is ResultadoAuditoria => (RESULTADOS_AUDITORIA as readonly string[]).includes(valor)

/**
 * HU-50: el administrador ve el nombre de cada actor (`/api/usuarios` es solo
 * suyo); el auditor ve el identificador, que es lo que guarda la bitácora.
 */
function useNombresUsuarios(habilitado: boolean): Map<string, string> {
  const [nombres, setNombres] = useState<Map<string, string>>(() => new Map())
  useEffect(() => {
    if (!habilitado) return
    let vigente = true
    apiClient
      .get<Usuario[]>('/api/usuarios')
      .then(({ data }) => {
        if (vigente && Array.isArray(data)) setNombres(new Map(data.map((u) => [u.id, u.nombre || u.email])))
      })
      .catch(() => {})
    return () => {
      vigente = false
    }
  }, [habilitado])
  return nombres
}

// Los tres resultados negativos van en tinte (no sólido): en una tabla de
// registros conviven muchos y el sólido se reserva para lo que pide actuar.
const VARIANTE_RESULTADO: Record<string, 'ok' | 'criticalTint' | 'warn'> = {
  exitoso: 'ok',
  fallido: 'criticalTint',
  denegado: 'criticalTint',
  bloqueado: 'warn',
}

const fechaDe = (r: RegistroAuditoria) => r.created_at
/** Un UUID se abrevia a 8 caracteres; un id corto se muestra entero, sin «…». */
const claveRegistro = (r: RegistroAuditoria) => r.id
const humanizar = (clave: string) => clave.replaceAll('_', ' ').replace(/^\p{L}/u, (l) => l.toLocaleUpperCase())

export function AuditoriaPage() {
  const { t } = useTranslation()
  const { registros, cargando, errorCarga, motivoError, consultar, exportar, exportando, limite } = useAuditoria()
  const rol = useAuthStore((s) => s.usuario?.rol)
  const nombres = useNombresUsuarios(rol === 'administrador')
  const [resultadoExportacion, setResultadoExportacion] = useState<ResultadoExportacion | null>(null)
  const [pagina, setPagina] = useState(1)
  const tamanoPagina = useResponsivePageSize(8)
  const [filtros, setFiltros] = useState<FiltrosAuditoria>(FILTROS_INICIALES)
  const [aplicados, setAplicados] = useState<FiltrosAuditoria>(FILTROS_INICIALES)
  const [diaHistograma, setDiaHistograma] = useState<string | null>(null)
  const [categoria, setCategoria] = useState<CategoriaAuditoria | null>(null)
  const [expandida, setExpandida] = useState<string | null>(null)
  const [masFiltros, setMasFiltros] = useState(false)

  // Base del histograma: la última carga SIN periodo, para que no se reduzca
  // a una barra al filtrar un día.
  const sinPeriodo = !aplicados.desde && !aplicados.hasta
  const [baseHistograma, setBaseHistograma] = useState<RegistroAuditoria[]>(registros)
  if (sinPeriodo && baseHistograma !== registros && !cargando) setBaseHistograma(registros)

  // HU-42/HU-50: el resultado se filtra en el SERVIDOR (`resultado`); la
  // categoría, sobre las filas ya cargadas (diferida para no bloquear la escritura).
  const categoriaDiferida = useDeferredValue(categoria)
  const filtradas = useMemo(
    () => registros.filter((r) => !categoriaDiferida || clasificarAccion(r.accion).categoria === categoriaDiferida),
    [registros, categoriaDiferida],
  )
  // La firma evita reiniciar la vista cuando llega la misma lista otra vez.
  const firma = `${filtradas.length}:${filtradas[0]?.id}:${filtradas.at(-1)?.id}`
  const [firmaPrevia, setFirmaPrevia] = useState(firma)
  if (firmaPrevia !== firma) {
    setFirmaPrevia(firma)
    setPagina(1)
    setExpandida(null)
  }
  const visibles = useMemo(() => filtradas.slice(...rangoPagina(pagina, tamanoPagina)), [filtradas, pagina, tamanoPagina])
  const porDia = useMemo(() => contarPorDia(filtradas, fechaDe), [filtradas])

  const consultarCon = (crudos: FiltrosAuditoria, dia: string | null = null) => {
    const nuevos = { ...crudos, usuario_id: crudos.usuario_id?.trim() || undefined, accion: crudos.accion?.trim() || undefined }
    setFiltros(nuevos)
    setAplicados(nuevos)
    setDiaHistograma(dia)
    void consultar(nuevos)
  }
  const actualizarFiltro = (campo: keyof FiltrosAuditoria, valor: string) => {
    setFiltros((previos) => ({ ...previos, [campo]: valor || undefined }))
  }
  const limpiar = () => {
    setCategoria(null)
    consultarCon(FILTROS_INICIALES)
  }

  // HU-42 esc. 1 / HU-50 esc. 4: el SERVIDOR exporta la bitácora con los
  // filtros aplicados (hasta 10 000 filas), declara el alcance en la primera
  // línea y deja la exportación auditada (EXPORTAR_BITACORA).
  const exportarCsv = async () => {
    setResultadoExportacion(null)
    setResultadoExportacion(await exportar(aplicados))
  }

  // HU-50: KPIs del resultado REAL que registra el backend (antes se contaba
  // un BLOQUEO_TEMPORAL que el backend nunca emite).
  const contar = (valor: ResultadoAuditoria) => registros.filter((r) => r.resultado === valor).length
  const bloqueos = contar('bloqueado')
  const fallidos = contar('fallido')
  const denegados = contar('denegado')
  const usuarios = new Set(registros.flatMap((r) => (r.usuario_id ? [r.usuario_id] : []))).size
  const nombreUsuario = (id: string) => nombres.get(id)
  const codigosAccion = useMemo(() => [...new Set([...CODIGOS_SEGURIDAD, ...registros.map((r) => r.accion)])].sort(), [registros])
  const usuariosVistos = useMemo(() => [...new Set(registros.flatMap((r) => (r.usuario_id ? [r.usuario_id] : [])))].sort(), [registros])

  const etiquetaResultado = (valor: string | null | undefined) =>
    valor ? t(`auditoria.resultados.${valor}`, { defaultValue: valor }) : '—'

  const chips: Chip[] = []
  if (aplicados.accion) chips.push({ clave: 'accion', texto: t('auditoria.chip.accion', { valor: aplicados.accion }), quitar: () => consultarCon({ ...aplicados, accion: undefined }, diaHistograma) })
  if (aplicados.usuario_id) chips.push({ clave: 'usuario', texto: t('auditoria.chip.usuario', { valor: nombreUsuario(aplicados.usuario_id) ?? aplicados.usuario_id }), quitar: () => consultarCon({ ...aplicados, usuario_id: undefined }, diaHistograma) })
  if (aplicados.resultado) chips.push({ clave: 'resultado', texto: t('auditoria.chip.resultado', { valor: t(`auditoria.resultados.${aplicados.resultado}`) }), quitar: () => consultarCon({ ...aplicados, resultado: undefined }, diaHistograma) })
  if (aplicados.desde || aplicados.hasta) {
    const desde = aplicados.desde ? fechaHora(aplicados.desde) : ''
    const hasta = aplicados.hasta ? fechaHora(aplicados.hasta) : ''
    const valor = desde && hasta ? t('comunes.periodo.rango', { desde, hasta }) : desde ? t('comunes.periodo.desdeSolo', { desde }) : t('comunes.periodo.hastaSolo', { hasta })
    chips.push({ clave: 'periodo', texto: t('auditoria.chip.periodo', { valor }), quitar: () => consultarCon({ ...aplicados, desde: undefined, hasta: undefined }) })
  }
  if (categoria) chips.push({ clave: 'categoria', texto: t('auditoria.chip.categoria', { valor: t(`auditoria.categorias.${categoria}`) }), quitar: () => setCategoria(null) })
  const hayFiltros = chips.length > 0

  const guia =
    bloqueos > 0 ? (
      <span role="status" className="flex items-start gap-2">
        <ShieldAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-warning-700" />
        {t('auditoria.bloqueosTemporales', { count: bloqueos })}
      </span>
    ) : fallidos + denegados > 0 ? (
      <span className="flex items-start gap-2">
        <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-critical" />
        {t('auditoria.guia.fallidos', { count: fallidos + denegados })}
      </span>
    ) : (
      <span className="flex items-start gap-2">
        <CircleCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-success-700" />
        {t('auditoria.guia.sinFallos')}
      </span>
    )

  const porCategoria = useMemo(() => {
    const mapa = new Map<CategoriaAuditoria, { total: number; fallidas: number }>()
    for (const r of registros) {
      const c = clasificarAccion(r.accion).categoria
      const v = mapa.get(c) ?? { total: 0, fallidas: 0 }
      v.total += 1
      if (esFallida(r)) v.fallidas += 1
      mapa.set(c, v)
    }
    return CATEGORIAS_AUDITORIA.flatMap((c) => (mapa.has(c) ? [{ categoria: c, ...mapa.get(c)! }] : []))
  }, [registros])
  const origenes = useMemo(() => {
    const mapa = new Map<string, { total: number; fallidas: number }>()
    for (const r of registros) {
      if (!r.ip_origen) continue
      const v = mapa.get(r.ip_origen) ?? { total: 0, fallidas: 0 }
      v.total += 1
      if (esFallida(r)) v.fallidas += 1
      mapa.set(r.ip_origen, v)
    }
    return [...mapa.entries()].sort((a, b) => b[1].total - a[1].total).slice(0, 3)
  }, [registros])
  const maxCategoria = Math.max(1, ...porCategoria.map((c) => c.total))

  const meta =
    registros.length > 0
      ? t('auditoria.meta', { n: registros.length, desde: fechaHora(registros.at(-1)?.created_at).split(',')[0], hasta: fechaHora(registros[0].created_at).split(',')[0] })
      : undefined

  const alcance = (
    <p className="flex items-start gap-1.5 text-meta text-faint">
      <Info aria-hidden className="mt-0.5 size-3.5 shrink-0" />
      {t('auditoria.alcancePanel')}
    </p>
  )

  const barra = (
    <>
      {/* HU-50 criterio 1: filtrar por periodo, usuario o tipo de acción. */}
      {/* Rejilla de 3 columnas desde 1024 px: acción, usuario y resultado en
          la primera fila; periodo y acciones en la segunda (antes «Resultado»
          quedaba a media fila). Bajo 640 px solo se ve la acción y «Filtros». */}
      <form
        role="search"
        aria-label={t('auditoria.filtro.etiqueta')}
        className={cn('grid grid-cols-1 items-end gap-x-3 gap-y-2 border-b border-border px-3 py-2.5 sm:grid-cols-2 sm:px-4', masFiltros && 'lg:grid-cols-3')}
        onSubmit={(e) => {
          e.preventDefault()
          consultarCon(filtros)
        }}
      >
        <div className="min-w-0">
          <Label htmlFor="fa-accion" className="text-meta text-muted">{t('auditoria.accion')}</Label>
          <div className="flex gap-2">
            <div className="relative min-w-0 flex-1">
              <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" />
              <Input id="fa-accion" list="fa-accion-codigos" className="h-9 pl-9 max-sm:h-11 pointer-coarse:h-11" value={filtros.accion ?? ''} onChange={(e) => actualizarFiltro('accion', e.target.value)} placeholder={t('auditoria.accionPlaceholder')} aria-describedby="fa-accion-ayuda" />
              <datalist id="fa-accion-codigos">{codigosAccion.map((codigo) => <option key={codigo} value={codigo} label={nombreAccion(codigo, t)} />)}</datalist>
            </div>
            <BotonMasFiltros
              abierto={masFiltros}
              onCambiar={setMasFiltros}
              controla="auditoria-mas-filtros"
              activos={(aplicados.usuario_id ? 1 : 0) + (aplicados.resultado ? 1 : 0) + (aplicados.desde || aplicados.hasta ? 1 : 0)}
              texto={t('auditoria.filtro.mas')}
              textoActivos={(count) => t('auditoria.filtro.masActivos', { count })}
            />
          </div>
          <p id="fa-accion-ayuda" className="sr-only">{t('auditoria.ayudaAccion')}</p>
        </div>
        <div id="auditoria-mas-filtros" className={cn('grid-cols-1 gap-x-3 gap-y-2 min-[480px]:grid-cols-2', masFiltros ? 'grid sm:contents' : 'hidden')}>
          <div className="min-w-0">
            <Label htmlFor="fa-usuario" className="text-meta text-muted">{t('auditoria.usuario')}</Label>
            <Input id="fa-usuario" list="fa-usuario-ids" className="h-9 max-sm:h-11 pointer-coarse:h-11" value={filtros.usuario_id ?? ''} onChange={(e) => actualizarFiltro('usuario_id', e.target.value)} placeholder={t('auditoria.usuarioPlaceholder')} aria-describedby="fa-usuario-ayuda" />
            <datalist id="fa-usuario-ids">{usuariosVistos.map((id) => <option key={id} value={id} label={nombreUsuario(id) ?? id} />)}</datalist>
            <p id="fa-usuario-ayuda" className="sr-only">{t('auditoria.usuarioAyuda')}</p>
          </div>
          <div className="min-w-0">
            <Label htmlFor="fa-resultado" className="text-meta text-muted">{t('auditoria.filtroResultado.etiqueta')}</Label>
            <NativeSelect
              id="fa-resultado"
              className="h-9 max-sm:h-11 pointer-coarse:h-11"
              aria-describedby="fa-resultado-ayuda"
              value={filtros.resultado ?? ''}
              onChange={(e) => consultarCon({ ...filtros, resultado: esResultado(e.target.value) ? e.target.value : undefined }, diaHistograma)}
            >
              <option value="">{t('auditoria.filtroResultado.todas')}</option>
              {RESULTADOS_AUDITORIA.map((valor) => <option key={valor} value={valor}>{t(`auditoria.resultados.${valor}`)}</option>)}
            </NativeSelect>
            <p id="fa-resultado-ayuda" className="sr-only">{t('auditoria.filtroResultado.ayuda')}</p>
          </div>
          <div className="min-w-0">
            <Label htmlFor="fa-desde" className="text-meta text-muted">{t('historial.desde')}</Label>
            <SelectorFecha id="fa-desde" conHora valor={filtros.desde ?? ''} onCambiar={(valor) => actualizarFiltro('desde', valor)} />
          </div>
          <div className="min-w-0">
            <Label htmlFor="fa-hasta" className="text-meta text-muted">{t('historial.hasta')}</Label>
            <SelectorFecha id="fa-hasta" conHora valor={filtros.hasta ?? ''} onCambiar={(valor) => actualizarFiltro('hasta', valor)} />
          </div>
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Button type="submit" size="sm">{t('historial.aplicar')}</Button>
          {hayFiltros && (
            <Button type="button" variant="ghost" size="sm" className="text-muted" onClick={limpiar}>
              <FilterX aria-hidden />
              {t('historial.limpiar')}
            </Button>
          )}
          {/* El total ya sale en el encabezado: aquí solo se anuncia. */}
          <span aria-live="polite" className={cn('nums ml-auto text-meta text-faint', !cargando && 'sr-only')}>
            {cargando ? t('comunes.consultando') : t('auditoria.filtro.resultados', { count: filtradas.length })}
          </span>
        </div>
      </form>
      <ChipsFiltro chips={chips} idFocoAlVaciar="fa-accion" />
    </>
  )

  const tabla =
    cargando && registros.length === 0 ? (
      <EstadoCarga />
    ) : errorCarga ? (
      <div className="p-3 sm:p-4">
        <EstadoError mensaje={motivoError === 'validacion' ? t('auditoria.errorFiltros') : t('comunes.errorCargar')}>
          <Button variant="secondary" size="sm" className="mt-3" onClick={() => void consultar(aplicados)}>
            {t('comunes.reintentar')}
          </Button>
        </EstadoError>
      </div>
    ) : registros.length === 0 ? (
      <div className="p-3 sm:p-4">
        {Object.values(aplicados).some(Boolean) ? (
          <EstadoVacio ilustracion="sin-resultados" titulo={t('auditoria.vacio.filtrosTitulo')} detalle={t('auditoria.vacio.filtrosDetalle')}>
            <Button variant="secondary" size="sm" onClick={limpiar}>{t('comunes.quitarFiltros')}</Button>
          </EstadoVacio>
        ) : (
          <EstadoVacio ilustracion="sin-datos" titulo={t('auditoria.sinRegistros')} detalle={t('auditoria.vacio.sinDatosDetalle')}>
            <Button variant="secondary" size="sm" onClick={() => void consultar({})}>{t('auditoria.vacio.actualizar')}</Button>
          </EstadoVacio>
        )}
      </div>
    ) : filtradas.length === 0 ? (
      <div className="p-3 sm:p-4">
        <EstadoVacio ilustracion="sin-resultados" titulo={t('auditoria.vacio.filtrosTitulo')} detalle={t('auditoria.vacio.categoriaDetalle')}>
          <Button variant="secondary" size="sm" onClick={() => setCategoria(null)}>{t('comunes.mostrarTodas')}</Button>
        </EstadoVacio>
      </div>
    ) : (
      <>
        <TablaRegistros
          titulo={t('auditoria.titulo')}
          columnas={4}
          filas={visibles}
          clave={claveRegistro}
          fechaDe={fechaDe}
          cargando={cargando}
          expandida={expandida}
          onExpandir={setExpandida}
          etiquetaBoton={(r, abierta) => t(abierta ? 'auditoria.fila.ocultarDetalle' : 'auditoria.fila.verDetalle', { accion: nombreAccion(r.accion, t), hora: hora(r.created_at) })}
          resumenDia={(clave) => {
            const dia = porDia.get(clave) ?? []
            const nFallidas = dia.filter(esFallida).length
            return (
              <>
                {t('auditoria.dia.resumen', { count: dia.length })}
                {nFallidas > 0 && <span className="ml-2 text-critical">{t('auditoria.dia.fallidas', { count: nFallidas })}</span>}
              </>
            )
          }}
          encabezados={
            <>
              <EncabezadoRegistro className="w-[124px] whitespace-nowrap">{t('auditoria.columnas.hora')}</EncabezadoRegistro>
              <EncabezadoRegistro>{t('auditoria.accion')}</EncabezadoRegistro>
              <EncabezadoRegistro className="w-[136px]">{t('auditoria.resultado')}</EncabezadoRegistro>
              <EncabezadoRegistro className="w-[152px]">{t('auditoria.usuario')}</EncabezadoRegistro>
            </>
          }
          renderCeldas={(r) => {
            const { icono: Icono } = clasificarAccion(r.accion)
            return (
              <>
                <CeldaRegistro area="oculta" className="nums whitespace-nowrap text-body text-subtle">{hora(r.created_at)}</CeldaRegistro>
                <CeldaRegistro area="a">
                  <div className="flex min-w-0 items-start gap-2.5">
                    <Icono aria-hidden className="mt-0.5 size-4 shrink-0 text-muted" />
                    <div className="min-w-0">
                      <p className="truncate text-body text-foreground">{nombreAccion(r.accion, t)}</p>
                      <p className="nums text-meta text-muted sm:hidden">{hora(r.created_at)}</p>
                    </div>
                  </div>
                </CeldaRegistro>
                <CeldaRegistro area="c">
                  <Badge dot={r.resultado === 'exitoso'} variant={(r.resultado && VARIANTE_RESULTADO[r.resultado]) || 'neutral'}>
                    {etiquetaResultado(r.resultado)}
                  </Badge>
                </CeldaRegistro>
                <CeldaRegistro area="oculta" className="truncate text-meta text-muted">
                  {r.usuario_id ? (
                    nombreUsuario(r.usuario_id) ?? t('registros.usuarioRegistrado')
                  ) : (
                    <span className="text-faint">{t('auditoria.sinUsuario')}</span>
                  )}
                </CeldaRegistro>
              </>
            )
          }}
          renderDetalle={(r) => (
            <>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 xl:grid-cols-4">
                <Dato etiqueta={t('auditoria.fecha')} className="nums">{fechaHora(r.created_at)}</Dato>
                <Dato etiqueta={t('auditoria.detalle.fechaUtc')} className="codigo text-meta">{r.created_at}</Dato>
                <Dato etiqueta={t('auditoria.detalle.codigo')} className="codigo">{r.accion}</Dato>
                <Dato etiqueta={t('auditoria.resultado')}>{etiquetaResultado(r.resultado)}</Dato>
                <Dato etiqueta={t('auditoria.recurso')} className="codigo break-all">{r.recurso}</Dato>
                <Dato etiqueta={t('auditoria.ip')} className="codigo">{r.ip_origen ?? '—'}</Dato>
                <Dato etiqueta={t('auditoria.detalle.usuarioCompleto')} className="flex min-w-0 items-center gap-1">
                  <span className="codigo min-w-0 break-all">
                    {r.usuario_id ? `${nombreUsuario(r.usuario_id) ? `${nombreUsuario(r.usuario_id)} · ` : ''}${r.usuario_id}` : t('auditoria.sinUsuario')}
                  </span>
                  {r.usuario_id && <BotonCopiar valor={r.usuario_id} campo={t('auditoria.usuarioId')} />}
                </Dato>
                <Dato etiqueta={t('auditoria.detalle.idRegistro')} className="codigo break-all text-meta">{r.id}</Dato>
              </dl>
              <div className="mt-3 border-t border-border pt-3">
                <p className="text-meta font-medium text-muted">{t('auditoria.detalle.contenido')}</p>
                {r.detalle && Object.keys(r.detalle).length > 0 ? (
                  <dl className="mt-1.5 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
                    {Object.entries(r.detalle).map(([clave, valor]) => (
                      <Dato key={clave} etiqueta={humanizar(clave)} className="codigo break-all text-meta">
                        {valor == null ? '—' : typeof valor === 'object' ? JSON.stringify(valor) : String(valor)}
                      </Dato>
                    ))}
                  </dl>
                ) : (
                  <p className="mt-1 text-body text-faint">{t('auditoria.detalle.sinContenido')}</p>
                )}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {r.usuario_id && (
                  <Button variant="ghost" size="sm" onClick={() => consultarCon({ ...aplicados, usuario_id: r.usuario_id ?? undefined }, diaHistograma)}>
                    {t('auditoria.detalle.filtrarUsuario')}
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => consultarCon({ ...aplicados, accion: r.accion }, diaHistograma)}>
                  {t('auditoria.detalle.filtrarAccion')}
                </Button>
              </div>
            </>
          )}
        />
        <div className="border-t border-border px-3 sm:px-4">
          <Paginacion total={filtradas.length} pagina={pagina} onCambiar={setPagina} tamano={tamanoPagina} />
        </div>
      </>
    )

  return (
    <div className="space-y-4">
      <PageHeader titulo={t('auditoria.titulo')} descripcion={t('auditoria.descripcion')} meta={meta}>
        <Button
          variant="secondary"
          onClick={() => void exportarCsv()}
          disabled={cargando || exportando || registros.length === 0}
          aria-label={t('auditoria.exportar')}
          aria-describedby="auditoria-exportar-ayuda"
          title={t('auditoria.exportarAyuda')}
        >
          <Download aria-hidden />
          <span className="max-sm:sr-only">{exportando ? t('auditoria.exportando') : t('auditoria.exportar')}</span>
        </Button>
        <p id="auditoria-exportar-ayuda" className="sr-only">{t('auditoria.exportarAyuda')}</p>
      </PageHeader>

      {resultadoExportacion && resultadoExportacion !== 'ok' && (
        <p role="alert" className="rounded-(--radius-field) bg-critical-tint px-3 py-2 text-meta text-critical">
          {resultadoExportacion === 'cuota' ? t('auditoria.exportarCuota') : t('auditoria.exportarError')}
        </p>
      )}
      {limite != null && registros.length >= limite && (
        <p role="status" className="flex items-center gap-1.5 text-meta text-faint">
          <Info aria-hidden className="size-3.5 shrink-0" />
          {t('auditoria.limiteLista', { n: limite })}
        </p>
      )}

      {registros.length > 0 && <p className="border-l-2 border-border-strong pl-3 text-body font-medium text-subtle">{guia}</p>}

      <div className="superficie overflow-clip">
        {barra}
        {tabla}
      {(registros.length > 0 || baseHistograma.length > 0) && (
        <SeccionDetalle titulo={t('lectura.analizarActividad')} className="mx-3 sm:mx-4">
          {registros.length > 0 && <TiraEstado
            etiqueta={t('auditoria.resumen')}
            segmentos={[
              { clave: 'eventos', etiqueta: t('auditoria.totalEventos'), valor: registros.length },
              { clave: 'fallidos', etiqueta: t('auditoria.kpi.fallidos'), valor: fallidos, tono: fallidos > 0 ? 'critico' : 'neutro' },
              { clave: 'denegados', etiqueta: t('auditoria.kpi.denegados'), valor: denegados, tono: denegados > 0 ? 'critico' : 'neutro' },
              { clave: 'bloqueos', etiqueta: t('auditoria.bloqueos'), valor: bloqueos, tono: bloqueos > 0 ? 'aviso' : 'neutro' },
              { clave: 'usuarios', etiqueta: t('auditoria.usuariosDistintos'), valor: usuarios },
            ]}
          />}
          {registros.length > 0 && <div className="grid items-start gap-3 lg:grid-cols-2">
            <TarjetaRail titulo={t('auditoria.rail.categorias')}>
              <ul className="-mx-2 space-y-0.5">
                {porCategoria.map(({ categoria: c, total, fallidas }) => {
                  const Icono = ICONO_CATEGORIA[c]
                  const activa = categoria === c
                  return (
                    <li key={c}>
                      <button
                        type="button"
                        aria-pressed={activa}
                        onClick={() => setCategoria(activa ? null : c)}
                        className={cn(
                          'flex min-h-10 w-full cursor-pointer flex-col justify-center gap-1 rounded-(--radius-field) px-2 py-1.5 text-left transition-colors duration-(--duration-micro) hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-ring',
                          activa && 'bg-primary-tint hover:bg-primary-tint',
                        )}
                      >
                        <span className="flex w-full items-center gap-2 text-body">
                          <Icono aria-hidden className="size-4 shrink-0 text-muted" />
                          <span className="min-w-0 flex-1 truncate text-foreground">{t(`auditoria.categorias.${c}`)}</span>
                          {fallidas > 0 && <span className="nums text-meta text-critical">{t('auditoria.dia.fallidas', { count: fallidas })}</span>}
                          <span className="nums text-meta text-muted">{total}</span>
                        </span>
                        <span aria-hidden className="block h-1 w-full overflow-hidden rounded-full bg-surface-sunken">
                          <span className="block h-full w-full origin-left rounded-full bg-border-strong" style={{ transform: `scaleX(${total / maxCategoria})` }} />
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </TarjetaRail>
            {origenes.length > 0 && (
              <TarjetaRail titulo={t('auditoria.rail.origenes')}>
                <ul className="divide-y divide-border">
                  {origenes.map(([ip, v]) => (
                    <li key={ip} className="flex items-baseline justify-between gap-3 py-1.5 first:pt-0 last:pb-0">
                      <span className="codigo text-body text-foreground">{ip}</span>
                      <span className="nums text-meta text-muted">
                        {t('auditoria.rail.origenValor', { count: v.total })}
                        {v.fallidas > 0 && <span className="text-critical"> · {t('auditoria.dia.fallidas', { count: v.fallidas })}</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              </TarjetaRail>
            )}
          </div>}
          {baseHistograma.length > 0 && (
            <HistogramaActividad
              registros={baseHistograma}
              diaSeleccionado={diaHistograma}
              onSeleccionar={(clave, inicio) => {
                if (!clave) {
                  consultarCon({ ...aplicados, desde: undefined, hasta: undefined })
                  return
                }
                const fin = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate(), 23, 59, 59)
                consultarCon({ ...aplicados, desde: inicio.toISOString(), hasta: fin.toISOString() }, claveDia(inicio.toISOString()))
              }}
            />
          )}
        </SeccionDetalle>
      )}
        <div className="border-t border-border px-3 py-2 sm:px-4">{alcance}</div>
      </div>
    </div>
  )
}
