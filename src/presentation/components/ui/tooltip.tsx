import * as TooltipPrimitive from '@radix-ui/react-tooltip'

import { cn } from '@/lib/utils'

export const TooltipProvider = TooltipPrimitive.Provider

/**
 * Tooltip accesible (Radix): aparece con foco de teclado y con el cursor, se
 * cierra con Escape y no sustituye al nombre accesible del control.
 */
export function Tooltip({
  contenido,
  lado = 'right',
  desactivado = false,
  children,
}: {
  contenido: React.ReactNode
  lado?: 'top' | 'right' | 'bottom' | 'left'
  desactivado?: boolean
  children: React.ReactElement
}) {
  if (desactivado) return children
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={lado}
          sideOffset={10}
          collisionPadding={8}
          className={cn(
            'cristal z-[70] rounded-md border px-2.5 py-1.5 text-xs font-medium text-foreground',
            'data-[state=delayed-open]:animate-(--animate-pop-in) data-[state=instant-open]:animate-(--animate-pop-in) data-[state=closed]:animate-(--animate-pop-out)',
          )}
        >
          {contenido}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  )
}
