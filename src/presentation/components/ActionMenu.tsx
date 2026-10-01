import { Children, isValidElement, type ReactNode } from 'react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { ChevronDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from './ui/button'

/** Row actions remain labelled, keyboard reachable and outside table clipping. */
export function ActionMenu({ children, label }: { children: ReactNode; label?: string }) {
  const { i18n } = useTranslation()
  const text = i18n.resolvedLanguage?.startsWith('en') ? 'Options' : 'Opciones'
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button variant="ghost" size="sm" aria-label={label ? `${text}: ${label}` : text} className="min-w-24 border border-border bg-surface text-foreground">
          {text}<ChevronDown className="size-3.5" aria-hidden />
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content aria-label={label ? `${text}: ${label}` : text} align="end" sideOffset={6} collisionPadding={12} className="z-50 max-h-[min(28rem,var(--radix-dropdown-menu-content-available-height))] w-72 max-w-[calc(100vw-24px)] overflow-y-auto rounded-(--radius-field) border border-border bg-surface p-1.5 shadow-(--shadow-raised) [&_button]:h-auto [&_button]:min-h-11 [&_button]:w-full [&_button]:justify-start [&_button]:whitespace-normal [&_button]:border-0 [&_button]:bg-transparent [&_button]:px-3 [&_button]:py-2.5 [&_button]:text-left [&_button]:text-sm [&_button]:shadow-none [&_button]:hover:translate-y-0 [&_button]:data-[highlighted]:bg-primary-tint">
          {Children.toArray(children).filter(isValidElement).map((child, index) => (
            <DropdownMenu.Item key={index} disabled={Boolean((child.props as { disabled?: boolean }).disabled)} asChild>{child}</DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
