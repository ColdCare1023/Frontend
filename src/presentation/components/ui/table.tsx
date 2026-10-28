import { cn } from '@/lib/utils'
import { useId, useLayoutEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MoveHorizontal } from 'lucide-react'

interface TableProps extends React.TableHTMLAttributes<HTMLTableElement> {
  /**
   * Nombre accesible de la tabla, expuesto como `<caption>` oculto.
   * Las páginas apilan varias tablas y listas; sin título, el lector de
   * pantalla las enumera todas como «tabla, 7 columnas» y no hay forma de
   * saber cuál se está recorriendo (WCAG 1.3.1).
   */
  titulo?: string
  /** Consulta en curso: marca la región como ocupada (WCAG 4.1.3). */
  cargando?: boolean
  mobileLayout?: 'scroll' | 'stack'
}

export function Table({ className, titulo, cargando, mobileLayout = 'scroll', children, ...props }: TableProps) {
  const { t } = useTranslation()
  const hintId = useId()
  const regionRef = useRef<HTMLDivElement>(null)
  const [overflowing, setOverflowing] = useState(false)
  useLayoutEffect(() => {
    const region = regionRef.current
    if (!region) return
    const update = () => setOverflowing(region.scrollWidth > region.clientWidth + 1)
    if (typeof ResizeObserver === 'undefined') {
      update()
      window.addEventListener('resize', update)
      return () => window.removeEventListener('resize', update)
    }
    const observer = new ResizeObserver(update)
    observer.observe(region)
    const table = region.querySelector('table')
    if (table) observer.observe(table)
    update()
    return () => observer.disconnect()
  }, [])
  return (
    <div className={cn('coldcare-data-surface', mobileLayout === 'stack' && 'coldcare-data-stack')}>
      {overflowing && <p id={hintId} className="mb-2 flex items-center gap-2 text-xs text-faint"><MoveHorizontal aria-hidden className="size-4" />{t('comunes.deslizarTabla')}</p>}
    <div
      ref={regionRef}
      // El contenedor con scroll horizontal debe ser alcanzable por teclado:
      // sin `tabindex`, en móvil la tabla se desplaza con el dedo pero no con
      // el tabulador ni las flechas (WCAG 2.1.1).
      tabIndex={0}
      role="region"
      aria-label={titulo}
      aria-describedby={overflowing ? hintId : undefined}
      aria-keyshortcuts="ArrowLeft ArrowRight Home End"
      aria-busy={cargando || undefined}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return
        const region = event.currentTarget
        const maxScroll = region.scrollWidth - region.clientWidth
        if (maxScroll <= 0) return
        const destinos: Record<string, number> = {
          ArrowLeft: region.scrollLeft - 48,
          ArrowRight: region.scrollLeft + 48,
          Home: 0,
          End: maxScroll,
        }
        const destino = destinos[event.key]
        if (destino === undefined) return
        event.preventDefault()
        region.scrollTo({ left: Math.max(0, Math.min(maxScroll, destino)), behavior: 'auto' })
      }}
      className="coldcare-table-region w-full overflow-x-auto rounded-(--radius-card) border border-border bg-surface shadow-(--shadow-card) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <table role="table" className={cn('w-full min-w-[640px] caption-bottom text-sm', className)} {...props}>
        {titulo && <caption className="sr-only">{titulo}</caption>}
        {children}
      </table>
    </div>
    </div>
  )
}

export function TableHeader({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead role="rowgroup" className={cn('border-b border-border bg-surface-sunken', className)} {...props} />
}

export function TableBody({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody role="rowgroup" className={cn('divide-y divide-border', className)} {...props} />
}

export function TableRow({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      role="row"
      className={cn('transition-colors duration-(--duration-micro) hover:bg-cream-200/45', className)}
      {...props}
    />
  )
}

export function TableHead({
  className,
  scope = 'col',
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      role="columnheader"
      scope={scope}
      className={cn(
        'h-10 px-3 py-2 text-left align-middle text-xs leading-4 font-medium tracking-[0.01em] text-muted sm:px-4',
        className,
      )}
      {...props}
    />
  )
}

export function TableCell({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td role="cell" className={cn('px-3 py-3 align-middle text-foreground sm:px-4', className)} {...props} />
}

export function TableEmpty({ colSpan, children }: { colSpan: number; children: React.ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="p-0 text-sm text-muted">
        <div className="sticky left-0 flex w-[min(100%,calc(100vw-2rem))] items-center justify-center px-4 py-8 text-center sm:static sm:w-full">
          {children}
        </div>
      </td>
    </tr>
  )
}
