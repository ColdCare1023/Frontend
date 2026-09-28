import { cn } from '@/lib/utils'

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
}

export function Table({ className, titulo, cargando, children, ...props }: TableProps) {
  return (
    <div
      // El contenedor con scroll horizontal debe ser alcanzable por teclado:
      // sin `tabindex`, en móvil la tabla se desplaza con el dedo pero no con
      // el tabulador ni las flechas (WCAG 2.1.1).
      tabIndex={0}
      role="region"
      aria-label={titulo}
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
      className="w-full overflow-x-auto rounded-(--radius-card) border border-border bg-surface shadow-(--shadow-card) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <table className={cn('w-full min-w-[560px] caption-bottom text-sm', className)} {...props}>
        {titulo && <caption className="sr-only">{titulo}</caption>}
        {children}
      </table>
    </div>
  )
}

export function TableHeader({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn('border-b border-border bg-cream-100/70', className)} {...props} />
}

export function TableBody({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn('divide-y divide-border', className)} {...props} />
}

export function TableRow({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn('transition-colors duration-100 hover:bg-cream-100/60', className)}
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
      scope={scope}
      className={cn(
        'h-11 px-4 text-left align-middle text-sm leading-5 font-semibold text-muted',
        className,
      )}
      {...props}
    />
  )
}

export function TableCell({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn('px-4 py-3 align-middle text-foreground', className)} {...props} />
}

export function TableEmpty({ colSpan, children }: { colSpan: number; children: React.ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-12 text-center text-sm text-muted">
        {children}
      </td>
    </tr>
  )
}
