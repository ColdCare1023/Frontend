import type { ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'

import { cn } from '@/lib/utils'

/** Conserva el contenido y sus controles; el resumen admite teclado y lector de pantalla. */
export function SeccionDetalle({ titulo, children, className, open }: {
  titulo: string
  children: ReactNode
  className?: string
  open?: boolean
}) {
  return (
    <details open={open} className={cn('min-w-0 self-start border-b border-border open:border-transparent', className)}>
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-(--radius-field) px-2 py-2 text-body font-medium text-subtle hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
        {titulo}
        <ChevronDown aria-hidden className="size-4 shrink-0 text-muted [details[open]>summary>&]:rotate-180" />
      </summary>
      <div className="mt-1 space-y-3 pb-3">{children}</div>
    </details>
  )
}
