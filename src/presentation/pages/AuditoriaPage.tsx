import { CompactWorkspace } from '../components/CompactWorkspace'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Download, FilterX, ScrollText, SlidersHorizontal } from 'lucide-react'

import { useAuditoria, type FiltrosAuditoria } from '@/application/hooks/useAuditoria'
import { fechaHora } from '@/lib/formato'
import { rangoPagina } from '@/lib/paginacion'
import { Paginacion } from '../components/Paginacion'
import { PageHeader } from '../components/PageHeader'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Card, CardContent } from '../components/ui/card'
import { Input, Label } from '../components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table'

const FILTROS_INICIALES: FiltrosAuditoria = {}

export function AuditoriaPage() {
  const { t } = useTranslation()
  const { registros, cargando, consultar } = useAuditoria()
  const [pagina, setPagina] = useState(1)
  // La lista completa puede tener miles de filas; solo se pinta la página
  // visible. Al cambiar la lista (filtro nuevo) se vuelve a la primera.
  const visibles = useMemo(
    () => registros.slice(...rangoPagina(pagina)),
    [registros, pagina],
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
      <PageHeader eyebrow={t('nav.seccionAdministracion')} titulo={t('auditoria.titulo')} descripcion={t('auditoria.descripcion')} />

      {bloqueos > 0 && (
        <Card className="mb-5 border-clay-100 bg-clay-100/60">
          <CardContent role="status" className="p-4 text-sm text-clay-700">
            {t('auditoria.bloqueosTemporales', { count: bloqueos })}
          </CardContent>
        </Card>
      )}

      {/* HU-50 criterio 1: filtrar por periodo, usuario o tipo de acción. */}
      <Card className="mb-4 rounded-lg border border-border bg-surface shadow-none">
        <CardContent className="p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <p id="titulo-filtros-auditoria" className="flex items-center gap-2 text-xs font-medium text-muted">
              <SlidersHorizontal className="size-3.5" aria-hidden />
              {t('auditoria.filtros')}
            </p>
            <Button variant="secondary" size="sm" onClick={exportar} disabled={cargando || registros.length === 0}>
              <Download />{t('auditoria.exportar')}
            </Button>
          </div>
          <form
            aria-labelledby="titulo-filtros-auditoria"
            className="grid grid-cols-2 items-end gap-3 xl:grid-cols-[1fr_1fr_1.2fr_1.2fr_auto]"
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
              <Input
                id="fa-desde"
                type="datetime-local"
                value={filtros.desde ?? ''}
                onChange={(e) => actualizarFiltro('desde', e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="fa-hasta">{t('historial.hasta')}</Label>
              <Input
                id="fa-hasta"
                type="datetime-local"
                value={filtros.hasta ?? ''}
                onChange={(e) => actualizarFiltro('hasta', e.target.value)}
              />
            </div>
            <div className="flex gap-2 col-span-2 xl:col-span-1">
              <Button type="submit" className="flex-1">
                {t('historial.aplicar')}
              </Button>
              <Button variant="ghost" onClick={limpiar} aria-label={t('historial.limpiar')}>
                <FilterX />
              </Button>
            </div>
          </form>
          <p id="fa-accion-ayuda" className="mt-2 text-xs text-faint">{t('auditoria.ayudaAccion')}</p>
        </CardContent>
      </Card>

      <div className="animate-rise [&_thead]:bg-cream-100 ">
        <Table className="min-w-[1080px]" titulo={t('auditoria.titulo')} cargando={cargando}>
          <TableHeader>
            <TableRow>
              <TableHead>{t('auditoria.fecha')}</TableHead>
              <TableHead>{t('auditoria.accion')}</TableHead>
              <TableHead>{t('auditoria.recurso')}</TableHead>
              <TableHead>{t('auditoria.usuarioId')}</TableHead>
              <TableHead>{t('auditoria.resultado')}</TableHead>
              <TableHead>{t('auditoria.ip')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cargando ? (
              <TableEmpty colSpan={6}>{t('app.cargando')}</TableEmpty>
            ) : registros.length === 0 ? (
              <TableEmpty colSpan={6}>
                <span className="inline-flex flex-col items-center gap-2">
                  <ScrollText className="size-5 text-faint" aria-hidden />
                  {t('auditoria.sinRegistros')}
                </span>
              </TableEmpty>
            ) : (
              visibles.map((registro) => (
                <TableRow key={registro.id}>
                  <TableCell className="nums whitespace-nowrap text-[13px]">
                    {fechaHora(registro.created_at)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="neutral">
                      {t(`auditoria.eventos.${registro.accion}`, {
                        defaultValue: registro.accion
                          .toLocaleLowerCase()
                          .replaceAll('_', ' ')
                          .replace(/^\p{L}/u, (letra) => letra.toLocaleUpperCase()),
                      })}
                    </Badge>
                  </TableCell>
                  <TableCell className="nums text-[13px] text-muted">{registro.recurso}</TableCell>
                  <TableCell className="nums text-xs text-muted">
                    {registro.usuario_id ? `${registro.usuario_id.slice(0, 8)}…` : '—'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={registro.resultado === 'exitoso' ? 'ok' : registro.resultado ? 'critical' : 'neutral'}>
                      {registro.resultado ?? '—'}
                    </Badge>
                  </TableCell>
                  <TableCell className="nums text-[13px] text-muted">
                    {registro.ip_origen ?? '—'}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <Paginacion total={registros.length} pagina={pagina} onCambiar={setPagina} />
      </div>
    </CompactWorkspace>
  )
}
