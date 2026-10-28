import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Download, FilterX, ScrollText, ShieldAlert, SlidersHorizontal } from 'lucide-react'

import { useAuditoria, type FiltrosAuditoria } from '@/application/hooks/useAuditoria'
import { fechaHora } from '@/lib/formato'
import { rangoPagina } from '@/lib/paginacion'
import { cn } from '@/lib/utils'
import { useResponsivePageSize } from '@/presentation/hooks/useResponsivePageSize'
import { CompactWorkspace } from '../components/CompactWorkspace'
import { EstadoCarga, EstadoVacio } from '../components/EstadoPagina'
import { Paginacion } from '../components/Paginacion'
import { PageHeader } from '../components/PageHeader'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Card } from '../components/ui/card'
import { Input, Label } from '../components/ui/input'
import { SelectorFecha } from '../components/ui/selector-fecha'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table'

const FILTROS_INICIALES: FiltrosAuditoria = {}

export function AuditoriaPage() {
  const { t } = useTranslation()
  const { registros, cargando, consultar } = useAuditoria()
  const [pagina, setPagina] = useState(1)
  const tamanoPagina = useResponsivePageSize()
  // La lista completa puede tener miles de filas; solo se pinta la página
  // visible. Al cambiar la lista (filtro nuevo) se vuelve a la primera.
  const visibles = useMemo(
    () => registros.slice(...rangoPagina(pagina, tamanoPagina)),
    [registros, pagina, tamanoPagina],
  )
  const [filtros, setFiltros] = useState<FiltrosAuditoria>(FILTROS_INICIALES)

  const actualizarFiltro = (campo: keyof FiltrosAuditoria, valor: string) => {
    setFiltros((previos) => ({ ...previos, [campo]: valor || undefined }))
  }

  const limpiar = () => {
    setFiltros(FILTROS_INICIALES)
    void consultar(FILTROS_INICIALES)
  }

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

  return (
    <CompactWorkspace>
      <PageHeader eyebrow={t('nav.seccionAdministracion')} titulo={t('auditoria.titulo')} descripcion={t('auditoria.descripcion')}>
        <Button variant="secondary" onClick={exportar} disabled={cargando || registros.length === 0}>
          <Download />
          {t('auditoria.exportar')}
        </Button>
      </PageHeader>

      {bloqueos > 0 && (
        <p
          role="status"
          className="flex items-start gap-2.5 rounded-(--radius-card) border border-honey-600/25 bg-honey-100 px-4 py-3 text-[13px] leading-5 text-honey-700 sm:px-5"
        >
          <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          {t('auditoria.bloqueosTemporales', { count: bloqueos })}
        </p>
      )}

      {/* HU-50 criterio 1: filtrar por periodo, usuario o tipo de acción. */}
      <Card className="p-4 sm:px-5">
        <h2 id="titulo-filtros-auditoria" className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <SlidersHorizontal className="size-4 text-primary" aria-hidden />
          {t('auditoria.filtros')}
        </h2>
        <form
          aria-labelledby="titulo-filtros-auditoria"
          className="mt-3 grid grid-cols-1 items-end gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.15fr)_minmax(0,1.15fr)_auto]"
          onSubmit={(e) => {
            e.preventDefault()
            void consultar(filtros)
          }}
        >
          <div>
            <Label htmlFor="fa-accion">{t('auditoria.accion')}</Label>
            <Input
              id="fa-accion"
              value={filtros.accion ?? ''}
              onChange={(e) => actualizarFiltro('accion', e.target.value)}
              placeholder={t('auditoria.accionPlaceholder')}
              aria-describedby="fa-accion-ayuda"
            />
          </div>
          <div>
            <Label htmlFor="fa-usuario">{t('auditoria.usuario')}</Label>
            <Input
              id="fa-usuario"
              value={filtros.usuario_id ?? ''}
              onChange={(e) => actualizarFiltro('usuario_id', e.target.value)}
              placeholder={t('auditoria.usuarioPlaceholder')}
            />
          </div>
          <div>
            <Label htmlFor="fa-desde">{t('historial.desde')}</Label>
            <SelectorFecha
              id="fa-desde"
              conHora
              valor={filtros.desde ?? ''}
              onCambiar={(valor) => actualizarFiltro('desde', valor)}
            />
          </div>
          <div>
            <Label htmlFor="fa-hasta">{t('historial.hasta')}</Label>
            <SelectorFecha
              id="fa-hasta"
              conHora
              valor={filtros.hasta ?? ''}
              onCambiar={(valor) => actualizarFiltro('hasta', valor)}
            />
          </div>
          <div className="flex gap-2 sm:col-span-2 xl:col-span-1">
            <Button type="submit" className="flex-1">
              {t('historial.aplicar')}
            </Button>
            <Button variant="ghost" onClick={limpiar} aria-label={t('historial.limpiar')}>
              <FilterX />
            </Button>
          </div>
        </form>
        <p id="fa-accion-ayuda" className="mt-2 text-xs text-faint">{t('auditoria.ayudaAccion')}</p>
      </Card>

      {/* ── Bitácora: la tarea principal ────────────────────── */}
      <div>
        {cargando && registros.length === 0 ? (
          <EstadoCarga />
        ) : registros.length === 0 ? (
          <EstadoVacio icono={ScrollText} titulo={t('auditoria.sinRegistros')} />
        ) : (
          <>
            <Table
              mobileLayout="stack"
              className={cn('min-w-0 transition-opacity', cargando && 'opacity-60')}
              titulo={t('auditoria.titulo')}
              cargando={cargando}
            >
              <TableHeader>
                <TableRow>
                  <TableHead>{t('auditoria.fecha')}</TableHead>
                  <TableHead>{t('auditoria.accion')}</TableHead>
                  <TableHead>{t('auditoria.resultado')}</TableHead>
                  <TableHead>{t('auditoria.usuarioId')}</TableHead>
                  <TableHead>{t('auditoria.recurso')}</TableHead>
                  <TableHead>{t('auditoria.ip')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibles.map((registro) => (
                  <TableRow key={registro.id}>
                    <TableCell data-label={t('auditoria.fecha')} className="nums whitespace-nowrap text-[13px]">
                      {fechaHora(registro.created_at)}
                    </TableCell>
                    <TableCell data-label={t('auditoria.accion')}>
                      {/* En móvil la fila se apila en dos columnas estrechas: la
                          píldora se parte en líneas en vez de cortarse. */}
                      <Badge variant="neutral" className="max-w-full max-sm:rounded-lg max-sm:whitespace-normal">
                        {t(`auditoria.eventos.${registro.accion}`, {
                          defaultValue: registro.accion
                            .toLocaleLowerCase()
                            .replaceAll('_', ' ')
                            .replace(/^\p{L}/u, (letra) => letra.toLocaleUpperCase()),
                        })}
                      </Badge>
                    </TableCell>
                    <TableCell data-label={t('auditoria.resultado')}>
                      <Badge variant={registro.resultado === 'exitoso' ? 'ok' : registro.resultado ? 'critical' : 'neutral'}>
                        {registro.resultado ?? '—'}
                      </Badge>
                    </TableCell>
                    <TableCell data-label={t('auditoria.usuarioId')} className="nums text-xs text-muted">
                      {registro.usuario_id ? `${registro.usuario_id.slice(0, 8)}…` : '—'}
                    </TableCell>
                    <TableCell data-label={t('auditoria.recurso')} className="nums text-[13px] text-muted">
                      {registro.recurso}
                    </TableCell>
                    <TableCell data-label={t('auditoria.ip')} className="nums text-[13px] text-muted">
                      {registro.ip_origen ?? '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Paginacion total={registros.length} pagina={pagina} onCambiar={setPagina} tamano={tamanoPagina} />
          </>
        )}
      </div>
    </CompactWorkspace>
  )
}
