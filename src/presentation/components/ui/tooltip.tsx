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
          sideOffset={8}
          collisionPadding={8}
          className={cn(
            'flotante z-[70] origin-(--radix-tooltip-content-transform-origin) rounded-(--radius-small) px-2 py-1 text-meta font-medium text-foreground',
            // Al cerrar, Radix debe desmontar la capa de inmediato para que Escape llegue al diálogo activo.
            'data-[state=delayed-open]:animate-(--animate-pop-in)',
          )}
        >
          {contenido}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  )
}
