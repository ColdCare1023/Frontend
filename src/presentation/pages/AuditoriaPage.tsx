import { useDeferredValue, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CircleCheck, Download, FilterX, Info, Search, ShieldAlert, TriangleAlert } from 'lucide-react'

import { useAuditoria, type FiltrosAuditoria } from '@/application/hooks/useAuditoria'
import type { RegistroAuditoria } from '@/domain/entities/Usuario'
import { claveDia, contarPorDia } from '@/lib/agruparPorDia'
import { fechaHora, hora } from '@/lib/formato'
import { rangoPagina } from '@/lib/paginacion'
import { cn } from '@/lib/utils'
import { useResponsivePageSize } from '@/presentation/hooks/useResponsivePageSize'
import { EstadoCarga, EstadoError, EstadoVacio } from '../components/EstadoPagina'
import { Paginacion } from '../components/Paginacion'
import { PageHeader } from '../components/PageHeader'
import { BotonCopiar, ChipsFiltro, Dato, PlantillaBandeja, TarjetaRail, type Chip } from '../components/registros/piezas'
import { CeldaRegistro, EncabezadoRegistro, TablaRegistros } from '../components/registros/TablaRegistros'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Input, Label, NativeSelect } from '../components/ui/input'
import { SelectorFecha } from '../components/ui/selector-fecha'
import { TiraEstado } from '../components/ui/tira-estado'
import { CATEGORIAS_AUDITORIA, clasificarAccion, ICONO_CATEGORIA, nombreAccion, type CategoriaAuditoria } from './auditoria/categoriasAuditoria'
import { HistogramaActividad } from './auditoria/HistogramaActividad'
import { esFallida } from './auditoria/categoriasAuditoria'

const FILTROS_INICIALES: FiltrosAuditoria = {}
type FiltroResultado = 'todas' | 'fallidas' | 'bloqueos'

const VARIANTE_RESULTADO: Record<string, 'ok' | 'critical' | 'warn'> = {
  exitoso: 'ok',
  fallido: 'critical',
  denegado: 'critical',
  bloqueado: 'warn',
}

const fechaDe = (r: RegistroAuditoria) => r.created_at
const claveRegistro = (r: RegistroAuditoria) => r.id
const humanizar = (clave: string) => clave.replaceAll('_', ' ').replace(/^\p{L}/u, (l) => l.toLocaleUpperCase())

export function AuditoriaPage() {
  const { t } = useTranslation()
  const { registros, cargando, errorCarga, consultar } = useAuditoria()
  const [pagina, setPagina] = useState(1)
  const tamanoPagina = useResponsivePageSize()
  const [filtros, setFiltros] = useState<FiltrosAuditoria>(FILTROS_INICIALES)
  const [aplicados, setAplicados] = useState<FiltrosAuditoria>(FILTROS_INICIALES)
  const [diaHistograma, setDiaHistograma] = useState<string | null>(null)
  const [resultado, setResultado] = useState<FiltroResultado>('todas')
  const [categoria, setCategoria] = useState<CategoriaAuditoria | null>(null)
  const [expandida, setExpandida] = useState<string | null>(null)

  // Base del histograma: la última carga SIN periodo, para que no se reduzca
  // a una barra al filtrar un día.
  const sinPeriodo = !aplicados.desde && !aplicados.hasta
  const [baseHistograma, setBaseHistograma] = useState<RegistroAuditoria[]>(registros)
  if (sinPeriodo && baseHistograma !== registros && !cargando) setBaseHistograma(registros)

  // Filtros locales (sobre las filas ya cargadas): diferidos para no bloquear la escritura.
  const resultadoDiferido = useDeferredValue(resultado)
  const categoriaDiferida = useDeferredValue(categoria)
  const filtradas = useMemo(
    () =>
      registros.filter((r) => {
        if (resultadoDiferido === 'fallidas' && !esFallida(r)) return false
        if (resultadoDiferido === 'bloqueos' && r.accion !== 'BLOQUEO_TEMPORAL') return false
        if (categoriaDiferida && clasificarAccion(r.accion).categoria !== categoriaDiferida) return false
        return true
      }),
    [registros, resultadoDiferido, categoriaDiferida],
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

  const consultarCon = (nuevos: FiltrosAuditoria, dia: string | null = null) => {
    setFiltros(nuevos)
    setAplicados(nuevos)
    setDiaHistograma(dia)
    void consultar(nuevos)
  }
  const actualizarFiltro = (campo: keyof FiltrosAuditoria, valor: string) => {
    setFiltros((previos) => ({ ...previos, [campo]: valor || undefined }))
  }
  const limpiar = () => {
    setResultado('todas')
    setCategoria(null)
    consultarCon(FILTROS_INICIALES)
  }

  // Exporta las filas visibles (filtro de servidor + filtros locales), con la
  // fila final de alcance (HU-50 esc. 4) y protección contra fórmulas.
  const exportar = () => {
    const columnas = [t('auditoria.fecha'), t('auditoria.usuarioId'), t('auditoria.accion'), t('auditoria.recurso'), t('auditoria.resultado'), t('auditoria.ip')]
    const csvCell = (value: unknown) => {
      let text = String(value ?? '')
      if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`
      return `"${text.replaceAll('"', '""')}"`
    }
    const rows = filtradas.map((r) => [r.created_at, r.usuario_id, r.accion, r.recurso, r.resultado, r.ip_origen])
    const blob = new Blob([`\uFEFF${[columnas, ...rows, [t('auditoria.alcancePanel')]].map((row) => row.map(csvCell).join(',')).join('\r\n')}`], { type: 'text/csv;charset=utf-8' })
    const href = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = href
    link.download = 'coldcare-auditoria.csv'
    link.click()
    URL.revokeObjectURL(href)
  }

  const bloqueos = registros.filter((r) => r.accion === 'BLOQUEO_TEMPORAL').length
  const fallidos = registros.filter(esFallida).length
  const usuarios = new Set(registros.flatMap((r) => (r.usuario_id ? [r.usuario_id] : []))).size

  const etiquetaResultado = (valor: string | null | undefined) =>
    valor ? t(`auditoria.resultados.${valor}`, { defaultValue: valor }) : '—'

  const chips: Chip[] = []
  if (aplicados.accion) chips.push({ clave: 'accion', texto: t('auditoria.chip.accion', { valor: aplicados.accion }), quitar: () => consultarCon({ ...aplicados, accion: undefined }, diaHistograma) })
  if (aplicados.usuario_id) chips.push({ clave: 'usuario', texto: t('auditoria.chip.usuario', { valor: aplicados.usuario_id }), quitar: () => consultarCon({ ...aplicados, usuario_id: undefined }, diaHistograma) })
  if (aplicados.desde || aplicados.hasta) {
    const desde = aplicados.desde ? fechaHora(aplicados.desde) : ''
    const hasta = aplicados.hasta ? fechaHora(aplicados.hasta) : ''
    const valor = desde && hasta ? t('comunes.periodo.rango', { desde, hasta }) : desde ? t('comunes.periodo.desdeSolo', { desde }) : t('comunes.periodo.hastaSolo', { hasta })
    chips.push({ clave: 'periodo', texto: t('auditoria.chip.periodo', { valor }), quitar: () => consultarCon({ ...aplicados, desde: undefined, hasta: undefined }) })
  }
  if (resultado !== 'todas') chips.push({ clave: 'resultado', texto: t('auditoria.chip.resultado', { valor: t(`auditoria.filtroResultado.${resultado}`) }), quitar: () => setResultado('todas') })
  if (categoria) chips.push({ clave: 'categoria', texto: t('auditoria.chip.categoria', { valor: t(`auditoria.categorias.${categoria}`) }), quitar: () => setCategoria(null) })
  const hayFiltros = chips.length > 0

  const guia =
    bloqueos > 0 ? (
      <span role="status" className="flex items-start gap-2">
        <ShieldAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-warning-700" />
        {t('auditoria.bloqueosTemporales', { count: bloqueos })}
      </span>
    ) : fallidos > 0 ? (
      <span className="flex items-start gap-2">
        <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-critical" />
        {t('auditoria.guia.fallidos', { count: fallidos })}
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
      <form
        role="search"
        aria-label={t('auditoria.filtro.etiqueta')}
        className="flex flex-wrap items-end gap-x-3 gap-y-2 border-b border-border px-3 py-2.5 sm:px-4"
        onSubmit={(e) => {
          e.preventDefault()
          consultarCon(filtros)
        }}
      >
        <div className="w-full sm:w-52">
          <Label htmlFor="fa-accion" className="text-meta text-muted">{t('auditoria.accion')}</Label>
          <div className="relative">
            <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" />
            <Input id="fa-accion" className="h-9 pl-9 pointer-coarse:h-11" value={filtros.accion ?? ''} onChange={(e) => actualizarFiltro('accion', e.target.value)} placeholder={t('auditoria.accionPlaceholder')} aria-describedby="fa-accion-ayuda" />
          </div>
          <p id="fa-accion-ayuda" className="sr-only">{t('auditoria.ayudaAccion')}</p>
        </div>
        <div className="w-full sm:w-40">
          <Label htmlFor="fa-usuario" className="text-meta text-muted">{t('auditoria.usuario')}</Label>
          <Input id="fa-usuario" className="h-9 pointer-coarse:h-11" value={filtros.usuario_id ?? ''} onChange={(e) => actualizarFiltro('usuario_id', e.target.value)} placeholder={t('auditoria.usuarioPlaceholder')} />
        </div>
        <div className="w-full sm:w-44">
          <Label htmlFor="fa-resultado" className="text-meta text-muted">{t('auditoria.filtroResultado.etiqueta')}</Label>
          <NativeSelect id="fa-resultado" className="h-9 pointer-coarse:h-11" aria-describedby="fa-resultado-ayuda" value={resultado} onChange={(e) => setResultado(e.target.value as FiltroResultado)}>
            <option value="todas">{t('auditoria.filtroResultado.todas')}</option>
            <option value="fallidas">{t('auditoria.filtroResultado.fallidas')}</option>
            <option value="bloqueos">{t('auditoria.filtroResultado.bloqueos')}</option>
          </NativeSelect>
          <p id="fa-resultado-ayuda" className="sr-only">{t('auditoria.filtroResultado.ayuda')}</p>
        </div>
        <div className="w-full min-[480px]:w-[calc(50%-6px)] sm:w-52">
          <Label htmlFor="fa-desde" className="text-meta text-muted">{t('historial.desde')}</Label>
          <SelectorFecha id="fa-desde" conHora valor={filtros.desde ?? ''} onCambiar={(valor) => actualizarFiltro('desde', valor)} />
        </div>
        <div className="w-full min-[480px]:w-[calc(50%-6px)] sm:w-52">
          <Label htmlFor="fa-hasta" className="text-meta text-muted">{t('historial.hasta')}</Label>
          <SelectorFecha id="fa-hasta" conHora valor={filtros.hasta ?? ''} onCambiar={(valor) => actualizarFiltro('hasta', valor)} />
        </div>
        <div className="flex flex-1 items-center gap-2">
          <Button type="submit" size="sm" className="h-9 pointer-coarse:h-11">{t('historial.aplicar')}</Button>
          {hayFiltros && (
            <Button type="button" variant="ghost" size="sm" className="h-9 text-muted pointer-coarse:h-11" onClick={limpiar}>
              <FilterX aria-hidden />
              {t('historial.limpiar')}
            </Button>
          )}
          <span aria-live="polite" className="nums ml-auto text-meta text-faint">
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
        <EstadoError mensaje={t('comunes.errorCargar')}>
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
        <EstadoVacio ilustracion="sin-resultados" titulo={t('auditoria.vacio.filtrosTitulo')} detalle={t('auditoria.filtroResultado.ayuda')}>
          <Button variant="secondary" size="sm" onClick={() => { setResultado('todas'); setCategoria(null) }}>{t('comunes.mostrarTodas')}</Button>
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
                      {/* Recurso e IP siguen visibles: sin ellos la entrada no sirve como evidencia. */}
                      <p className="codigo truncate text-meta text-faint">
                        <span className="nums sm:hidden">{hora(r.created_at)} · </span>
                        <span>{r.recurso}</span> · <span>{r.ip_origen ?? '—'}</span>
                      </p>
                    </div>
                  </div>
                </CeldaRegistro>
                <CeldaRegistro area="c">
                  <Badge dot={r.resultado === 'exitoso'} className="capitalize" variant={(r.resultado && VARIANTE_RESULTADO[r.resultado]) || 'neutral'}>
                    {r.resultado ?? '—'}
                  </Badge>
                </CeldaRegistro>
                <CeldaRegistro area="oculta" className="codigo truncate text-meta text-muted">
                  {r.usuario_id ? `${r.usuario_id.slice(0, 8)}…` : <span className="text-faint">{t('auditoria.sinUsuario')}</span>}
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
                  <span className="codigo min-w-0 break-all">{r.usuario_id ?? t('auditoria.sinUsuario')}</span>
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
        <Button variant="secondary" onClick={exportar} disabled={cargando || filtradas.length === 0} aria-label={t('auditoria.exportar')}>
          <Download aria-hidden />
          <span className="max-sm:sr-only">{t('auditoria.exportar')}</span>
        </Button>
      </PageHeader>

      {registros.length > 0 && (
        <TiraEstado
          etiqueta={t('auditoria.resumen')}
          guia={guia}
          segmentos={[
            { clave: 'eventos', etiqueta: t('auditoria.totalEventos'), valor: registros.length },
            { clave: 'fallidos', etiqueta: t('auditoria.fallidos'), valor: fallidos, tono: fallidos > 0 ? 'critico' : 'neutro' },
            { clave: 'bloqueos', etiqueta: t('auditoria.bloqueos'), valor: bloqueos, tono: bloqueos > 0 ? 'aviso' : 'neutro' },
            { clave: 'usuarios', etiqueta: t('auditoria.usuariosDistintos'), valor: usuarios },
          ]}
        />
      )}

      <PlantillaBandeja
        etiquetaRail={t('auditoria.rail.etiqueta')}
        superior={
          baseHistograma.length > 0 && (
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
          )
        }
        rail={
          registros.length > 0 ? (
            <>
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
              <TarjetaRail titulo={t('auditoria.rail.alcance')} className="max-xl:hidden">
                {alcance}
              </TarjetaRail>
            </>
          ) : undefined
        }
        inferior={
          <div className="superficie overflow-clip">
            {barra}
            {tabla}
            {/* HU-50 esc. 4: el alcance siempre visible; bajo 1280 px, como nota al pie. */}
            <div className={cn('border-t border-border px-3 py-2.5 sm:px-4', registros.length > 0 && 'xl:hidden')}>{alcance}</div>
          </div>
        }
      />
    </div>
  )
}
