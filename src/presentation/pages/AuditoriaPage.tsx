import { useEffect, useMemo, useRef, useState, type ComponentProps } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { Download, Lock, ScrollText } from 'lucide-react'

import { useAuditoria, type FiltrosAuditoria } from '@/application/hooks/useAuditoria'
import { useUsuarios } from '@/application/hooks/useUsuarios'
import { useAuthStore } from '@/application/stores/authStore'
import type { RegistroAuditoria } from '@/domain/entities/Usuario'
import { fechaHora } from '@/lib/formato'
import { rangoPagina } from '@/lib/paginacion'
import { useResponsivePageSize } from '@/presentation/hooks/useResponsivePageSize'
import { EstadoError, EstadoVacio } from '../components/EstadoPagina'
import { Paginacion } from '../components/Paginacion'
import { BarraFiltros, type FiltroActivo } from '../components/ui/barra-filtros'
import { Button } from '../components/ui/button'
import { Campo, Input } from '../components/ui/input'
import { SelectorFecha } from '../components/ui/selector-fecha'
import { TituloPagina } from '../components/ui/titulo-pagina'
import { momento } from './auditoria/dias'
import { EsqueletoLinea, LineaTiempo } from './auditoria/LineaTiempo'
import { CifraFrase, FrasePantalla } from './usuarios/piezas'

const FILTROS_INICIALES: FiltrosAuditoria = {}

const mismosFiltros = (a: FiltrosAuditoria, b: FiltrosAuditoria) =>
  a.accion === b.accion && a.usuario_id === b.usuario_id && a.desde === b.desde && a.hasta === b.hasta

/**
 * El administrador puede ver la lista de cuentas: la línea dice el nombre de quien hizo cada cosa.
 * El auditor no tiene acceso a esa lista, y ve el código de usuario (y «Tú» en lo suyo).
 */
function LineaConNombres({ quienHizo, ...props }: ComponentProps<typeof LineaTiempo>) {
  const { usuarios } = useUsuarios()
  const nombres = useMemo(() => new Map(usuarios.map((u) => [u.id, u.nombre])), [usuarios])
  return <LineaTiempo {...props} quienHizo={(id) => quienHizo(id) ?? (id ? (nombres.get(id) ?? null) : null)} />
}

/** La respuesta en una frase: cuántas acciones, cuántas no salieron bien y cuándo fue la última. */
function ResumenBitacora({ registros }: { registros: RegistroAuditoria[] }) {
  const { t } = useTranslation()
  const total = registros.length
  const sinExito = registros.filter((r) => r.resultado && r.resultado !== 'exitoso').length
  const ultima = registros.reduce<string | null>((max, r) => (!max || Date.parse(r.created_at) > Date.parse(max) ? r.created_at : max), null)
  const cuando = ultima ? momento(ultima) : null
  return (
    <FrasePantalla className="mb-6 sm:mb-8">
      <Trans t={t} i18nKey="auditoria.resumenAcciones" count={total} components={{ n: <CifraFrase valor={total} /> }} />
      {'; '}
      {sinExito > 0 ? t('auditoria.resumenMal', { count: sinExito }) : t('auditoria.resumenBien', { count: total })}.
      {cuando && (
        <>
          {' '}
          {t('auditoria.ultimaAccion', {
            cuando:
              cuando.dia === 'hoy'
                ? t('auditoria.cuandoHoy', { hora: cuando.hora })
                : cuando.dia === 'ayer'
                  ? t('auditoria.cuandoAyer', { hora: cuando.hora })
                  : t('auditoria.cuandoFecha', { fecha: cuando.fecha, hora: cuando.hora }),
          })}
        </>
      )}
    </FrasePantalla>
  )
}

/** El panel de filtros se desmonta al cerrarse: lo escrito y no aplicado se aplica entonces. */
function AlCerrar({ accion }: { accion: () => void }) {
  const ultima = useRef(accion)
  useEffect(() => {
    ultima.current = accion
  })
  useEffect(() => () => ultima.current(), [])
  return null
}

export function AuditoriaPage() {
  const { t } = useTranslation()
  const { registros, cargando, errorCarga, consultar } = useAuditoria()
  const sesion = useAuthStore((s) => s.usuario)
  const [pagina, setPagina] = useState(1)
  const tamanoPagina = useResponsivePageSize()
  // La lista completa puede tener miles de filas; solo se pinta la página
  // visible. Al cambiar la lista (filtro nuevo) se vuelve a la primera.
  const visibles = useMemo(
    () => registros.slice(...rangoPagina(pagina, tamanoPagina)),
    [registros, pagina, tamanoPagina],
  )
  // Lo que se escribe en el panel y lo que ya está aplicado a la lista.
  const [filtros, setFiltros] = useState<FiltrosAuditoria>(FILTROS_INICIALES)
  const [aplicados, setAplicados] = useState<FiltrosAuditoria>(FILTROS_INICIALES)
  const [fallo, setFallo] = useState(false)

  const actualizarFiltro = (campo: keyof FiltrosAuditoria, valor: string) => {
    setFiltros((previos) => ({ ...previos, [campo]: valor || undefined }))
  }

  const aplicar = async (siguientes: FiltrosAuditoria) => {
    setFiltros(siguientes)
    setAplicados(siguientes)
    setPagina(1)
    setFallo(false)
    try {
      await consultar(siguientes)
    } catch {
      setFallo(true)
    }
  }

  const limpiar = () => void aplicar(FILTROS_INICIALES)

  const exportar = () => {
    const columnas = [t('auditoria.fecha'), t('auditoria.usuarioId'), t('auditoria.accion'), t('auditoria.recurso'), t('auditoria.resultado'), t('auditoria.ip')]
    const csvCell = (value: unknown) => {
      let text = String(value ?? '')
      if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`
      return `"${text.replaceAll('"', '""')}"`
    }
    const rows = registros.map((r) => [r.created_at, r.usuario_id, r.accion, r.recurso, r.resultado, r.ip_origen])
    const blob = new Blob([`\uFEFF${[columnas, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n')}`], { type: 'text/csv;charset=utf-8' })
    const href = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = href
    link.download = 'coldcare-auditoria.csv'
    link.click()
    URL.revokeObjectURL(href)
  }
  const bloqueos = registros.filter((r) => r.accion === 'BLOQUEO_TEMPORAL').length
  // Lo propio se lee como «Tú»; el resto, por nombre si se conoce.
  const quienHizo = (id: string | null) => (id && id === sesion?.id ? t('auditoria.quienTu') : null)

  const quitar = (campo: keyof FiltrosAuditoria) => () => void aplicar({ ...aplicados, [campo]: undefined })
  const activos: FiltroActivo[] = []
  if (aplicados.accion) activos.push({ id: 'accion', etiqueta: t('auditoria.filtroAccion', { valor: aplicados.accion }), onQuitar: quitar('accion') })
  if (aplicados.usuario_id) activos.push({ id: 'usuario', etiqueta: t('auditoria.filtroUsuario', { valor: aplicados.usuario_id }), onQuitar: quitar('usuario_id') })
  if (aplicados.desde) activos.push({ id: 'desde', etiqueta: t('auditoria.filtroDesde', { valor: fechaHora(aplicados.desde) }), onQuitar: quitar('desde') })
  if (aplicados.hasta) activos.push({ id: 'hasta', etiqueta: t('auditoria.filtroHasta', { valor: fechaHora(aplicados.hasta) }), onQuitar: quitar('hasta') })

  return (
    <div className="flex flex-1 flex-col">
      <TituloPagina
        antetitulo={t('nav.auditoria')}
        titulo={t('auditoria.titulo')}
        descripcion={t('auditoria.descripcion')}
        className="mb-3 sm:mb-4"
      />
      {registros.length > 0 && !(fallo || errorCarga) ? <ResumenBitacora registros={registros} /> : <div className="mb-3 sm:mb-4" />}

      {/* HU-50 criterio 1: filtrar por periodo, usuario o tipo de acción. */}
      <h2 id="titulo-filtros-auditoria" className="sr-only">{t('auditoria.filtros')}</h2>
      <BarraFiltros
        titulo={t('auditoria.filtros')}
        activos={activos}
        onLimpiar={limpiar}
        acciones={
          <Button variant="secondary" onClick={exportar} disabled={cargando || registros.length === 0}>
            <Download />
            {t('auditoria.exportar')}
          </Button>
        }
      >
        <form
          aria-labelledby="titulo-filtros-auditoria"
          className="contents"
          onSubmit={(e) => {
            e.preventDefault()
            void aplicar(filtros)
          }}
        >
          <Campo etiqueta={t('auditoria.accion')} htmlFor="fa-accion" ayuda={t('auditoria.ayudaAccion')}>
            <Input
              id="fa-accion"
              value={filtros.accion ?? ''}
              onChange={(e) => actualizarFiltro('accion', e.target.value)}
              placeholder={t('auditoria.accionPlaceholder')}
              aria-describedby="fa-accion-ayuda"
            />
          </Campo>
          <Campo etiqueta={t('auditoria.usuario')} htmlFor="fa-usuario">
            <Input
              id="fa-usuario"
              value={filtros.usuario_id ?? ''}
              onChange={(e) => actualizarFiltro('usuario_id', e.target.value)}
              placeholder={t('auditoria.usuarioPlaceholder')}
            />
          </Campo>
          <Campo etiqueta={t('historial.desde')} htmlFor="fa-desde">
            <SelectorFecha
              id="fa-desde"
              conHora
              valor={filtros.desde ?? ''}
              onCambiar={(valor) => actualizarFiltro('desde', valor)}
            />
          </Campo>
          <Campo etiqueta={t('historial.hasta')} htmlFor="fa-hasta">
            <SelectorFecha
              id="fa-hasta"
              conHora
              valor={filtros.hasta ?? ''}
              onCambiar={(valor) => actualizarFiltro('hasta', valor)}
            />
          </Campo>
          <Button type="submit" variant="secondary" className="sm:col-span-2">
            {t('historial.aplicar')}
          </Button>
          <AlCerrar
            accion={() => {
              if (!mismosFiltros(filtros, aplicados)) void aplicar(filtros)
            }}
          />
        </form>
      </BarraFiltros>

      {bloqueos > 0 && (
        <p role="status" className="mt-4 flex items-center gap-3 rounded-(--radius-card) bg-honey-100 px-3 py-2.5 text-sm leading-5 text-foreground sm:px-4">
          <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-full bg-campo-preventivo text-campo-preventivo-tinta">
            <Lock className="size-4" />
          </span>
          {t('auditoria.bloqueosTemporales', { count: bloqueos })}
        </p>
      )}

      {/* ── Bitácora: la tarea principal ────────────────────── */}
      <div className="mt-6 flex flex-1 flex-col sm:mt-8">
        {fallo || errorCarga ? (
          <EstadoError mensaje={t('auditoria.errorCarga')} onReintentar={() => void aplicar(aplicados)} />
        ) : cargando && registros.length === 0 ? (
          <EsqueletoLinea />
        ) : registros.length === 0 ? (
          activos.length > 0 ? (
            <EstadoVacio icono={ScrollText} titulo={t('auditoria.sinCoincidencias')} llenar>
              <Button variant="secondary" onClick={limpiar}>{t('historial.limpiar')}</Button>
            </EstadoVacio>
          ) : (
            <EstadoVacio icono={ScrollText} titulo={t('auditoria.sinRegistros')} llenar />
          )
        ) : (
          <>
            {sesion?.rol === 'administrador' ? (
              <LineaConNombres todos={registros} visibles={visibles} cargando={cargando} quienHizo={quienHizo} />
            ) : (
              <LineaTiempo todos={registros} visibles={visibles} cargando={cargando} quienHizo={quienHizo} />
            )}
            <Paginacion total={registros.length} pagina={pagina} onCambiar={setPagina} tamano={tamanoPagina} />
          </>
        )}
      </div>
    </div>
  )
}
