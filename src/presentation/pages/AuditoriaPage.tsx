import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FilterX, ScrollText, SlidersHorizontal } from 'lucide-react'

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

  return (
    <div>
      <PageHeader eyebrow={t('nav.seccionAdministracion')} titulo={t('auditoria.titulo')} descripcion={t('auditoria.descripcion')} />

      {/* HU-50 criterio 1: filtrar por periodo, usuario o tipo de acción. */}
      <Card className="mb-5 animate-rise">
        <CardContent className="p-5">
          <p
            id="titulo-filtros-auditoria"
            className="mb-3 flex items-center gap-2 text-[13px] font-medium text-muted"
          >
            <SlidersHorizontal className="size-3.5" aria-hidden />
            {t('auditoria.filtros')}
          </p>
          <form
            aria-labelledby="titulo-filtros-auditoria"
            className="grid grid-cols-1 items-end gap-3 min-[480px]:grid-cols-2 lg:grid-cols-5"
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
                placeholder="LOGIN_FALLIDO"
              />
            </div>
            <div>
              <Label htmlFor="fa-usuario">{t('auditoria.usuario')}</Label>
              <Input
                id="fa-usuario"
                value={filtros.usuario_id ?? ''}
                onChange={(e) => actualizarFiltro('usuario_id', e.target.value)}
                placeholder="UUID"
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
            <div className="flex gap-2 min-[480px]:col-span-2 lg:col-span-1">
              <Button type="submit" className="flex-1">
                {t('historial.aplicar')}
              </Button>
              <Button variant="ghost" onClick={limpiar} aria-label={t('historial.limpiar')}>
                <FilterX />
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="animate-rise">
        <Table titulo={t('auditoria.titulo')} cargando={cargando}>
          <TableHeader>
            <TableRow>
              <TableHead>{t('auditoria.fecha')}</TableHead>
              <TableHead>{t('auditoria.accion')}</TableHead>
              <TableHead>{t('auditoria.recurso')}</TableHead>
              <TableHead>{t('auditoria.usuario')}</TableHead>
              <TableHead>{t('auditoria.ip')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cargando ? (
              <TableEmpty colSpan={5}>{t('app.cargando')}</TableEmpty>
            ) : registros.length === 0 ? (
              <TableEmpty colSpan={5}>
                <span className="inline-flex flex-col items-center gap-2">
                  <ScrollText className="size-5 text-faint" aria-hidden />
                  {t('auditoria.sinRegistros')}
                </span>
              </TableEmpty>
            ) : (
              visibles.map((registro) => (
                <TableRow key={registro.id}>
                  <TableCell className="nums text-[13px]">
                    {fechaHora(registro.created_at)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="neutral">{registro.accion}</Badge>
                  </TableCell>
                  <TableCell className="nums text-[13px] text-muted">{registro.recurso}</TableCell>
                  <TableCell className="nums text-xs text-muted">
                    {registro.usuario_id ? `${registro.usuario_id.slice(0, 8)}…` : '—'}
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
    </div>
  )
}
