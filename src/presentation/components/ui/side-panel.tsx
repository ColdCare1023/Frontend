import * as DialogPrimitive from '@radix-ui/react-dialog'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'

import { cn } from '@/lib/utils'

/**
 * Side panel: a dialog anchored to the right edge for tasks that need more
 * room than a centered modal but should keep the list visible behind it
 * (corrective action from an alert row, device details). Built on the same
 * Radix dialog, so focus trap, Escape, labelling and scroll lock are shared.
 */
export const SidePanel = DialogPrimitive.Root
export const SidePanelTrigger = DialogPrimitive.Trigger
export const SidePanelClose = DialogPrimitive.Close

export function SidePanelContent({
  className,
  children,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>) {
  const { t } = useTranslation()
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-overlay/40 data-[state=open]:animate-fade data-[state=closed]:animate-fade-out" />
      <DialogPrimitive.Content
        className={cn(
          'fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-border bg-surface shadow-(--shadow-lift) focus:outline-none',
          'pb-[env(safe-area-inset-bottom)] sm:max-w-lg',
          'data-[state=open]:animate-(--animate-panel-in) data-[state=closed]:animate-(--animate-panel-out)',
          className,
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close
          className="absolute right-3 top-3 flex size-9 cursor-pointer items-center justify-center rounded-lg text-muted transition-colors duration-(--duration-micro) hover:bg-neutral-200 hover:text-foreground max-sm:size-11 pointer-coarse:size-11"
          aria-label={t('comunes.cerrar')}
        >
          <X className="size-4" aria-hidden />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
}

/** Fixed header: title and optional description, padded away from the close button. */
export function SidePanelHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('shrink-0 border-b border-border px-5 pt-5 pb-4 pr-14 sm:px-6', className)} {...props} />
}

/** Scrollable body. */
export function SidePanelBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6', className)} {...props} />
}

/** Footer for the primary and secondary actions, always visible. */
export function SidePanelFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex shrink-0 flex-col-reverse gap-2 border-t border-border px-5 py-4 sm:flex-row sm:justify-end sm:px-6', className)}
      {...props}
    />
  )
}

export function SidePanelTitle({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      className={cn('font-display text-lg leading-7 font-semibold tracking-tight text-foreground', className)}
      {...props}
    />
  )
}

export function SidePanelDescription({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>) {
  return <DialogPrimitive.Description className={cn('mt-1 text-sm leading-5 text-muted', className)} {...props} />
}
