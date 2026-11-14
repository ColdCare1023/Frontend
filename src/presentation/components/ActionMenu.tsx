import { Children, isValidElement, type ReactElement, type ReactNode } from 'react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { ChevronDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from './ui/button'

/**
 * Section heading inside an ActionMenu. Groups related actions (equipment,
 * security, demo) so a long menu reads as a few short lists.
 */
export function ActionMenuLabel({ children }: { children: ReactNode }) {
  return <>{children}</>
}

/** Visual break between groups; place it before destructive actions. */
export function ActionMenuSeparator() {
  return null
}

function esTipo(child: ReactElement, tipo: unknown) {
  return child.type === tipo
}

/**
 * Row actions remain labelled, keyboard reachable and outside table clipping.
 *
 * Children are `Button`s (each becomes a menu item), plus optional
 * `ActionMenuLabel` and `ActionMenuSeparator`. A button with `data-peligro`
 * is drawn in the danger tone (revoke, deactivate, decommission).
 */
export function ActionMenu({ children, label }: { children: ReactNode; label?: string }) {
  const { t } = useTranslation()
  const text = t('comunes.acciones')
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button variant="secondary" size="sm" aria-label={label ? `${text}: ${label}` : text} className="min-w-24 data-[state=open]:border-border-field data-[state=open]:bg-neutral-200/60">
          {text}<ChevronDown className="size-3.5" aria-hidden />
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content aria-label={label ? `${text}: ${label}` : text} align="end" sideOffset={6} collisionPadding={12} className="z-50 max-h-[min(28rem,var(--radix-dropdown-menu-content-available-height))] w-72 max-w-[calc(100vw-24px)] origin-(--radix-dropdown-menu-content-transform-origin) overflow-y-auto cristal rounded-(--radius-card) border p-1.5 data-[state=open]:animate-(--animate-pop-in) data-[state=closed]:animate-(--animate-pop-out) [&_button]:h-auto [&_button]:min-h-10 [&_button]:w-full [&_button]:justify-start [&_button]:whitespace-normal [&_button]:rounded-md [&_button]:border-0 [&_button]:bg-transparent [&_button]:px-3 [&_button]:py-2 [&_button]:text-left [&_button]:text-sm [&_button]:font-normal [&_button]:text-foreground [&_button]:shadow-none [&_button]:active:scale-100 [&_button]:data-[highlighted]:bg-neutral-200/70 [&_button]:data-[highlighted]:outline-none [&_button[data-peligro]]:text-danger-700 [&_button[data-peligro]]:data-[highlighted]:bg-danger-100 pointer-coarse:[&_button]:min-h-11">
          {Children.toArray(children).filter(isValidElement).map((child, index) => {
            if (esTipo(child, ActionMenuLabel)) {
              return (
                <DropdownMenu.Label key={index} className="px-3 pt-2 pb-1 text-xs font-medium text-faint first:pt-1">
                  {(child.props as { children: ReactNode }).children}
                </DropdownMenu.Label>
              )
            }
            if (esTipo(child, ActionMenuSeparator)) {
              return <DropdownMenu.Separator key={index} className="-mx-1.5 my-1.5 h-px bg-border" />
            }
            return (
              <DropdownMenu.Item key={index} disabled={Boolean((child.props as { disabled?: boolean }).disabled)} asChild>{child}</DropdownMenu.Item>
            )
          })}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
