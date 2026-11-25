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
    <details open={open} className={cn('superficie min-w-0 self-start', className)}>
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 rounded-[inherit] px-4 py-3 text-body font-medium text-subtle hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
        {titulo}
        <ChevronDown aria-hidden className="size-4 shrink-0 text-muted [details[open]>summary>&]:rotate-180" />
      </summary>
      <div className="space-y-3 border-t border-border p-3 sm:p-4">{children}</div>
    </details>
  )
}
