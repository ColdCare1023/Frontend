import { Children, isValidElement, type ReactNode } from 'react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { ChevronDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from './ui/button'

/** Row actions remain labelled, keyboard reachable and outside table clipping. */
export function ActionMenu({ children, label }: { children: ReactNode; label?: string }) {
  const { t } = useTranslation()
  const text = t('comunes.acciones')
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button variant="secondary" size="sm" aria-label={label ? `${text}: ${label}` : text} className="min-w-24 data-[state=open]:border-border-field data-[state=open]:bg-cream-200/60">
          {text}<ChevronDown className="size-3.5" aria-hidden />
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content aria-label={label ? `${text}: ${label}` : text} align="end" sideOffset={6} collisionPadding={12} className="z-50 max-h-[min(28rem,var(--radix-dropdown-menu-content-available-height))] w-72 max-w-[calc(100vw-24px)] origin-(--radix-dropdown-menu-content-transform-origin) overflow-y-auto rounded-(--radius-card) border border-border bg-surface-raised p-1.5 shadow-(--shadow-raised) data-[state=open]:animate-(--animate-pop-in) data-[state=closed]:animate-(--animate-pop-out) [&_button]:h-auto [&_button]:min-h-10 [&_button]:w-full [&_button]:justify-start [&_button]:whitespace-normal [&_button]:rounded-md [&_button]:border-0 [&_button]:bg-transparent [&_button]:px-3 [&_button]:py-2 [&_button]:text-left [&_button]:text-sm [&_button]:font-normal [&_button]:text-foreground [&_button]:shadow-none [&_button]:active:scale-100 [&_button]:data-[highlighted]:bg-cream-200/70 [&_button]:data-[highlighted]:outline-none pointer-coarse:[&_button]:min-h-11">
          {Children.toArray(children).filter(isValidElement).map((child, index) => (
            <DropdownMenu.Item key={index} disabled={Boolean((child.props as { disabled?: boolean }).disabled)} asChild>{child}</DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
