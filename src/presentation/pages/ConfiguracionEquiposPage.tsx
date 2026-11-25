import { SeccionDetalle } from '@/presentation/components/ui/seccion-detalle'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { History, Info, Lock, ShieldCheck } from 'lucide-react'

import { useHistorialConfiguracion, type FiltrosHistorialConfiguracion } from '@/application/hooks/useHistorialConfiguracion'
import { CATEGORIAS_HISTORIAL, type CategoriaHistorial } from '@/domain/entities/Dispositivo'
import { fechaHora } from '@/lib/formato'
import { EstadoError, EstadoVacio } from '../components/EstadoPagina'
import { PageHeader } from '../components/PageHeader'
import { ChipsFiltro, TarjetaRail, type Chip } from '../components/registros/piezas'
import { Button } from '../components/ui/button'
import { Label, NativeSelect } from '../components/ui/input'
import { SelectorFecha } from '../components/ui/selector-fecha'
import { TiraEstado } from '../components/ui/tira-estado'
import { LineaTiempoCambios } from './dispositivos/detalle/LineaTiempoCambios'

const esCategoria = (valor: string): valor is CategoriaHistorial => (CATEGORIAS_HISTORIAL as readonly string[]).includes(valor)

/** Equipo de la URL (`?device_id=`), p. ej. desde un enlace de la bitácora. */
function equipoDeUrl(): string {
  if (typeof window === 'undefined') return ''
  return new URLSearchParams(window.location.search).get('device_id')?.trim() ?? ''
}

/**
 * HU-49: vista de SOLO LECTURA del historial de configuración, calibración,
 * instalación y reemplazo del hardware para el auditor (el administrador la
 * ve también, además de la pestaña del detalle del equipo). Esc. 1: valor
 * anterior, nuevo, actor y fecha. Esc. 2: filtro por categoría y periodo con
 * la vigencia de cada cambio. Esc. 3 y 4 se declaran en el rail.
 */
export function ConfiguracionEquiposPage() {
  const { t } = useTranslation()
  const { equipos, cambios, cargando, error, consultar } = useHistorialConfiguracion()
  const [equipo, setEquipo] = useState(equipoDeUrl)
  const [filtros, setFiltros] = useState<FiltrosHistorialConfiguracion>({})
  const [aplicados, setAplicados] = useState<{ equipo: string; filtros: FiltrosHistorialConfiguracion } | null>(null)
  const [errorRango, setErrorRango] = useState(false)

  const consultarCon = (deviceId: string, nuevos: FiltrosHistorialConfiguracion) => {
    if (!deviceId) return
    if (nuevos.desde && nuevos.hasta && new Date(nuevos.desde) > new Date(nuevos.hasta)) {
      setErrorRango(true)
      return
    }
    setErrorRango(false)
    setEquipo(deviceId)
    setFiltros(nuevos)
    setAplicados({ equipo: deviceId, filtros: nuevos })
    void consultar(deviceId, nuevos)
  }

  // Sin equipo en la URL se abre el primero disponible: la vista nunca queda en blanco.
  const [inicial, setInicial] = useState(true)
  useEffect(() => {
    if (!inicial) return
    const elegido = equipo || equipos[0]
    if (!elegido) return
    setInicial(false)
    consultarCon(elegido, {})
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo la primera consulta
  }, [equipos, inicial])

  const vigentes = useMemo(() => cambios.filter((c) => c.vigente_hasta == null && c.vigente_desde !== undefined).length, [cambios])
  const actores = useMemo(() => new Set(cambios.flatMap((c) => (c.actor_id ? [c.actor_id] : []))).size, [cambios])
  const opcionesEquipo = useMemo(() => [...new Set([...equipos, ...(equipo ? [equipo] : [])])].sort(), [equipos, equipo])

  const chips: Chip[] = []
  if (aplicados?.filtros.categoria) {
    chips.push({
      clave: 'categoria',
      texto: t('configuracionEquipos.chipCategoria', { valor: t(`configuracionEquipos.categorias.${aplicados.filtros.categoria}`) }),
      quitar: () => consultarCon(aplicados.equipo, { ...aplicados.filtros, categoria: undefined }),
    })
  }
  if (aplicados && (aplicados.filtros.desde || aplicados.filtros.hasta)) {
    const desde = aplicados.filtros.desde ? fechaHora(aplicados.filtros.desde) : ''
    const hasta = aplicados.filtros.hasta ? fechaHora(aplicados.filtros.hasta) : ''
    const valor = desde && hasta ? t('comunes.periodo.rango', { desde, hasta }) : desde ? t('comunes.periodo.desdeSolo', { desde }) : t('comunes.periodo.hastaSolo', { hasta })
    chips.push({
      clave: 'periodo',
      texto: t('configuracionEquipos.chipPeriodo', { valor }),
      quitar: () => consultarCon(aplicados.equipo, { ...aplicados.filtros, desde: undefined, hasta: undefined }),
    })
  }

  const barra = (
    <>
      <form
        role="search"
        aria-label={t('configuracionEquipos.filtro.etiqueta')}
        className="grid grid-cols-1 items-end gap-x-3 gap-y-2 border-b border-border px-3 py-2.5 sm:grid-cols-2 sm:px-4"
        onSubmit={(e) => {
          e.preventDefault()
          consultarCon(equipo, filtros)
        }}
      >
        <div className="min-w-0">
          <Label htmlFor="cfg-equipo" className="text-meta text-muted">{t('configuracionEquipos.filtro.equipo')}</Label>
          <NativeSelect id="cfg-equipo" className="h-9 max-sm:h-11 pointer-coarse:h-11" value={equipo} onChange={(e) => consultarCon(e.target.value, filtros)}>
            {!equipo && <option value="">{t('configuracionEquipos.filtro.elegirEquipo')}</option>}
            {opcionesEquipo.map((id) => <option key={id} value={id}>{id}</option>)}
          </NativeSelect>
        </div>
        <div className="min-w-0">
          <Label htmlFor="cfg-categoria" className="text-meta text-muted">{t('configuracionEquipos.filtro.categoria')}</Label>
          <NativeSelect
            id="cfg-categoria"
            className="h-9 max-sm:h-11 pointer-coarse:h-11"
            value={filtros.categoria ?? ''}
            onChange={(e) => consultarCon(equipo, { ...filtros, categoria: esCategoria(e.target.value) ? e.target.value : undefined })}
          >
            <option value="">{t('configuracionEquipos.filtro.todas')}</option>
            {CATEGORIAS_HISTORIAL.map((c) => <option key={c} value={c}>{t(`configuracionEquipos.categorias.${c}`)}</option>)}
          </NativeSelect>
        </div>
        <details className="col-span-full">
          <summary className="min-h-10 w-fit cursor-pointer content-center text-body font-medium text-subtle">{t('lectura.filtrarPeriodo')}</summary>
          <div className="grid items-end gap-3 pb-2 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto]">
            <div className="min-w-0">
              <Label htmlFor="cfg-desde" className="text-meta text-muted">{t('historial.desde')}</Label>
              <SelectorFecha id="cfg-desde" conHora valor={filtros.desde ?? ''} onCambiar={(valor) => setFiltros((f) => ({ ...f, desde: valor || undefined }))} invalido={errorRango} aria-describedby={errorRango ? 'cfg-error-rango' : undefined} />
            </div>
            <div className="min-w-0">
              <Label htmlFor="cfg-hasta" className="text-meta text-muted">{t('historial.hasta')}</Label>
              <SelectorFecha id="cfg-hasta" conHora valor={filtros.hasta ?? ''} onCambiar={(valor) => setFiltros((f) => ({ ...f, hasta: valor || undefined }))} invalido={errorRango} aria-describedby={errorRango ? 'cfg-error-rango' : undefined} />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="submit" size="sm" disabled={!equipo}>{t('historial.aplicar')}</Button>
            </div>
          </div>
        </details>
      </form>
      {errorRango && (
        <p id="cfg-error-rango" role="alert" className="mx-3 mt-2.5 rounded-(--radius-field) bg-critical-tint px-3 py-2 text-meta text-critical sm:mx-4">
          {t('historial.rangoInvalido')}
        </p>
      )}
      <ChipsFiltro chips={chips} idFocoAlVaciar="cfg-equipo" />
    </>
  )

  const contenido = error ? (
    <div className="p-3 sm:p-4">
      <EstadoError mensaje={error === 'no_encontrado' ? t('configuracionEquipos.noEncontrado', { equipo: aplicados?.equipo }) : t('comunes.errorCargar')}>
        {error === 'error' && aplicados && (
          <Button variant="secondary" size="sm" className="mt-3" onClick={() => void consultar(aplicados.equipo, aplicados.filtros)}>
            {t('comunes.reintentar')}
          </Button>
        )}
      </EstadoError>
    </div>
  ) : !aplicados && !cargando ? (
    <div className="p-3 sm:p-4">
      <EstadoVacio ilustracion="sin-datos" titulo={t('configuracionEquipos.sinEquipos')} detalle={t('configuracionEquipos.sinEquiposDetalle')} />
    </div>
  ) : (
    <div className="p-3 sm:p-4">
      <LineaTiempoCambios
        resumir
        cambios={cambios}
        cargando={cargando}
        vacio={chips.length > 0 ? t('configuracionEquipos.vacioFiltros') : t('dispositivos.sinHistorial')}
      />
    </div>
  )

  return (
    <div className="space-y-4">
      <PageHeader titulo={t('configuracionEquipos.titulo')} descripcion={t('configuracionEquipos.descripcion')} />

      <section aria-labelledby="cfg-historial-titulo" className="superficie overflow-clip">
        <h2 id="cfg-historial-titulo" className="flex items-center gap-2 px-3 pt-3 text-title text-foreground sm:px-4">
          <History aria-hidden className="size-4 text-muted" />
          {t('configuracionEquipos.cambiosRegistrados')}
          <span aria-live="polite" className="nums ml-auto text-meta text-faint">
            {cargando ? t('comunes.consultando') : aplicados ? t('configuracionEquipos.resultados', { count: cambios.length }) : ''}
          </span>
        </h2>
        {barra}
        {contenido}
      </section>
      <aside aria-label={t('configuracionEquipos.rail.etiqueta')}>
        <SeccionDetalle titulo={t('lectura.registro')}>
          {aplicados && !error && cambios.length > 0 && (
            <TiraEstado
              etiqueta={t('configuracionEquipos.resumen.etiqueta')}
              segmentos={[
                { clave: 'cambios', etiqueta: t('configuracionEquipos.resumen.cambios'), valor: cambios.length },
                { clave: 'vigentes', etiqueta: t('configuracionEquipos.resumen.vigentes'), valor: vigentes },
                { clave: 'actores', etiqueta: t('configuracionEquipos.resumen.actores'), valor: actores },
              ]}
            />
          )}
          <TarjetaRail titulo={t('configuracionEquipos.rail.soloLectura')}>
            <p className="flex items-start gap-2 text-body text-subtle">
              <Lock aria-hidden className="mt-0.5 size-4 shrink-0 text-muted" />
              {t('configuracionEquipos.rail.soloLecturaDetalle')}
            </p>
          </TarjetaRail>
          <TarjetaRail titulo={t('configuracionEquipos.rail.telemetria')}>
            <p className="flex items-start gap-2 text-body text-subtle">
              <ShieldCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-success-700" />
              {t('configuracionEquipos.rail.telemetriaDetalle')}
            </p>
          </TarjetaRail>
          <TarjetaRail titulo={t('configuracionEquipos.rail.rango')}>
            <p className="flex items-start gap-2 text-body text-subtle">
              <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-muted" />
              {t('configuracionEquipos.rail.rangoDetalle')}
            </p>
          </TarjetaRail>
        </SeccionDetalle>
      </aside>
    </div>
  )
}
