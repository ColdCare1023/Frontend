import { Fragment, useMemo, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown } from 'lucide-react'

import { agruparPorDia } from '@/lib/agruparPorDia'
import { etiquetaDia, fechaCorta } from '@/lib/formato'
import { cn } from '@/lib/utils'
import { Button } from '../ui/button'
import { Table, TableBody, TableHeader, TableRow } from '../ui/table'
import { idBotonFila, idDetalleFila } from './ids'


/**
 * Tabla de registros (Historial, Bitácora, Integridad): agrupada por día
 * con una cabecera `th scope="colgroup"` por día, filas expandibles en
 * acordeón (una a la vez) y lista compacta bajo 640 px.
 *
 * El botón de la última celda es el control accesible (`aria-expanded`,
 * `aria-controls`); el clic en la fila es un atajo para el puntero que se
 * ignora si cae sobre otro control. Escape dentro del detalle lo cierra y
 * devuelve el foco al botón. El detalle solo se monta mientras está abierto.
 */
export function TablaRegistros<T>({
  titulo,
  encabezados,
  columnas,
  filas,
  clave,
  fechaDe,
  resumenDia,
  renderCeldas,
  renderDetalle,
  etiquetaBoton,
  expandida,
  onExpandir,
  marca,
  propsFila,
  cargando,
  className,
}: {
  titulo: string
  /** Celdas `<th>` (sin la del detalle, que añade la tabla). */
  encabezados: ReactNode
  /** Número de columnas de datos visibles (sin contar la del detalle). */
  columnas: number
  filas: readonly T[]
  clave: (fila: T) => string
  fechaDe: (fila: T) => string
  /** Resumen del día completo (no solo de la página) a la derecha de la cabecera. */
  resumenDia?: (claveDia: string) => ReactNode
  renderCeldas: (fila: T) => ReactNode
  renderDetalle: (fila: T) => ReactNode
  etiquetaBoton: (fila: T, abierta: boolean) => string
  expandida: string | null
  onExpandir: (id: string | null) => void
  marca?: (fila: T) => 'corrupta' | undefined
  propsFila?: (fila: T) => Record<string, string | undefined>
  cargando?: boolean
  className?: string
}) {
  const { t } = useTranslation()
  const grupos = useMemo(() => agruparPorDia(filas, fechaDe), [filas, fechaDe])
  const total = columnas + 1

  const cerrarYEnfocar = (id: string) => {
    onExpandir(null)
    requestAnimationFrame(() => document.getElementById(idBotonFila(id))?.focus())
  }

  return (
    <Table
      titulo={titulo}
      cargando={cargando}
      mobileLayout="list"
      className={cn('table-fixed min-w-[600px] sm:min-w-0', className)}
    >
      <TableHeader>
        <TableRow>
          {encabezados}
          <th scope="col" className="w-12">
            <span className="sr-only">{t('comunes.verDetalleFila')}</span>
          </th>
        </TableRow>
      </TableHeader>
      <TableBody
        data-cargando={cargando || undefined}
        className="transition-opacity duration-(--duration-pop) data-[cargando]:opacity-60"
      >
        {grupos.map((grupo) => (
          <Fragment key={`${grupo.clave}-${clave(grupo.filas[0])}`}>
            <tr data-grupo>
              <th
                scope="colgroup"
                colSpan={total}
                className="h-9 border-y border-border bg-surface-sunken px-4 text-left align-middle font-normal"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-meta font-medium text-subtle">
                    {etiquetaDia(grupo.iso, t)}
                    <span className="nums font-normal text-muted"> · {fechaCorta(grupo.iso)}</span>
                  </span>
                  {resumenDia && <span className="nums truncate text-meta text-muted">{resumenDia(grupo.clave)}</span>}
                </div>
              </th>
            </tr>
            {grupo.filas.map((fila) => {
              const id = clave(fila)
              const abierta = expandida === id
              const tipoMarca = marca?.(fila)
              return (
                <Fragment key={id}>
                  <tr
                    role="row"
                    data-fila
                    data-expandida={abierta || undefined}
                    data-marca={tipoMarca}
                    {...propsFila?.(fila)}
                    onClick={(evento) => {
                      const destino = evento.target as HTMLElement
                      if (destino.closest('button, a, input, select, textarea, [role="button"]')) return
                      onExpandir(abierta ? null : id)
                    }}
                    className={cn(
                      'group cursor-pointer border-t border-border transition-colors duration-(--duration-micro) hover:bg-surface-hover',
                      abierta && 'bg-primary-tint hover:bg-primary-tint [&>td:first-child]:shadow-[inset_2px_0_0_var(--color-primary)]',
                      tipoMarca === 'corrupta' &&
                        'bg-critical-tint hover:bg-critical-tint [&>td:first-child]:shadow-[inset_3px_0_0_var(--color-critical)]',
                    )}
                  >
                    {renderCeldas(fila)}
                    <td role="cell" data-area="d" className="py-1.5 pr-2 text-right align-middle">
                      <Button
                        id={idBotonFila(id)}
                        variant="ghost"
                        size="sm"
                        className="w-8 px-0 sm:h-8 text-muted max-sm:w-11 pointer-coarse:w-11 sm:pointer-coarse:h-11"
                        aria-expanded={abierta}
                        aria-controls={abierta ? idDetalleFila(id) : undefined}
                        aria-label={etiquetaBoton(fila, abierta)}
                        onClick={() => onExpandir(abierta ? null : id)}
                      >
                        <ChevronDown
                          aria-hidden
                          className={cn('size-4 transition-transform duration-(--duration-ui) ease-(--ease-out)', abierta && 'rotate-180')}
                        />
                      </Button>
                    </td>
                  </tr>
                  {abierta && (
                    <tr data-detalle id={idDetalleFila(id)}>
                      <td colSpan={total} className="p-0">
                        <div className="fila-detalle">
                          <div className="min-h-0 overflow-hidden">
                            <div
                              onKeyDown={(evento) => {
                                if (evento.key !== 'Escape') return
                                evento.stopPropagation()
                                cerrarYEnfocar(id)
                              }}
                              className="border-t border-border bg-surface-sunken px-4 py-3 sm:px-6"
                            >
                              {renderDetalle(fila)}
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </Fragment>
        ))}
      </TableBody>
    </Table>
  )
}

/** Celda de datos de una fila de registros (alto 44/56 px, relleno compacto). */
export function CeldaRegistro({
  area,
  className,
  children,
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement> & { area?: 'a' | 'b' | 'c' | 'oculta' }) {
  return (
    <td role="cell" data-area={area} className={cn('px-3 py-2.5 align-middle first:pl-4', className)} {...props}>
      {children}
    </td>
  )
}

/** Encabezado compacto de las tablas de registros. */
export function EncabezadoRegistro({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      scope="col"
      className={cn('h-10 px-3 text-left align-middle text-meta font-medium text-faint first:pl-4', className)}
      {...props}
    />
  )
}
